import {
    ARTBOARD_SIZE,
    MAX_ELLIPSES,
    buildGlobalScene,
    centerElementIds,
    constrainSettings,
    coreElementIds,
    defaultSettings,
    geometryControlLimits,
    visibleElementIds
} from './geometry/globalGeometry.js';
import { HistoryManager } from './core/history.js';
import { DEFAULT_PRESET_NAME, PresetManager, SEEDED_PRESETS } from './core/presets.js';
import { renderSceneToSvg, sceneToSvgString } from './render/globalRenderer.js';
import { PanelManager } from './ui/PanelManager.js';
import { ZoomPanManager } from './ui/ZoomPanManager.js';
import { AnimationExporter } from './export/AnimationExporter.js';

const clone = (value) => structuredClone(value);
const pad = (value) => String(value).padStart(2, '0');
const SPHERE_SESSION_KEY = 'yfToolsSphereSessionV1';
const DEFAULT_PRESET_VERSION = 2;
const isEditable = (target) => target instanceof Element
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

export function rotationPreviewOffsets(
    progress,
    axis = 'x',
    degrees = 360,
    easing = 'smootherstep'
) {
    const time = Math.min(1, Math.max(0, Number(progress) || 0));
    const eased = easing === 'linear'
        ? time
        : time * time * time * (time * (time * 6 - 15) + 10);
    const angle = Number(degrees) * eased;
    return {
        rotationX: axis === 'x' ? angle : 0,
        rotationY: axis === 'y' ? angle : 0,
        rotationZ: axis === 'z' ? angle : 0
    };
}

export function rotationControlValue(value) {
    return ((Number(value) + 180) % 360 + 360) % 360 - 180;
}

