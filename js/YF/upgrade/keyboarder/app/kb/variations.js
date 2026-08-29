/**
 * Minimal TrueType variation support for outline rendering.
 *
 * opentype.js parses `fvar` but does not apply `gvar` deltas. Keyboarder needs
 * real outline instances for exported legends, so this module handles the
 * subset used by YS Text VF: normalized coordinates, optional `avar` mapping,
 * packed `gvar` deltas, IUP interpolation, and phantom-point advance deltas.
 */

const GLYPH_VARIATION_COUNT_MASK = 0x0fff;
const GLYPH_VARIATIONS_HAVE_SHARED_POINT_NUMBERS = 0x8000;
const EMBEDDED_PEAK_TUPLE = 0x8000;
const INTERMEDIATE_REGION = 0x4000;
const PRIVATE_POINT_NUMBERS = 0x2000;
const TUPLE_INDEX_MASK = 0x0fff;
const POINTS_ARE_WORDS = 0x80;
const POINT_RUN_COUNT_MASK = 0x7f;
const DELTAS_ARE_ZERO = 0x80;
const DELTAS_ARE_WORDS = 0x40;
const DELTA_RUN_COUNT_MASK = 0x3f;

const finite = (value) => Number.isFinite(value) ? value : null;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function viewFor(buffer) {
    if (!buffer) return null;
    if (buffer instanceof ArrayBuffer) return new DataView(buffer);
    if (ArrayBuffer.isView(buffer)) {
        return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    return null;
}

function tagAt(view, offset) {
    return String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
    );
}

function tableDirectory(view) {
    if (!view || view.byteLength < 12) return new Map();
    const tableCount = view.getUint16(4, false);
    const tables = new Map();
    for (let i = 0; i < tableCount; i++) {
        const pos = 12 + i * 16;
        if (pos + 16 > view.byteLength) break;
        tables.set(tagAt(view, pos), {
            offset: view.getUint32(pos + 8, false),
            length: view.getUint32(pos + 12, false)
        });
    }
    return tables;
}

function readF2Dot14(view, offset) {
    return view.getInt16(offset, false) / 16384;
}

function parseAvar(view, table, axes) {
    if (!table || table.offset + 8 > view.byteLength) return new Map();
    const start = table.offset;
    const axisCount = view.getUint16(start + 6, false);
    const maps = new Map();
    let pos = start + 8;
    for (let axisIndex = 0; axisIndex < axisCount; axisIndex++) {
        const axis = axes[axisIndex];
        const count = view.getUint16(pos, false);
        pos += 2;
        const segments = [];
        for (let i = 0; i < count; i++) {
            if (pos + 4 > view.byteLength) break;
            segments.push({ from: readF2Dot14(view, pos), to: readF2Dot14(view, pos + 2) });
            pos += 4;
        }
        if (axis?.tag && segments.length) maps.set(axis.tag, segments.sort((a, b) => a.from - b.from));
    }
    return maps;
}

function mapAvar(value, segments) {
    if (!segments?.length) return value;
    for (const segment of segments) {
        if (Math.abs(value - segment.from) < 1e-7) return segment.to;
    }
    for (let i = 0; i < segments.length - 1; i++) {
        const a = segments[i];
        const b = segments[i + 1];
        if (value < a.from || value > b.from) continue;
        const span = b.from - a.from;
        return span === 0 ? a.to : a.to + (b.to - a.to) * ((value - a.from) / span);
    }
    return value;
}

function normalizeAxis(value, axis) {
    const min = finite(axis.minValue) ?? 0;
    const def = finite(axis.defaultValue) ?? 0;
    const max = finite(axis.maxValue) ?? def;
    const v = clamp(finite(Number(value)) ?? def, min, max);
    if (v === def) return 0;
    if (v < def) return def === min ? 0 : (v - def) / (def - min);
    return max === def ? 0 : (v - def) / (max - def);
}

