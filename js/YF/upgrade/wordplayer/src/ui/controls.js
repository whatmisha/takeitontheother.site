import { clamp } from '../core/math.js';

const AVAILABLE_MODES = new Set(['dither', 'forms']);
export const normalizeMode = (mode) => AVAILABLE_MODES.has(mode) ? mode : 'dither';

export class WordplayerUI {
    constructor({ assets, exporter, getScene, FileIntakeController }) {
        this.assets = assets;
        this.exporter = exporter;
        this.getScene = getScene;
        this.FileIntakeController = FileIntakeController;
        this.fileIntakes = [];
        this.bound = false;
    }

    syncPixelControls(settings) {
        const groups = {
            sizeEnabled: ['sizeMin', 'sizeMax'],
            weightEnabled: ['weightMin', 'weightMax'],
            rotationEnabled: ['rotationMin', 'rotationMax'],
            noiseEnabled: ['noiseMin', 'noiseMax']
        };
        for (const [setting, prefixes] of Object.entries(groups)) {
            const disabled = settings[setting] === false;
            for (const prefix of prefixes) {
                const slider = document.getElementById(`${prefix}Slider`);
                const value = document.getElementById(`${prefix}Value`);
                if (slider) slider.disabled = disabled;
                if (value) value.disabled = disabled;
                slider?.closest('.control-group')?.classList.toggle('disabled', disabled);
            }
        }
    }

    sync(app) {
        const settings = app.settings;
        const mode = normalizeMode(settings.mode);
        if (settings.mode !== mode) {
            app.settingsStore.set('mode', mode);
            return;
        }
        document.querySelector('.container')?.setAttribute('data-mode', mode);
        const textInput = document.getElementById('patternTextInput');
        if (textInput && textInput.value !== settings.patternText) textInput.value = settings.patternText;
        const widthInput = document.getElementById('widthValue');
        if (widthInput && widthInput.value !== String(settings.width)) widthInput.value = String(settings.width);
        const heightInput = document.getElementById('heightValue');
        if (heightInput && heightInput.value !== String(settings.height)) heightInput.value = String(settings.height);
        const resolutionInput = document.getElementById('resolutionValue');
        if (resolutionInput && resolutionInput.value !== String(settings.resolution)) resolutionInput.value = String(settings.resolution);
        document.querySelectorAll('input[name="mode"]').forEach((input) => {
            input.checked = input.value === mode;
        });
        const bayerToggle = document.getElementById('bayerToggle');
        if (bayerToggle) bayerToggle.checked = settings.ditherAlgorithm === 'bayer';
        const lightLabel = document.getElementById('lightToneGroupLabel');
        if (lightLabel) lightLabel.textContent = mode === 'forms' ? 'Far from edge' : 'Light pixels';
        const darkLabel = document.getElementById('darkToneGroupLabel');
        if (darkLabel) darkLabel.textContent = mode === 'forms' ? 'Near edge' : 'Dark pixels';
        this.syncPixelControls(settings);
        this.assets.syncLabels();
        if (mode === 'forms') void this.assets.ensureDefaultForm();
    }

