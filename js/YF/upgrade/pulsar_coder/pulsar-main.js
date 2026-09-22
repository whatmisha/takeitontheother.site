/**
 * Pulsar Coder v2 browser controller.
 *
 * Version 2 is intentionally a new format: previously generated artwork is
 * not accepted by the decoder. The codec, geometry, and importers live in
 * separate pure modules so the visual editor and regression tests use the
 * same implementation.
 */

import {
    DialogHost,
    OverlayDialogHost,
    PanelManager,
    SliderController
} from './js/framework/FrameworkAdapter.js?v=g5-feedback-2';
import { ZoomPanManager } from './js/ui/ZoomPanManager.js?v=g13-ui-repair-1';
import { downloadPulsarSvg } from './js/export/PulsarSvgExport.js?v=g7-export-1';
import { downloadPulsarPng } from './js/export/PulsarPngExport.js?v=v2-1';
import * as PulsarCodec from './js/codec/PulsarCodec.js?v=v2-1';
import { buildPulsarSvg, createPulsarGeometry } from './js/geometry/PulsarGeometry.js?v=v2-2';
import { decodePulsarSvg } from './js/decode/PulsarSvgDecoder.js?v=v2-1';
import { decodePulsarRaster } from './js/decode/PulsarRasterDecoder.js?v=v2-1';

const settings = {
    values: {
        payload: 'The truth is out there',
        rayCount: 14,
        rayLength: 250,
        bitStep: 8,
        tickShort: 4,
        tickLong: 12,
        eccMode: 'none',
        strokeWidth: 1.5,
        showRays: true,
        seed: 'voyager1977',
        margin: 50,
        centerOffsetX: 0,
        centerOffsetY: 0
    },
    get(key) {
        return this.values[key];
    },
    set(key, value) {
        this.values[key] = value;
    }
};

const presets = Object.freeze({
    voyager: {
        rayCount: 14,
        rayLength: 350,
        bitStep: 8,
        tickShort: 4,
        tickLong: 8,
        strokeWidth: 1.5,
        margin: 50,
        seed: 'voyager1977'
    },
    dense: {
        rayCount: 20,
        rayLength: 380,
        bitStep: 6,
        tickShort: 3,
        tickLong: 7,
        strokeWidth: 1.2,
        margin: 40,
        seed: 'dense2024'
    },
    minimal: {
        rayCount: 8,
        rayLength: 320,
        bitStep: 10,
        tickShort: 5,
        tickLong: 10,
        strokeWidth: 2,
        margin: 60,
        seed: 'minimal'
    },
    accurate: {
        rayCount: 16,
        rayLength: 360,
        bitStep: 7,
        tickShort: 4,
        tickLong: 8,
        strokeWidth: 1.5,
        margin: 50,
        seed: 'accurate42'
    }
});

const sliderDefinitions = Object.freeze([
    { id: 'rayCountSlider', valueId: 'rayCountValue', setting: 'rayCount', decimals: 0, min: 8, max: 24, baseStep: 1, shiftStep: 2 },
    { id: 'rayLengthSlider', valueId: 'rayLengthValue', setting: 'rayLength', decimals: 0, min: 200, max: 500, baseStep: 10, shiftStep: 50 },
    { id: 'bitStepSlider', valueId: 'bitStepValue', setting: 'bitStep', decimals: 1, min: 4, max: 16, baseStep: 0.5, shiftStep: 2 },
    { id: 'tickShortSlider', valueId: 'tickShortValue', setting: 'tickShort', decimals: 1, min: 2, max: 12, baseStep: 0.5, shiftStep: 2 },
    { id: 'tickLongSlider', valueId: 'tickLongValue', setting: 'tickLong', decimals: 1, min: 4, max: 20, baseStep: 0.5, shiftStep: 2 },
    { id: 'strokeWidthSlider', valueId: 'strokeWidthValue', setting: 'strokeWidth', decimals: 1, min: 0.5, max: 4, baseStep: 0.1, shiftStep: 0.5 },
    { id: 'marginSlider', valueId: 'marginValue', setting: 'margin', decimals: 0, min: 20, max: 100, baseStep: 5, shiftStep: 10 }
]);

let currentSvg = '';
let currentRaysBits = [];
let currentGeometry = null;
let currentMetadata = null;
let feedbackDialogHost = null;
let verifyModalHost = null;

