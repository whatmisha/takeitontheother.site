import { defineTool } from './framework/src/core/defineTool.js';
import {
    DEFAULT_GEOMETRY,
    buildCharacterGeometry
} from './src/geometry/characterGeometry.js';
import { buildEyeGeometry } from './src/geometry/eyeGeometry.js';
import {
    createSparkyExportBaseName,
    createSparkySettingsDocument
} from './src/export/exportNaming.js';
import { clamp, distance, point, scale, subtract, add } from './src/geometry/vector.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GUIDE_CLIP_ID = 'sparky-artboard-clip';
const HEAD_CLIP_ID = 'sparky-head-clip';

const settings = {
    width: DEFAULT_GEOMETRY.artboardWidth,
    height: DEFAULT_GEOMETRY.artboardHeight,
    boundaryType: DEFAULT_GEOMETRY.boundaryType,
    boundaryCenterX: DEFAULT_GEOMETRY.boundaryCenterX,
    boundaryCenterY: DEFAULT_GEOMETRY.boundaryCenterY,
    boundaryRadius: DEFAULT_GEOMETRY.boundaryRadius,
    boundaryRadiusX: DEFAULT_GEOMETRY.boundaryRadiusX,
    boundaryRadiusY: DEFAULT_GEOMETRY.boundaryRadiusY,
    boundaryRotation: DEFAULT_GEOMETRY.boundaryRotation,
    focusX: DEFAULT_GEOMETRY.focusX,
    focusY: DEFAULT_GEOMETRY.focusY,
    rayCount: DEFAULT_GEOMETRY.rayCount,
    centerAngle: DEFAULT_GEOMETRY.centerAngle,
    angleStep: DEFAULT_GEOMETRY.angleStep,
    angleSpan: DEFAULT_GEOMETRY.angleSpan,
    rayLength: DEFAULT_GEOMETRY.rayLength,
    rayWidth: DEFAULT_GEOMETRY.rayWidth,
    roundness: DEFAULT_GEOMETRY.roundness,
    cornerSmoothing: 0,
    rayOverrides: [{}, {}, {}, {}, {}],
    headColor: '#ffffff',
    eyeColor: '#000000',
    backgroundColor: '#000000',
    showGuides: true,
    showPoint: true,
    eyePerspective: 50,
    eyeSize: 0,
    eyeDistance: -20,
    cute: 0,
    angry: 0
};

const STATE_KEYS = Object.freeze(Object.keys(settings));

function extractState(source) {
    return Object.fromEntries(STATE_KEYS.map((key) => [key, source[key]]));
}

function normalizeIncomingState(source = {}) {
    const normalized = { ...settings, ...source };
    if (source.roundness == null && Number.isFinite(source.cornerRadius)) {
        normalized.roundness = clamp(source.cornerRadius * 6, 0, 100);
    }
    return extractState(normalized);
}

function setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([name, value]) => {
        if (value != null) element.setAttribute(name, String(value));
    });
    return element;
}

function makeSvgElement(tag, attributes = {}) {
    return setAttributes(document.createElementNS(SVG_NS, tag), attributes);
}

function append(parent, ...children) {
    children.forEach((child) => parent.appendChild(child));
    return parent;
}

function createDefinitions(width, height, headPath) {
    const defs = makeSvgElement('defs');
    const guideClip = makeSvgElement('clipPath', { id: GUIDE_CLIP_ID });
    guideClip.appendChild(makeSvgElement('rect', { x: 0, y: 0, width, height }));
    const headClip = makeSvgElement('clipPath', { id: HEAD_CLIP_ID });
    headClip.appendChild(makeSvgElement('path', { d: headPath }));
    append(defs, guideClip, headClip);
    return defs;
}

function drawEyes(ctx, eyeGeometry, definitions) {
    const { create, width, height, settings: state } = ctx;
    const eyes = create('g', {
        fill: state.eyeColor,
        'clip-path': `url(#${HEAD_CLIP_ID})`,
        'data-layer': 'eyes'
    });

    ['left', 'right'].forEach((side) => {
        const eye = eyeGeometry[side];
        const maskId = `sparky-${side}-eye-mask`;
        const mask = create('mask', {
            id: maskId,
            x: 0,
            y: 0,
            width,
            height,
            maskUnits: 'userSpaceOnUse',
            maskContentUnits: 'userSpaceOnUse'
        });
        append(mask,
            create('path', { d: eye.eye1.path, fill: '#ffffff' }),
            create('path', {
                id: `${side}_eye_top`,
                d: eye.top.path,
                fill: '#000000',
                'data-object': `${side}_eye_top`
            }),
            create('path', {
                id: `${side}_eye_bottom`,
                d: eye.bottom.path,
                fill: '#000000',
                'data-object': `${side}_eye_bottom`
            })
        );
        definitions.appendChild(mask);

        const eyeGroup = create('g', { id: `${side}_eye`, 'data-eye': side });
        eyeGroup.appendChild(create('path', {
            id: `${side}_eye1`,
            d: eye.eye1.path,
            mask: `url(#${maskId})`,
            'data-object': `${side}_eye1`
        }));
        eyes.appendChild(eyeGroup);
    });

    return eyes;
}

