#!/usr/bin/env node
import assert from 'node:assert/strict';
import { LCAKB23 } from '../app/kb/layouts.js';
import { renderLayoutSvg } from './render-import-export.mjs';

const COMPOSITE_PAIRS = new Map([
    ['К', 'K'],
    ['Е', 'E'],
    ['Н', 'H'],
    ['Х', 'X'],
    ['В', 'B'],
    ['А', 'A'],
    ['Р', 'P'],
    ['О', 'O'],
    ['С', 'C'],
    ['М', 'M'],
    ['Т', 'T']
]);
const WEIGHTS = [100, 250, 400, 700, 900];
const COORD_TOLERANCE = 0.08;

function pathNumbers(pathD = '') {
    return String(pathD).match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)?.map(Number) || [];
}

function pathBounds(pathD = '') {
    const nums = pathNumbers(pathD);
    if (nums.length < 2) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = nums[i];
        const y = nums[i + 1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
    }
    return Number.isFinite(x0) ? [x0, y0, x1, y1] : null;
}

function closeBox(a, b) {
    if (!a || !b) return false;
    return a.every((value, index) => Math.abs(value - b[index]) <= COORD_TOLERANCE);
}

function closePath(a, b) {
    const left = pathNumbers(a);
    const right = pathNumbers(b);
    return left.length === right.length
        && left.every((value, index) => Math.abs(value - right[index]) <= COORD_TOLERANCE);
}

let checked = 0;

for (const fontWeight of WEIGHTS) {
    const rendered = renderLayoutSvg(LCAKB23, { fontWeight, fontWidth: 100 });
    assert.equal(rendered.font.coordinates.wght, fontWeight, `render should use wght=${fontWeight}`);
    assert.ok(!/<text\b/i.test(rendered.svg), 'export regression should inspect outlined SVG paths');

    const seen = new Set();
    for (const el of rendered.legends) {
        const text = String(el.text || '');
        if (!COMPOSITE_PAIRS.has(text)) continue;

        const latin = COMPOSITE_PAIRS.get(text);
        const expected = rendered.typeface.pathData(latin, el.size, el.tracking || 0, [el.bx, el.by]);
        assert.ok(closePath(el.pathD, expected), `${text} should export like ${latin} at wght=${fontWeight}`);

        const actualBox = pathBounds(el.pathD);
        const expectedBox = pathBounds(expected);
        assert.ok(closeBox(actualBox, expectedBox), `${text} bounds should match ${latin} at wght=${fontWeight}`);
        assert.ok(actualBox[1] >= el.key.y - el.key.h, `${text} should not spike above its key at wght=${fontWeight}`);
        assert.ok(actualBox[3] <= el.key.y + el.key.h * 2, `${text} should not spike below its key at wght=${fontWeight}`);

        seen.add(text);
        checked++;
    }

    for (const ch of COMPOSITE_PAIRS.keys()) {
        assert.ok(seen.has(ch), `layout should contain ${ch}`);
    }
}

console.log(`export variable font regression passed: ${checked} composite legend checks across ${WEIGHTS.length} weights`);