function getParams() {
    return {
        rayCount: settings.get('rayCount'),
        rayLength: settings.get('rayLength'),
        bitStep: settings.get('bitStep'),
        tickShort: settings.get('tickShort'),
        tickLong: settings.get('tickLong'),
        eccMode: settings.get('eccMode'),
        strokeWidth: settings.get('strokeWidth'),
        showRays: settings.get('showRays'),
        seed: settings.get('seed'),
        margin: settings.get('margin'),
        centerOffsetX: settings.get('centerOffsetX'),
        centerOffsetY: settings.get('centerOffsetY')
    };
}

function showGenerateFirst() {
    return feedbackDialogHost.alert({
        title: 'Nothing to export',
        text: 'Generate a Pulsar map first.'
    });
}

function render(preserveEndpoints = false, { updateExport = true, viewBox = null } = {}) {
    const params = getParams();
    const payload = settings.get('payload') ?? '';
    if (!preserveEndpoints || !currentRaysBits.length || !currentMetadata) {
        const encoded = PulsarCodec.encodePulsar(payload, params);
        currentRaysBits = encoded.raysBits;
        currentMetadata = encoded.metadata;
    }
    if (!preserveEndpoints) currentGeometry = null;
    currentGeometry = createPulsarGeometry(params, currentRaysBits, currentGeometry, preserveEndpoints);

    const interfaceSvg = buildPulsarSvg(params, currentGeometry, currentMetadata, { forExport: false });
    if (updateExport) currentSvg = buildPulsarSvg(params, currentGeometry, currentMetadata, { forExport: true });

    const target = document.getElementById('pulsarSvg');
    const parsed = new DOMParser().parseFromString(interfaceSvg, 'image/svg+xml').documentElement;
    target.setAttribute('viewBox', viewBox || parsed.getAttribute('viewBox'));
    target.innerHTML = parsed.innerHTML;

    document.getElementById('infoPayloadBytes').textContent = `${currentMetadata.payloadByteLength} bytes`;
    document.getElementById('infoEncodedBits').textContent = `${currentMetadata.encodedLength} bits`;
    document.getElementById('infoCrc').textContent = currentMetadata.crcHex;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function showDecodeResult(result, label = 'Verification') {
    const body = document.getElementById('verifyModalBody');
    document.getElementById('verifyModalTitle').textContent = `${label} Result`;
    if (result.success) {
        body.innerHTML = `
            <p class="verify-success">✓ Pulsar v2 decoded successfully</p>
            <h3>Decoded message</h3>
            <pre>${escapeHtml(result.payloadText)}</pre>
            <p><strong>Source:</strong> ${escapeHtml(result.source || 'generated data')}</p>
            <p><strong>Payload:</strong> ${result.payloadLength / 8} bytes</p>
            <p><strong>CRC32:</strong> 0x${result.expectedCrc.toString(16).toUpperCase().padStart(8, '0')}</p>
            <p><strong>ECC:</strong> ${escapeHtml(result.details.eccMode)}</p>
            <p><strong>Rays:</strong> ${result.details.rayCount}</p>
        `;
    } else {
        body.innerHTML = `
            <p class="verify-error">✗ Pulsar v2 could not be decoded</p>
            <p>${escapeHtml(result.error || 'CRC mismatch or corrupted data')}</p>
        `;
    }
    verifyModalHost.open();
}

function verify() {
    if (!currentRaysBits.length) {
        void showGenerateFirst();
        return;
    }
    showDecodeResult(PulsarCodec.verifyPulsar(currentRaysBits));
}

async function handleDecodeFile(file) {
    if (!file) return;
    try {
        const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
        const result = isSvg
            ? decodePulsarSvg(await file.text())
            : await decodePulsarRaster(file);
        showDecodeResult(result, 'Decode');
    } catch (error) {
        showDecodeResult({ success: false, error: error.message }, 'Decode');
    }
}

function downloadSvg() {
    if (!currentSvg) {
        void showGenerateFirst();
        return;
    }
    downloadPulsarSvg(currentSvg);
}

async function downloadPng() {
    if (!currentSvg) {
        void showGenerateFirst();
        return;
    }
    const button = document.getElementById('pngBtn');
    button.disabled = true;
    try {
        await downloadPulsarPng(currentSvg);
    } catch (error) {
        await feedbackDialogHost.alert({ title: 'PNG export failed', text: error.message });
    } finally {
        button.disabled = false;
    }
}

async function copySvg() {
    if (!currentSvg) {
        void showGenerateFirst();
        return;
    }
    try {
        await navigator.clipboard.writeText(currentSvg);
        const button = document.getElementById('copyBtn');
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        button.classList.add('btn-success-flash');
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('btn-success-flash');
        }, 1500);
    } catch (error) {
        await feedbackDialogHost.alert({ title: 'Copy failed', text: error.message });
    }
}

