import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createEyeCorrection,
    eyeCorrectionDistance,
    sampleEyeCorrection
} from '../src/animation/eyeCorrection.js';
import { buildCharacterGeometry } from '../src/geometry/characterGeometry.js';
import { buildEyeGeometry, presentEyeGeometry } from '../src/geometry/eyeGeometry.js';

test('the fast-to-exact eye correction starts without a jump and ends exactly', () => {
    const from = { pairCenter: { x: 140, y: 385 }, fitScale: 1 };
    const target = { pairCenter: { x: 146, y: 370 }, fitScale: 0.9 };
    const correction = createEyeCorrection(from, target, 1000, 100);

    assert.deepEqual(sampleEyeCorrection(correction, 1000).placement, {
        pairCenter: from.pairCenter,
        fitScale: from.fitScale
    });
    const middle = sampleEyeCorrection(correction, 1050);
    assert.ok(middle.placement.pairCenter.x > from.pairCenter.x);
    assert.ok(middle.placement.pairCenter.x < target.pairCenter.x);
    const end = sampleEyeCorrection(correction, 1100);
    assert.equal(end.done, true);
    assert.deepEqual(end.placement, {
        pairCenter: target.pairCenter,
        fitScale: target.fitScale
    });
});

test('the correction path stays inside the current head at an extreme Focus', () => {
    const initialHead = buildCharacterGeometry();
    const initialEyes = buildEyeGeometry(initialHead.values, initialHead);
    const angle = 16 / 48 * Math.PI * 2;
    const radius = 195.233;
    const head = buildCharacterGeometry({
        focusX: 240 + Math.cos(angle) * radius,
        focusY: 240 + Math.sin(angle) * radius
    });
    const fast = buildEyeGeometry(head.values, head, {
        placementMode: 'fast',
        previousEyeGeometry: initialEyes,
        allowFastScaleReduction: false
    });
    const exact = buildEyeGeometry(head.values, head);
    assert.ok(eyeCorrectionDistance(fast, exact) > 10);

    const correction = createEyeCorrection(fast, exact, 0, 100);
    for (let time = 0; time <= 100; time += 10) {
        const { placement } = sampleEyeCorrection(correction, time);
        const presented = presentEyeGeometry(exact, placement);
        assert.ok(presented.minClearance + 0.025 >= presented.guard);
    }
});
