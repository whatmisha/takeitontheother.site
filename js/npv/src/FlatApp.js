import {
    FLAT_ARTBOARD_HEIGHT,
    FLAT_ARTBOARD_WIDTH,
    buildFlatScene,
    normalizeFlatSettings
} from './geometry/flatGeometry.js';
import { HistoryManager } from './core/history.js';
import {
    FLAT_DEFAULT_PRESET_NAME,
    flatPresetNames,
    getFlatPreset
} from './core/flatPresets.js';
import { PanelManager } from './ui/PanelManager.js';
import { ZoomPanManager } from './ui/ZoomPanManager.js';
import { flatSceneToSvgString, renderFlatSceneToSvg } from './render/flatRenderer.js';

const pad = (value) => String(value).padStart(2, '0');
const FLAT_SESSION_KEY = 'yfToolsFlatSessionV1';
const FLAT_SESSION_VERSION = 2;
const isEditable = (target) => target instanceof Element
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

function exportBaseName(date = new Date()) {
    return `flat_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
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
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))));
}

export class FlatApp {
    constructor() {
        this.svg = document.getElementById('mainSvg');
        this.canvas = document.getElementById('canvasContainer');
        this.settings = normalizeFlatSettings(getFlatPreset(FLAT_DEFAULT_PRESET_NAME));
        this.currentPresetName = FLAT_DEFAULT_PRESET_NAME;
        this.presetDirty = false;
        this.scene = null;
        this.transientField = null;
        this.renderFrame = null;
        this.clickCandidate = null;
        this.staticPointSequence = 0;
        this.personMotion = new Map();
        this.personMotionTime = null;
        this.hoveredStaticFieldId = null;
        this.history = new HistoryManager(this.settings, { limit: 100, debounceMs: 160 });
        this.panels = new PanelManager(['flatPatternPanel', 'flatFieldPanel', 'flatColorsPanel']);
        this.zoom = new ZoomPanManager(
            this.canvas,
            this.svg,
            document.getElementById('zoomDisplay'),
            { width: FLAT_ARTBOARD_WIDTH, height: FLAT_ARTBOARD_HEIGHT }
        );
    }

    init() {
        this.loadSessionState();
        this.bindControls();
        this.bindCanvas();
        this.bindChrome();
        this.bindShortcuts();
        this.loadSharedState();
        this.syncControls();
        this.renderNow();
        document.documentElement.classList.remove('global-initializing');
        return this;
    }

    update(patch, { history = true, markDirty = true } = {}) {
        this.settings = normalizeFlatSettings({ ...this.settings, ...patch });
        if (history) this.history.schedule(this.settings);
        if (markDirty) {
            this.presetDirty = true;
            this.syncPresetChrome();
        }
        this.saveSessionState();
        this.requestRender();
    }

    requestRender() {
        if (this.renderFrame != null) return;
        this.renderFrame = requestAnimationFrame((time) => {
            this.renderFrame = null;
            this.renderNow(time);
        });
    }

    renderNow(time = performance.now()) {
        const targetScene = buildFlatScene(this.settings, { transientField: this.transientField });
        this.zoom.setSurfaceSize(targetScene.width, targetScene.height);
        const transition = this.interpolatePersonScene(targetScene, time);
        this.scene = transition.scene;
        renderFlatSceneToSvg(this.svg, this.scene);
        this.syncHoveredStaticFieldGuide();
        document.documentElement.style.setProperty('--bg', this.settings.backgroundColor);
        if (!transition.settled) this.requestRender();
    }

    interpolatePersonScene(targetScene, time) {
        if (!targetScene.fields.some((field) => field.mode === 'person')) {
            this.personMotion.clear();
            this.personMotionTime = null;
            return { scene: targetScene, settled: true };
        }

        const firstFrame = this.personMotionTime == null;
        const elapsed = firstFrame ? 0 : Math.min(64, Math.max(0, time - this.personMotionTime));
        const amount = firstFrame ? 1 : 1 - Math.exp(-elapsed / 95);
        const activeIds = new Set();
        let settled = true;
        const elements = targetScene.elements.map((target) => {
            activeIds.add(target.id);
            const previous = this.personMotion.get(target.id) || {
                rx: target.rx,
                ry: target.ry,
                cy: target.cy
            };
            const current = {
                rx: previous.rx + (target.rx - previous.rx) * amount,
                ry: previous.ry + (target.ry - previous.ry) * amount,
                cy: previous.cy + (target.cy - previous.cy) * amount
            };
            if (Math.max(
                Math.abs(target.rx - current.rx),
                Math.abs(target.ry - current.ry),
                Math.abs(target.cy - current.cy)
            ) < 0.015) {
                current.rx = target.rx;
                current.ry = target.ry;
                current.cy = target.cy;
            } else {
                settled = false;
            }
            this.personMotion.set(target.id, current);
            return { ...target, ...current };
        });
        [...this.personMotion.keys()].forEach((id) => {
            if (!activeIds.has(id)) this.personMotion.delete(id);
        });
        this.personMotionTime = time;
        return { scene: { ...targetScene, elements }, settled };
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
        document.querySelectorAll('[data-flat-setting]').forEach((input) => {
            const key = input.dataset.flatSetting;
            const output = document.getElementById(`${input.id}Value`);
            const commit = (value) => {
                const patch = { [key]: value };
                if (key === 'fieldFollow' && value === false && this.transientField) {
                    patch.fieldX = this.transientField.x;
                    patch.fieldY = this.transientField.y;
                }
                this.update(patch);
                if (key === 'fieldFollow') this.transientField = null;
                this.syncControls();
            };
            input.addEventListener('input', () => {
                commit(input.type === 'checkbox' ? input.checked : Number(input.value));
            });
            if (input.type === 'range') this.bindRangeValueInput(input, output, commit);
        });

        document.querySelectorAll('[data-flat-coordinate]').forEach((input) => {
            const axis = input.dataset.flatCoordinate;
            const key = axis === 'x' ? 'fieldX' : 'fieldY';
            const output = document.getElementById(`${input.id}Value`);
            const commit = (coordinate) => {
                this.transientField = null;
                this.update({ [key]: coordinate });
                this.syncControls();
            };
            input.addEventListener('input', () => commit(Number(input.value)));
            this.bindRangeValueInput(input, output, commit);
        });

        document.querySelectorAll('input[name="flatMode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                this.update({ mode: input.value });
                this.syncControls();
            });
        });
        document.querySelectorAll('input[name="flatDistribution"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                this.update({ distribution: input.value });
                this.syncControls();
            });
        });
        document.querySelectorAll('[data-flat-color]').forEach((input) => {
            const key = input.dataset.flatColor;
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
    }

    bindCanvas() {
        this.canvas.addEventListener('selectstart', (event) => event.preventDefault());
        this.canvas.addEventListener('dragstart', (event) => event.preventDefault());
        this.canvas.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 || this.zoom.spaceDown) return;
            const point = this.clientToArtboard(event.clientX, event.clientY);
            if (!point) return;
            this.clickCandidate = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                point,
                moved: false
            };
        });
        this.canvas.addEventListener('pointermove', (event) => {
            if (this.clickCandidate?.pointerId === event.pointerId
                && Math.hypot(
                    event.clientX - this.clickCandidate.startX,
                    event.clientY - this.clickCandidate.startY
                ) > 3) {
                this.clickCandidate.moved = true;
            }
            if (!this.settings.fieldFollow || this.zoom.drag) return;
            const point = this.clientToArtboard(event.clientX, event.clientY);
            if (!point) return;
            this.transientField = point;
            this.syncFieldCoordinates();
            this.requestRender();
        });
        const finishClick = (event) => {
            const candidate = this.clickCandidate;
            if (!candidate || candidate.pointerId !== event.pointerId) return;
            this.clickCandidate = null;
            if (candidate.moved || this.zoom.drag) return;
            const point = this.clientToArtboard(event.clientX, event.clientY) || candidate.point;
            this.addStaticField(point);
        };
        this.canvas.addEventListener('pointerup', finishClick);
        this.canvas.addEventListener('pointercancel', () => { this.clickCandidate = null; });
    }

    clientToArtboard(clientX, clientY) {
        const ctm = this.svg.getScreenCTM();
        if (!ctm) return null;
        const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
        if (point.x < 0 || point.x > this.settings.width || point.y < 0 || point.y > this.settings.height) {
            return null;
        }
        return {
            x: point.x - this.settings.width / 2,
            y: point.y - this.settings.height / 2
        };
    }

    addStaticField(point) {
        const field = {
            id: `point-${Date.now().toString(36)}-${++this.staticPointSequence}`,
            x: Math.round(point.x),
            y: Math.round(point.y),
            enabled: true,
            mode: this.settings.mode,
            radius: this.settings.fieldRadius,
            falloffCurve: this.settings.falloffCurve,
            basicScale: this.settings.basicScale,
            personIconScale: this.settings.personIconScale,
            personMinimumScale: this.settings.personMinimumScale
        };
        this.update({ staticFields: [...this.settings.staticFields, field] });
        this.syncControls();
    }

    toggleStaticField(id) {
        this.hoveredStaticFieldId = null;
        this.update({
            staticFields: this.settings.staticFields.map((field) => (
                field.id === id ? { ...field, enabled: !field.enabled } : field
            ))
        });
        this.syncControls();
    }

    removeStaticField(id) {
        if (this.hoveredStaticFieldId === id) this.hoveredStaticFieldId = null;
        this.update({ staticFields: this.settings.staticFields.filter((field) => field.id !== id) });
        this.syncControls();
    }

    bindChrome() {
        const toggle = document.getElementById('flatPresetToggle');
        const list = document.getElementById('flatPresetList');
        toggle.addEventListener('click', () => {
            const open = toggle.getAttribute('aria-expanded') !== 'true';
            toggle.setAttribute('aria-expanded', String(open));
            list.hidden = !open;
            if (open) this.renderPresetList();
        });
        document.addEventListener('pointerdown', (event) => {
            if (!document.getElementById('flatPresetMenu').contains(event.target)) {
                this.closePresetMenu();
            }
        });
        document.getElementById('shareButton').addEventListener('click', () => this.share());
        document.getElementById('exportSvg').addEventListener('click', () => this.exportSvg());
        document.getElementById('exportPng').addEventListener('click', () => this.exportPng());
    }

    renderPresetList() {
        const list = document.getElementById('flatPresetList');
        list.replaceChildren();
        flatPresetNames().forEach((name) => {
            const row = document.createElement('div');
            row.className = `preset-entry${name === this.currentPresetName ? ' is-active' : ''}`;
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', String(name === this.currentPresetName));
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'preset-row';
            button.textContent = name;
            button.addEventListener('click', () => this.openPreset(name));
            row.appendChild(button);
            list.appendChild(row);
        });
    }

    openPreset(name) {
        const preset = getFlatPreset(name);
        if (!preset) return;
        this.currentPresetName = name;
        this.presetDirty = false;
        this.settings = normalizeFlatSettings(preset);
        this.transientField = null;
        this.hoveredStaticFieldId = null;
        this.personMotion.clear();
        this.personMotionTime = null;
        this.history.reset(this.settings);
        this.saveSessionState();
        this.syncControls();
        this.renderNow();
        this.closePresetMenu();
    }

    closePresetMenu() {
        document.getElementById('flatPresetToggle').setAttribute('aria-expanded', 'false');
        document.getElementById('flatPresetList').hidden = true;
    }

    syncPresetChrome() {
        const name = document.getElementById('flatPresetName');
        if (name) name.textContent = `${this.currentPresetName}${this.presetDirty ? ' *' : ''}`;
    }

    bindShortcuts() {
        document.addEventListener('keydown', (event) => {
            if (isEditable(event.target)) return;
            const mod = event.metaKey || event.ctrlKey;
            const key = event.key.toLowerCase();
            if (!mod && (event.code === 'BracketLeft' || event.code === 'BracketRight')) {
                event.preventDefault();
                const direction = event.code === 'BracketRight' ? 1 : -1;
                const step = event.shiftKey ? 15 : 5;
                this.update({ fieldRadius: this.settings.fieldRadius + direction * step });
                this.syncControls();
            } else if (key === 'g' && !mod) {
                event.preventDefault();
                this.update({ showField: !this.settings.showField });
                this.syncControls();
            } else if (mod && key === '\\') {
                event.preventDefault();
                this.panels.toggleAllCollapsed();
            } else if (mod && key === 'z') {
                event.preventDefault();
                const restored = event.shiftKey ? this.history.redo() : this.history.undo();
                if (restored) {
                    this.settings = normalizeFlatSettings(restored);
                    this.transientField = null;
                    this.presetDirty = true;
                    this.saveSessionState();
                    this.syncControls();
                    this.renderNow();
                }
            } else if (mod && key === 'e') {
                event.preventDefault();
                if (event.shiftKey) this.exportPng();
                else this.exportSvg();
            } else if (mod && key === 'j') {
                event.preventDefault();
                downloadText(
                    JSON.stringify(this.settings, null, 2),
                    `${exportBaseName()}.json`,
                    'application/json'
                );
            }
        });
    }

    exportScene() {
        const settings = { ...this.settings };
        if (this.transientField) {
            settings.fieldX = this.transientField.x;
            settings.fieldY = this.transientField.y;
        }
        settings.fieldFollow = false;
        return buildFlatScene(settings);
    }

    exportSvg() {
        downloadText(
            flatSceneToSvgString(this.exportScene()),
            `${exportBaseName()}.svg`,
            'image/svg+xml;charset=utf-8'
        );
    }

    exportPng() {
        const scene = this.exportScene();
        const svgText = flatSceneToSvgString(scene);
        const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = scene.width * 2;
            canvas.height = scene.height * 2;
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
                if (blob) downloadBlob(blob, `${exportBaseName()}.png`);
            }, 'image/png');
        };
        image.onerror = () => URL.revokeObjectURL(url);
        image.src = url;
    }

    async share() {
        const url = new URL(location.href);
        url.hash = `f=${encodeState(this.settings)}`;
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
            window.prompt('Copy share link', url.href);
        }
    }

    loadSharedState() {
        if (!location.hash.startsWith('#f=')) return;
        try {
            this.settings = normalizeFlatSettings(decodeState(location.hash.slice(3)));
            this.currentPresetName = 'Shared';
            this.presetDirty = false;
            this.history.reset(this.settings);
            this.saveSessionState();
        } catch {
            history.replaceState(null, '', location.pathname + location.search);
        }
    }

    loadSessionState() {
        try {
            const saved = JSON.parse(sessionStorage.getItem(FLAT_SESSION_KEY) || 'null');
            if (!saved) return;
            if (saved.version === FLAT_SESSION_VERSION && saved.settings) {
                this.settings = normalizeFlatSettings(saved.settings);
                this.currentPresetName = typeof saved.presetName === 'string'
                    ? saved.presetName
                    : FLAT_DEFAULT_PRESET_NAME;
                this.presetDirty = Boolean(saved.dirty);
            } else {
                this.settings = normalizeFlatSettings(saved);
                this.currentPresetName = FLAT_DEFAULT_PRESET_NAME;
                const basic = normalizeFlatSettings(getFlatPreset(FLAT_DEFAULT_PRESET_NAME));
                this.presetDirty = JSON.stringify(this.settings) !== JSON.stringify(basic);
            }
            this.history.reset(this.settings);
        } catch {
            // Session persistence is optional when browser storage is unavailable.
        }
    }

    saveSessionState() {
        try {
            sessionStorage.setItem(FLAT_SESSION_KEY, JSON.stringify({
                version: FLAT_SESSION_VERSION,
                settings: this.settings,
                presetName: this.currentPresetName,
                dirty: this.presetDirty
            }));
        } catch {
            // The tool remains usable without cross-page state persistence.
        }
    }

    syncControls() {
        document.querySelectorAll('[data-flat-setting]').forEach((input) => {
            const key = input.dataset.flatSetting;
            if (!(key in this.settings)) return;
            if (input.type === 'checkbox') input.checked = Boolean(this.settings[key]);
            else input.value = String(this.settings[key]);
            const output = document.getElementById(`${input.id}Value`);
            if (output) {
                const step = Number(input.step) || 1;
                const precision = step < 1 ? String(input.step).split('.')[1]?.length || 0 : 0;
                const numeric = Number(this.settings[key]);
                output.value = precision ? String(Number(numeric.toFixed(precision))) : String(Math.round(numeric));
            }
        });
        document.querySelectorAll('input[name="flatMode"]').forEach((input) => {
            input.checked = input.value === this.settings.mode;
        });
        document.querySelectorAll('input[name="flatDistribution"]').forEach((input) => {
            input.checked = input.value === this.settings.distribution;
        });

        const person = this.settings.mode === 'person';
        this.canvas.classList.toggle('is-person-mode', person);
        document.getElementById('basicGrowthGroup').hidden = person;
        document.getElementById('personSizeGroup').hidden = !person;
        document.getElementById('personReductionGroup').hidden = !person;
        document.getElementById('staggerGroup').hidden = this.settings.distribution !== 'paired';
        document.getElementById('flatPatternHint').textContent = this.settings.distribution === 'paired'
            ? 'Canvas size reveals more fixed paired tiles without moving existing marks.'
            : 'Canvas size reveals more of the fixed lattice; ellipse size and spacing stay unchanged.';
        document.getElementById('flatFieldHint').textContent = person
            ? 'The reference-ratio Person stays fixed while nearby ellipses shrink across the field radius.'
            : 'Basic scales every ellipse by distance from the field. Click the artboard to pin fields.';
        this.syncPresetChrome();
        this.syncFieldCoordinates();
        this.syncStaticFieldUI();
        this.syncColors();
    }

    syncFieldCoordinates() {
        const point = this.settings.fieldFollow && this.transientField
            ? this.transientField
            : { x: this.settings.fieldX, y: this.settings.fieldY };
        ['x', 'y'].forEach((axis) => {
            const coordinate = Number(point[axis].toFixed(1));
            const value = String(coordinate);
            document.getElementById(`field${axis.toUpperCase()}`).value = value;
            document.getElementById(`field${axis.toUpperCase()}Value`).value = coordinate > 0 ? `+${value}` : value;
        });
    }

    syncStaticFieldUI() {
        const section = document.getElementById('staticFieldsSection');
        const list = document.getElementById('staticFieldList');
        const count = document.getElementById('staticFieldCount');
        if (!section || !list || !count) return;
        section.hidden = this.settings.staticFields.length === 0;
        count.textContent = String(this.settings.staticFields.length);
        list.replaceChildren();
        this.settings.staticFields.forEach((field) => {
            const x = Math.round(field.x);
            const y = Math.round(field.y);
            const coordinates = `${x > 0 ? '+' : ''}${x}, ${y > 0 ? '+' : ''}${y}`;
            const pill = document.createElement('div');
            pill.className = 'field-point-pill';
            pill.dataset.enabled = String(field.enabled);
            const size = field.mode === 'person' ? field.personMinimumScale : field.basicScale;
            const sizeLabel = field.mode === 'person' ? 'minimum' : 'maximum';
            const iconSize = field.mode === 'person' ? ` · icon ${field.personIconScale}%` : '';
            pill.title = `${field.mode === 'person' ? 'Person' : 'Basic'} · radius ${field.radius}px${iconSize} · ${sizeLabel} ${size}% · curve ${field.falloffCurve}`;

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'field-point-toggle';
            toggle.setAttribute('aria-pressed', String(field.enabled));
            toggle.setAttribute('aria-label', `Toggle field at ${coordinates} from center`);
            toggle.textContent = `${field.mode === 'person' ? 'P ' : ''}${coordinates}`;
            toggle.addEventListener('click', () => this.toggleStaticField(field.id));
            toggle.addEventListener('pointerenter', () => {
                this.hoveredStaticFieldId = field.enabled ? field.id : null;
                this.syncHoveredStaticFieldGuide();
            });
            toggle.addEventListener('pointerleave', () => {
                if (this.hoveredStaticFieldId === field.id) this.hoveredStaticFieldId = null;
                this.syncHoveredStaticFieldGuide();
            });
            toggle.addEventListener('focus', () => {
                this.hoveredStaticFieldId = field.enabled ? field.id : null;
                this.syncHoveredStaticFieldGuide();
            });
            toggle.addEventListener('blur', () => {
                if (this.hoveredStaticFieldId === field.id) this.hoveredStaticFieldId = null;
                this.syncHoveredStaticFieldGuide();
            });

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'field-point-remove';
            remove.setAttribute('aria-label', `Delete field at ${coordinates} from center`);
            remove.textContent = '×';
            remove.addEventListener('click', () => this.removeStaticField(field.id));

            pill.append(toggle, remove);
            list.appendChild(pill);
        });
    }

    syncHoveredStaticFieldGuide() {
        const highlightId = this.settings.showField ? this.hoveredStaticFieldId : null;
        this.svg.querySelectorAll('[data-field-id]').forEach((element) => {
            element.classList.toggle('is-pinned-hover', element.dataset.fieldId === highlightId);
        });
    }

    syncColors() {
        ['ellipseColor', 'backgroundColor'].forEach((key) => {
            document.getElementById(key).value = this.settings[key];
            document.getElementById(`${key}Dot`).style.background = this.settings[key];
        });
    }
}