    bindNumericInput(app, id, setting, min, max, { baseStep = 1, shiftStep = 10 } = {}) {
        const input = document.getElementById(id);
        if (!input) return;
        const sync = (value) => {
            const rounded = Math.round(Number(value));
            input.value = String(Number.isFinite(rounded) ? rounded : app.settingsStore.get(setting));
        };
        const commit = () => {
            const parsed = Number.parseFloat(String(input.value).replace(',', '.'));
            const fallback = Number(app.settingsStore.get(setting));
            const next = clamp(Number.isFinite(parsed) ? Math.round(parsed) : fallback, min, max);
            input.value = String(next);
            app.settingsStore.set(setting, next);
        };
        input.addEventListener('blur', commit);
        input.addEventListener('focus', () => input.select());
        input.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                const direction = event.key === 'ArrowUp' ? 1 : -1;
                const fallback = Number(app.settingsStore.get(setting));
                const parsed = Number.parseFloat(String(input.value).replace(',', '.'));
                const current = Number.isFinite(parsed) ? parsed : fallback;
                const step = event.shiftKey ? shiftStep : baseStep;
                let next;
                if (event.shiftKey && shiftStep > 0) {
                    const quotient = current / shiftStep;
                    const nearest = Math.round(quotient);
                    const isMultiple = Math.abs(quotient - nearest) < 1e-6;
                    next = isMultiple
                        ? current + direction * shiftStep
                        : (direction > 0 ? Math.ceil(quotient) : Math.floor(quotient)) * shiftStep;
                } else {
                    next = current + direction * step;
                }
                next = clamp(Math.round(next), min, max);
                input.value = String(next);
                app.settingsStore.set(setting, next);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                input.blur();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                sync(app.settingsStore.get(setting));
                input.blur();
            }
        });
        app.settingsStore.subscribe(setting, sync);
        sync(app.settingsStore.get(setting));
    }

    showExportError(app, title, error) {
        console.error(error);
        app.dialog?.alert({ title, text: `Could not prepare ${title.toLowerCase()} in this browser session.` });
    }

    bindTextPanelScrollbar() {
        const panel = document.getElementById('textPanel');
        const content = panel?.querySelector('.panel-content');
        const section = content?.firstElementChild;
        if (!panel || !content) return;

        let frame = 0;
        const sync = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const hasScrollbar = content.scrollHeight > content.clientHeight + 1;
                const scrollbarWidth = hasScrollbar
                    ? Math.max(0, content.offsetWidth - content.clientWidth)
                    : 0;
                panel.style.setProperty('--panel-scrollbar-width', `${scrollbarWidth}px`);
                panel.classList.toggle('panel-scrollbar-visible', hasScrollbar);
            });
        };

        if (typeof ResizeObserver === 'function') {
            const observer = new ResizeObserver(sync);
            try {
                observer.observe(content);
                if (section) observer.observe(section);
                this.textPanelResizeObserver = observer;
            } catch {
                observer.disconnect?.();
            }
        }
        window.addEventListener('resize', sync);
        sync();
    }

    bindFileIntakes() {
        if (!this.FileIntakeController || this.fileIntakes.length) return;
        const create = ({ inputId, triggerId, statusId, ...options }) => {
            const input = document.getElementById(inputId);
            const controller = new this.FileIntakeController({
                input,
                trigger: document.getElementById(triggerId),
                status: document.getElementById(statusId),
                root: input?.closest('.file-intake'),
                dropzone: input?.closest('.file-intake'),
                initialState: 'ready',
                ...options
            }).init();
            this.fileIntakes.push(controller);
        };

        create({
            inputId: 'imageInput',
            triggerId: 'imageLoadBtn',
            statusId: 'imageStatus',
            accept: 'image/*',
            typeErrorText: 'Choose an image file.',
            errorText: () => 'Could not load this image.',
            onSelect: file => this.assets.loadImageFile(file),
            onError: error => this.assets.showError('Image', error)
        });
        create({
            inputId: 'formInput',
            triggerId: 'formLoadBtn',
            statusId: 'formStatus',
            accept: '.svg,image/svg+xml',
            typeErrorText: 'Choose an SVG file.',
            errorText: () => 'Could not load this SVG.',
            onSelect: file => this.assets.loadFormFile(file),
            onError: error => this.assets.showError('SVG form', error)
        });
    }

    bind(app) {
        if (this.bound) return;
        this.bound = true;
        const set = (key, value) => app.settingsStore.set(key, value);
        document.getElementById('patternTextInput')?.addEventListener('input', (event) => set('patternText', event.target.value));
        this.bindNumericInput(app, 'widthValue', 'width', 200, 2000);
        this.bindNumericInput(app, 'heightValue', 'height', 200, 2000);
        this.bindNumericInput(app, 'resolutionValue', 'resolution', 8, 180);
        this.bindTextPanelScrollbar();

        document.querySelectorAll('input[name="mode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                const mode = normalizeMode(input.value);
                set('mode', mode);
                if (mode === 'forms') void this.assets.ensureDefaultForm();
                this.sync(app);
            });
        });
        document.getElementById('bayerToggle')?.addEventListener('change', (event) => {
            set('ditherAlgorithm', event.target.checked ? 'bayer' : 'floyd');
        });
        ['sizeEnabled', 'weightEnabled', 'rotationEnabled', 'noiseEnabled'].forEach((key) => {
            app.settingsStore.subscribe(key, () => this.syncPixelControls(app.settings));
        });

        this.bindFileIntakes();

        const pngButton = document.getElementById('exportPngBtn');
        pngButton?.addEventListener('click', () => {
            window.wordplayerLastAction = 'png-export-start';
            pngButton.setAttribute('aria-busy', 'true');
            void this.exporter.exportPng(this.getScene(), {
                transparent: app.settings.exportTransparent,
                scale: 3
            }).then(() => {
                window.wordplayerLastAction = 'png-export-complete';
            }).catch((error) => this.showExportError(app, 'PNG export', error))
                .finally(() => pngButton.setAttribute('aria-busy', 'false'));
        });
        const svgButton = document.getElementById('exportSvgBtn');
        svgButton?.addEventListener('click', () => {
            window.wordplayerLastAction = 'curves-export-start';
            svgButton.setAttribute('aria-busy', 'true');
            void this.exporter.exportCurvedSvg(this.getScene()).then(() => {
                window.wordplayerLastAction = 'curves-export-complete';
            }).catch((error) => this.showExportError(app, 'SVG export', error))
                .finally(() => svgButton.setAttribute('aria-busy', 'false'));
        });
        app.settingsStore.subscribe('mode', () => this.sync(app));
        this.sync(app);
    }
}
