import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateFitView,
    calculateZoomView,
    clientToSvgPoint,
    getSvgRenderScale,
    getSvgViewportSize,
    screenDeltaToSvg
} from '../src/ui/CanvasViewTransform.js';

const rect = { left: 0, top: 0, width: 800, height: 600 };
const viewBox = { x: 0, y: 0, width: 400, height: 300 };

function assertClose(actual, expected) {
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);
}

test('canvas viewport and render scale swap axes at quarter turns', () => {
    assert.deepEqual(getSvgViewportSize(rect, 0), { width: 800, height: 600 });
    assert.deepEqual(getSvgViewportSize(rect, 90), { width: 600, height: 800 });
    assert.equal(getSvgRenderScale(rect, viewBox, 0), 2);
    assert.equal(getSvgRenderScale(rect, viewBox, 90), 1.5);
});

test('screen pan follows visible axes at every canvas rotation', () => {
    assert.deepEqual(screenDeltaToSvg(20, 10, rect, viewBox, 0), { x: 10, y: 5 });
    const quarterTurn = screenDeltaToSvg(20, 10, rect, viewBox, 90);
    assertClose(quarterTurn.x, 10 / 1.5);
    assertClose(quarterTurn.y, -20 / 1.5);
    assert.deepEqual(screenDeltaToSvg(20, 10, rect, viewBox, 180), { x: -10, y: -5 });
});

test('client coordinates map to the same SVG center after rotation', () => {
    assert.deepEqual(clientToSvgPoint(400, 300, rect, viewBox, 0), { x: 200, y: 150 });
    const rotatedCenter = clientToSvgPoint(400, 300, rect, viewBox, 90);
    assertClose(rotatedCenter.x, 200);
    assertClose(rotatedCenter.y, 150);

    const rotatedUpperPoint = clientToSvgPoint(400, 150, rect, viewBox, 90);
    assertClose(rotatedUpperPoint.x, 100);
    assertClose(rotatedUpperPoint.y, 150);
});

test('cursor-centered zoom and Fit return deterministic view state', () => {
    assert.deepEqual(calculateZoomView({
        requestedZoom: 2,
        currentZoom: 1,
        minZoom: 1,
        maxZoom: 10,
        mouseX: 400,
        mouseY: 300,
        rect,
        viewBox: { x: 0, y: 0, width: 800, height: 600 },
        originalWidth: 800,
        originalHeight: 600
    }), { zoom: 2, panX: 200, panY: 150 });

    assert.deepEqual(calculateFitView({
        bbox: { x: 10, y: 20, width: 500, height: 300 },
        containerRect: { width: 1200, height: 900 },
        originalWidth: 1000,
        originalHeight: 800,
        minZoom: 1,
        maxZoom: 10
    }), { zoom: 1, baseZoom: 1, panX: -240, panY: -230 });
});