function setControlValue(setting, value) {
    settings.set(setting, value);
    const definition = sliderDefinitions.find(item => item.setting === setting);
    if (!definition) return;
    const slider = document.getElementById(definition.id);
    const input = document.getElementById(definition.valueId);
    if (slider) slider.value = value;
    if (input) input.value = Number(value).toFixed(definition.decimals);
}

function enforceTickContrast() {
    const minimumLong = settings.get('tickShort') * 1.5;
    if (settings.get('tickLong') < minimumLong) setControlValue('tickLong', minimumLong);
}

function applyPreset(name) {
    const preset = presets[name];
    if (!preset) return;
    for (const [key, value] of Object.entries(preset)) setControlValue(key, value);
    document.getElementById('seedInput').value = preset.seed;
    render();
}

function bindPresetMenu() {
    const toggle = document.getElementById('presetDropdownToggle');
    const menu = document.getElementById('presetDropdownMenu');
    const label = document.getElementById('presetDropdownText');
    toggle.addEventListener('click', () => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!isExpanded));
        menu.classList.toggle('active');
    });
    document.querySelectorAll('.preset-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.preset-dropdown-item').forEach(candidate => candidate.classList.remove('selected'));
            item.classList.add('selected');
            label.textContent = item.textContent;
            applyPreset(item.dataset.preset);
            toggle.setAttribute('aria-expanded', 'false');
            menu.classList.remove('active');
        });
    });
    document.addEventListener('click', event => {
        if (!event.target.closest('.preset-dropdown')) {
            toggle.setAttribute('aria-expanded', 'false');
            menu.classList.remove('active');
        }
    });
}

function bindCenterDragging() {
    const svg = document.getElementById('pulsarSvg');
    const container = document.getElementById('canvasContainer');
    let drag = null;
    let renderFrame = 0;

    container.addEventListener('mousedown', event => {
        if (event.button !== 0) return;
        const matrix = svg.getScreenCTM();
        if (!matrix) return;
        drag = {
            clientX: event.clientX,
            clientY: event.clientY,
            inverse: matrix.inverse(),
            offsetX: settings.get('centerOffsetX'),
            offsetY: settings.get('centerOffsetY'),
            viewBox: svg.getAttribute('viewBox')
        };
        container.style.cursor = 'grabbing';
        event.preventDefault();
        event.stopPropagation();
    }, true);

    document.addEventListener('mousemove', event => {
        if (!drag) return;
        const screenX = event.clientX - drag.clientX;
        const screenY = event.clientY - drag.clientY;
        const deltaX = drag.inverse.a * screenX + drag.inverse.c * screenY;
        const deltaY = drag.inverse.b * screenX + drag.inverse.d * screenY;
        settings.set('centerOffsetX', drag.offsetX + deltaX);
        settings.set('centerOffsetY', drag.offsetY + deltaY);
        if (!renderFrame) {
            renderFrame = requestAnimationFrame(() => {
                renderFrame = 0;
                if (drag) render(true, { updateExport: false, viewBox: drag.viewBox });
            });
        }
    });
    document.addEventListener('mouseup', () => {
        if (!drag) return;
        if (renderFrame) {
            cancelAnimationFrame(renderFrame);
            renderFrame = 0;
        }
        drag = null;
        container.style.cursor = 'grab';
        render(true);
    });
    container.style.cursor = 'grab';
}

function bindFileDrop() {
    const container = document.getElementById('canvasContainer');
    container.addEventListener('dragover', event => {
        event.preventDefault();
        container.classList.add('is-file-dragover');
    });
    container.addEventListener('dragleave', () => container.classList.remove('is-file-dragover'));
    container.addEventListener('drop', async event => {
        event.preventDefault();
        container.classList.remove('is-file-dragover');
        await handleDecodeFile(event.dataTransfer.files[0]);
    });
}

