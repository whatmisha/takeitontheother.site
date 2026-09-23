/**
 * Pattern Studio — a reference tool built entirely on Othersite UI Framework v3.
 *
 * It contains NO framework code: only a settings declaration, control registry
 * and a `render(ctx)` that draws SVG. Everything else — sliders, the dice/range
 * control, color pickers, draggable/collapsible panels, zoom/pan, undo/redo,
 * presets, share links, export and tooltips — is provided by `defineTool`.
 */
import { defineTool, SeededRandom } from '../src/index.js';
const lerp = (a, b, t) => a + (b - a) * t;

const app = defineTool({
    renderer: 'svg',
    autoStart: true,

    dom: {
        canvas: 'canvasContainer',
        surface: 'mainSvg',
        zoomIndicator: 'zoomIndicator'
    },

    settings: {
        width: 800,
        height: 800,
        cols: 6,
        rows: 6,
        scale: 0.72,
        scaleMin: 0.3,
        scaleMax: 0.9,
        rotation: 0,
        randomScale: false,
        square: false,
        showGrid: false,
        color: '#82A9D9',
        bg: '#0a0a0a',
        seed: 1
    },

    controls: {
        sliders: [
            // shiftStep is omitted on purpose — it defaults to 10× baseStep.
            { id: 'colsSlider', valueId: 'colsValue', setting: 'cols', min: 1, max: 24, decimals: 0, baseStep: 1 },
            { id: 'rowsSlider', valueId: 'rowsValue', setting: 'rows', min: 1, max: 24, decimals: 0, baseStep: 1 },
            { id: 'scaleSlider', valueId: 'scaleValue', setting: 'scale', min: 0.05, max: 1, decimals: 2, baseStep: 0.01 },
            { id: 'rotationSlider', valueId: 'rotationValue', setting: 'rotation', min: 0, max: 360, decimals: 0, baseStep: 1, suffix: '°' }
        ],
        ranges: [
            {
                containerId: 'scaleRangeSlider',
                minValueId: 'scaleMinValue', maxValueId: 'scaleMaxValue',
                minSetting: 'scaleMin', maxSetting: 'scaleMax',
                min: 0.05, max: 1, decimals: 2, baseStep: 0.01, shiftStep: 0.1
            }
        ],
        toggles: true
    },

    panels: [
        { id: 'gridPanel', headerId: 'gridPanelHeader', persistent: true },
        { id: 'shapePanel', headerId: 'shapePanelHeader', persistent: true },
        { id: 'colorsPanel', headerId: 'colorsPanelHeader', persistent: true }
    ],

    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'shape', setting: 'color', label: 'Shape', itemId: 'shapeColorItem', dotId: 'shapeColorPreview', hexId: 'shapeColorHex', hsbSlotId: 'shapeColorHsbSlot' },
            { type: 'bg', setting: 'bg', label: 'Background', itemId: 'bgColorItem', dotId: 'bgColorPreview', hexId: 'bgColorHex', hsbSlotId: 'bgColorHsbSlot' }
        ]
    },

    dice: {
        params: [
            {
                key: 'scale', flag: 'randomScale', label: 'Size',
                diceId: 'scaleDiceBtn', singleId: 'scaleSingleWrap', rangeId: 'scaleRangeWrap',
                valueId: 'scaleValue',
                min: 0.05, max: 1, decimals: 2, rangeMinKey: 'scaleMin', rangeMaxKey: 'scaleMax'
            }
        ]
    },

    presets: {
        storageKey: 'upgrade:framework-demo:presets:v1',
        basePath: 'presets',
        // Color dots shown in each dropdown row: shape color + background.
        colorDots: (blob) => {
            const shape = blob.color || '#ffffff';
            const bg = blob.bg || '#000000';
            const dots = [{ kind: 'solid', value: shape }];
            if (shape.toLowerCase() !== bg.toLowerCase()) dots.push({ kind: 'solid', value: bg });
            return dots;
        },
        // ◆ marker when the preset has randomization enabled.
        hasRandom: (blob) => !!blob.randomScale
    },
    share: { quantizableFloatKeys: ['scale', 'scaleMin', 'scaleMax'] },
    export: { filename: 'pattern.svg' },

    render(ctx) {
        const { svg, create, width, height, settings } = ctx;
        const s = settings;

        svg.appendChild(create('rect', { x: 0, y: 0, width, height, fill: s.bg }));

        const cw = width / s.cols;
        const ch = height / s.rows;
        const base = Math.min(cw, ch);
        const rng = new SeededRandom((s.seed >>> 0) || 1);

        for (let r = 0; r < s.rows; r++) {
            for (let c = 0; c < s.cols; c++) {
                const cx = c * cw + cw / 2;
                const cy = r * ch + ch / 2;
                const scale = s.randomScale ? lerp(s.scaleMin, s.scaleMax, rng.next()) : s.scale;
                const size = base * scale;
                if (s.square) {
                    const rect = create('rect', {
                        x: cx - size / 2, y: cy - size / 2, width: size, height: size, fill: s.color
                    });
                    if (s.rotation) rect.setAttribute('transform', `rotate(${s.rotation} ${cx} ${cy})`);
                    svg.appendChild(rect);
                } else {
                    svg.appendChild(create('circle', { cx, cy, r: size / 2, fill: s.color }));
                }
            }
        }

        if (s.showGrid) {
            for (let c = 0; c <= s.cols; c++) {
                svg.appendChild(create('line', {
                    x1: c * cw, y1: 0, x2: c * cw, y2: height,
                    stroke: '#444', 'stroke-width': 1, opacity: 0.4
                }));
            }
            for (let r = 0; r <= s.rows; r++) {
                svg.appendChild(create('line', {
                    x1: 0, y1: r * ch, x2: width, y2: r * ch,
                    stroke: '#444', 'stroke-width': 1, opacity: 0.4
                }));
            }
        }
    },

    onReady(app) {
        // Shuffle: roll a fresh seed (deterministic, undoable).
        document.getElementById('shuffleBtn')?.addEventListener('click', () => {
            if (!app.settings.randomScale) app.dice.toggle('scale', true);
            app.settingsStore.set('seed', Math.floor(Math.random() * 1e9));
        });

        document.getElementById('exportSvgBtn')?.addEventListener('click', () => app.exportSVG());
        document.getElementById('exportPngBtn')?.addEventListener('click', () => app.exportPNG());
        document.getElementById('introHelpBtn')?.addEventListener('click', () => {
            app.dialog?.alert({
                title: 'Pattern Studio',
                text: 'A demo tool built on Othersite UI Framework v3. Tweak the grid, randomize sizes with the ◆ dice, pick colors, save and share presets, then export SVG/PNG. Cmd/Ctrl+Z to undo.'
            });
        });
    }
});

export default app;
