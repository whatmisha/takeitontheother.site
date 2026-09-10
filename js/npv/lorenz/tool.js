import { defineTool } from '../framework/src/core/defineTool.js';
import { LorenzAnimationExporter } from './src/animationExporter.js';
import { CLASSIC_LORENZ, integrateLorenz } from './src/lorenz.js';
import { advanceMotionPhase } from './src/motion.js';
import { renderLorenzCanvas, renderLorenzSvg } from './src/renderer.js';

const DEFAULT_VIEW = Object.freeze({ rotationX: 12, rotationY: 120, rotationZ: 0, perspective: 100 });
const DYNAMIC_KEYS = ['systemType', 'wingCount', 'sigma', 'rho', 'beta', 'x0', 'y0', 'z0', 'dt', 'pointCount', 'warmupSteps', 'sampleStride'];

const wrapDegrees = (value) => ((Number(value) + 180) % 360 + 360) % 360 - 180;
const pad = (value) => String(value).padStart(2, '0');

function animationBaseName(date = new Date()) {
    return `lorenz_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
        + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

let trajectoryCache = null;
let trajectoryKey = '';
let motionPhase = 0;
let motionFrameId = null;
let motionLastTime = null;

function dynamicsKey(settings) {
    return DYNAMIC_KEYS.map((key) => settings[key]).join('|');
}

function trajectoryFor(settings) {
    const key = dynamicsKey(settings);
    if (trajectoryCache && key === trajectoryKey) return trajectoryCache;
    trajectoryKey = key;
    trajectoryCache = integrateLorenz(settings);
    return trajectoryCache;
}

function updateStatus(settings, trajectory, pixelCount) {
    const output = document.getElementById('trajectoryStatus');
    const countLabel = document.getElementById('pixelCountLabel');
    if (countLabel) {
        const kind = settings.animateParticles ? 'animated vector pixels' : 'unique vector pixels';
        countLabel.textContent = trajectory.diverged
            ? `${pixelCount.toLocaleString()} pixels before divergence`
            : `${pixelCount.toLocaleString()} ${kind}`;
    }
    if (!output) return;
    if (trajectory.diverged) {
        output.textContent = `Trajectory stopped at ${trajectory.pointCount.toLocaleString()} points — reduce step or parameters`;
        output.classList.add('is-visible');
    } else {
        output.textContent = `${pixelCount.toLocaleString()} vector pixels`;
        output.classList.toggle('is-visible', Boolean(settings.showStatus));
    }
}

function syncSystemControls(shell) {
    const proto = shell.settings.systemType === 'protoLorenz';
    document.querySelectorAll('input[name="attractorSystem"]').forEach((input) => {
        input.checked = input.value === shell.settings.systemType;
    });
    shell.sliders?.setEnabled('wingCountSlider', proto);
    document.getElementById('wingCountSlider')
        ?.closest('.control-group')
        ?.classList.toggle('disabled', !proto);
    const xLabel = document.getElementById('initialXLabel');
    const yLabel = document.getElementById('initialYLabel');
    if (xLabel) xLabel.textContent = proto ? 'Initial P' : 'Initial X';
    if (yLabel) yLabel.textContent = proto ? 'Initial Q' : 'Initial Y';
}

function syncMotionButton(shell) {
    const playing = Boolean(shell.settings.animateParticles);
    const button = document.getElementById('motionPlayBtn');
    if (button) {
        button.classList.toggle('is-playing', playing);
        button.setAttribute('aria-pressed', playing ? 'true' : 'false');
        button.textContent = playing ? 'Ⅱ Pause' : '▶ Play';
    }
    const restart = document.getElementById('restartMotionBtn');
    if (restart) restart.disabled = !playing;
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
        if (!shell.settings.animateParticles) {
            stopMotion();
            syncMotionButton(shell);
            return;
        }
        const elapsed = Math.max(0, Math.min(64, time - motionLastTime));
        motionPhase = advanceMotionPhase(motionPhase, elapsed, shell.settings.motionSpeed);
        motionLastTime = time;
        shell.renderNow();
        motionFrameId = requestAnimationFrame(tick);
    };
    motionFrameId = requestAnimationFrame(tick);
}

function syncMotion(shell) {
    syncMotionButton(shell);
    if (shell.settings.animateParticles) startMotion(shell);
    else stopMotion();
}

function applySettings(shell, patch) {
    shell.settingsStore.setMultiple(patch);
    shell._syncControls();
}

const app = defineTool({
    renderer: 'canvas',
    autoStart: true,
    dom: { canvas: 'canvasContainer', surface: 'mainCanvas', zoomIndicator: 'zoomIndicator' },
    settings: {
        width: 960,
        height: 960,
        systemType: 'lorenz63',
        wingCount: 3,
        sigma: CLASSIC_LORENZ.sigma,
        rho: CLASSIC_LORENZ.rho,
        beta: CLASSIC_LORENZ.beta,
        x0: CLASSIC_LORENZ.x0,
        y0: CLASSIC_LORENZ.y0,
        z0: CLASSIC_LORENZ.z0,
        dt: 0.005,
        pointCount: 24000,
        warmupSteps: 1800,
        sampleStride: 1,
        pixelWidth: 2,
        pixelHeight: 2,
        gridStep: 2,
        pixelColor: '#ffffff',
        backgroundColor: '#000000',
        transparentExport: false,
        depthStretch: 1,
        animateParticles: false,
        motionSpeed: 0.01,
        motionDuration: 10,
        particleCount: 600,
        trailLength: 8,
        viewScale: 1,
        ...DEFAULT_VIEW,
        showAxes: false,
        showStatus: false
    },
    controls: {
        sliders: [
            { id: 'sigmaSlider', valueId: 'sigmaValue', setting: 'sigma', min: 0.1, max: 30, decimals: 1, baseStep: 0.1 },
            { id: 'rhoSlider', valueId: 'rhoValue', setting: 'rho', min: 0, max: 100, decimals: 1, baseStep: 0.1 },
            { id: 'betaSlider', valueId: 'betaValue', setting: 'beta', min: 0.1, max: 10, decimals: 3, baseStep: 0.001, shiftStep: 0.1 },
            { id: 'wingCountSlider', valueId: 'wingCountValue', setting: 'wingCount', min: 3, max: 8, decimals: 0, baseStep: 1 },
            { id: 'rotationXSlider', valueId: 'rotationXValue', setting: 'rotationX', min: -180, max: 180, decimals: 0, baseStep: 1, suffix: '°' },
            { id: 'rotationYSlider', valueId: 'rotationYValue', setting: 'rotationY', min: -180, max: 180, decimals: 0, baseStep: 1, suffix: '°' },
            { id: 'rotationZSlider', valueId: 'rotationZValue', setting: 'rotationZ', min: -180, max: 180, decimals: 0, baseStep: 1, suffix: '°' },
            { id: 'perspectiveSlider', valueId: 'perspectiveValue', setting: 'perspective', min: 0, max: 100, decimals: 0, baseStep: 1 },
            { id: 'depthStretchSlider', valueId: 'depthStretchValue', setting: 'depthStretch', min: 0.5, max: 3, decimals: 2, baseStep: 0.05, shiftStep: 0.25, suffix: '×' },
            { id: 'viewScaleSlider', valueId: 'viewScaleValue', setting: 'viewScale', min: 0.4, max: 1.3, decimals: 2, baseStep: 0.01, shiftStep: 0.1 },
            { id: 'pointCountSlider', valueId: 'pointCountValue', setting: 'pointCount', min: 1000, max: 100000, decimals: 0, baseStep: 1000, shiftStep: 10000 },
            { id: 'sampleStrideSlider', valueId: 'sampleStrideValue', setting: 'sampleStride', min: 1, max: 12, decimals: 0, baseStep: 1 },
            { id: 'motionSpeedSlider', valueId: 'motionSpeedValue', setting: 'motionSpeed', min: 0.01, max: 4, decimals: 2, baseStep: 0.01, shiftStep: 0.1, suffix: '×' },
            { id: 'motionDurationSlider', valueId: 'motionDurationValue', setting: 'motionDuration', min: 1, max: 30, decimals: 0, baseStep: 1, shiftStep: 5, suffix: ' s' },
            { id: 'particleCountSlider', valueId: 'particleCountValue', setting: 'particleCount', min: 100, max: 3000, decimals: 0, baseStep: 100, shiftStep: 500 },
            { id: 'trailLengthSlider', valueId: 'trailLengthValue', setting: 'trailLength', min: 0, max: 24, decimals: 0, baseStep: 1 },
            { id: 'dtSlider', valueId: 'dtValue', setting: 'dt', min: 0.001, max: 0.02, decimals: 3, baseStep: 0.001, shiftStep: 0.005 },
            { id: 'warmupStepsSlider', valueId: 'warmupStepsValue', setting: 'warmupSteps', min: 0, max: 10000, decimals: 0, baseStep: 100, shiftStep: 1000 },
            { id: 'x0Slider', valueId: 'x0Value', setting: 'x0', min: -30, max: 30, decimals: 1, baseStep: 0.1, shiftStep: 1 },
            { id: 'y0Slider', valueId: 'y0Value', setting: 'y0', min: -30, max: 30, decimals: 1, baseStep: 0.1, shiftStep: 1 },
            { id: 'z0Slider', valueId: 'z0Value', setting: 'z0', min: -10, max: 60, decimals: 2, baseStep: 0.05, shiftStep: 1 },
            { id: 'pixelWidthSlider', valueId: 'pixelWidthValue', setting: 'pixelWidth', min: 0.5, max: 16, decimals: 2, baseStep: 0.25, shiftStep: 1 },
            { id: 'pixelHeightSlider', valueId: 'pixelHeightValue', setting: 'pixelHeight', min: 0.5, max: 16, decimals: 2, baseStep: 0.25, shiftStep: 1 },
            { id: 'gridStepSlider', valueId: 'gridStepValue', setting: 'gridStep', min: 0, max: 16, decimals: 2, baseStep: 0.25, shiftStep: 1 }
        ],
        toggles: true
    },
    panels: [
        { id: 'systemPanel', headerId: 'systemPanelHeader', persistent: true },
        { id: 'viewPanel', headerId: 'viewPanelHeader', persistent: true },
        { id: 'generationPanel', headerId: 'generationPanelHeader', persistent: true },
        { id: 'appearancePanel', headerId: 'appearancePanelHeader', persistent: true }
    ],
    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'pixel', setting: 'pixelColor', label: 'Pixel', itemId: 'pixelColorItem', dotId: 'pixelColorPreview', hexId: 'pixelColorHex', hsbSlotId: 'pixelColorHsbSlot' },
            { type: 'background', setting: 'backgroundColor', label: 'Background', itemId: 'backgroundColorItem', dotId: 'backgroundColorPreview', hexId: 'backgroundColorHex', hsbSlotId: 'backgroundColorHsbSlot' }
        ]
    },
    presets: {
        storageKey: 'othersiteLorenzAttractorV6',
        basePath: 'presets',
        defaultName: 'Classic',
        colorDots: (blob) => [{ kind: 'solid', value: blob.pixelColor || '#ffffff' }]
    },
    share: { quantizableFloatKeys: ['sigma', 'rho', 'beta', 'x0', 'y0', 'z0', 'dt', 'viewScale', 'pixelWidth', 'pixelHeight', 'gridStep', 'depthStretch', 'motionSpeed'] },
    export: { filename: 'lorenz-attractor.svg' },
    shortcuts: {
        'mod+shift+e': (shell) => { void shell.exportPNG(); }
    },
    zoom: { fitPadding: { top: 44, right: 44, bottom: 44, left: 44 } },
    render({ ctx2d, width, height, settings }) {
        const trajectory = trajectoryFor(settings);
        const rendered = renderLorenzCanvas(ctx2d, width, height, settings, trajectory, { motionPhase });
        updateStatus(settings, trajectory, rendered.pixelCount);
    },
    renderTo({ ctx2d, width, height, settings }) {
        renderLorenzCanvas(ctx2d, width, height, settings, trajectoryFor(settings), {
            transparent: settings.transparentExport,
            motionPhase
        });
    },
    renderSVG({ width, height, settings }) {
        return renderLorenzSvg(width, height, settings, trajectoryFor(settings), { motionPhase });
    },
    syncControls(shell) {
        syncSystemControls(shell);
        syncMotionButton(shell);
    },
    onChromeRefresh(shell) {
        syncSystemControls(shell);
        syncMotion(shell);
    },
    onReady(shell) {
        const exportPngButton = document.getElementById('exportPngBtn');
        const exportSvgButton = document.getElementById('exportSvgBtn');
        const exportSequenceButton = document.getElementById('exportPngSequenceBtn');
        const exportMp4Button = document.getElementById('exportMp4Btn');
        const animationExporter = new LorenzAnimationExporter({
            container: document.getElementById('bottomButtons'),
            status: document.getElementById('animationExportStatus'),
            progress: document.getElementById('animationExportProgress'),
            message: document.getElementById('animationExportMessage'),
            cancelButton: document.getElementById('cancelAnimationExport'),
            buttons: [
                exportPngButton,
                exportSvgButton,
                exportSequenceButton,
                exportMp4Button,
                document.getElementById('transparentExport')
            ],
            onError: (error) => shell.dialog?.alert({
                title: 'Export failed',
                text: error.message
            })
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
        document.getElementById('classicValuesBtn')?.addEventListener('click', () => {
            applySettings(shell, CLASSIC_LORENZ);
        });
        document.getElementById('resetViewBtn')?.addEventListener('click', () => {
            applySettings(shell, { ...DEFAULT_VIEW, viewScale: 1 });
        });
        document.getElementById('motionPlayBtn')?.addEventListener('click', () => {
            shell.settingsStore.set('animateParticles', !shell.settings.animateParticles);
        });
        document.getElementById('restartMotionBtn')?.addEventListener('click', () => {
            motionPhase = 0;
            shell.renderNow();
        });
        shell.settingsStore.subscribe('animateParticles', () => syncMotion(shell));
        shell.settingsStore.subscribe('systemType', () => syncSystemControls(shell));
        syncMotion(shell);
        document.getElementById('helpBtn')?.addEventListener('click', () => {
            shell.dialog?.alert({
                title: 'Lorenz',
                text: 'Lorenz-63 and multi-wing Proto-Lorenz trajectories built from vector pixels. Drag to rotate, use the trackpad to pan, and Cmd/Ctrl + wheel to zoom. MP4 includes the selected background; PNG sequence follows the Transparent toggle.'
            });
        });

        document.querySelectorAll('input[name="attractorSystem"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked) applySettings(shell, { systemType: input.value });
            });
        });

        const canvas = document.getElementById('mainCanvas');
        const container = document.getElementById('canvasContainer');
        let drag = null;
        canvas?.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) return;
            drag = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                rotationX: shell.settings.rotationX,
                rotationY: shell.settings.rotationY
            };
            canvas.setPointerCapture(event.pointerId);
            container.classList.add('is-rotating');
        });
        canvas?.addEventListener('pointermove', (event) => {
            if (!drag || event.pointerId !== drag.id) return;
            const rotationY = wrapDegrees(drag.rotationY + (event.clientX - drag.x) * 0.35);
            const rotationX = wrapDegrees(drag.rotationX - (event.clientY - drag.y) * 0.35);
            shell.settingsStore.setMultiple({
                rotationY,
                rotationX
            });
            document.getElementById('rotationYSlider').value = String(rotationY);
            document.getElementById('rotationYValue').value = `${Math.round(rotationY)}°`;
            document.getElementById('rotationXSlider').value = String(rotationX);
            document.getElementById('rotationXValue').value = `${Math.round(rotationX)}°`;
        });
        const finishDrag = (event) => {
            if (!drag || event.pointerId !== drag.id) return;
            drag = null;
            container.classList.remove('is-rotating');
        };
        canvas?.addEventListener('pointerup', finishDrag);
        canvas?.addEventListener('pointercancel', finishDrag);
    }
});

export default app;
