/**
 * Метрики гарнитуры и раскладка строки. Порт analysis/font.py.
 *
 * Единицы: метрики шрифта — в em-units (font units), результат раскладки — в px макета.
 * Ось Y направлена вниз, как в SVG: ink.y0 = baseline − yMax.
 */
import opentype from '../../vendor/lib/opentype.module.js';

/** Метрики, снятые из файла. Геометрический замер приоритетнее объявленного в OS/2. */
function readMetrics(font) {
    const os2 = font.tables.os2 || {};
    const hhea = font.tables.hhea || {};
    const inkTop = (ch) => {
        const g = font.charToGlyph(ch);
        const bb = g && g.getBoundingBox();
        return bb && Number.isFinite(bb.y2) ? bb.y2 : null;
    };
    return {
        upm: font.unitsPerEm,
        capHeight: os2.sCapHeight || inkTop('H') || inkTop('Н'),
        xHeight: os2.sxHeight || inkTop('x') || inkTop('н'),
        // ascender / descender — по hhea: это то, чем renderer мерит строку,
        // и то, что задокументировано в PIPELINE § 8.3. sTypo лежит рядом,
        // потому что на этапе 8 понадобится сравнивать одно с другим.
        ascender: hhea.ascender,
        descender: hhea.descender,
        typoAscender: os2.sTypoAscender,
        typoDescender: os2.sTypoDescender,
        italicAngle: (font.tables.post && font.tables.post.italicAngle) || 0,
        weightClass: os2.usWeightClass || 400,
        widthClass: os2.usWidthClass || 5
    };
}

/**
 * Точный ink-бокс по контуру: экстремумы кривых берутся аналитически.
 *
 * Своя реализация нужна ради совпадения с fontTools: getBoundingBox() в opentype.js
 * теряет точность на квадратичных сегментах, а нам эти доли em-unit важны — на них
 * стоит выключка по кромке.
 */
function exactBounds(commands) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    let px = 0, py = 0;
    const add = (x, y) => {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
    };
    const quadAxis = (p0, p1, p2) => {
        const den = p0 - 2 * p1 + p2;
        if (den === 0) return [];
        const t = (p0 - p1) / den;
        if (t <= 0 || t >= 1) return [];
        const u = 1 - t;
        return [u * u * p0 + 2 * u * t * p1 + t * t * p2];
    };
    // f'(t)/3 = (−p0+3p1−3p2+p3)t² + 2(p0−2p1+p2)t + (p1−p0)
    const cubicAxis = (p0, p1, p2, p3) => {
        const A = -p0 + 3 * p1 - 3 * p2 + p3;
        const B = 2 * (p0 - 2 * p1 + p2);
        const C = p1 - p0;
        const roots = [];
        if (Math.abs(A) < 1e-12) {
            if (B !== 0) roots.push(-C / B);
        } else {
            const disc = B * B - 4 * A * C;
            if (disc >= 0) {
                const s = Math.sqrt(disc);
                roots.push((-B + s) / (2 * A), (-B - s) / (2 * A));
            }
        }
        return roots.filter((t) => t > 0 && t < 1).map((t) => {
            const u = 1 - t;
            return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
        });
    };
    const spanX = (vs) => { for (const v of vs) { if (v < x0) x0 = v; if (v > x1) x1 = v; } };
    const spanY = (vs) => { for (const v of vs) { if (v < y0) y0 = v; if (v > y1) y1 = v; } };

    for (const cmd of commands) {
        if (cmd.type === 'Z') continue;
        add(cmd.x, cmd.y);
        if (cmd.type === 'Q') {
            spanX(quadAxis(px, cmd.x1, cmd.x));
            spanY(quadAxis(py, cmd.y1, cmd.y));
        } else if (cmd.type === 'C') {
            spanX(cubicAxis(px, cmd.x1, cmd.x2, cmd.x));
            spanY(cubicAxis(py, cmd.y1, cmd.y2, cmd.y));
        }
        px = cmd.x; py = cmd.y;
    }
    return Number.isFinite(x0) ? [x0, y0, x1, y1] : null;
}

