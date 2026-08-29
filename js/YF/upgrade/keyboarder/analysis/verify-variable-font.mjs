import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFont } from '../app/kb/typography.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_PATH = resolve(ROOT, 'Fonts/YS Text Variable/YSText-Upright-weight-VF.ttf');

const LOCATIONS = [
    { wght: 100, wdth: 100 },
    { wght: 400, wdth: 100 },
    { wght: 900, wdth: 100 },
    { wght: 400, wdth: 70 },
    { wght: 400, wdth: 150 },
    { wght: 100, wdth: 70 },
    { wght: 900, wdth: 150 }
];

const ADVANCE_TOLERANCE = 1.1;
const BOUNDS_TOLERANCE = 1.1;
const REPORT_LIMIT = 20;

function loadTypeface(path) {
    const buf = readFileSync(path);
    return parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function locationKey(location) {
    return `wght=${location.wght},wdth=${location.wdth}`;
}

function fontToolsSnapshot(locations) {
    const code = `
import json
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

font_path = sys.argv[1]
locations = json.loads(sys.argv[2])
out = {}

for location in locations:
    key = "wght=%s,wdth=%s" % (location["wght"], location["wdth"])
    font = instantiateVariableFont(TTFont(font_path), location, inplace=False)
    glyf = font["glyf"]
    hmtx = font["hmtx"]
    rows = []
    for name in font.getGlyphOrder():
        glyph = glyf[name]
        box = None
        try:
            glyph.recalcBounds(glyf)
            if hasattr(glyph, "xMin"):
                box = [glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax]
        except Exception:
            box = None
        rows.append({
            "name": name,
            "advance": hmtx.metrics[name][0],
            "box": box,
            "composite": glyph.isComposite()
        })
    out[key] = rows

print(json.dumps(out, separators=(",", ":")))
`;
    const stdout = execFileSync('python3', ['-c', code, FONT_PATH, JSON.stringify(locations)], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return JSON.parse(stdout);
}

function commandBounds(commands = []) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const add = (x, y) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
    };
    for (const cmd of commands) {
        if (cmd.type === 'Z') continue;
        add(cmd.x, cmd.y);
        if (cmd.type === 'Q' || cmd.type === 'C') add(cmd.x1, cmd.y1);
        if (cmd.type === 'C') add(cmd.x2, cmd.y2);
    }
    return Number.isFinite(x0) ? [x0, y0, x1, y1] : null;
}

function maxBoxDelta(a, b) {
    const emptyBox = (box) => Array.isArray(box) && box.every((value) => value === 0);
    if (!a && emptyBox(b)) return 0;
    if (!b && emptyBox(a)) return 0;
    if (!a && !b) return 0;
    if (!a || !b) return Infinity;
    return Math.max(...a.map((value, index) => Math.abs(value - b[index])));
}

function round(value) {
    return Math.round(value * 1000) / 1000;
}

const typeface = loadTypeface(FONT_PATH);
const expected = fontToolsSnapshot(LOCATIONS);
const failures = [];

for (const location of LOCATIONS) {
    typeface.setVariations(location);
    const normalized = typeface.variationModel.normalize(location);
    const rows = expected[locationKey(location)] || [];
    assert.equal(rows.length, typeface.font.numGlyphs, `fontTools glyph count mismatch at ${locationKey(location)}`);

    for (let index = 0; index < rows.length; index++) {
        const glyph = typeface.font.glyphs.get(index);
        const actual = typeface.variationModel.instantiateGlyph(glyph, normalized);
        const actualBox = commandBounds(actual.commands);
        const expectedRow = rows[index];
        const advanceDelta = Math.abs((actual.advance || 0) - expectedRow.advance);
        const boundsDelta = maxBoxDelta(actualBox, expectedRow.box);
        if (glyph.name !== expectedRow.name || advanceDelta > ADVANCE_TOLERANCE || boundsDelta > BOUNDS_TOLERANCE) {
            failures.push({
                location: locationKey(location),
                index,
                glyph: glyph.name,
                expectedGlyph: expectedRow.name,
                advance: round(actual.advance || 0),
                expectedAdvance: expectedRow.advance,
                advanceDelta: round(advanceDelta),
                box: actualBox?.map(round) || null,
                expectedBox: expectedRow.box,
                boundsDelta: round(boundsDelta)
            });
        }
    }
}

if (failures.length) {
    console.error(JSON.stringify(failures.slice(0, REPORT_LIMIT), null, 2));
}
assert.equal(failures.length, 0, `${failures.length} variable glyph metric mismatch(es)`);

console.log(`variable font verification passed: ${typeface.font.numGlyphs} glyphs x ${LOCATIONS.length} locations`);