function parseGvar(view, table, axisCount) {
    if (!table || table.offset + 20 > view.byteLength) return null;
    const start = table.offset;
    const parsedAxisCount = view.getUint16(start + 4, false);
    if (parsedAxisCount !== axisCount) return null;
    const sharedTupleCount = view.getUint16(start + 6, false);
    const sharedTuplesOffset = view.getUint32(start + 8, false);
    const glyphCount = view.getUint16(start + 12, false);
    const flags = view.getUint16(start + 14, false);
    const glyphDataOffset = view.getUint32(start + 16, false);
    let pos = start + 20;
    const offsets = [];
    if (flags & 1) {
        for (let i = 0; i <= glyphCount; i++) {
            offsets.push(view.getUint32(pos, false));
            pos += 4;
        }
    } else {
        for (let i = 0; i <= glyphCount; i++) {
            offsets.push(view.getUint16(pos, false) * 2);
            pos += 2;
        }
    }
    const sharedTuples = [];
    let sharedPos = start + sharedTuplesOffset;
    for (let i = 0; i < sharedTupleCount; i++) {
        const tuple = [];
        for (let axis = 0; axis < axisCount; axis++) {
            tuple.push(readF2Dot14(view, sharedPos));
            sharedPos += 2;
        }
        sharedTuples.push(tuple);
    }
    return { view, start, axisCount, glyphCount, glyphDataStart: start + glyphDataOffset, offsets, sharedTuples, cache: new Map() };
}

function readTupleCoordinates(view, pos, axisCount) {
    const values = [];
    for (let i = 0; i < axisCount; i++) {
        values.push(readF2Dot14(view, pos));
        pos += 2;
    }
    return { values, pos };
}

function readPackedPoints(view, pos) {
    let count = view.getUint8(pos++);
    if (count === 0) return { points: null, pos };
    if (count & POINTS_ARE_WORDS) {
        count = ((count & POINT_RUN_COUNT_MASK) << 8) | view.getUint8(pos++);
    }
    const points = [];
    let point = 0;
    while (points.length < count) {
        const control = view.getUint8(pos++);
        const runCount = (control & POINT_RUN_COUNT_MASK) + 1;
        const words = !!(control & POINTS_ARE_WORDS);
        for (let i = 0; i < runCount && points.length < count; i++) {
            point += words ? view.getUint16(pos, false) : view.getUint8(pos);
            pos += words ? 2 : 1;
            points.push(point);
        }
    }
    return { points, pos };
}

function readPackedDeltas(view, pos, count) {
    const deltas = [];
    while (deltas.length < count) {
        const control = view.getUint8(pos++);
        const runCount = (control & DELTA_RUN_COUNT_MASK) + 1;
        if (control & DELTAS_ARE_ZERO) {
            for (let i = 0; i < runCount && deltas.length < count; i++) deltas.push(0);
        } else if (control & DELTAS_ARE_WORDS) {
            for (let i = 0; i < runCount && deltas.length < count; i++) {
                deltas.push(view.getInt16(pos, false));
                pos += 2;
            }
        } else {
            for (let i = 0; i < runCount && deltas.length < count; i++) {
                deltas.push(view.getInt8(pos++));
            }
        }
    }
    return { deltas, pos };
}

function parseGlyphVariationData(gvar, glyphIndex) {
    if (!gvar || glyphIndex < 0 || glyphIndex >= gvar.glyphCount) return [];
    if (gvar.cache.has(glyphIndex)) return gvar.cache.get(glyphIndex);
    const start = gvar.glyphDataStart + gvar.offsets[glyphIndex];
    const end = gvar.glyphDataStart + gvar.offsets[glyphIndex + 1];
    if (start === end || start + 4 > gvar.view.byteLength) {
        gvar.cache.set(glyphIndex, []);
        return [];
    }
    const rawCount = gvar.view.getUint16(start, false);
    const tupleCount = rawCount & GLYPH_VARIATION_COUNT_MASK;
    const hasSharedPoints = !!(rawCount & GLYPH_VARIATIONS_HAVE_SHARED_POINT_NUMBERS);
    const dataOffset = gvar.view.getUint16(start + 2, false);
    let headerPos = start + 4;
    const headers = [];
    for (let i = 0; i < tupleCount; i++) {
        const variationDataSize = gvar.view.getUint16(headerPos, false);
        const tupleIndex = gvar.view.getUint16(headerPos + 2, false);
        headerPos += 4;
        let peak = null;
        let startCoord = null;
        let endCoord = null;
        if (tupleIndex & EMBEDDED_PEAK_TUPLE) {
            const parsed = readTupleCoordinates(gvar.view, headerPos, gvar.axisCount);
            peak = parsed.values;
            headerPos = parsed.pos;
        } else {
            peak = gvar.sharedTuples[tupleIndex & TUPLE_INDEX_MASK] || null;
        }
        if (tupleIndex & INTERMEDIATE_REGION) {
            const startParsed = readTupleCoordinates(gvar.view, headerPos, gvar.axisCount);
            startCoord = startParsed.values;
            const endParsed = readTupleCoordinates(gvar.view, startParsed.pos, gvar.axisCount);
            endCoord = endParsed.values;
            headerPos = endParsed.pos;
        }
        headers.push({ variationDataSize, tupleIndex, peak, startCoord, endCoord });
    }

    let dataPos = start + dataOffset;
    let sharedPoints = null;
    if (hasSharedPoints) {
        const parsed = readPackedPoints(gvar.view, dataPos);
        sharedPoints = parsed.points;
        dataPos = parsed.pos;
    }

    const tuples = [];
    for (const header of headers) {
        let tuplePos = dataPos;
        let points = sharedPoints;
        if (header.tupleIndex & PRIVATE_POINT_NUMBERS) {
            const parsed = readPackedPoints(gvar.view, tuplePos);
            points = parsed.points;
            tuplePos = parsed.pos;
        }
        tuples.push({ ...header, points, tupleDataPos: tuplePos });
        dataPos += header.variationDataSize;
    }
    gvar.cache.set(glyphIndex, tuples);
    return tuples;
}