function drawCharacter(ctx, geometry, eyeGeometry) {
    const { svg, create, width, height, settings: state } = ctx;
    const definitions = createDefinitions(width, height, geometry.rounded.path);
    svg.appendChild(definitions);
    svg.appendChild(create('rect', {
        x: 0,
        y: 0,
        width,
        height,
        fill: state.backgroundColor,
        'data-layer': 'background'
    }));

    svg.appendChild(create('path', {
        d: geometry.rounded.path,
        fill: state.headColor,
        'fill-rule': 'nonzero',
        'data-layer': 'head'
    }));

    svg.appendChild(drawEyes(ctx, eyeGeometry, definitions));

    if (state.showGuides || state.showPoint) drawGuides(ctx, geometry);
}

function drawGuides(ctx, geometry) {
    const { svg, create, width, height } = ctx;
    const state = geometry.values;
    const commonStroke = {
        fill: 'none',
        'stroke-width': 0.75,
        'vector-effect': 'non-scaling-stroke'
    };
    const guides = create('g', {
        'clip-path': `url(#${GUIDE_CLIP_ID})`,
        'aria-hidden': 'true'
    });

    if (state.showGuides) {
        append(guides,
            create('line', {
                x1: state.boundaryCenterX,
                y1: 0,
                x2: state.boundaryCenterX,
                y2: height,
                stroke: '#315bff',
                opacity: 0.55,
                ...commonStroke
            }),
            create('line', {
                x1: 0,
                y1: state.boundaryCenterY,
                x2: width,
                y2: state.boundaryCenterY,
                stroke: '#315bff',
                opacity: 0.55,
                ...commonStroke
            })
        );

        if (geometry.boundary.type === 'circle') {
            guides.appendChild(create('circle', {
                cx: geometry.boundary.center.x,
                cy: geometry.boundary.center.y,
                r: geometry.boundary.radius,
                stroke: '#315bff',
                opacity: 0.8,
                ...commonStroke
            }));
        } else if (geometry.boundary.type === 'ellipse') {
            guides.appendChild(create('ellipse', {
                cx: geometry.boundary.center.x,
                cy: geometry.boundary.center.y,
                rx: geometry.boundary.radiusX,
                ry: geometry.boundary.radiusY,
                transform: `rotate(${geometry.boundary.rotationDeg} ${geometry.boundary.center.x} ${geometry.boundary.center.y})`,
                stroke: '#315bff',
                opacity: 0.8,
                ...commonStroke
            }));
        }

        geometry.rays.forEach((ray) => {
            guides.appendChild(create('path', {
                d: `M ${ray.baseMinus.x} ${ray.baseMinus.y} L ${ray.tip.x} ${ray.tip.y} L ${ray.basePlus.x} ${ray.basePlus.y}`,
                stroke: '#ff4c48',
                opacity: 0.72,
                ...commonStroke
            }));
            guides.appendChild(create('line', {
                x1: ray.baseCenter.x,
                y1: ray.baseCenter.y,
                x2: ray.tip.x,
                y2: ray.tip.y,
                stroke: '#38e972',
                opacity: 0.68,
                ...commonStroke
            }));
        });
    }

    if (state.showPoint) {
        append(guides,
            create('path', {
                d: `M ${geometry.focus.x - 6} ${geometry.focus.y} H ${geometry.focus.x + 6} M ${geometry.focus.x} ${geometry.focus.y - 6} V ${geometry.focus.y + 6}`,
                fill: 'none',
                stroke: '#000000',
                'stroke-width': 2,
                'stroke-linecap': 'square',
                'vector-effect': 'non-scaling-stroke',
                'pointer-events': 'none'
            }),
            create('rect', {
                x: geometry.focus.x - 12,
                y: geometry.focus.y - 12,
                width: 24,
                height: 24,
                fill: 'transparent',
                class: 'sparky-focus-hit-area',
                'data-focus-handle': 'true',
                'data-interactive': 'true',
                'data-export-exclude': 'true'
            })
        );
    }

    svg.appendChild(guides);
}

