import { defineTool } from './framework/src/core/defineTool.js';
import { SVGExporter } from './framework/src/export/SVGExporter.js';

const FONT_URL = './Pragma260128-VariableVF.ttf';
const EXPORT_FILENAME = 'pragma-a-variable-preview.svg';
const PNG_EXPORT_FILENAME = 'pragma-a-variable-preview.png';
const GLYPH = 'A';
const SVG_NS = 'http://www.w3.org/2000/svg';

let pragmaFont = null;
let loadError = null;
const svgExporter = new SVGExporter();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

function axisValues(min, max, steps) {
    const count = Math.max(1, Math.round(steps)) + 1;
    return Array.from({ length: count }, (_, index) => {
        if (index === 0) return min;
        if (index === count - 1) return max;
        return lerp(min, max, index / (count - 1));
    });
}

function artboardSize(settings) {
    const fontSize = Number(settings.fontSize) || 240;
    return {
        width: Math.ceil(Math.max(1400, fontSize * 4.6)),
        height: Math.ceil(Math.max(900, fontSize * 1.8))
    };
}

function exportPreview(app) {
    if (!pragmaFont) {
        app.dialog?.alert({
            title: 'Font is loading',
            text: 'Export will be available after the glyph paths are ready.'
        });
        return;
    }

    return svgExporter.exportToFile(app.target.element, EXPORT_FILENAME, {
        removeInteractive: true,
        convertTextToOutlines: false
    });
}

function exportPngPreview(app) {
    if (!pragmaFont) {
        app.dialog?.alert({
            title: 'Font is loading',
            text: 'PNG export will be available after the glyph paths are ready.'
        });
        return;
    }

    return app.exportPNG(PNG_EXPORT_FILENAME, 2);
}

class BinaryReader {
    constructor(buffer) {
        this.buffer = buffer;
        this.view = new DataView(buffer);
        this.bytes = new Uint8Array(buffer);
    }

    u8(offset) { return this.view.getUint8(offset); }
    i8(offset) { return this.view.getInt8(offset); }
    u16(offset) { return this.view.getUint16(offset, false); }
    i16(offset) { return this.view.getInt16(offset, false); }
    u32(offset) { return this.view.getUint32(offset, false); }
    fixed(offset) { return this.i16(offset) + this.u16(offset + 2) / 65536; }

    tag(offset) {
        return String.fromCharCode(
            this.bytes[offset],
            this.bytes[offset + 1],
            this.bytes[offset + 2],
            this.bytes[offset + 3]
        );
    }
}

