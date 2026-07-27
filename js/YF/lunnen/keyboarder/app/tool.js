/**
 * Keyboarder — этапы 1–2 (геометрия и легенды).
 *
 * Тонкий слой: настройки, реестр контролов и render(ctx). Вся предметная логика — в app/kb/*,
 * вся инфраструктура (слайдеры, панели, зум, история, пресеты, шаринг, экспорт) — во фреймворке.
 *
 * В интерфейсе размеры сетки — только мм, кегли (когда появятся) — только pt. Внутри геометрия
 * по-прежнему в px (= pt = 1/72″), перевод через toPx / toMm.
 */
import { defineTool } from '../vendor/framework/src/core/defineTool.js';
import { buildLayout, gapOf, widthInU } from './kb/grid.js';
import { attachGuides } from './kb/guides.js';
import { LCAKB23 } from './kb/layouts.js';
import { toMm, toPx } from './kb/units.js';
import { loadTypeface } from './kb/typography.js';
import { Compensator } from './kb/compensate.js';
import { attachContent, buildLegends, textPath } from './kb/legends.js';
import {
    loadReference, loadLegendReference, compare, reportHtml,
    compareLegends, legendsReportHtml
} from './kb/verify.js';
import CONTENT from './kb/content/lcakb23.js';
import ICONS from './kb/icons/lcakb23.js';
import ICON_OPTICS from './kb/icons/lcakb23-optics.js';

const REF = LCAKB23.grid;

/** Эталонная сетка в мм — то, что видит и правит пользователь. */
const REF_MM = {
    colPitch: toMm(REF.colPitch),
    rowPitch: toMm(REF.rowPitch),
    keyWidth1U: toMm(REF.keyWidth1U),
    keyHeight: toMm(REF.keyHeight),
    cornerRadius: toMm(REF.cornerRadius),
    guideInset: toMm(REF.guideInset)
};

/**
 * Эталонные прямоугольники для слоя «Эталон». Заполняется асинхронно в onReady.
 * Объявление обязано быть выше render(): при уже загруженном DOM defineTool вызывает init()
 * синхронно, и обращение к переменной в её temporal dead zone уронило бы первый кадр.
 */
let REFERENCE = null;

/**
 * Гарнитура. До её загрузки инструмент рисует геометрию без надписей: шрифт весит 200 КБ,
 * и ждать его, чтобы показать первый кадр, незачем.
 */
let TYPEFACE = null;
let COMP = null;

/** Значения сетки из настроек (мм) — в форму, которую ждёт buildLayout (px). */
const gridFrom = (s) => ({
    colPitch: toPx(s.colPitch),
    rowPitch: toPx(s.rowPitch),
    keyWidth1U: toPx(s.keyWidth1U),
    keyHeight: toPx(s.keyHeight),
    cornerRadius: toPx(s.cornerRadius),
    guideInset: toPx(s.guideInset),
    origin: REF.origin
});

/**
 * Пересчёт раскладки. Кэшируется по подписи сетки: render вызывается и при смене цвета,
 * а геометрия при этом не меняется.
 */
let cached = { sig: null, data: null };
function layoutFor(s) {
    const g = gridFrom(s);
    const sig = JSON.stringify(g) + (TYPEFACE ? '·tf' : '');
    if (cached.sig !== sig) {
        const data = buildLayout(LCAKB23, g);
        attachGuides(data.keys, g.guideInset);
        attachContent(data.keys, CONTENT);
        data.legends = TYPEFACE
            ? buildLegends(data.keys, {
                tf: TYPEFACE, comp: COMP,
                interline: CONTENT.interline, iconOptics: ICON_OPTICS
            })
            : [];
        cached = { sig, data };
    }
    return cached.data;
}