function tupleScalar(normalized, tuple, axes) {
    if (!tuple.peak) return 0;
    let scalar = 1;
    for (let i = 0; i < axes.length; i++) {
        const tag = axes[i].tag;
        const coord = normalized[tag] || 0;
        const peak = tuple.peak[i] || 0;
        if (peak === 0) continue;
        if (tuple.startCoord && tuple.endCoord) {
            const start = tuple.startCoord[i];
            const end = tuple.endCoord[i];
            if (coord < start || coord > end) return 0;
            if (coord === peak) continue;
            if (coord < peak) {
                const denom = peak - start;
                if (denom === 0) return 0;
                scalar *= (coord - start) / denom;
            } else {
                const denom = end - peak;
                if (denom === 0) return 0;
                scalar *= (end - coord) / denom;
            }
        } else {
            if (coord === 0 || Math.sign(coord) !== Math.sign(peak)) return 0;
            if (Math.abs(coord) < Math.abs(peak)) scalar *= coord / peak;
        }
    }
    return Number.isFinite(scalar) ? scalar : 0;
}

function contoursForPoints(points) {
    const contours = [];
    let contour = [];
    for (let i = 0; i < points.length; i++) {
        contour.push(i);
        if (points[i].lastPointOfContour) {
            contours.push(contour);
            contour = [];
        }
    }
    return contours;
}

function interpolateAxis(points, deltas, contour, axis) {
    const touchedPositions = [];
    for (let i = 0; i < contour.length; i++) {
        const index = contour[i];
        if (deltas[index] && Number.isFinite(deltas[index][axis])) touchedPositions.push(i);
    }
    if (!touchedPositions.length) {
        for (const index of contour) deltas[index][axis] = 0;
        return;
    }
    if (touchedPositions.length === 1) {
        const value = deltas[contour[touchedPositions[0]]][axis] || 0;
        for (const index of contour) deltas[index][axis] = value;
        return;
    }
    for (let t = 0; t < touchedPositions.length; t++) {
        const posA = touchedPositions[t];
        const posB = touchedPositions[(t + 1) % touchedPositions.length];
        const indexA = contour[posA];
        const indexB = contour[posB];
        const coordA = points[indexA][axis];
        const coordB = points[indexB][axis];
        const deltaA = deltas[indexA][axis] || 0;
        const deltaB = deltas[indexB][axis] || 0;
        const loCoord = Math.min(coordA, coordB);
        const hiCoord = Math.max(coordA, coordB);
        const loDelta = coordA <= coordB ? deltaA : deltaB;
        const hiDelta = coordA <= coordB ? deltaB : deltaA;
        let pos = (posA + 1) % contour.length;
        while (pos !== posB) {
            const index = contour[pos];
            const coord = points[index][axis];
            if (coord <= loCoord || loCoord === hiCoord) deltas[index][axis] = loDelta;
            else if (coord >= hiCoord) deltas[index][axis] = hiDelta;
            else deltas[index][axis] = loDelta + (hiDelta - loDelta) * ((coord - loCoord) / (hiCoord - loCoord));
            pos = (pos + 1) % contour.length;
        }
    }
}