class PragmaGlyphFont {
    static async load(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Font request failed: ${response.status}`);
        }
        return new PragmaGlyphFont(await response.arrayBuffer());
    }

    constructor(buffer) {
        this.reader = new BinaryReader(buffer);
        this.tables = this.readTableDirectory();
        this.unitsPerEm = this.reader.u16(this.table('head') + 18);
        this.indexToLocFormat = this.reader.i16(this.table('head') + 50);
        this.ascender = this.reader.i16(this.table('hhea') + 4);
        this.descender = this.reader.i16(this.table('hhea') + 6);
        this.numberOfHMetrics = this.reader.u16(this.table('hhea') + 34);
        this.numGlyphs = this.reader.u16(this.table('maxp') + 4);
        this.axes = this.readAxes();
        this.glyphMap = this.readCmap();
        this.glyphCache = new Map();
        this.variationCache = new Map();
        this.pathCache = new Map();
    }

    table(tag) {
        const table = this.tables.get(tag);
        if (!table) throw new Error(`Missing font table: ${tag}`);
        return table.offset;
    }

    readTableDirectory() {
        const r = this.reader;
        const tables = new Map();
        const count = r.u16(4);
        for (let index = 0; index < count; index++) {
            const offset = 12 + index * 16;
            tables.set(r.tag(offset), {
                offset: r.u32(offset + 8),
                length: r.u32(offset + 12)
            });
        }
        return tables;
    }

    readAxes() {
        const table = this.tables.get('fvar');
        if (!table) return [];

        const r = this.reader;
        const base = table.offset;
        const axisOffset = r.u16(base + 4);
        const axisCount = r.u16(base + 8);
        const axisSize = r.u16(base + 10);
        const axes = [];

        for (let index = 0; index < axisCount; index++) {
            const offset = base + axisOffset + index * axisSize;
            axes.push({
                tag: r.tag(offset),
                min: r.fixed(offset + 4),
                defaultValue: r.fixed(offset + 8),
                max: r.fixed(offset + 12)
            });
        }

        return axes;
    }

    readCmap() {
        const r = this.reader;
        const base = this.table('cmap');
        const tableCount = r.u16(base + 2);
        let subtable = 0;

        for (let index = 0; index < tableCount; index++) {
            const record = base + 4 + index * 8;
            const platformId = r.u16(record);
            const encodingId = r.u16(record + 2);
            const offset = base + r.u32(record + 4);
            const format = r.u16(offset);
            if (format === 4 && (platformId === 3 || platformId === 0) && (encodingId === 1 || encodingId === 3)) {
                subtable = offset;
                break;
            }
        }

        if (!subtable) throw new Error('No Unicode cmap format 4 table found');

        const segCount = r.u16(subtable + 6) / 2;
        const endOffset = subtable + 14;
        const startOffset = endOffset + segCount * 2 + 2;
        const deltaOffset = startOffset + segCount * 2;
        const rangeOffset = deltaOffset + segCount * 2;

        return {
            glyphId: (codePoint) => {
                for (let index = 0; index < segCount; index++) {
                    const end = r.u16(endOffset + index * 2);
                    const start = r.u16(startOffset + index * 2);
                    if (codePoint < start || codePoint > end) continue;

                    const delta = r.i16(deltaOffset + index * 2);
                    const range = r.u16(rangeOffset + index * 2);
                    if (range === 0) return (codePoint + delta) & 0xffff;

                    const glyphOffset = rangeOffset + index * 2 + range + (codePoint - start) * 2;
                    const id = r.u16(glyphOffset);
                    return id === 0 ? 0 : (id + delta) & 0xffff;
                }
                return 0;
            }
        };
    }

    glyphOffset(glyphId) {
        const loca = this.table('loca');
        if (this.indexToLocFormat === 0) {
            return this.reader.u16(loca + glyphId * 2) * 2;
        }
        return this.reader.u32(loca + glyphId * 4);
    }

    glyphLength(glyphId) {
        return this.glyphOffset(glyphId + 1) - this.glyphOffset(glyphId);
    }

    readMetric(glyphId) {
        const r = this.reader;
        const hmtx = this.table('hmtx');
        if (glyphId < this.numberOfHMetrics) {
            const offset = hmtx + glyphId * 4;
            return { advance: r.u16(offset), lsb: r.i16(offset + 2) };
        }

        const lastMetric = hmtx + (this.numberOfHMetrics - 1) * 4;
        const lsbOffset = hmtx + this.numberOfHMetrics * 4 + (glyphId - this.numberOfHMetrics) * 2;
        return { advance: r.u16(lastMetric), lsb: r.i16(lsbOffset) };
    }

    glyphForCharacter(character) {
        const glyphId = this.glyphMap.glyphId(character.codePointAt(0));
        if (!glyphId) throw new Error(`Glyph not found: ${character}`);
        return this.readGlyph(glyphId);
    }

    readGlyph(glyphId) {
        if (this.glyphCache.has(glyphId)) return this.glyphCache.get(glyphId);

        const r = this.reader;
        const glyf = this.table('glyf');
        const offset = glyf + this.glyphOffset(glyphId);
        const length = this.glyphLength(glyphId);
        if (!length) throw new Error(`Empty glyph: ${glyphId}`);

        const contourCount = r.i16(offset);
        if (contourCount < 0) throw new Error('Composite glyphs are not supported in this preview');

        const xMin = r.i16(offset + 2);
        const yMin = r.i16(offset + 4);
        const xMax = r.i16(offset + 6);
        const yMax = r.i16(offset + 8);

        let cursor = offset + 10;
        const endPts = [];
        for (let index = 0; index < contourCount; index++) {
            endPts.push(r.u16(cursor));
            cursor += 2;
        }

        const pointCount = endPts[endPts.length - 1] + 1;
        const instructionLength = r.u16(cursor);
        cursor += 2 + instructionLength;

        const flags = [];
        while (flags.length < pointCount) {
            const flag = r.u8(cursor++);
            flags.push(flag);
            if (flag & 0x08) {
                const repeats = r.u8(cursor++);
                for (let count = 0; count < repeats; count++) flags.push(flag);
            }
        }

        const xs = [];
        let x = 0;
        for (let index = 0; index < pointCount; index++) {
            const flag = flags[index];
            let delta = 0;
            if (flag & 0x02) {
                delta = r.u8(cursor++);
                if (!(flag & 0x10)) delta = -delta;
            } else if (!(flag & 0x10)) {
                delta = r.i16(cursor);
                cursor += 2;
            }
            x += delta;
            xs.push(x);
        }

        const ys = [];
        let y = 0;
        for (let index = 0; index < pointCount; index++) {
            const flag = flags[index];
            let delta = 0;
            if (flag & 0x04) {
                delta = r.u8(cursor++);
                if (!(flag & 0x20)) delta = -delta;
            } else if (!(flag & 0x20)) {
                delta = r.i16(cursor);
                cursor += 2;
            }
            y += delta;
            ys.push(y);
        }

        const points = xs.map((pointX, index) => ({
            x: pointX,
            y: ys[index],
            onCurve: !!(flags[index] & 0x01)
        }));

        const metric = this.readMetric(glyphId);
        const phantomOrigin = xMin - metric.lsb;
        const phantomPoints = [
            { x: phantomOrigin, y: 0, onCurve: true },
            { x: phantomOrigin + metric.advance, y: 0, onCurve: true },
            { x: 0, y: this.ascender, onCurve: true },
            { x: 0, y: this.descender, onCurve: true }
        ];

        const glyph = {
            id: glyphId,
            xMin,
            yMin,
            xMax,
            yMax,
            advance: metric.advance,
            contours: endPts,
            points,
            pointsWithPhantoms: points.concat(phantomPoints)
        };

        this.glyphCache.set(glyphId, glyph);
        return glyph;
    }

    normalizedLocation(location) {
        return this.axes.map((axis) => {
            const value = clamp(location[axis.tag] ?? axis.defaultValue, axis.min, axis.max);
            if (value === axis.defaultValue) return 0;
            if (value < axis.defaultValue) {
                return (value - axis.defaultValue) / (axis.defaultValue - axis.min);
            }
            return (value - axis.defaultValue) / (axis.max - axis.defaultValue);
        });
    }

    f2dot14(offset) {
        return this.reader.i16(offset) / 16384;
    }

    tupleScalar(coords, peak, start = null, end = null) {
        let scalar = 1;

        for (let index = 0; index < coords.length; index++) {
            const coordinate = coords[index];
            const peakValue = peak[index];
            if (peakValue === 0) continue;

            if (start && end) {
                const startValue = start[index];
                const endValue = end[index];
                if (coordinate <= startValue || coordinate >= endValue) return 0;
                if (coordinate < peakValue) {
                    scalar *= (coordinate - startValue) / (peakValue - startValue);
                } else if (coordinate > peakValue) {
                    scalar *= (endValue - coordinate) / (endValue - peakValue);
                }
            } else {
                if (coordinate === 0 || Math.sign(coordinate) !== Math.sign(peakValue)) return 0;
                scalar *= coordinate / peakValue;
            }
        }

        return scalar;
    }

    readGlyphVariations(glyph) {
        if (this.variationCache.has(glyph.id)) return this.variationCache.get(glyph.id);

        const table = this.tables.get('gvar');
        if (!table) {
            this.variationCache.set(glyph.id, []);
            return [];
        }

        const r = this.reader;
        const base = table.offset;
        const axisCount = r.u16(base + 4);
        const glyphCount = r.u16(base + 12);
        const flags = r.u16(base + 14);
        const dataBase = base + r.u32(base + 16);
        const offsetsBase = base + 20;

        if (glyph.id >= glyphCount) return [];

        const readOffset = (index) => {
            if (flags & 0x0001) return r.u32(offsetsBase + index * 4);
            return r.u16(offsetsBase + index * 2) * 2;
        };

        const start = dataBase + readOffset(glyph.id);
        const end = dataBase + readOffset(glyph.id + 1);
        if (start === end) {
            this.variationCache.set(glyph.id, []);
            return [];
        }

        const tupleVariationCountRaw = r.u16(start);
        const tupleVariationCount = tupleVariationCountRaw & 0x0fff;
        const hasSharedPoints = !!(tupleVariationCountRaw & 0x8000);
        const dataOffset = r.u16(start + 2);
        let headerCursor = start + 4;
        let dataCursor = start + dataOffset;
        let sharedPoints = null;

        if (hasSharedPoints) {
            const parsed = this.readPackedPoints(dataCursor, glyph.pointsWithPhantoms.length);
            sharedPoints = parsed.points;
            dataCursor = parsed.next;
        }

        const headers = [];
        for (let index = 0; index < tupleVariationCount; index++) {
            const variationDataSize = r.u16(headerCursor);
            const tupleIndex = r.u16(headerCursor + 2);
            headerCursor += 4;

            let peak = null;
            let startTuple = null;
            let endTuple = null;

            if (tupleIndex & 0x8000) {
                peak = [];
                for (let axis = 0; axis < axisCount; axis++) {
                    peak.push(this.f2dot14(headerCursor));
                    headerCursor += 2;
                }
            } else {
                peak = new Array(axisCount).fill(0);
            }

            if (tupleIndex & 0x4000) {
                startTuple = [];
                endTuple = [];
                for (let axis = 0; axis < axisCount; axis++) {
                    startTuple.push(this.f2dot14(headerCursor));
                    headerCursor += 2;
                }
                for (let axis = 0; axis < axisCount; axis++) {
                    endTuple.push(this.f2dot14(headerCursor));
                    headerCursor += 2;
                }
            }

            headers.push({
                variationDataSize,
                tupleIndex,
                peak,
                startTuple,
                endTuple
            });
        }

        const variations = [];
        for (const header of headers) {
            const tupleEnd = dataCursor + header.variationDataSize;
            let pointNumbers = sharedPoints;

            if (header.tupleIndex & 0x2000) {
                const parsed = this.readPackedPoints(dataCursor, glyph.pointsWithPhantoms.length);
                pointNumbers = parsed.points;
                dataCursor = parsed.next;
            }

            const pointCount = pointNumbers ? pointNumbers.length : glyph.pointsWithPhantoms.length;
            const xDeltas = this.readPackedDeltas(dataCursor, pointCount);
            dataCursor = xDeltas.next;
            const yDeltas = this.readPackedDeltas(dataCursor, pointCount);
            dataCursor = yDeltas.next;
            dataCursor = tupleEnd;

            variations.push({
                peak: header.peak,
                start: header.startTuple,
                end: header.endTuple,
                deltas: this.expandTupleDeltas(glyph, pointNumbers, xDeltas.values, yDeltas.values)
            });
        }

        this.variationCache.set(glyph.id, variations);
        return variations;
    }

    readPackedPoints(offset, pointCount) {
        const r = this.reader;
        let cursor = offset;
        let count = r.u8(cursor++);

        if (count === 0) {
            return { points: null, next: cursor };
        }

        if (count & 0x80) {
            count = ((count & 0x7f) << 8) | r.u8(cursor++);
        }

        const points = [];
        let point = 0;
        while (points.length < count) {
            const control = r.u8(cursor++);
            const runCount = (control & 0x7f) + 1;
            for (let index = 0; index < runCount; index++) {
                point += control & 0x80 ? r.u16(cursor) : r.u8(cursor);
                cursor += control & 0x80 ? 2 : 1;
                if (point < pointCount) points.push(point);
            }
        }

        return { points, next: cursor };
    }

    readPackedDeltas(offset, count) {
        const r = this.reader;
        const values = [];
        let cursor = offset;

        while (values.length < count) {
            const control = r.u8(cursor++);
            const runCount = (control & 0x3f) + 1;

            if (control & 0x80) {
                for (let index = 0; index < runCount; index++) values.push(0);
            } else if (control & 0x40) {
                for (let index = 0; index < runCount; index++) {
                    values.push(r.i16(cursor));
                    cursor += 2;
                }
            } else {
                for (let index = 0; index < runCount; index++) values.push(r.i8(cursor++));
            }
        }

        return { values, next: cursor };
    }

    expandTupleDeltas(glyph, pointNumbers, xDeltas, yDeltas) {
        const totalPoints = glyph.pointsWithPhantoms.length;
        const deltas = new Array(totalPoints).fill(null);

        if (!pointNumbers) {
            for (let index = 0; index < totalPoints; index++) {
                deltas[index] = { x: xDeltas[index] || 0, y: yDeltas[index] || 0 };
            }
            return deltas;
        }

        pointNumbers.forEach((pointIndex, index) => {
            deltas[pointIndex] = { x: xDeltas[index] || 0, y: yDeltas[index] || 0 };
        });

        this.interpolateMissingDeltas(glyph, deltas);

        for (let index = 0; index < totalPoints; index++) {
            if (!deltas[index]) deltas[index] = { x: 0, y: 0 };
        }

        return deltas;
    }

    interpolateMissingDeltas(glyph, deltas) {
        let contourStart = 0;
        for (const contourEnd of glyph.contours) {
            this.interpolateContour(glyph.pointsWithPhantoms, deltas, contourStart, contourEnd);
            contourStart = contourEnd + 1;
        }
    }

    interpolateContour(points, deltas, start, end) {
        const refs = [];
        for (let index = start; index <= end; index++) {
            if (deltas[index]) refs.push(index);
        }

        if (!refs.length) return;

        if (refs.length === 1) {
            const delta = deltas[refs[0]];
            for (let index = start; index <= end; index++) {
                if (!deltas[index]) deltas[index] = { ...delta };
            }
            return;
        }

        for (let refIndex = 0; refIndex < refs.length; refIndex++) {
            const left = refs[refIndex];
            const right = refs[(refIndex + 1) % refs.length];
            const segment = [];
            let cursor = left === end ? start : left + 1;
            while (cursor !== right) {
                segment.push(cursor);
                cursor = cursor === end ? start : cursor + 1;
            }

            for (const pointIndex of segment) {
                deltas[pointIndex] = {
                    x: this.interpolateAxis(points[pointIndex].x, points[left].x, deltas[left].x, points[right].x, deltas[right].x),
                    y: this.interpolateAxis(points[pointIndex].y, points[left].y, deltas[left].y, points[right].y, deltas[right].y)
                };
            }
        }
    }

    interpolateAxis(value, leftValue, leftDelta, rightValue, rightDelta) {
        if (leftValue === rightValue) return leftDelta;
        if (leftValue > rightValue) {
            [leftValue, rightValue] = [rightValue, leftValue];
            [leftDelta, rightDelta] = [rightDelta, leftDelta];
        }
        if (value <= leftValue) return leftDelta;
        if (value >= rightValue) return rightDelta;
        return leftDelta + ((rightDelta - leftDelta) * (value - leftValue)) / (rightValue - leftValue);
    }

    instancePoints(glyph, location) {
        const coords = this.normalizedLocation(location);
        const points = glyph.pointsWithPhantoms.map((point) => ({ ...point }));

        for (const variation of this.readGlyphVariations(glyph)) {
            const scalar = this.tupleScalar(coords, variation.peak, variation.start, variation.end);
            if (!Number.isFinite(scalar) || Math.abs(scalar) < 0.000001) continue;

            variation.deltas.forEach((delta, index) => {
                points[index].x += delta.x * scalar;
                points[index].y += delta.y * scalar;
            });
        }

        return points;
    }

    pathFor(character, location, fontSize) {
        const cacheKey = `${character}:${location.wght.toFixed(3)}:${location.opsz.toFixed(3)}:${fontSize}`;
        if (this.pathCache.has(cacheKey)) return this.pathCache.get(cacheKey);

        const glyph = this.glyphForCharacter(character);
        const points = this.instancePoints(glyph, location);
        const scale = fontSize / this.unitsPerEm;
        const advance = points[points.length - 3].x - points[points.length - 4].x;
        const metricCenter = (this.ascender + this.descender) / 2;

        const outlinePoints = points.slice(0, glyph.points.length).map((point) => ({
            x: (point.x - advance / 2) * scale,
            y: (metricCenter - point.y) * scale,
            onCurve: point.onCurve
        }));

        let start = 0;
        const paths = [];
        for (const end of glyph.contours) {
            paths.push(this.contourToPath(outlinePoints.slice(start, end + 1)));
            start = end + 1;
        }

        const result = paths.join(' ');
        this.pathCache.set(cacheKey, result);
        return result;
    }

    contourToPath(contour) {
        if (!contour.length) return '';

        const expanded = [];
        for (let index = 0; index < contour.length; index++) {
            const current = contour[index];
            const next = contour[(index + 1) % contour.length];
            expanded.push(current);
            if (!current.onCurve && !next.onCurve) {
                expanded.push({
                    x: (current.x + next.x) / 2,
                    y: (current.y + next.y) / 2,
                    onCurve: true
                });
            }
        }

        if (!expanded[0].onCurve) {
            const last = expanded[expanded.length - 1];
            expanded.unshift({
                x: (expanded[0].x + last.x) / 2,
                y: (expanded[0].y + last.y) / 2,
                onCurve: true
            });
        }

        const commands = [`M ${this.format(expanded[0].x)} ${this.format(expanded[0].y)}`];
        for (let index = 1; index < expanded.length; index++) {
            const point = expanded[index];
            if (point.onCurve) {
                commands.push(`L ${this.format(point.x)} ${this.format(point.y)}`);
            } else {
                const next = expanded[index + 1] || expanded[0];
                commands.push(`Q ${this.format(point.x)} ${this.format(point.y)} ${this.format(next.x)} ${this.format(next.y)}`);
                index++;
            }
        }

        commands.push('Z');
        return commands.join(' ');
    }

    format(value) {
        const rounded = Math.round(value * 1000) / 1000;
        return Object.is(rounded, -0) ? '0' : String(rounded);
    }
}

const app = defineTool({
    renderer: 'svg',
    autoStart: true,

    dom: {
        canvas: 'canvasContainer',
        surface: 'mainSvg',
        zoomIndicator: 'zoomIndicator'
    },

    settings: {
        weightSteps: 6,
        opszSteps: 12,
        opacity: 1,
        fontSize: 240,
        outlineMode: false,
        strokeWidth: 1,
        color: '#ffffff',
        bg: '#000000'
    },

    size: artboardSize,

    controls: {
        sliders: [
            { id: 'weightStepsSlider', valueId: 'weightStepsValue', setting: 'weightSteps', min: 1, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'opszStepsSlider', valueId: 'opszStepsValue', setting: 'opszSteps', min: 1, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'fontSizeSlider', valueId: 'fontSizeValue', setting: 'fontSize', min: 80, max: 1100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'opacitySlider', valueId: 'opacityValue', setting: 'opacity', min: 1, max: 100, decimals: 0, baseStep: 1, shiftStep: 10, suffix: '%' },
            { id: 'strokeWidthSlider', valueId: 'strokeWidthValue', setting: 'strokeWidth', min: 1, max: 80, decimals: 0, baseStep: 1, shiftStep: 10 }
        ],
        toggles: true
    },

    panels: [
        { id: 'axesPanel', headerId: 'axesPanelHeader', persistent: true },
        { id: 'typePanel', headerId: 'typePanelHeader', persistent: true },
        { id: 'colorsPanel', headerId: 'colorsPanelHeader', persistent: true }
    ],

    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'type', setting: 'color', label: 'Type', itemId: 'typeColorItem', dotId: 'typeColorPreview', hexId: 'typeColorHex', hsbSlotId: 'typeColorHsbSlot' },
            { type: 'bg', setting: 'bg', label: 'Background', itemId: 'bgColorItem', dotId: 'bgColorPreview', hexId: 'bgColorHex', hsbSlotId: 'bgColorHsbSlot' }
        ]
    },

    export: false,
    shortcuts: { 'mod+e': exportPreview },

    render(ctx) {
        const { svg, create, width, height, settings } = ctx;
        const weightSteps = Math.round(settings.weightSteps);
        const opszSteps = Math.round(settings.opszSteps);
        const opacity = clamp(settings.opacity, 1, 100) / 100;
        const outlineMode = !!settings.outlineMode;

        svg.appendChild(create('rect', { x: 0, y: 0, width, height, fill: settings.bg }));

        if (loadError) {
            const text = create('text', {
                x: width / 2,
                y: height / 2,
                class: 'pragma-loading',
                'text-anchor': 'middle',
                'dominant-baseline': 'middle'
            });
            text.textContent = 'Font load error';
            svg.appendChild(text);
            return;
        }

        if (!pragmaFont) {
            const text = create('text', {
                x: width / 2,
                y: height / 2,
                class: 'pragma-loading',
                'text-anchor': 'middle',
                'dominant-baseline': 'middle'
            });
            text.textContent = 'Loading';
            svg.appendChild(text);
            return;
        }

        const groupAttrs = {
            transform: `translate(${width / 2} ${height / 2})`,
            'fill-rule': 'nonzero'
        };

        if (outlineMode) {
            groupAttrs.fill = 'none';
            groupAttrs.stroke = settings.color;
            groupAttrs['stroke-opacity'] = opacity;
            groupAttrs['stroke-width'] = Math.max(1, Number(settings.strokeWidth) || 1);
            groupAttrs['stroke-linejoin'] = 'round';
            groupAttrs['stroke-linecap'] = 'round';
        } else {
            groupAttrs.fill = settings.color;
            groupAttrs['fill-opacity'] = opacity;
        }

        const group = create('g', groupAttrs);

        const weights = axisValues(300, 700, weightSteps);
        const opticalSizes = axisValues(0, 100, opszSteps);

        for (const wght of weights) {
            for (const opsz of opticalSizes) {
                const path = document.createElementNS(SVG_NS, 'path');
                path.setAttribute('class', 'pragma-preview-layer');
                path.setAttribute('d', pragmaFont.pathFor(GLYPH, { wght, opsz }, settings.fontSize));
                path.setAttribute('data-wght', thisNumber(wght));
                path.setAttribute('data-opsz', thisNumber(opsz));
                group.appendChild(path);
            }
        }

        svg.appendChild(group);
    },

    onReady(app) {
        const exportButton = document.getElementById('exportSvgBtn');
        const exportPngButton = document.getElementById('exportPngBtn');
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.addEventListener('click', () => exportPreview(app));
        }
        if (exportPngButton) {
            exportPngButton.disabled = true;
            exportPngButton.addEventListener('click', () => exportPngPreview(app));
        }

        PragmaGlyphFont.load(FONT_URL)
            .then((font) => {
                pragmaFont = font;
                if (exportButton) exportButton.disabled = false;
                if (exportPngButton) exportPngButton.disabled = false;
                app.renderNow();
                app.target.fitToScreen();
            })
            .catch((error) => {
                loadError = error;
                console.error(error);
                app.renderNow();
                app.dialog?.alert({
                    title: 'Font load error',
                    text: error.message
                });
            });
    }
});

function thisNumber(value) {
    return String(Math.round(value * 1000) / 1000);
}

export default app;
