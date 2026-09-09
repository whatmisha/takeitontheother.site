import { defineTool } from '../framework/src/core/defineTool.js';
import { CLASSIC_LORENZ, integrateLorenz } from './src/lorenz.js';
import { renderLorenzCanvas, renderLorenzSvg } from './src/renderer.js';

const DEFAULT_VIEW = Object.freeze({ rotationX: -8, rotationY: 15, rotationZ: 0, perspective: 34 });
const DYNAMIC_KEYS = ['sigma', 'rho', 'beta', 'x0', 'y0', 'z0', 'dt', 'pointCount', 'warmupSteps', 'sampleStride'];
const FORMAT_DIMENSIONS = Object.freeze({
    square: { width: 960, height: 960 },
    portrait: { width: 864, height: 1080 },
    wide: { width: 1280, height: 720 }
});

const wrapDegrees = (value) => ((Number(value) + 180) % 360 + 360) % 360 - 180;

let trajectoryCache = null;
let trajectoryKey = '';

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
        countLabel.textContent = trajectory.diverged
            ? `${pixelCount.toLocaleString()} pixels before divergence`
            : `${pixelCount.toLocaleString()} unique vector pixels`;
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

function syncFormatControls(shell) {
    document.querySelectorAll('input[name="artboardFormat"]').forEach((input) => {
        input.checked = input.value === shell.settings.format;
    });
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
        format: 'square',
        pixelWidth: 2,
        pixelHeight: 2,
        gridStep: 2,
        opacity: 90,
        pixelColor: '#ffffff',
        backgroundColor: '#000000',
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
            { id: 'rotationXSlider', valueId: 'rotationXValue', setting: 'rotationX', min: -180, max: 180, decimals: 0, baseStep: 1, suffix: '°' },
            { id: 'rotationYSlider', valueId: 'rotationYValue', setting: 'rotationY', min: -180, max: 180, decimals: 0, baseStep: 1, suffix: '°' },
            { id: 'rotationZSlider', valueId: 'rotationZValue', setting: 'rotationZ', min: -180, max: 180, decimals: 0, baseStep: 1, suffix: '°' },
            { id: 'perspectiveSlider', valueId: 'perspectiveValue', setting: 'perspective', min: 0, max: 100, decimals: 0, baseStep: 1 },
            { id: 'viewScaleSlider', valueId: 'viewScaleValue', setting: 'viewScale', min: 0.4, max: 1.3, decimals: 2, baseStep: 0.01, shiftStep: 0.1 },
            { id: 'pointCountSlider', valueId: 'pointCountValue', setting: 'pointCount', min: 1000, max: 100000, decimals: 0, baseStep: 1000, shiftStep: 10000 },
            { id: 'sampleStrideSlider', valueId: 'sampleStrideValue', setting: 'sampleStride', min: 1, max: 12, decimals: 0, baseStep: 1 },
            { id: 'dtSlider', valueId: 'dtValue', setting: 'dt', min: 0.001, max: 0.02, decimals: 3, baseStep: 0.001, shiftStep: 0.005 },
            { id: 'warmupStepsSlider', valueId: 'warmupStepsValue', setting: 'warmupSteps', min: 0, max: 10000, decimals: 0, baseStep: 100, shiftStep: 1000 },
            { id: 'x0Slider', valueId: 'x0Value', setting: 'x0', min: -30, max: 30, decimals: 1, baseStep: 0.1, shiftStep: 1 },
            { id: 'y0Slider', valueId: 'y0Value', setting: 'y0', min: -30, max: 30, decimals: 1, baseStep: 0.1, shiftStep: 1 },
            { id: 'z0Slider', valueId: 'z0Value', setting: 'z0', min: -10, max: 60, decimals: 2, baseStep: 0.05, shiftStep: 1 },
            { id: 'pixelWidthSlider', valueId: 'pixelWidthValue', setting: 'pixelWidth', min: 0.5, max: 16, decimals: 2, baseStep: 0.25, shiftStep: 1 },
            { id: 'pixelHeightSlider', valueId: 'pixelHeightValue', setting: 'pixelHeight', min: 0.5, max: 16, decimals: 2, baseStep: 0.25, shiftStep: 1 },
            { id: 'gridStepSlider', valueId: 'gridStepValue', setting: 'gridStep', min: 0, max: 16, decimals: 2, baseStep: 0.25, shiftStep: 1 },
            { id: 'opacitySlider', valueId: 'opacityValue', setting: 'opacity', min: 5, max: 100, decimals: 0, baseStep: 1, suffix: '%' }
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
        storageKey: 'othersiteLorenzAttractorV1',
        basePath: 'presets',
        defaultName: 'Classic',
        colorDots: (blob) => [{ kind: 'solid', value: blob.pixelColor || '#ffffff' }]
    },
    share: { quantizableFloatKeys: ['sigma', 'rho', 'beta', 'x0', 'y0', 'z0', 'dt', 'opacity', 'viewScale', 'pixelWidth', 'pixelHeight', 'gridStep'] },
    export: { filename: 'lorenz-attractor.svg' },
    shortcuts: {
        'mod+shift+e': (shell) => { void shell.exportPNG(); }
    },
    zoom: { fitPadding: { top: 44, right: 44, bottom: 44, left: 44 } },
    render({ ctx2d, width, height, settings }) {
        const trajectory = trajectoryFor(settings);
        const rendered = renderLorenzCanvas(ctx2d, width, height, settings, trajectory);
        updateStatus(settings, trajectory, rendered.pixelCount);
    },
    renderTo({ ctx2d, width, height, settings }) {
        renderLorenzCanvas(ctx2d, width, height, settings, trajectoryFor(settings));
    },
    renderSVG({ width, height, settings }) {
        return renderLorenzSvg(width, height, settings, trajectoryFor(settings));
    },
    syncControls(shell) {
        syncFormatControls(shell);
    },
    onReady(shell) {
        document.getElementById('exportPngBtn')?.addEventListener('click', () => shell.exportPNG());
        document.getElementById('exportSvgBtn')?.addEventListener('click', () => shell.exportSVG());
        document.getElementById('classicValuesBtn')?.addEventListener('click', () => {
            applySettings(shell, CLASSIC_LORENZ);
        });
        document.getElementById('resetViewBtn')?.addEventListener('click', () => {
            applySettings(shell, { ...DEFAULT_VIEW, viewScale: 1 });
        });
        document.getElementById('helpBtn')?.addEventListener('click', () => {
            shell.dialog?.alert({
                title: 'Lorenz',
                text: 'A parametric Lorenz attractor built from vector pixels. Drag to rotate, use the trackpad to pan, and Cmd/Ctrl + wheel to zoom.'
            });
        });

        document.querySelectorAll('input[name="artboardFormat"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                const dimensions = FORMAT_DIMENSIONS[input.value] || FORMAT_DIMENSIONS.square;
                applySettings(shell, { format: input.value, ...dimensions });
                requestAnimationFrame(() => shell.target.fitToScreen());
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