function exportBaseName(date = new Date()) {
    return `global_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
        + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(text, filename, type = 'text/plain;charset=utf-8') {
    downloadBlob(new Blob([text], { type }), filename);
}

function encodeState(state) {
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeState(value) {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
}

export class GlobalApp {
    constructor() {
        this.svg = document.getElementById('mainSvg');
        this.canvas = document.getElementById('canvasContainer');
        const defaults = defaultSettings();
        this.presetManager = new PresetManager(defaults);
        this.settings = constrainSettings(this.presetManager.get(DEFAULT_PRESET_NAME) || defaults);
        this.scene = null;
        this.selectedIds = new Set();
        this.selectionMode = 'relative';
        this.transientMagnet = null;
        this.renderFrame = null;
        this.animationFrame = null;
        this.animationStartedAt = performance.now();
        this.animationElapsed = 0;
        this.animationPlaying = true;
        this.rotationPreview = null;
        this.rotationPreviewFrame = null;
        this.rotationDrag = null;
        this.history = new HistoryManager(this.settings, { limit: 100, debounceMs: 160 });
        this.panels = new PanelManager([
            'geometryPanel', 'transformPanel', 'colorsPanel', 'magnetPanel'
        ]);
        this.zoom = new ZoomPanManager(
            this.canvas,
            this.svg,
            document.getElementById('zoomDisplay')
        );
        this.animationExporter = new AnimationExporter({
            container: document.getElementById('exportActions'),
            status: document.getElementById('exportStatus'),
            progress: document.getElementById('exportProgress'),
            message: document.getElementById('exportMessage'),
            cancelButton: document.getElementById('cancelExport'),
            buttons: [document.getElementById('exportPng'), document.getElementById('exportPrimary')],
            onError: (error) => this.alert('Export failed', error.message)
        });
    }

    init() {
        this.loadSessionState();
        this.bindControls();
        this.bindCanvas();
        this.bindPresetControls();
        this.bindHelp();
        this.bindShortcuts();
        this.bindExports();
        this.bindRotationPreview();
        this.loadSharedState();
        this.syncControls();
        this.renderNow();
        this.syncAnimationLoop();
        document.documentElement.classList.remove('global-initializing');
        return this;
    }

    snapshot() {
        return clone(this.settings);
    }

    exportSnapshot() {
        const snapshot = this.snapshot();
        if (this.transientMagnet) {
            snapshot.magnetX = this.transientMagnet.x;
            snapshot.magnetY = this.transientMagnet.y;
        }
        snapshot.magnetFollow = false;
        return snapshot;
    }

    replaceSettings(next, { resetHistory = false, markDirty = false } = {}) {
        this.stopRotationPreview({ render: false });
        this.settings = constrainSettings(next);
        this.selectedIds.clear();
        this.transientMagnet = null;
        this.animationElapsed = 0;
        this.animationStartedAt = performance.now();
        if (resetHistory) this.history.reset(this.settings);
        if (markDirty) this.presetManager.markDirty();
        this.saveSessionState();
        this.syncControls();
        this.renderNow();
        this.syncAnimationLoop();
    }

    update(patch, { history = true, dirty = true, render = true } = {}) {
        this.stopRotationPreview({ render: false });
        Object.assign(this.settings, patch);
        this.settings = constrainSettings(this.settings);
        if (history) this.history.schedule(this.settings);
        if (dirty) this.presetManager.markDirty();
        this.saveSessionState();
        if (render) this.requestRender();
        this.syncPresetChrome();
    }

    requestRender() {
        if (this.renderFrame != null) return;
        this.renderFrame = requestAnimationFrame(() => {
            this.renderFrame = null;
            this.renderNow();
        });
    }

    currentAnimationTime() {
        if (this.settings.animationMode !== 'grow') return 0;
        const elapsed = this.animationPlaying
            ? this.animationElapsed + performance.now() - this.animationStartedAt
            : this.animationElapsed;
        return elapsed / 1000;
    }

    buildScene() {
        const previewOffsets = this.rotationPreview?.offsets || {};
        return buildGlobalScene(this.settings, {
            timeSeconds: this.currentAnimationTime(),
            transientMagnet: this.transientMagnet,
            ...previewOffsets
        });
    }

    renderNow() {
        this.scene = this.buildScene();
        renderSceneToSvg(this.svg, this.scene);
        document.documentElement.style.setProperty('--bg', this.settings.backgroundColor);
        this.syncSelectionUI();
    }

    normalizeRangeValue(range, rawValue) {
        const parsed = Number(String(rawValue).trim().replace(',', '.'));
        if (!Number.isFinite(parsed)) return Number(range.value);
        const min = Number(range.min);
        const max = Number(range.max);
        const step = Number(range.step) || 1;
        const clamped = Math.min(max, Math.max(min, parsed));
        const snapped = min + Math.round((clamped - min) / step) * step;
        const decimals = step < 1 ? String(step).split('.')[1]?.length || 0 : 0;
        return Number(snapped.toFixed(decimals));
    }

    bindRangeValueInput(range, valueInput, onCommit) {
        if (!valueInput) return;
        const commit = (rawValue = valueInput.value) => {
            const value = this.normalizeRangeValue(range, rawValue);
            range.value = String(value);
            valueInput.value = String(value);
            onCommit(value);
        };
        valueInput.addEventListener('focus', () => valueInput.select());
        valueInput.addEventListener('blur', () => commit());
        valueInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                valueInput.blur();
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                valueInput.value = range.value;
                valueInput.blur();
                return;
            }
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            const direction = event.key === 'ArrowUp' ? 1 : -1;
            const step = (Number(range.step) || 1) * (event.shiftKey ? 10 : 1);
            const current = Number(String(valueInput.value).replace(',', '.'));
            commit((Number.isFinite(current) ? current : Number(range.value)) + direction * step);
            valueInput.select();
        });
    }

    bindControls() {
        document.querySelectorAll('[data-setting]').forEach((input) => {
            const key = input.dataset.setting;
            const output = document.getElementById(`${input.id}Value`);
            const commit = (value) => {
                if (output) output.value = input.value;
                if (key === 'ellipseCount') {
                    const fromInput = document.getElementById('animationFrom');
                    if (this.settings.animationFrom >= value) {
                        this.settings.animationFrom = Math.max(1, value - 1);
                        fromInput.value = String(this.settings.animationFrom);
                        document.getElementById('animationFromValue').value = String(this.settings.animationFrom);
                    }
                }
                this.update({ [key]: value });
                if (key === 'magnetFollow' || (key === 'magnetStrength' && Number(value) <= 0)) {
                    this.transientMagnet = null;
                }
                this.syncControls();
            };
            input.addEventListener('input', () => {
                commit(input.type === 'checkbox' ? input.checked : Number(input.value));
            });
            if (input.type === 'range') this.bindRangeValueInput(input, output, commit);
        });

        document.querySelectorAll('[data-color-setting]').forEach((input) => {
            const key = input.dataset.colorSetting;
            const apply = () => {
                if (!/^#[0-9a-f]{6}$/i.test(input.value)) return;
                this.update({ [key]: input.value.toLowerCase() });
                this.syncColors();
            };
            input.addEventListener('change', apply);
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    apply();
                    input.blur();
                }
            });
        });

        document.querySelectorAll('input[name="animationMode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                this.update({ animationMode: input.value });
                this.animationElapsed = 0;
                this.animationStartedAt = performance.now();
                this.animationPlaying = true;
                this.syncAnimationUI();
                this.syncAnimationLoop();
            });
        });

        document.querySelectorAll('input[name="topologyMode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                this.update({ topologyMode: input.value });
                this.syncControls();
            });
        });

        document.getElementById('centerMagnet').addEventListener('click', () => {
            this.transientMagnet = null;
            this.update({ magnetFollow: false, magnetX: 240, magnetY: 240 });
            this.syncControls();
        });

        document.getElementById('resetTransform').addEventListener('click', () => {
            const alreadyReset = ['rotationX', 'rotationY', 'rotationZ']
                .every((key) => Number(this.settings[key]) === 0);
            if (alreadyReset) {
                this.stopRotationPreview();
                return;
            }
            this.update({ rotationX: 0, rotationY: 0, rotationZ: 0 });
            this.syncControls();
        });
    }

    bindRotationPreview() {
        document.getElementById('rotationPreviewButton').addEventListener('click', () => {
            if (this.rotationPreview) this.stopRotationPreview();
            else this.startRotationPreview();
        });
    }

    startRotationPreview() {
        this.stopRotationPreview({ render: false });
        const button = document.getElementById('rotationPreviewButton');
        const startedAt = performance.now();
        const { axis, degrees, duration, easing } = this.settings.rotationAnimation;
        const durationMs = duration * 1000;
        this.rotationPreview = {
            axis,
            degrees,
            duration,
            easing,
            offsets: rotationPreviewOffsets(0, axis, degrees, easing)
        };
        button.classList.add('is-playing');
        button.setAttribute('aria-pressed', 'true');
        button.textContent = '■';

        const tick = (time) => {
            const progress = Math.min(1, (time - startedAt) / durationMs);
            this.rotationPreview.offsets = rotationPreviewOffsets(progress, axis, degrees, easing);
            this.syncRotationControls();
            this.renderNow();
            if (progress < 1) {
                this.rotationPreviewFrame = requestAnimationFrame(tick);
                return;
            }
            this.rotationPreview = null;
            this.rotationPreviewFrame = null;
            button.classList.remove('is-playing');
            button.setAttribute('aria-pressed', 'false');
            button.textContent = '▶';
            this.syncRotationControls();
            this.renderNow();
        };
        this.rotationPreviewFrame = requestAnimationFrame(tick);
    }

    stopRotationPreview({ render = true } = {}) {
        if (this.rotationPreviewFrame != null) cancelAnimationFrame(this.rotationPreviewFrame);
        const wasPlaying = Boolean(this.rotationPreview);
        this.rotationPreview = null;
        this.rotationPreviewFrame = null;
        const button = document.getElementById('rotationPreviewButton');
        if (button) {
            button.classList.remove('is-playing');
            button.setAttribute('aria-pressed', 'false');
            button.textContent = '▶';
        }
        if (wasPlaying) this.syncRotationControls();
        if (render && wasPlaying) this.renderNow();
    }

    bindCanvas() {
        const preventSelection = (event) => event.preventDefault();
        this.canvas.addEventListener('selectstart', preventSelection);
        this.canvas.addEventListener('dragstart', preventSelection);
        this.canvas.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 || this.zoom.spaceDown) return;
            event.preventDefault();
            this.stopRotationPreview({ render: false });
            if (this.settings.magnetFollow && this.settings.magnetStrength > 0) {
                const point = this.clientToArtboard(event.clientX, event.clientY);
                if (point) {
                    this.transientMagnet = point;
                    this.syncMagnetPositionControls(point);
                    this.requestRender();
                }
            }
            this.rotationDrag = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                rotationX: this.settings.rotationX,
                rotationY: this.settings.rotationY,
                moved: false
            };
            this.history.begin(this.settings);
            this.canvas.setPointerCapture(event.pointerId);
        });

        this.canvas.addEventListener('pointermove', (event) => {
            if (this.rotationDrag && event.pointerId === this.rotationDrag.pointerId) {
                const dx = event.clientX - this.rotationDrag.startX;
                const dy = event.clientY - this.rotationDrag.startY;
                if (Math.hypot(dx, dy) > 3) this.rotationDrag.moved = true;
                if (this.rotationDrag.moved) {
                    this.settings.rotationX = this.rotationDrag.rotationX + dx * 0.42;
                    this.settings.rotationY = this.rotationDrag.rotationY - dy * 0.42;
                    this.presetManager.markDirty();
                    this.syncRotationControls();
                    this.requestRender();
                }
                return;
            }
            if (this.settings.magnetFollow && this.settings.magnetStrength > 0) {
                const point = this.clientToArtboard(event.clientX, event.clientY);
                if (point) {
                    this.transientMagnet = point;
                    this.syncMagnetPositionControls(point);
                    this.requestRender();
                }
            }
        });

        const finish = (event) => {
            const drag = this.rotationDrag;
            if (!drag || event.pointerId !== drag.pointerId) return;
            this.rotationDrag = null;
            this.canvas.releasePointerCapture?.(event.pointerId);
            if (drag.moved) {
                this.settings = constrainSettings(this.settings);
                this.history.end(this.settings);
                this.saveSessionState();
                this.syncPresetChrome();
            } else if (
                event.type === 'pointerup'
                && this.settings.magnetFollow
                && this.settings.magnetStrength > 0
            ) {
                const point = this.transientMagnet || this.clientToArtboard(event.clientX, event.clientY);
                if (point) {
                    this.settings = constrainSettings({
                        ...this.settings,
                        magnetX: Math.round(point.x),
                        magnetY: Math.round(point.y),
                        magnetFollow: false
                    });
                    this.transientMagnet = null;
                    this.presetManager.markDirty();
                    this.history.end(this.settings);
                    this.saveSessionState();
                    this.syncControls();
                    this.requestRender();
                    return;
                }
                this.history.end(this.settings);
            } else {
                this.history.end(this.settings);
            }
        };
        this.canvas.addEventListener('pointerup', finish);
        this.canvas.addEventListener('pointercancel', finish);
        this.canvas.addEventListener('pointerleave', () => {
            if (this.settings.magnetFollow && !this.rotationDrag) {
                this.transientMagnet = null;
                this.syncMagnetPositionControls();
                this.requestRender();
            }
        });
    }

    clientToArtboard(clientX, clientY) {
        const ctm = this.svg.getScreenCTM();
        if (!ctm) return null;
        const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
        return {
            x: Math.max(0, Math.min(ARTBOARD_SIZE, point.x)),
            y: Math.max(0, Math.min(ARTBOARD_SIZE, point.y))
        };
    }

    selectEllipse(id, additive = false) {
        if (!additive) this.selectedIds.clear();
        if (id) {
            if (additive && this.selectedIds.has(id)) this.selectedIds.delete(id);
            else this.selectedIds.add(id);
        }
        this.renderNow();
    }

    selectIds(ids) {
        this.selectedIds = new Set(ids);
        this.renderNow();
    }

    bindSelectionControls() {
        document.getElementById('clearSelection').addEventListener('click', () => this.selectIds([]));
        document.getElementById('selectCenter').addEventListener('click', () => this.selectIds(centerElementIds(this.scene)));
        document.getElementById('selectCore').addEventListener('click', () => this.selectIds(coreElementIds(this.scene)));
        document.getElementById('selectVisible').addEventListener('click', () => this.selectIds(visibleElementIds(this.scene)));

        document.querySelectorAll('input[name="sizeMode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                this.selectionMode = input.value;
                if (this.selectedIds.size) this.applySelectedSize(this.selectionMode === 'fixed' ? this.settings.diameter : 100);
                this.syncSelectionUI();
            });
        });

        const size = document.getElementById('selectedSize');
        size.addEventListener('input', () => this.applySelectedSize(Number(size.value)));
        this.bindRangeValueInput(size, document.getElementById('selectedSizeValue'), (value) => {
            this.applySelectedSize(value);
        });
    }

    applySelectedSize(value) {
        if (!this.selectedIds.size) return;
        const overrides = clone(this.settings.overrides);
        this.selectedIds.forEach((id) => {
            overrides[id] = { mode: this.selectionMode, value };
        });
        this.update({ overrides });
        this.syncSelectionUI();
    }

    syncSelectionUI() {
        const count = this.selectedIds.size;
        document.getElementById('selectionCount').textContent = count ? `${count} selected` : 'None selected';
        const slider = document.getElementById('selectedSize');
        slider.disabled = count === 0;
        const label = document.getElementById('selectedSizeLabel');
        const output = document.getElementById('selectedSizeValue');
        output.disabled = count === 0;
        slider.min = '0';
        slider.max = this.selectionMode === 'fixed' ? '480' : '400';
        const firstId = this.selectedIds.values().next().value;
        const override = firstId ? this.settings.overrides[firstId] : null;
        const value = override?.mode === this.selectionMode
            ? Number(override.value)
            : this.selectionMode === 'fixed' ? this.settings.diameter : 100;
        slider.value = String(value);
        output.value = String(Math.round(value));
        label.innerHTML = this.selectionMode === 'fixed'
            ? 'Size <span class="unit">px</span>'
            : 'Size <span class="unit">%</span>';
    }

    bindPresetControls() {
        const toggle = document.getElementById('presetToggle');
        const list = document.getElementById('presetList');
        toggle.addEventListener('click', () => {
            const open = toggle.getAttribute('aria-expanded') !== 'true';
            toggle.setAttribute('aria-expanded', String(open));
            list.hidden = !open;
            if (open) this.renderPresetList();
        });
        document.addEventListener('pointerdown', (event) => {
            if (!document.getElementById('presetMenu').contains(event.target)) this.closePresetMenu();
        });
        document.getElementById('savePresetButton').addEventListener('click', () => this.savePreset());
        document.getElementById('shareButton').addEventListener('click', () => this.share());
    }

    renderPresetList() {
        const list = document.getElementById('presetList');
        list.replaceChildren();
        this.presetManager.names().forEach((name) => {
            const builtIn = Boolean(SEEDED_PRESETS[name]);
            const row = document.createElement('div');
            row.className = `preset-entry${builtIn ? '' : ' has-actions'}${name === this.presetManager.currentName ? ' is-active' : ''}`;
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', String(name === this.presetManager.currentName));
            const label = document.createElement('button');
            label.type = 'button';
            label.className = 'preset-row';
            label.textContent = name;
            label.addEventListener('click', () => this.openPreset(name));
            row.appendChild(label);
            if (!builtIn) {
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'preset-delete';
                remove.textContent = '×';
                remove.setAttribute('aria-label', `Delete ${name}`);
                remove.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    if (await this.confirm('Delete preset?', `${name} will be removed.`)) {
                        this.presetManager.delete(name);
                        this.renderPresetList();
                    }
                });
                row.appendChild(remove);
            }
            list.appendChild(row);
        });
        const newButton = document.createElement('button');
        newButton.type = 'button';
        newButton.className = 'preset-row preset-row--utility';
        newButton.textContent = '+ New preset';
        newButton.addEventListener('click', () => {
            this.presetManager.markClean('Untitled');
            this.replaceSettings(defaultSettings(), { resetHistory: true, markDirty: true });
            this.closePresetMenu();
        });
        list.appendChild(newButton);
    }

    async openPreset(name) {
        if (this.presetManager.dirty) {
            const proceed = await this.confirm('Discard changes?', 'The current unsaved changes will be lost.');
            if (!proceed) return;
        }
        const preset = this.presetManager.get(name);
        if (!preset) return;
        this.presetManager.markClean(name);
        this.replaceSettings(preset, { resetHistory: true });
        this.closePresetMenu();
    }

    closePresetMenu() {
        document.getElementById('presetToggle').setAttribute('aria-expanded', 'false');
        document.getElementById('presetList').hidden = true;
    }

    async savePreset() {
        const suggested = SEEDED_PRESETS[this.presetManager.currentName]
            ? `${this.presetManager.currentName} Copy`
            : this.presetManager.currentName === 'Untitled' ? 'My Global' : this.presetManager.currentName;
        const name = await this.prompt('Save preset', 'Choose a name for this state.', suggested);
        if (!name) return;
        if (!this.presetManager.save(name.trim(), this.settings)) {
            await this.alert('Choose another name', 'Built-in presets cannot be overwritten.');
            return;
        }
        this.syncPresetChrome();
    }

    syncPresetChrome() {
        const suffix = this.presetManager.dirty ? ' *' : '';
        document.getElementById('presetName').textContent = `${this.presetManager.currentName}${suffix}`;
        document.getElementById('savePresetButton').hidden = !this.presetManager.dirty;
    }

    async share() {
        const url = new URL(location.href);
        url.hash = `s=${encodeState(this.settings)}`;
        try {
            await navigator.clipboard.writeText(url.href);
            const button = document.getElementById('shareButton');
            button.classList.add('is-copied');
            button.setAttribute('aria-label', 'Link copied');
            setTimeout(() => {
                button.classList.remove('is-copied');
                button.setAttribute('aria-label', 'Copy share link');
            }, 900);
        } catch {
            await this.alert('Share link', url.href);
        }
    }

    loadSharedState() {
        if (!location.hash.startsWith('#s=')) return;
        try {
            this.settings = constrainSettings(decodeState(location.hash.slice(3)));
            this.presetManager.markClean('Shared');
            this.history.reset(this.settings);
            this.saveSessionState();
        } catch {
            history.replaceState(null, '', location.pathname + location.search);
        }
    }

    loadSessionState() {
        try {
            const saved = JSON.parse(sessionStorage.getItem(SPHERE_SESSION_KEY) || 'null');
            if (!saved?.settings) return;
            if (saved.defaultPresetVersion !== DEFAULT_PRESET_VERSION && !saved.dirty) {
                this.saveSessionState();
                return;
            }
            this.settings = constrainSettings(saved.settings);
            const savedName = saved.presetName || 'Session';
            const availableNames = new Set([...this.presetManager.names(), 'Session', 'Shared', 'Untitled']);
            this.presetManager.currentName = availableNames.has(savedName) ? savedName : 'Session';
            this.presetManager.dirty = availableNames.has(savedName) ? Boolean(saved.dirty) : true;
            this.history.reset(this.settings);
        } catch {
            // Private browsing and strict storage policies may disable session storage.
        }
    }

    saveSessionState() {
        try {
            sessionStorage.setItem(SPHERE_SESSION_KEY, JSON.stringify({
                settings: this.settings,
                presetName: this.presetManager.currentName,
                dirty: this.presetManager.dirty,
                defaultPresetVersion: DEFAULT_PRESET_VERSION
            }));
        } catch {
            // The generators remain fully usable without navigation persistence.
        }
    }

    bindHelp() {
        const root = document.getElementById('helpMenu');
        const button = document.getElementById('helpButton');
        const popup = document.getElementById('helpPopup');
        const setOpen = (open) => {
            popup.hidden = !open;
            button.setAttribute('aria-expanded', String(open));
        };
        button.addEventListener('click', () => setOpen(popup.hidden));
        document.addEventListener('pointerdown', (event) => {
            if (!popup.hidden && !root.contains(event.target)) setOpen(false);
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !popup.hidden) setOpen(false);
        });
    }

    bindShortcuts() {
        document.addEventListener('keydown', (event) => {
            const mod = event.metaKey || event.ctrlKey;
            const key = event.key.toLowerCase();
            if (isEditable(event.target)) return;
            if (key === ' ' && !event.repeat) {
                event.preventDefault();
                this.toggleAnimation();
            } else if (key === 'g' && !mod) {
                event.preventDefault();
                this.update({ showGuides: !this.settings.showGuides });
                this.syncControls();
            } else if (mod && key === '\\') {
                event.preventDefault();
                this.panels.toggleAllCollapsed();
            } else if (mod && key === 'z') {
                event.preventDefault();
                this.restoreHistory(event.shiftKey ? this.history.redo() : this.history.undo());
            } else if (mod && key === 'e') {
                event.preventDefault();
                if (event.shiftKey) this.exportPngAction();
                else this.exportPrimaryAction();
            } else if (mod && key === 'j') {
                event.preventDefault();
                downloadText(JSON.stringify(this.settings, null, 2), `${exportBaseName()}.json`, 'application/json');
            }
        });
    }

    restoreHistory(snapshot) {
        if (!snapshot) return;
        this.stopRotationPreview({ render: false });
        this.settings = constrainSettings(snapshot);
        this.presetManager.markDirty();
        this.saveSessionState();
        this.syncControls();
        this.renderNow();
        this.syncAnimationLoop();
    }

    syncAnimationLoop() {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
        if (this.settings.animationMode !== 'grow' || !this.animationPlaying) return;
        const tick = () => {
            this.renderNow();
            this.animationFrame = requestAnimationFrame(tick);
        };
        this.animationFrame = requestAnimationFrame(tick);
    }

    toggleAnimation() {
        if (this.settings.animationMode !== 'grow') return;
        if (this.animationPlaying) {
            this.animationElapsed += performance.now() - this.animationStartedAt;
            this.animationPlaying = false;
        } else {
            this.animationStartedAt = performance.now();
            this.animationPlaying = true;
        }
        this.syncAnimationUI();
        this.syncAnimationLoop();
        this.renderNow();
    }

    restartAnimation() {
        this.animationElapsed = 0;
        this.animationStartedAt = performance.now();
        this.animationPlaying = true;
        this.syncAnimationUI();
        this.syncAnimationLoop();
        this.renderNow();
    }

    syncAnimationUI() {
        const animated = this.settings.animationMode === 'grow';
        document.getElementById('animationControls').hidden = !animated;
        document.getElementById('playPause').textContent = this.animationPlaying ? 'Pause' : 'Play';
        document.getElementById('exportPng').textContent = animated ? 'Export PNG sequence' : 'Export PNG';
        document.getElementById('exportPrimary').textContent = animated ? 'Export MP4' : 'Export ⌘E';
    }

    bindExports() {
        document.getElementById('playPause').addEventListener('click', () => this.toggleAnimation());
        document.getElementById('restartAnimation').addEventListener('click', () => this.restartAnimation());
        document.getElementById('exportPng').addEventListener('click', () => this.exportPngAction());
        document.getElementById('exportPrimary').addEventListener('click', () => this.exportPrimaryAction());
    }

    exportPrimaryAction() {
        if (this.settings.animationMode === 'grow') {
            return this.animationExporter.export({
                format: 'mp4',
                settings: this.exportSnapshot(),
                baseName: exportBaseName()
            }).catch((error) => {
                if (error.name !== 'AbortError') console.error(error);
            });
        }
        const scene = buildGlobalScene(this.exportSnapshot());
        const svg = sceneToSvgString(scene);
        downloadText(svg, `${exportBaseName()}.svg`, 'image/svg+xml;charset=utf-8');
        return Promise.resolve();
    }

    exportPngAction() {
        if (this.settings.animationMode === 'grow') {
            return this.animationExporter.export({
                format: 'png-sequence',
                settings: this.exportSnapshot(),
                baseName: exportBaseName()
            }).catch((error) => {
                if (error.name !== 'AbortError') console.error(error);
            });
        }
        const scene = buildGlobalScene(this.exportSnapshot());
        const svgText = sceneToSvgString(scene);
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = 1080;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, 1080, 1080);
            URL.revokeObjectURL(url);
            canvas.toBlob((png) => {
                if (png) downloadBlob(png, `${exportBaseName()}.png`);
            }, 'image/png');
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            this.alert('Export failed', 'The SVG preview could not be rasterized.');
        };
        image.src = url;
        return Promise.resolve();
    }

    syncControls() {
        document.querySelectorAll('[data-setting]').forEach((input) => {
            const key = input.dataset.setting;
            if (!(key in this.settings)) return;
            if (input.type === 'checkbox') input.checked = Boolean(this.settings[key]);
            else input.value = String(this.settings[key]);
            const output = document.getElementById(`${input.id}Value`);
            if (output) output.value = String(Math.round(Number(this.settings[key])));
        });
        document.querySelectorAll('input[name="animationMode"]').forEach((input) => {
            input.checked = input.value === this.settings.animationMode;
        });
        document.querySelectorAll('input[name="topologyMode"]').forEach((input) => {
            input.checked = input.value === this.settings.topologyMode;
        });
        this.syncGeometryUI();
        this.syncOverlapUI();
        this.syncMagnetUI();
        this.syncRotationControls();
        this.syncColors();
        this.syncAnimationUI();
        this.syncSelectionUI();
        this.syncPresetChrome();
    }

    syncGeometryUI() {
        const packed = this.settings.topologyMode === 'packed';
        const limits = geometryControlLimits(this.settings);
        const diameter = document.getElementById('diameter');
        const coverage = document.getElementById('packingCoverage');
        const gap = document.getElementById('overlapGap');
        const diameterLimit = Math.max(Number(diameter.min), Math.floor(limits.diameterMax));

        document.getElementById('diameterGroup').hidden = packed;
        document.getElementById('packingCoverageGroup').hidden = !packed;
        diameter.value = String(this.settings.diameter);
        coverage.value = String(this.settings.packingCoverage);
        gap.value = String(this.settings.overlapGap);
        document.getElementById('diameterValue').value = String(Math.round(this.settings.diameter));
        document.getElementById('packingCoverageValue').value = String(Math.round(this.settings.packingCoverage));
        document.getElementById('overlapGapValue').value = String(Math.round(this.settings.overlapGap));

        const hint = document.getElementById('geometryHint');
        if (packed) {
            hint.textContent = this.settings.preventOverlap
                ? 'Packed derives each size from its local spherical cell. Coverage 100% is the non-overlapping maximum at the requested gap.'
                : 'Packed derives each size from its local spherical cell. Coverage above 100% creates controlled overlaps.';
        } else if (this.settings.preventOverlap) {
            hint.textContent = `The current density and gap allow ${diameterLimit} px. Conflicting changes move Diameter to the nearest usable value without changing its range.`;
        } else {
            hint.textContent = `The spherical surface currently allows ${diameterLimit} px. Conflicting changes move Diameter without changing its range.`;
        }
    }

    syncOverlapUI() {
        const disabled = !this.settings.preventOverlap;
        document.getElementById('overlapGap').disabled = disabled;
        document.getElementById('overlapGapValue').disabled = disabled;
    }

    syncMagnetUI() {
        const active = this.settings.magnetStrength > 0;
        document.getElementById('magnetRadius').disabled = !active;
        document.getElementById('magnetRadiusValue').disabled = !active;
        document.getElementById('magnetFollow').disabled = !active;
        document.getElementById('centerMagnet').disabled = !active;
        ['magnetX', 'magnetY'].forEach((id) => {
            const disabled = !active || this.settings.magnetFollow;
            document.getElementById(id).disabled = disabled;
            document.getElementById(`${id}Value`).disabled = disabled;
        });
        this.syncMagnetPositionControls();
    }

    syncMagnetPositionControls(point = this.transientMagnet) {
        const position = point || { x: this.settings.magnetX, y: this.settings.magnetY };
        [['magnetX', position.x], ['magnetY', position.y]].forEach(([id, value]) => {
            document.getElementById(id).value = String(value);
            document.getElementById(`${id}Value`).value = String(Math.round(value));
        });
    }

    syncRotationControls() {
        const offsets = this.rotationPreview?.offsets || {};
        ['rotationX', 'rotationY', 'rotationZ'].forEach((key) => {
            const input = document.getElementById(key);
            const output = document.getElementById(`${key}Value`);
            const normalized = rotationControlValue(Number(this.settings[key]) + Number(offsets[key] || 0));
            input.value = String(normalized);
            output.value = String(Math.round(normalized));
        });
    }

    syncColors() {
        ['ellipseColor', 'backgroundColor'].forEach((key) => {
            document.getElementById(key).value = this.settings[key];
            document.getElementById(`${key}Dot`).style.background = this.settings[key];
        });
    }

    alert(title, text) {
        return this.showDialog({ title, text, confirmText: 'OK' });
    }

    confirm(title, text) {
        return this.showDialog({ title, text, confirmText: 'Continue', cancelText: 'Cancel' });
    }

    prompt(title, text, value = '') {
        return this.showDialog({ title, text, value, confirmText: 'Save', cancelText: 'Cancel' });
    }

    showDialog({ title, text, value, confirmText, cancelText }) {
        const dialog = document.getElementById('dialog');
        const input = document.getElementById('dialogInput');
        const buttons = document.getElementById('dialogButtons');
        document.getElementById('dialogTitle').textContent = title;
        document.getElementById('dialogText').textContent = text;
        input.hidden = value == null;
        input.value = value ?? '';
        buttons.replaceChildren();
        return new Promise((resolve) => {
            const onCancel = (event) => {
                event.preventDefault();
                finish(value == null ? false : null);
            };
            const finish = (result) => {
                dialog.removeEventListener('cancel', onCancel);
                if (dialog.open) dialog.close();
                resolve(result);
            };
            if (cancelText) {
                const cancel = document.createElement('button');
                cancel.type = 'button';
                cancel.textContent = cancelText;
                cancel.addEventListener('click', () => finish(value == null ? false : null));
                buttons.appendChild(cancel);
            }
            const confirm = document.createElement('button');
            confirm.type = 'button';
            confirm.textContent = confirmText;
            confirm.addEventListener('click', () => finish(value == null ? true : input.value.trim()));
            buttons.appendChild(confirm);
            dialog.addEventListener('cancel', onCancel, { once: true });
            dialog.showModal();
            if (!input.hidden) {
                input.focus();
                input.select();
            }
        });
    }
}

export { MAX_ELLIPSES, exportBaseName };
