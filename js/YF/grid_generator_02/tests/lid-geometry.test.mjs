import test from 'node:test';
import assert from 'node:assert/strict';
import { createLidPanels, panelPoint, panelUV } from '../src/preview/LidGeometry.js';

const dimensions = { frontWidth: 310, frontHeight: 185, thickness: 42 };
const panels = createLidPanels(dimensions);
function close(actual, expected) {
    actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-9, `${actual} != ${expected}`));
}

test('unfolded geometry and UV coordinates coincide with the existing millimeter dieline', () => {
    for (const panel of panels) for (const u of [0, 1]) for (const v of [0, 1]) {
        const point = panelPoint(panel, (u - 0.5) * panel.width, (v - 0.5) * panel.height, 0);
        const uv = panelUV(panel, u, v);
        close(point, [uv[0] * 394 - 197, uv[1] * 269 - 134.5, 0]);
    }
});

test('hinges stay attached through every intermediate fold without scaling panels', () => {
    for (const panel of panels.filter(panel => panel.sign)) for (const fold of [0, 0.2, 0.5, 0.85, 1]) {
        const x = -panel.offset[0], y = -panel.offset[1];
        close(panelPoint(panel, x, y, fold), panel.hinge);
        const a = panelPoint(panel, -panel.width / 2, -panel.height / 2, fold);
        const b = panelPoint(panel, panel.width / 2, panel.height / 2, fold);
        assert.ok(Math.abs(Math.hypot(...a.map((value, i) => value - b[i])) - Math.hypot(panel.width, panel.height)) < 1e-9);
    }
});

test('fully folded side corners meet and form an open lid with the requested depth', () => {
    const byId = Object.fromEntries(panels.map(p => [p.id, p]));
    close(panelPoint(byId.left, -21, 92.5, 1), [-155, 92.5, -42]);
    close(panelPoint(byId.top, -155, 21, 1), [-155, 92.5, -42]);
    close(panelPoint(byId.right, 21, -92.5, 1), [155, -92.5, -42]);
    close(panelPoint(byId.bottom, 155, -21, 1), [155, -92.5, -42]);
    assert.equal(panels.length, 5);
    close(panelPoint(byId.front, 0, 0, 1), [0, 0, 0]);
});

test('visibility filters the model and invalid dimensions fail explicitly', () => {
    assert.deepEqual(createLidPanels({ ...dimensions, visibleSurfaces: ['front', 'right'] }).map(p => p.id), ['front', 'right']);
    for (const value of [0, -1, Infinity, NaN]) assert.throws(() => createLidPanels({ ...dimensions, thickness: value }));
});