const app = defineTool({
    renderer: 'svg',
    autoStart: true,

    dom: { canvas: 'canvasContainer', surface: 'mainSvg', zoomIndicator: 'zoomIndicator' },

    /**
     * Артборд клавиатуры очень широкий и низкий (отношение 3.6:1), а панели — оверлеи поверх
     * канваса. Без боковых отступов «вписать в экран» прячет крайние клавиши под панелями.
     */
    zoom: { fitPadding: { top: 24, right: 335, bottom: 24, left: 335 } },

    settings: {
        // Сетка в мм. Четыре размера независимы: по X макет круглый, по Y сжат на 0.648 %.
        colPitch: REF_MM.colPitch,
        rowPitch: REF_MM.rowPitch,
        keyWidth1U: REF_MM.keyWidth1U,
        keyHeight: REF_MM.keyHeight,
        cornerRadius: REF_MM.cornerRadius,
        guideInset: REF_MM.guideInset,

        showCaps: true,
        showGuides: false,
        showGlyphs: true,
        showIcons: true,
        showColumns: false,
        showIndex: false,
        showInk: false,
        showSlots: false,
        showRef: false,
        showBlocks: false,

        capColor: '#1e1e1e',
        guideColor: '#2353db',
        inkColor: '#aaaaaa',
        bgColor: '#808080'
    },

    controls: {
        // Ranges and steps in mm; value-display shows “N.NNN mm”, no px duplicate.
        sliders: [
            { id: 'colPitchSlider', valueId: 'colPitchValue', setting: 'colPitch', min: 10, max: 28, decimals: 3, baseStep: 0.001, shiftStep: 0.1, suffix: ' mm' },
            { id: 'rowPitchSlider', valueId: 'rowPitchValue', setting: 'rowPitch', min: 10, max: 28, decimals: 3, baseStep: 0.001, shiftStep: 0.1, suffix: ' mm' },
            { id: 'keyWidthSlider', valueId: 'keyWidthValue', setting: 'keyWidth1U', min: 7, max: 26, decimals: 3, baseStep: 0.001, shiftStep: 0.1, suffix: ' mm' },
            { id: 'keyHeightSlider', valueId: 'keyHeightValue', setting: 'keyHeight', min: 7, max: 26, decimals: 3, baseStep: 0.001, shiftStep: 0.1, suffix: ' mm' },
            { id: 'radiusSlider', valueId: 'radiusValue', setting: 'cornerRadius', min: 0, max: 7, decimals: 3, baseStep: 0.001, shiftStep: 0.05, suffix: ' mm' },
            { id: 'insetSlider', valueId: 'insetValue', setting: 'guideInset', min: 0, max: 6.5, decimals: 3, baseStep: 0.001, shiftStep: 0.05, suffix: ' mm' }
        ],
        toggles: true
    },

    panels: [
        { id: 'gridPanel', headerId: 'gridPanelHeader', persistent: true },
        { id: 'layersPanel', headerId: 'layersPanelHeader', persistent: true },
        { id: 'colorsPanel', headerId: 'colorsPanelHeader', persistent: true }
    ],

    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'cap', setting: 'capColor', label: 'Key', itemId: 'capColorItem', dotId: 'capColorPreview', hexId: 'capColorHex', hsbSlotId: 'capColorHsbSlot' },
            { type: 'guide', setting: 'guideColor', label: 'Guide', itemId: 'guideColorItem', dotId: 'guideColorPreview', hexId: 'guideColorHex', hsbSlotId: 'guideColorHsbSlot' },
            { type: 'ink', setting: 'inkColor', label: 'Legend', itemId: 'inkColorItem', dotId: 'inkColorPreview', hexId: 'inkColorHex', hsbSlotId: 'inkColorHsbSlot' },
            { type: 'bg', setting: 'bgColor', label: 'Background', itemId: 'bgColorItem', dotId: 'bgColorPreview', hexId: 'bgColorHex', hsbSlotId: 'bgColorHsbSlot' }
        ]
    },

    presets: {
        storageKey: 'keyboarder',
        basePath: 'presets',
        colorDots: (b) => [
            { kind: 'solid', value: b.capColor || '#1e1e1e' },
            { kind: 'solid', value: b.bgColor || '#808080' }
        ]
    },
    share: { quantizableFloatKeys: [] },
    export: { filename: 'keyboarder.svg' },

    /** Артборд зависит от сетки, поэтому размер отдаём хуком. */
    size(s) {
        const { bounds } = layoutFor(s);
        return { width: bounds.w, height: bounds.h };
    },

    render(ctx) {
        const { svg, create, width, height, settings: s } = ctx;
        const { keys, grid } = layoutFor(s);
        const gap = gapOf(grid);

        svg.appendChild(create('rect', { x: 0, y: 0, width, height, fill: s.bgColor }));

        if (s.showBlocks) {
            const g = create('g', { id: 'blocks' });
            for (const b of LCAKB23.blocks) {
                if (b.width == null) continue;
                g.appendChild(create('rect', {
                    x: b.x - gap / 2, y: grid.origin.y - gap / 2,
                    width: b.width + gap, height: height - 2 * grid.origin.y + gap,
                    fill: 'none', stroke: '#3d7fd9', 'stroke-width': 0.4, 'stroke-dasharray': '3 2'
                }));
            }
            svg.appendChild(g);
        }

        if (s.showColumns) {
            const g = create('g', { id: 'columns', opacity: 0.35 });
            for (let x = grid.origin.x; x < width; x += grid.colPitch) {
                g.appendChild(create('line', {
                    x1: x, y1: 0, x2: x, y2: height, stroke: '#4a4f55', 'stroke-width': 0.3
                }));
            }
            for (let r = 0; r <= LCAKB23.rows.length; r++) {
                const y = grid.origin.y + r * grid.rowPitch;
                g.appendChild(create('line', {
                    x1: 0, y1: y, x2: width, y2: y, stroke: '#4a4f55', 'stroke-width': 0.3
                }));
            }
            svg.appendChild(g);
        }

        // Эталон подложкой: пунктир поверх заливки, чтобы расхождение было видно сразу.
        if (s.showRef && REFERENCE) {
            const g = create('g', { id: 'reference' });
            for (const r of REFERENCE) {
                g.appendChild(create('rect', {
                    x: r.x, y: r.y, width: r.w, height: r.h,
                    rx: grid.cornerRadius, ry: grid.cornerRadius,
                    fill: 'none', stroke: '#ffa500', 'stroke-width': 0.5, 'stroke-dasharray': '2 1.5'
                }));
            }
            svg.appendChild(g);
        }

        if (s.showCaps) {
            const g = create('g', { id: 'caps' });
            for (const k of keys) {
                g.appendChild(create('rect', {
                    x: k.x, y: k.y, width: k.w, height: k.h,
                    rx: grid.cornerRadius, ry: grid.cornerRadius, fill: s.capColor
                }));
            }
            svg.appendChild(g);
        }

        if (s.showGuides) {
            const g = create('g', { id: 'guides' });
            for (const k of keys) {
                g.appendChild(create('rect', {
                    x: k.guide.x0, y: k.guide.y0, width: k.guide.w, height: k.guide.h,
                    fill: 'none', stroke: s.guideColor, 'stroke-width': 0.5
                }));
            }
            svg.appendChild(g);
        }

        const legends = layoutFor(s).legends;

        // Надписи — кривыми из TTF, а не <text>: результат не зависит от того, установлен ли
        // YS Text у пользователя, и совпадает с тем, что уйдёт в экспорт (решение 2).
        if (s.showGlyphs && TYPEFACE) {
            const g = create('g', { id: 'glyphs', fill: s.inkColor });
            for (const el of legends) {
                if (el.kind !== 'txt') continue;
                const d = textPath(TYPEFACE, el);
                if (d) g.appendChild(create('path', { d }));
            }
            svg.appendChild(g);
        }

        if (s.showIcons) {
            const g = create('g', { id: 'icons', fill: s.inkColor });
            for (const el of legends) {
                if (el.kind !== 'ico') continue;
                const ico = ICONS[el.icon];
                if (!ico) continue;
                const wrap = create('g', {
                    transform: `translate(${el.x - ico.ox} ${el.y - ico.oy})`
                });
                wrap.appendChild(create('path', { d: ico.d }));
                g.appendChild(wrap);
            }
            svg.appendChild(g);
        }

        // Диагностика: чернильный габарит показывает, насколько знак выпущен за кромку поля.
        if (s.showInk) {
            const g = create('g', { id: 'ink' });
            for (const el of legends) {
                const box = el.kind === 'txt' && el.ink
                    ? { x: el.ink[0], y: el.ink[1], width: el.ink[2], height: el.ink[3] }
                    : el.kind === 'ico' ? { x: el.x, y: el.y, width: el.w, height: el.h } : null;
                if (!box) continue;
                g.appendChild(create('rect', {
                    ...box, fill: 'none', stroke: '#3d7fd9', 'stroke-width': 0.2
                }));
                if (el.kind === 'txt') {
                    g.appendChild(create('line', {
                        x1: el.bx, y1: el.by, x2: el.bx + el.advw, y2: el.by,
                        stroke: '#ffa500', 'stroke-width': 0.2
                    }));
                }
            }
            svg.appendChild(g);
        }

        if (s.showSlots) {
            const g = create('g', {
                id: 'slot-codes', 'font-size': 2.6, fill: '#3d7fd9', 'font-family': 'monospace'
            });
            for (const el of legends) {
                const t = create('text', {
                    x: el.kind === 'txt' ? el.bx : el.x,
                    y: (el.kind === 'txt' ? el.by : el.y + el.h) + 3
                });
                t.textContent = el.slot;
                g.appendChild(t);
            }
            svg.appendChild(g);
        }

        if (s.showIndex) {
            const g = create('g', { id: 'labels', 'font-size': 4, fill: '#1c1f22', 'font-family': 'monospace' });
            for (const k of keys) {
                const t = create('text', { x: k.guide.x0, y: k.guide.y0 + 4 });
                t.textContent = `${k.row}·${widthInU(k.w, grid).toFixed(2)}`;
                g.appendChild(t);
            }
            svg.appendChild(g);
        }

        updateReadout(s, keys, grid, legends);
    },

    onReady(readyApp) {
        document.getElementById('exportSvgBtn')?.addEventListener('click', () => readyApp.exportSVG());
        document.getElementById('exportPngBtn')?.addEventListener('click', () => readyApp.exportPNG());

        document.getElementById('resetGridBtn')?.addEventListener('click', () => {
            readyApp.settingsStore.setMultiple({ ...REF_MM });
        });

        document.getElementById('verifyBtn')?.addEventListener('click', async () => {
            try {
                const { keys } = layoutFor(readyApp.settings);
                let html = '<h3 class="verify-h">Geometry</h3>'
                    + reportHtml(compare(keys, await loadReference()));
                html += '<h3 class="verify-h">Legends</h3>';
                if (!TYPEFACE) {
                    html += '<p>Typeface is still loading — nothing to verify yet.</p>';
                } else {
                    const legendRef = await loadLegendReference();
                    const r = compareLegends(layoutFor(readyApp.settings).legends, legendRef.keys);
                    html += legendsReportHtml(r);
                }
                // alert() does not pass the html flag, so go through show().
                readyApp.dialog?.show({
                    title: 'Verify against reference',
                    text: html,
                    html: true,
                    buttons: [{ id: 'ok', text: 'Close', type: 'primary' }]
                });
            } catch (e) {
                readyApp.dialog?.alert({ title: 'Verification failed', text: e.message, okText: 'Close' });
            }
        });

        document.getElementById('aboutBtn')?.addEventListener('click', () => {
            readyApp.dialog?.alert({
                title: 'Keyboarder',
                text: 'Geometry is derived from a declarative row description: each row has one '
                    + 'key marked flex that takes the remaining block width, so widths do not '
                    + 'need to be hard-coded. In the UI, sizes are millimetres and type sizes '
                    + 'are pt; internally 1 px = 1 pt = 1/72″, and the reference column pitch '
                    + 'is exactly 19 mm.\n\n'
                    + 'Legends are placed by rules, not by coordinates from the drawing: the '
                    + 'safety guide is a coordinate system, a slot picks an anchor pair, and a '
                    + 'glyph at the guide edge is released outward by optical compensation — '
                    + 'computed from the contour edge shape, not from sidebearings. Verify '
                    + 'shows how close this matches LCAKB23.',
                okText: 'Close'
            });
        });

        // Эталон для подложки грузим заранее, чтобы тумблер срабатывал сразу.
        loadReference().then((r) => {
            REFERENCE = r;
            if (readyApp.settings.showRef) readyApp.render();
        }).catch(() => { /* подложка необязательна */ });

        // Гарнитура: путь с пробелом обязан быть URL-энкоден, папка называется Fonts с большой.
        loadTypeface('Fonts/YS%20Text/YS%20Text-Regular.ttf').then((tf) => {
            TYPEFACE = tf;
            COMP = new Compensator(tf);
            readyApp.render();
        }).catch((e) => {
            readyApp.dialog?.alert({
                title: 'Font failed to load',
                text: `${e.message}\n\nGeometry still works; legends will be missing.`,
                okText: 'Close'
            });
        });
    }
});

function updateReadout(s, keys, grid, legends) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const { bounds } = layoutFor(s);
    set('statKeys', String(keys.length));
    set('statBoard', `${toMm(bounds.w).toFixed(1)} × ${toMm(bounds.h).toFixed(1)} mm`);
    set('statGap', `${toMm(gapOf(grid)).toFixed(2)} mm`);
    const txt = legends.filter((e) => e.kind === 'txt').length;
    set('statLegends', TYPEFACE
        ? `${txt} strings, ${legends.length - txt} icons`
        : 'loading font');
}

export default app;