function renderFailure(ctx, error) {
    const { svg, create, width, height, settings: state } = ctx;
    svg.appendChild(create('rect', { x: 0, y: 0, width, height, fill: state.backgroundColor }));
    const message = create('text', {
        x: width / 2,
        y: height / 2,
        fill: '#ff765f',
        'text-anchor': 'middle',
        class: 'sparky-error-message',
        'data-interactive': 'true'
    });
    message.textContent = 'This combination cannot form a closed character.';
    svg.appendChild(message);
    console.warn('Sparky geometry:', error.message);
}

function constrainFocus(raw, state) {
    let constrained = point(clamp(raw.x, 120, 360), clamp(raw.y, 180, 390));
    if (state.boundaryType !== 'circle') return constrained;

    const center = point(state.boundaryCenterX, state.boundaryCenterY);
    const delta = subtract(constrained, center);
    const magnitude = distance(constrained, center);
    const maximum = state.boundaryRadius - 2;
    if (magnitude > maximum) constrained = add(center, scale(delta, maximum / magnitude));
    return constrained;
}

function pointFromPointer(svg, event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
}

function bindFocusDragging(app) {
    const svg = document.getElementById('mainSvg');
    if (!svg) return;
    let pointerId = null;

    const update = (event) => {
        const raw = pointFromPointer(svg, event);
        if (!raw) return;
        const focus = constrainFocus(raw, app.settings);
        const x = Number(focus.x.toFixed(1));
        const y = Number(focus.y.toFixed(1));
        app.settingsStore.setMultiple({ focusX: x, focusY: y });
        app.sliders?.setValue('focusXSlider', x, false);
        app.sliders?.setValue('focusYSlider', y, false);
    };

    svg.addEventListener('pointerdown', (event) => {
        const handle = event.target.closest?.('[data-focus-handle="true"]');
        if (!handle) return;
        event.preventDefault();
        event.stopPropagation();
        pointerId = event.pointerId;
        svg.setPointerCapture(pointerId);
        app.history?.beginTransaction('focus-drag');
        update(event);
    });

    svg.addEventListener('pointermove', (event) => {
        if (event.pointerId !== pointerId) return;
        event.preventDefault();
        update(event);
    });

    const finish = (event) => {
        if (event.pointerId !== pointerId) return;
        if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
        pointerId = null;
        app.history?.endTransaction();
    };
    svg.addEventListener('pointerup', finish);
    svg.addEventListener('pointercancel', finish);
}

function setFocus(app, x, y) {
    app.settingsStore.setMultiple({ focusX: x, focusY: y });
    app.sliders?.setValue('focusXSlider', x, false);
    app.sliders?.setValue('focusYSlider', y, false);
}

