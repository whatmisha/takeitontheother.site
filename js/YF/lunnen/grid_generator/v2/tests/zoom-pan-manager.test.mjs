import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateFitView } from '../src/ui/CanvasViewTransform.js';

test('fit view defines the current zoom level as the 100% baseline', () => {
    const fit = calculateFitView({
        bbox: { x: 0, y: 0, width: 2000, height: 1500 },
        containerRect: { width: 1200, height: 800 },
        originalWidth: 2000,
        originalHeight: 1500,
        minZoom: 0.1,
        maxZoom: 10
    });

    assert.ok(fit.zoom < 1);
    assert.equal(fit.baseZoom, fit.zoom);
    assert.equal(Math.round((fit.zoom / fit.baseZoom) * 100), 100);
});