export class Typeface {
    constructor(font) {
        this.font = font;
        Object.assign(this, readMetrics(font));
        this._glyphs = new Map();
    }

    /** Глиф с кэшированным ink-боксом; null, если знака нет в cmap. */
    glyph(ch) {
        if (this._glyphs.has(ch)) return this._glyphs.get(ch);
        let out = null;
        if (this.font.charToGlyphIndex(ch) > 0) {
            const g = this.font.charToGlyph(ch);
            out = {
                glyph: g,
                advance: g.advanceWidth,
                // [xMin, yMin, xMax, yMax] в em-units, Y вверх — порядок как в fontTools
                bbox: exactBounds(g.path.commands)
            };
        }
        this._glyphs.set(ch, out);
        return out;
    }

    box(ch) { const g = this.glyph(ch); return g ? g.bbox : null; }
    advance(ch) { const g = this.glyph(ch); return g ? g.advance : 0; }

    /** Полуапроши знака в em-units: [левый, правый]. */
    sidebearings(ch) {
        const bb = this.box(ch);
        if (!bb) return [0, 0];
        return [bb[0], this.advance(ch) - bb[2]];
    }

    /**
     * Разложить строку от позиции пера.
     * @param {number} size кегль в px
     * @param {number} tracking межбуквенное в em (letter-spacing)
     * @returns {{ink: number[]|null, advw: number, per: object[]}}
     *          ink — [x, y, w, h] фактических контуров; advw — ширина по перу.
     */
    layout(text, size, tracking = 0, start = [0, 0]) {
        const k = size / this.upm;
        let pen = 0;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const per = [];
        for (const ch of text) {
            const bb = this.box(ch);
            if (bb) {
                const gx0 = start[0] + (pen + bb[0]) * k;
                const gx1 = start[0] + (pen + bb[2]) * k;
                const gy0 = start[1] - bb[3] * k;
                const gy1 = start[1] - bb[1] * k;
                x0 = Math.min(x0, gx0); y0 = Math.min(y0, gy0);
                x1 = Math.max(x1, gx1); y1 = Math.max(y1, gy1);
                per.push({ ch, pen, x0: gx0, y0: gy0, x1: gx1, y1: gy1, bbox: bb });
            }
            pen += this.advance(ch) + tracking * this.upm;
        }
        const advw = text.length ? (pen - tracking * this.upm) * k : 0;
        return {
            ink: x0 > 1e17 ? null : [x0, y0, x1 - x0, y1 - y0],
            advw, per
        };
    }

    /** Смещение левой кромки ink от пера, px. Нужно для выключки влево. */
    inkLeftOffset(text, size, tracking = 0) {
        const r = this.layout(text, size, tracking, [0, 0]);
        return r.ink ? r.ink[0] : 0;
    }

    /** Смещение правой кромки ink от пера, px. Нужно для выключки вправо. */
    inkRightOffset(text, size, tracking = 0) {
        const r = this.layout(text, size, tracking, [0, 0]);
        return r.ink ? r.ink[0] + r.ink[2] : 0;
    }

    /** Контур строки как SVG-путь в координатах макета. */
    pathData(text, size, tracking = 0, start = [0, 0]) {
        const k = size / this.upm;
        let pen = 0;
        const out = [];
        for (const ch of text) {
            const g = this.glyph(ch);
            if (g) {
                const p = g.glyph.getPath(start[0] + pen * k, start[1], size);
                const d = p.toPathData(4);
                if (d) out.push(d);
            }
            pen += this.advance(ch) + tracking * this.upm;
        }
        return out.join(' ');
    }
}

/** Разбор шрифта из ArrayBuffer. */
export const parseFont = (buf) => new Typeface(opentype.parse(buf));

/** Загрузка шрифта по URL (браузер). */
export async function loadTypeface(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`шрифт не загрузился: ${url} (${res.status})`);
    return parseFont(await res.arrayBuffer());
}