function interpolateUntouched(points, rawDeltas) {
    const deltas = rawDeltas.map((delta) => ({ ...delta }));
    for (const contour of contoursForPoints(points)) {
        interpolateAxis(points, deltas, contour, 'x');
        interpolateAxis(points, deltas, contour, 'y');
    }
    return deltas;
}

function tupleDeltas(gvar, tuple, pointCount) {
    const points = tuple.points;
    const deltaCount = points ? points.length : pointCount;
    let pos = tuple.tupleDataPos;
    const x = readPackedDeltas(gvar.view, pos, deltaCount);
    const y = readPackedDeltas(gvar.view, x.pos, deltaCount);
    const deltas = Array.from({ length: pointCount }, () => ({}));
    if (points) {
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (point >= 0 && point < pointCount) {
                deltas[point] = { x: x.deltas[i] || 0, y: y.deltas[i] || 0 };
            }
        }
        return { deltas, touchedPoints: points };
    }
    for (let i = 0; i < pointCount; i++) {
        deltas[i] = { x: x.deltas[i] || 0, y: y.deltas[i] || 0 };
    }
    return { deltas, touchedPoints: null };
}

function glyphPhantomPoints(glyph) {
    const xMin = finite(glyph._xMin) ?? finite(glyph.xMin) ?? 0;
    const yMin = finite(glyph._yMin) ?? finite(glyph.yMin) ?? 0;
    const yMax = finite(glyph._yMax) ?? finite(glyph.yMax) ?? 0;
    const left = xMin - (finite(glyph.leftSideBearing) ?? 0);
    const right = left + (finite(glyph.advanceWidth) ?? 0);
    return [
        { x: left, y: 0, onCurve: true },
        { x: right, y: 0, onCurve: true },
        { x: 0, y: yMax, onCurve: true },
        { x: 0, y: yMin, onCurve: true }
    ];
}

function pointsToCommands(points) {
    const commands = [];
    const contours = [];
    let contour = [];
    for (const point of points) {
        contour.push(point);
        if (point.lastPointOfContour) {
            contours.push(contour);
            contour = [];
        }
    }
    for (const c of contours) {
        let prev = null;
        let curr = c[c.length - 1];
        let next = c[0];
        if (curr.onCurve) {
            commands.push({ type: 'M', x: curr.x, y: curr.y });
        } else if (next.onCurve) {
            commands.push({ type: 'M', x: next.x, y: next.y });
        } else {
            commands.push({ type: 'M', x: (curr.x + next.x) * 0.5, y: (curr.y + next.y) * 0.5 });
        }
        for (let i = 0; i < c.length; i++) {
            prev = curr;
            curr = next;
            next = c[(i + 1) % c.length];
            if (curr.onCurve) {
                commands.push({ type: 'L', x: curr.x, y: curr.y });
            } else {
                const target = next.onCurve
                    ? next
                    : { x: (curr.x + next.x) * 0.5, y: (curr.y + next.y) * 0.5 };
                commands.push({ type: 'Q', x1: curr.x, y1: curr.y, x: target.x, y: target.y });
            }
        }
        commands.push({ type: 'Z' });
    }
    return commands;
}

function transformCommands(commands, transform) {
    return (commands || []).map((cmd) => {
        if (cmd.type === 'Z') return { type: 'Z' };
        const point = (x, y) => ({
            x: transform.xScale * x + transform.scale01 * y + transform.dx,
            y: transform.scale10 * x + transform.yScale * y + transform.dy
        });
        if (cmd.type === 'M' || cmd.type === 'L') {
            return { type: cmd.type, ...point(cmd.x, cmd.y) };
        }
        if (cmd.type === 'Q') {
            return { type: 'Q', ...point(cmd.x, cmd.y), ...prefixPoint(point(cmd.x1, cmd.y1), '1') };
        }
        if (cmd.type === 'C') {
            return {
                type: 'C',
                ...point(cmd.x, cmd.y),
                ...prefixPoint(point(cmd.x1, cmd.y1), '1'),
                ...prefixPoint(point(cmd.x2, cmd.y2), '2')
            };
        }
        return { ...cmd };
    });
}

function prefixPoint(point, suffix) {
    return { [`x${suffix}`]: point.x, [`y${suffix}`]: point.y };
}

function ensureGlyphPoints(glyph) {
    void glyph.path;
    return glyph.points || [];
}