const app = defineTool({
    renderer: 'svg',
    autoStart: true,
    dom: {
        canvas: 'canvasContainer',
        surface: 'mainSvg',
        zoomIndicator: 'zoomIndicator'
    },
    settings,
    controls: {
        sliders: [
            { id: 'rayCountSlider', valueId: 'rayCountValue', setting: 'rayCount', min: 3, max: 13, decimals: 0, baseStep: 1, shiftStep: 2 },
            { id: 'rayLengthSlider', valueId: 'rayLengthValue', setting: 'rayLength', min: 220, max: 360, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'rayWidthSlider', valueId: 'rayWidthValue', setting: 'rayWidth', min: 20, max: 160, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'roundnessSlider', valueId: 'roundnessValue', setting: 'roundness', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'cornerSmoothingSlider', valueId: 'cornerSmoothingValue', setting: 'cornerSmoothing', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'focusXSlider', valueId: 'focusXValue', setting: 'focusX', min: 120, max: 360, decimals: 1, baseStep: 0.5, shiftStep: 5 },
            { id: 'focusYSlider', valueId: 'focusYValue', setting: 'focusY', min: 180, max: 390, decimals: 1, baseStep: 0.5, shiftStep: 5 },
            { id: 'eyePerspectiveSlider', valueId: 'eyePerspectiveValue', setting: 'eyePerspective', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'eyeSizeSlider', valueId: 'eyeSizeValue', setting: 'eyeSize', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'eyeDistanceSlider', valueId: 'eyeDistanceValue', setting: 'eyeDistance', min: -90, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'cuteSlider', valueId: 'cuteValue', setting: 'cute', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'angrySlider', valueId: 'angryValue', setting: 'angry', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 }
        ],
        toggles: true
    },
    panels: [
        { id: 'shapePanel', headerId: 'shapePanelHeader', persistent: true },
        { id: 'focusPanel', headerId: 'focusPanelHeader', persistent: true },
        { id: 'eyesPanel', headerId: 'eyesPanelHeader', persistent: true },
        { id: 'colorsPanel', headerId: 'colorsPanelHeader', persistent: true }
    ],
    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'head', setting: 'headColor', label: 'Head', itemId: 'headColorItem', dotId: 'headColorPreview', hexId: 'headColorHex', hsbSlotId: 'headColorHsbSlot' },
            { type: 'eyes', setting: 'eyeColor', label: 'Eyes', itemId: 'eyeColorItem', dotId: 'eyeColorPreview', hexId: 'eyeColorHex', hsbSlotId: 'eyeColorHsbSlot' },
            { type: 'background', setting: 'backgroundColor', label: 'Background', itemId: 'backgroundColorItem', dotId: 'backgroundColorPreview', hexId: 'backgroundColorHex', hsbSlotId: 'backgroundColorHsbSlot' }
        ]
    },
    presets: {
        storageKey: 'lunnenSparkyGeneratorV1',
        basePath: 'presets',
        defaultName: 'Basic',
        forceSeed: true,
        migrate: (store) => {
            const legacy = store.load('+ Precise Five');
            if (legacy?.seeded === true) store.delete('+ Precise Five');
        },
        pinnedPrefix: '+',
        colorDots: (blob) => [
            { kind: 'solid', value: blob.headColor || '#ffffff' },
            { kind: 'solid', value: blob.backgroundColor || '#000000' }
        ]
    },
    share: {
        stripKeys: ['width', 'height'],
        quantizableFloatKeys: [
            'focusX', 'focusY', 'rayLength', 'rayWidth', 'roundness', 'cornerSmoothing',
            'rayCount', 'angleSpan', 'boundaryCenterX', 'boundaryCenterY', 'boundaryRadius',
            'eyePerspective', 'eyeSize', 'eyeDistance', 'cute', 'angry'
        ],
        decimals: 2
    },
    history: { maxSize: 80, debounceMs: 180 },
    snapshot: (tool) => extractState(tool.settingsStore.toObject()),
    restore: (tool, snapshot) => tool.settingsStore.setMultiple(normalizeIncomingState(snapshot), true),
    collectPreset: (tool) => extractState(tool.settingsStore.toObject()),
    applyPreset: (tool, preset) => tool.settingsStore.setMultiple(normalizeIncomingState(preset), true),
    export: { filename: 'sparky.svg' },
    zoom: { fitPadding: { top: 58, right: 58, bottom: 58, left: 58 } },
    shortcuts: {
        g: (tool) => tool.settingsStore.set('showGuides', !tool.settings.showGuides)
    },
    render(ctx) {
        try {
            const geometry = buildCharacterGeometry(ctx.settings);
            const eyeGeometry = buildEyeGeometry(ctx.settings, geometry);
            ctx.app.characterGeometry = geometry;
            ctx.app.eyeGeometry = eyeGeometry;
            ctx.app.geometryError = null;
            drawCharacter(ctx, geometry, eyeGeometry);
        } catch (error) {
            ctx.app.geometryError = error;
            renderFailure(ctx, error);
        }
    },
    onReady(tool) {
        const frameworkExportSVG = tool.exportSVG.bind(tool);
        const frameworkExportPNG = tool.exportPNG.bind(tool);
        tool.exportSVG = async (filename) => {
            if (filename) return frameworkExportSVG(filename);
            const exportedAt = new Date();
            const baseName = createSparkyExportBaseName(exportedAt);
            await frameworkExportSVG(`${baseName}.svg`);
            const settingsDocument = createSparkySettingsDocument(
                extractState(tool.settingsStore.toObject()),
                baseName,
                exportedAt
            );
            // Keep the two browser downloads in separate tasks. Some browsers
            // discard the first of two synthetic link clicks in the same task.
            window.setTimeout(() => {
                tool.exporter?.exportJSON(settingsDocument, `${baseName}.json`);
            }, 250);
        };
        tool.exportPNG = (filename, scaleFactor) => {
            if (filename) return frameworkExportPNG(filename, scaleFactor);
            return frameworkExportPNG(`${createSparkyExportBaseName()}.png`, scaleFactor);
        };
        bindFocusDragging(tool);
        document.getElementById('resetFocusBtn')?.addEventListener('click', () => {
            setFocus(tool, DEFAULT_GEOMETRY.focusX, DEFAULT_GEOMETRY.focusY);
        });
        document.getElementById('exportSvgBtn')?.addEventListener('click', () => tool.exportSVG());
        document.getElementById('exportPngBtn')?.addEventListener('click', () => tool.exportPNG());
        document.getElementById('introHelpBtn')?.addEventListener('click', () => {
            tool.dialog?.alert({
                title: 'Lunnen Sparky',
                text: 'A mathematically precise parametric character. Change ray geometry, drag the focus, shape the expression, save or share presets, and export SVG, JSON, or PNG. Enabled guides and focus are included in exports.'
            });
        });
    }
});

export default app;
