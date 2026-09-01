import assert from 'node:assert/strict';
import test from 'node:test';

import {
    normalizeRayFrequency,
    normalizeRayMotion,
    normalizeRayPhase,
    normalizeRayVariation,
    settingsAtRayMotionTime
} from '../src/geometry/rayModulation.js';

test('ray modulation controls normalize to their UI contracts', () => {
    assert.equal(normalizeRayVariation(-20), 0);
    assert.equal(normalizeRayVariation(120), 100);
    assert.equal(normalizeRayFrequency(0), 1);
    assert.equal(normalizeRayFrequency(9), 6);
    assert.equal(normalizeRayPhase(-1), 0);
    assert.equal(normalizeRayPhase(500), 360);
    assert.equal(normalizeRayMotion(-1), 0);
    assert.equal(normalizeRayMotion(9), 4);
});

test('ray phase advances by whole revolutions and wraps seamlessly', () => {
    const settings = {
        rayModulationPhase: 30,
        rayMotion: 2,
        motionDuration: 4
    };
    assert.equal(settingsAtRayMotionTime(settings, 0, 4000).rayModulationPhase, 30);
    assert.equal(settingsAtRayMotionTime(settings, 1000, 4000).rayModulationPhase, 210);
    assert.equal(settingsAtRayMotionTime(settings, 4000, 4000).rayModulationPhase, 30);
    assert.equal(settingsAtRayMotionTime(settings, -1000, 4000).rayModulationPhase, 570);
});