function compositeComponents(glyph) {
    void glyph.path;
    return glyph.isComposite && glyph.components?.length ? glyph.components : null;
}

export function createVariationModel(font, buffer) {
    const axes = font?.tables?.fvar?.axes || [];
    if (!axes.length) return null;
    const view = viewFor(buffer);
    const tables = tableDirectory(view);
    const gvar = parseGvar(view, tables.get('gvar'), axes.length);
    if (!view || !gvar) return null;
    const avar = parseAvar(view, tables.get('avar'), axes);

    return {
        axes,
        normalize(coordinates = {}) {
            const normalized = {};
            for (const axis of axes) {
                const raw = coordinates[axis.tag] ?? axis.defaultValue;
                normalized[axis.tag] = mapAvar(normalizeAxis(raw, axis), avar.get(axis.tag));
            }
            return normalized;
        },
        instantiateGlyph(glyph, normalized = {}, stack = new Set()) {
            const components = compositeComponents(glyph);
            if (components && !stack.has(glyph.index)) {
                const compositePointCount = components.length + 4;
                const compositeTotal = Array.from({ length: compositePointCount }, () => ({ x: 0, y: 0 }));
                for (const tuple of parseGlyphVariationData(gvar, glyph.index)) {
                    const scalar = tupleScalar(normalized, tuple, axes);
                    if (!scalar) continue;
                    const raw = tupleDeltas(gvar, tuple, compositePointCount);
                    for (let i = 0; i < compositePointCount; i++) {
                        compositeTotal[i].x += (raw.deltas[i]?.x || 0) * scalar;
                        compositeTotal[i].y += (raw.deltas[i]?.y || 0) * scalar;
                    }
                }
                const nextStack = new Set(stack);
                nextStack.add(glyph.index);
                const commands = [];
                let canBuild = true;
                for (let componentIndex = 0; componentIndex < components.length; componentIndex++) {
                    const component = components[componentIndex];
                    if (component.matchedPoints) {
                        canBuild = false;
                        break;
                    }
                    const componentGlyph = font.glyphs.get(component.glyphIndex);
                    const instance = this.instantiateGlyph(componentGlyph, normalized, nextStack);
                    const transform = {
                        ...component,
                        dx: component.dx + compositeTotal[componentIndex].x,
                        dy: component.dy + compositeTotal[componentIndex].y
                    };
                    commands.push(...transformCommands(instance.commands, transform));
                }
                if (canBuild && commands.length) {
                    const leftPhantom = components.length;
                    const rightPhantom = leftPhantom + 1;
                    const advanceDelta = compositeTotal[rightPhantom].x - compositeTotal[leftPhantom].x;
                    return {
                        commands,
                        advance: (finite(glyph.advanceWidth) ?? 0) + advanceDelta
                    };
                }
            }
            const basePoints = ensureGlyphPoints(glyph);
            const pointCount = basePoints.length + 4;
            const tuples = parseGlyphVariationData(gvar, glyph.index);
            if (!tuples.length) {
                return { commands: glyph.path.commands, advance: finite(glyph.advanceWidth) ?? 0 };
            }
            const total = Array.from({ length: pointCount }, () => ({ x: 0, y: 0 }));
            for (const tuple of tuples) {
                const scalar = tupleScalar(normalized, tuple, axes);
                if (!scalar) continue;
                const raw = tupleDeltas(gvar, tuple, pointCount);
                const baseDeltas = raw.touchedPoints
                    ? interpolateUntouched(basePoints, raw.deltas.slice(0, basePoints.length))
                    : raw.deltas.slice(0, basePoints.length);
                const deltas = baseDeltas.concat(raw.deltas.slice(basePoints.length));
                for (let i = 0; i < pointCount; i++) {
                    total[i].x += (deltas[i]?.x || 0) * scalar;
                    total[i].y += (deltas[i]?.y || 0) * scalar;
                }
            }
            const variedPoints = basePoints.map((point, i) => ({
                ...point,
                x: point.x + total[i].x,
                y: point.y + total[i].y
            }));
            const leftPhantom = basePoints.length;
            const rightPhantom = leftPhantom + 1;
            const advanceDelta = total[rightPhantom].x - total[leftPhantom].x;
            return {
                commands: pointsToCommands(variedPoints),
                advance: (finite(glyph.advanceWidth) ?? 0) + advanceDelta,
                phantom: glyphPhantomPoints(glyph)
            };
        }
    };
}
