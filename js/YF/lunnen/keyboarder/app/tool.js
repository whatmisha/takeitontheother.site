/**
 * Keyboard Layout Studio — этапы 1–2 (геометрия и легенды).
 *
 * Тонкий слой: настройки, реестр контролов и render(ctx). Вся предметная логика — в app/kb/*,
 * вся инфраструктура (слайдеры, панели, зум, история, пресеты, шаринг, экспорт) — во фреймворке.
 */
import { defineTool } from '../vendor/framework/src/core/defineTool.js';
import { buildLayout, gapOf, widthInU } from './kb/grid.js';
import { attachGuides } from './kb/guides.js';
import { LCAKB23 } from './kb/layouts.js';
import { toMm } from './kb/units.js';
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

/** Значения сетки из настроек — в форму, которую ждёт buildLayout. */
const gridFrom = (s) => ({
    colPitch: s.colPitch,
    rowPitch: s.rowPitch,
    keyWidth1U: s.keyWidth1U,
    keyHeight: s.keyHeight,
    cornerRadius: s.cornerRadius,
    guideInset: s.guideInset,
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
        // Сетка. Четыре размера независимы: по X макет круглый в мм, по Y сжат на 0.648 %.
        colPitch: REF.colPitch,
        rowPitch: REF.rowPitch,
        keyWidth1U: REF.keyWidth1U,
        keyHeight: REF.keyHeight,
        cornerRadius: REF.cornerRadius,
        guideInset: REF.guideInset,

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

        capColor: '#e6e7e8',
        guideColor: '#d44698',
        inkColor: '#1c1f22',
        bgColor: '#1c1f22'
    },

    controls: {
        sliders: [
            { id: 'colPitchSlider', valueId: 'colPitchValue', setting: 'colPitch', min: 30, max: 80, decimals: 4, baseStep: 0.1, shiftStep: 1 },
            { id: 'rowPitchSlider', valueId: 'rowPitchValue', setting: 'rowPitch', min: 30, max: 80, decimals: 4, baseStep: 0.1, shiftStep: 1 },
            { id: 'keyWidthSlider', valueId: 'keyWidthValue', setting: 'keyWidth1U', min: 20, max: 75, decimals: 4, baseStep: 0.1, shiftStep: 1 },
            { id: 'keyHeightSlider', valueId: 'keyHeightValue', setting: 'keyHeight', min: 20, max: 75, decimals: 4, baseStep: 0.1, shiftStep: 1 },
            { id: 'radiusSlider', valueId: 'radiusValue', setting: 'cornerRadius', min: 0, max: 20, decimals: 4, baseStep: 0.05, shiftStep: 0.5 },
            { id: 'insetSlider', valueId: 'insetValue', setting: 'guideInset', min: 0, max: 18, decimals: 4, baseStep: 0.05, shiftStep: 0.5 }
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
            { type: 'cap', setting: 'capColor', label: 'Клавиша', itemId: 'capColorItem', dotId: 'capColorPreview', hexId: 'capColorHex', hsbSlotId: 'capColorHsbSlot' },
            { type: 'guide', setting: 'guideColor', label: 'Поле', itemId: 'guideColorItem', dotId: 'guideColorPreview', hexId: 'guideColorHex', hsbSlotId: 'guideColorHsbSlot' },
            { type: 'ink', setting: 'inkColor', label: 'Надпись', itemId: 'inkColorItem', dotId: 'inkColorPreview', hexId: 'inkColorHex', hsbSlotId: 'inkColorHsbSlot' },
            { type: 'bg', setting: 'bgColor', label: 'Фон', itemId: 'bgColorItem', dotId: 'bgColorPreview', hexId: 'bgColorHex', hsbSlotId: 'bgColorHsbSlot' }
        ]
    },

    presets: {
        storageKey: 'keyboardLayoutStudio',
        basePath: 'presets',
        colorDots: (b) => [
            { kind: 'solid', value: b.capColor || '#e6e7e8' },
            { kind: 'solid', value: b.bgColor || '#1c1f22' }
        ]
    },
    share: { quantizableFloatKeys: [] },
    export: { filename: 'keyboard.svg' },

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
            readyApp.settingsStore.setMultiple({
                colPitch: REF.colPitch, rowPitch: REF.rowPitch,
                keyWidth1U: REF.keyWidth1U, keyHeight: REF.keyHeight,
                cornerRadius: REF.cornerRadius, guideInset: REF.guideInset
            });
        });

        document.getElementById('verifyBtn')?.addEventListener('click', async () => {
            try {
                const { keys } = layoutFor(readyApp.settings);
                let html = '<h3 class="verify-h">Геометрия</h3>'
                    + reportHtml(compare(keys, await loadReference()));
                html += '<h3 class="verify-h">Легенды</h3>';
                if (!TYPEFACE) {
                    html += '<p>Гарнитура ещё не загрузилась — сверять нечего.</p>';
                } else {
                    const legendRef = await loadLegendReference();
                    const r = compareLegends(layoutFor(readyApp.settings).legends, legendRef.keys);
                    html += legendsReportHtml(r);
                }
                // alert() не пропускает флаг html, поэтому идём через show().
                readyApp.dialog?.show({
                    title: 'Сверка с эталоном',
                    text: html,
                    html: true,
                    buttons: [{ id: 'ok', text: 'Закрыть', type: 'primary' }]
                });
            } catch (e) {
                readyApp.dialog?.alert({ title: 'Сверка не удалась', text: e.message, okText: 'Закрыть' });
            }
        });

        document.getElementById('aboutBtn')?.addEventListener('click', () => {
            readyApp.dialog?.alert({
                title: 'Keyboard Layout Studio',
                text: 'Геометрия выводится из декларативного описания рядов: в каждом ряду одна '
                    + 'клавиша помечена flex и забирает остаток ширины блока, поэтому ширины не '
                    + 'приходится хардкодить. Единица — px, она же pt, она же 1/72 дюйма: шаг '
                    + 'по X ровно 19 мм.\n\nНадписи ставятся не по координатам из чертежа, '
                    + 'а по правилам: охранное поле работает системой координат, слот задаёт '
                    + 'пару якорей, а знак у кромки поля выпускается наружу на оптическую '
                    + 'компенсацию — она считается по форме края контура, а не по полуапрошу. '
                    + 'Кнопка «Сверить» показывает, насколько это совпало с LCAKB23.',
                okText: 'Закрыть'
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
                title: 'Шрифт не загрузился',
                text: `${e.message}\n\nГеометрия работает, надписей не будет.`,
                okText: 'Закрыть'
            });
        });
    }
});

function updateReadout(s, keys, grid, legends) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const mm = (px) => `${toMm(px).toFixed(2)} мм`;

    set('colPitchMm', mm(s.colPitch));
    set('rowPitchMm', mm(s.rowPitch));
    set('keyWidthMm', mm(s.keyWidth1U));
    set('keyHeightMm', mm(s.keyHeight));
    set('radiusMm', mm(s.cornerRadius));
    set('insetMm', mm(s.guideInset));

    const { bounds } = layoutFor(s);
    set('statKeys', String(keys.length));
    set('statBoard', `${toMm(bounds.w).toFixed(1)} × ${toMm(bounds.h).toFixed(1)} мм`);
    set('statGap', `${gapOf(grid).toFixed(3)} px / ${toMm(gapOf(grid)).toFixed(2)} мм`);
    const txt = legends.filter((e) => e.kind === 'txt').length;
    set('statLegends', TYPEFACE ? `${txt} строк, ${legends.length - txt} иконок` : 'шрифт грузится');
}

export default app;
