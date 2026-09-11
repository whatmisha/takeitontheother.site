import { defineTool } from '../framework/src/core/defineTool.js';
import { CascadeAnimationExporter } from './src/animationExporter.js';
import { CASCADE_DEFAULTS, cascadeLevelCount, normalizeCascadeSettings } from './src/cascadeGeometry.js';
import { advanceMotionPhase, cascadeGenerationAtPhase } from './src/motion.js';
import { renderCascadeSvgDom } from './src/renderer.js';

const pad = (value) => String(value).padStart(2, '0');

function animationBaseName(date = new Date()) {
    return `cascade_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
        + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

let motionPhase = 0;
let motionGeneration = -1;
let motionFrameId = null;
let motionLastTime = null;

function applySettings(shell, patch) {
    const normalized = normalizeCascadeSettings({ ...shell.settingsStore.toObject(), ...patch });
    shell.settingsStore.setMultiple(normalized);
    shell._syncControls();
}

function syncMotionButton(shell) {
    const playing = Boolean(shell.settings.animate);
    const button = document.getElementById('motionPlayBtn');
    if (button) {
        button.classList.toggle('is-playing', playing);
        button.setAttribute('aria-pressed', playing ? 'true' : 'false');
        button.textContent = playing ? 'Ⅱ Pause' : '▶ Play';
    }
    const output = document.getElementById('motionGeneration');
    if (output) {
        if (!playing) output.textContent = 'Static cascade';
        else {
            const generation = cascadeGenerationAtPhase(motionPhase, shell.settings);
            const activeCount = generation >= cascadeLevelCount(shell.settings)
                ? 0
                : shell.settings.candidateCount / (2 ** generation);
            output.textContent = `Generation ${generation + 1} · ${activeCount} active`;
        }
    }
}

function stopMotion() {
    if (motionFrameId != null) cancelAnimationFrame(motionFrameId);
    motionFrameId = null;
    motionLastTime = null;
}

function startMotion(shell) {
    if (motionFrameId != null) return;
    motionLastTime = performance.now();
    const tick = (time) => {
        if (!shell.settings.animate) {
            stopMotion();
            shell.renderNow();
            syncMotionButton(shell);
            return;
        }
        const elapsed = Math.max(0, Math.min(64, time - motionLastTime));
        motionPhase = advanceMotionPhase(motionPhase, elapsed, shell.settings);
        motionLastTime = time;
        const generation = cascadeGenerationAtPhase(motionPhase, shell.settings);
        if (generation !== motionGeneration) {
            motionGeneration = generation;
            shell.renderNow();
            syncMotionButton(shell);
        }
        motionFrameId = requestAnimationFrame(tick);
    };
    motionFrameId = requestAnimationFrame(tick);
}

function syncMotion(shell) {
    syncMotionButton(shell);
    if (shell.settings.animate) startMotion(shell);
    else stopMotion();
}

function syncCustomControls(shell) {
    const candidateSelect = document.getElementById('candidateCountSelect');
    const finalistSelect = document.getElementById('finalistCountSelect');
    const phaseSelect = document.getElementById('phaseModeSelect');
    if (candidateSelect) candidateSelect.value = String(shell.settings.candidateCount);
    if (finalistSelect) {
        finalistSelect.value = String(shell.settings.finalistCount);
        finalistSelect.querySelectorAll('option').forEach((option) => {
            option.disabled = Number(option.value) > shell.settings.candidateCount;
        });
    }
    if (phaseSelect) phaseSelect.value = shell.settings.phaseMode;
    document.querySelectorAll('input[name="patternType"]').forEach((input) => {
        input.checked = input.value === shell.settings.patternType;
    });
    const isSierpinski = shell.settings.patternType === 'sierpinski';
    document.querySelectorAll('.cascade-only').forEach((element) => {
        element.hidden = isSierpinski;
    });
    document.querySelectorAll('.sierpinski-only').forEach((element) => {
        element.hidden = !isSierpinski;
    });
    document.querySelectorAll('input[name="layoutMode"]').forEach((input) => {
        input.checked = input.value === shell.settings.layoutMode;
    });
    document.querySelectorAll('.radial-only').forEach((element) => {
        element.hidden = isSierpinski || shell.settings.layoutMode !== 'radial';
    });
    document.querySelectorAll('.fan-only').forEach((element) => {
        element.hidden = isSierpinski || shell.settings.layoutMode !== 'fan';
    });
    const seedGroup = document.getElementById('seedGroup');
    if (seedGroup) seedGroup.hidden = isSierpinski || shell.settings.phaseMode !== 'random';
    const phaseAmountGroup = document.getElementById('phaseAmountGroup');
    if (phaseAmountGroup) phaseAmountGroup.hidden = isSierpinski || shell.settings.phaseMode === 'center';
    const sequence = document.getElementById('cascadeSequence');
    if (sequence) {
        const values = [];
        for (let count = shell.settings.candidateCount; count >= shell.settings.finalistCount; count /= 2) {
            values.push(count);
            if (count === shell.settings.finalistCount) break;
        }
        if (shell.settings.finalistCount === 1) values.push(0);
        sequence.textContent = values.join(' → ');
    }
    const hint = document.getElementById('mappingHint');
    if (hint) {
        hint.textContent = isSierpinski
            ? 'A downward Sierpinski gasket: each recursion retains three corner triangles and removes the inverted center.'
            : shell.settings.layoutMode === 'radial'
            ? 'Candidates enter as channels around the outside and resolve through concentric stages toward the center.'
            : shell.settings.layoutMode === 'fan'
                ? 'The same binary cascade of channels is progressively drawn toward a result point.'
                : 'The reference cascade halves the number of channels at every stage.';
    }
}

const app = defineTool({
    renderer: 'svg',
    autoStart: true,
    dom: { canvas: 'canvasContainer', surface: 'mainSvg', zoomIndicator: 'zoomIndicator' },
    settings: { ...CASCADE_DEFAULTS },
    controls: {
        sliders: [
            { id: 'fillSlider', valueId: 'fillValue', setting: 'fill', min: 10, max: 90, decimals: 0, baseStep: 1, suffix: '%' },
            { id: 'sierpinskiScaleSlider', valueId: 'sierpinskiScaleValue', setting: 'sierpinskiScale', min: 25, max: 100, decimals: 0, baseStep: 1, suffix: '%' },
            { id: 'phaseAmountSlider', valueId: 'phaseAmountValue', setting: 'phaseAmount', min: 0, max: 100, decimals: 0, baseStep: 1, suffix: '%' },
            { id: 'stageBalanceSlider', valueId: 'stageBalanceValue', setting: 'stageBalance', min: -100, max: 100, decimals: 0, baseStep: 1 },
            { id: 'seedSlider', valueId: 'seedValue', setting: 'seed', min: 0, max: 9999, decimals: 0, baseStep: 1, shiftStep: 100 },
            { id: 'radialRotationSlider', valueId: 'radialRotationValue', setting: 'radialRotation', min: -180, max: 180, decimals: 0, baseStep: 1, suffix: '°' },
            { id: 'radialInnerSlider', valueId: 'radialInnerValue', setting: 'radialInner', min: 0, max: 85, decimals: 0, baseStep: 1, suffix: '%' },
            { id: 'radialTwistSlider', valueId: 'radialTwistValue', setting: 'radialTwist', min: -360, max: 360, decimals: 0, baseStep: 1, suffix: '°' },
            { id: 'fanConvergenceSlider', valueId: 'fanConvergenceValue', setting: 'fanConvergence', min: 0, max: 95, decimals: 0, baseStep: 1, suffix: '%' },
            { id: 'fanCurveSlider', valueId: 'fanCurveValue', setting: 'fanCurve', min: 0.25, max: 3, decimals: 2, baseStep: 0.05, shiftStep: 0.25 },
            { id: 'fanOffsetSlider', valueId: 'fanOffsetValue', setting: 'fanOffset', min: -50, max: 50, decimals: 0, baseStep: 1, suffix: '%' },
            { id: 'stepDurationSlider', valueId: 'stepDurationValue', setting: 'stepDuration', min: 0.1, max: 2, decimals: 1, baseStep: 0.1, shiftStep: 0.5, suffix: ' s' },
            { id: 'canvasWidthSlider', valueId: 'canvasWidthValue', setting: 'width', min: 320, max: 1920, decimals: 0, baseStep: 1, shiftStep: 100, suffix: ' px' },
            { id: 'canvasHeightSlider', valueId: 'canvasHeightValue', setting: 'height', min: 320, max: 1920, decimals: 0, baseStep: 1, shiftStep: 100, suffix: ' px' }
        ],
        toggles: true
    },
    panels: [
        { id: 'structurePanel', headerId: 'structurePanelHeader', persistent: true },
        { id: 'mappingPanel', headerId: 'mappingPanelHeader', persistent: true },
        { id: 'motionPanel', headerId: 'motionPanelHeader', persistent: true },
        { id: 'appearancePanel', headerId: 'appearancePanelHeader', persistent: true }
    ],
    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'foreground', setting: 'foregroundColor', label: 'Foreground', itemId: 'foregroundColorItem', dotId: 'foregroundColorPreview', hexId: 'foregroundColorHex', hsbSlotId: 'foregroundColorHsbSlot' },
            { type: 'background', setting: 'backgroundColor', label: 'Background', itemId: 'backgroundColorItem', dotId: 'backgroundColorPreview', hexId: 'backgroundColorHex', hsbSlotId: 'backgroundColorHsbSlot' }
        ]
    },
    presets: {
        storageKey: 'othersiteCascadeV2',
        basePath: 'presets',
        defaultName: 'Reference 32→1',
        transform: normalizeCascadeSettings,
        colorDots: (blob) => [
            { kind: 'solid', value: blob.foregroundColor || '#ffffff' },
            { kind: 'solid', value: blob.backgroundColor || '#000000' }
        ]
    },
    share: { stripKeys: ['animate'], quantizableFloatKeys: ['fill', 'phaseAmount', 'stageBalance', 'fanCurve', 'stepDuration'] },
    export: { filename: 'cascade.svg' },
    shortcuts: { 'mod+shift+e': (shell) => { void shell.exportPNG(); } },
    zoom: { fitPadding: { top: 44, right: 44, bottom: 44, left: 44 } },
    snapshot(shell) {
        return normalizeCascadeSettings(shell.settingsStore.toObject());
    },
    restore(shell, snapshot) {
        shell.settingsStore.setMultiple(normalizeCascadeSettings(snapshot), true);
    },
    collectPreset(shell) {
        return normalizeCascadeSettings(shell.settingsStore.toObject());
    },
    applyPreset(shell, preset) {
        shell.settingsStore.setMultiple(normalizeCascadeSettings(preset), true);
    },
    render({ svg, create, width, height, settings }) {
        const generation = settings.animate ? cascadeGenerationAtPhase(motionPhase, settings) : undefined;
        renderCascadeSvgDom(svg, create, width, height, settings, { generation });
    },
    syncControls(shell) {
        syncCustomControls(shell);
        syncMotionButton(shell);
    },
    onChromeRefresh(shell) {
        syncCustomControls(shell);
        syncMotion(shell);
    },
    onReady(shell) {
        const exportPngButton = document.getElementById('exportPngBtn');
        const exportSvgButton = document.getElementById('exportSvgBtn');
        const exportSequenceButton = document.getElementById('exportPngSequenceBtn');
        const exportMp4Button = document.getElementById('exportMp4Btn');
        const animationExporter = new CascadeAnimationExporter({
            container: document.getElementById('bottomButtons'),
            status: document.getElementById('animationExportStatus'),
            progress: document.getElementById('animationExportProgress'),
            message: document.getElementById('animationExportMessage'),
            cancelButton: document.getElementById('cancelAnimationExport'),
            buttons: [exportPngButton, exportSvgButton, exportSequenceButton, exportMp4Button, document.getElementById('transparentExport')],
            onError: (error) => shell.dialog?.alert({ title: 'Export failed', text: error.message })
        });
        const exportAnimation = (format) => animationExporter.export({
            format,
            settings: shell.settingsStore.toObject(),
            baseName: animationBaseName()
        }).catch((error) => {
            if (error.name !== 'AbortError') console.error(error);
        });

        exportPngButton?.addEventListener('click', () => shell.exportPNG());
        exportSvgButton?.addEventListener('click', () => shell.exportSVG());
        exportSequenceButton?.addEventListener('click', () => exportAnimation('png-sequence'));
        exportMp4Button?.addEventListener('click', () => exportAnimation('mp4'));

        document.getElementById('candidateCountSelect')?.addEventListener('change', (event) => {
            const candidateCount = Number(event.target.value);
            const finalistCount = Math.min(shell.settings.finalistCount, candidateCount);
            applySettings(shell, { candidateCount, finalistCount });
        });
        document.getElementById('finalistCountSelect')?.addEventListener('change', (event) => {
            applySettings(shell, { finalistCount: Number(event.target.value) });
        });
        document.getElementById('phaseModeSelect')?.addEventListener('change', (event) => {
            applySettings(shell, { phaseMode: event.target.value });
        });
        document.querySelectorAll('input[name="patternType"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked) applySettings(shell, { patternType: input.value });
            });
        });
        document.querySelectorAll('input[name="layoutMode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked) applySettings(shell, { layoutMode: input.value });
            });
        });
        document.getElementById('motionPlayBtn')?.addEventListener('click', () => {
            if (!shell.settings.animate) {
                motionPhase = 0;
                motionGeneration = -1;
            }
            shell.settingsStore.set('animate', !shell.settings.animate);
        });
        document.getElementById('restartMotionBtn')?.addEventListener('click', () => {
            motionPhase = 0;
            motionGeneration = -1;
            if (!shell.settings.animate) shell.settingsStore.set('animate', true);
            else shell.renderNow();
        });
        document.getElementById('helpBtn')?.addEventListener('click', () => {
            shell.dialog?.alert({
                title: 'Cascade',
                text: 'Two related selection structures. Cascade halves continuous channels at every stage. Sierpinski recursively keeps three corner triangles and removes the inverted center, with the complete construction pointing downward. Candidates and Finalists control its recursion depth and number of final root triangles. When one finalist remains, the black area after its apex acts as the final empty stage.'
            });
        });

        shell.settingsStore.subscribe('animate', () => syncMotion(shell));
        shell.settingsStore.subscribe('patternType', () => syncCustomControls(shell));
        shell.settingsStore.subscribe('layoutMode', () => syncCustomControls(shell));
        shell.settingsStore.subscribe('phaseMode', () => syncCustomControls(shell));
        syncCustomControls(shell);
        syncMotion(shell);
    }
});

export default app;