function initialize() {
    feedbackDialogHost = new DialogHost({
        dialog: 'feedbackDialog',
        title: 'feedbackDialogTitle',
        text: 'feedbackDialogText',
        input: 'feedbackDialogInput',
        buttons: 'feedbackDialogButtons'
    });
    verifyModalHost = new OverlayDialogHost({
        overlayId: 'verifyModal',
        closeButtonId: 'modalClose',
        triggerId: 'verifyBtn',
        bindTrigger: false
    }).init();

    const sliderController = new SliderController(settings);
    sliderDefinitions.forEach(definition => {
        sliderController.initSlider(definition.id, {
            valueId: definition.valueId,
            setting: definition.setting,
            decimals: definition.decimals,
            min: definition.min,
            max: definition.max,
            baseStep: definition.baseStep,
            shiftStep: definition.shiftStep,
            onUpdate: () => {
                enforceTickContrast();
                render();
            }
        });
        const initial = Number(document.getElementById(definition.id).value);
        if (Number.isFinite(initial)) settings.set(definition.setting, initial);
    });

    const panelManager = new PanelManager();
    panelManager.registerPanel('mainPanel', { headerId: 'mainPanelHeader', draggable: true, persistent: true });
    panelManager.registerPanel('encodingPanel', { headerId: 'encodingPanelHeader', draggable: true, persistent: true });
    panelManager.registerPanel('visualPanel', { headerId: 'visualPanelHeader', draggable: true, persistent: true });
    panelManager.initCollapse();

    const container = document.getElementById('canvasContainer');
    const zoomPanManager = new ZoomPanManager(container, document.getElementById('pulsarSvg'));
    container.addEventListener('zoomchange', event => {
        document.getElementById('zoomIndicator').textContent = `${event.detail.percent}%`;
    });
    document.getElementById('zoomIndicator').addEventListener('click', () => zoomPanManager.resetZoom());

    const payloadInput = document.getElementById('payloadInput');
    const charCounter = document.getElementById('charCounter');
    settings.set('payload', payloadInput.value);
    charCounter.textContent = `${payloadInput.value.length} characters`;
    let payloadTimeout = null;
    payloadInput.addEventListener('input', () => {
        settings.set('payload', payloadInput.value);
        charCounter.textContent = `${payloadInput.value.length} characters`;
        clearTimeout(payloadTimeout);
        payloadTimeout = setTimeout(() => render(), 350);
    });

    document.querySelectorAll('input[name="eccMode"]').forEach(radio => {
        if (radio.checked) settings.set('eccMode', radio.value);
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            settings.set('eccMode', radio.value);
            render();
        });
    });

    const showRays = document.getElementById('showRays');
    const seedInput = document.getElementById('seedInput');
    settings.set('showRays', showRays.checked);
    settings.set('seed', seedInput.value || 'voyager1977');
    showRays.addEventListener('change', () => {
        settings.set('showRays', showRays.checked);
        render();
    });
    seedInput.addEventListener('change', () => {
        settings.set('seed', seedInput.value || 'voyager1977');
        render();
    });

    document.getElementById('downloadBtn').addEventListener('click', downloadSvg);
    document.getElementById('pngBtn').addEventListener('click', () => void downloadPng());
    document.getElementById('copyBtn').addEventListener('click', () => void copySvg());
    document.getElementById('verifyBtn').addEventListener('click', verify);
    document.getElementById('resetCenterBtn').addEventListener('click', () => {
        settings.set('centerOffsetX', 0);
        settings.set('centerOffsetY', 0);
        render();
    });
    document.getElementById('randomizeBtn').addEventListener('click', () => {
        const seed = Math.random().toString(36).slice(2, 10);
        seedInput.value = seed;
        settings.set('seed', seed);
        render();
    });

    const decodeInput = document.getElementById('decodeInput');
    document.getElementById('decodeBtn').addEventListener('click', () => decodeInput.click());
    decodeInput.addEventListener('change', async () => {
        await handleDecodeFile(decodeInput.files[0]);
        decodeInput.value = '';
    });

    bindPresetMenu();
    bindCenterDragging();
    bindFileDrop();
    render();
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', initialize);

export * from './js/codec/PulsarCodec.js';
export { buildPulsarSvg, createPulsarGeometry, makeAngles, seededRandom } from './js/geometry/PulsarGeometry.js';
export { decodePulsarSvg } from './js/decode/PulsarSvgDecoder.js';
export { decodePulsarBinaryImage, imageDataToBinary } from './js/decode/PulsarRasterDecoder.js';
