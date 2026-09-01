import assert from 'node:assert/strict';
import test from 'node:test';

import {
    BOLID_FAR_STRENGTH_RATIO,
    bolidTargetPoint,
    bolidTargetPolarFromPoint,
    resolveBolidStrength,
    resolveBolidPhases,
    settingsAtBolidTime
} from '../src/animation/bolid.js';
import { DEFAULT_GEOMETRY, buildCharacterGeometry } from '../src/geometry/characterGeometry.js';

const settings = {
    ...DEFAULT_GEOMETRY,
    boundaryCenterY: 240,
    focusMode: 'bolid',
    motionDuration: 5,
    bolidTargetAngle: 90,
    bolidTargetDistance: 40,
    bolidIntensity: 100,
    angry: 10,
    roundness: 60,
    cornerSmoothing: 100
};

test('Target uses the whole focus circle and converts back to the same polar values', () => {
    const focus = { x: 180, y: 240 };
    const atFocus = bolidTargetPoint({ ...settings, bolidTargetDistance: 0 }, focus);
    const atEdge = bolidTargetPoint({ ...settings, bolidTargetDistance: 100 }, focus);
    assert.deepEqual(atFocus, focus);
    assert.ok(Math.abs(atEdge.x - 480) < 1e-9);
    assert.ok(Math.abs(atEdge.y - 240) < 1e-9);
    const polar = bolidTargetPolarFromPoint(settings, focus, atEdge);
    assert.ok(Math.abs(polar.angle - 90) < 1e-9);
    assert.ok(Math.abs(polar.distance - 100) < 1e-9);
});

test('recomputing Target polar values keeps its absolute point fixed when Focus moves', () => {
    const firstFocus = { x: 180, y: 240 };
    const nextFocus = { x: 300, y: 150 };
    const fixedTarget = bolidTargetPoint(settings, firstFocus);
    const nextPolar = bolidTargetPolarFromPoint(
        settings,
        nextFocus,
        fixedTarget,
        settings.bolidTargetAngle
    );
    const rebuiltTarget = bolidTargetPoint({
        ...settings,
        bolidTargetAngle: nextPolar.angle,
        bolidTargetDistance: nextPolar.distance
    }, nextFocus);

    assert.ok(Math.abs(rebuiltTarget.x - fixedTarget.x) < 1e-9);
    assert.ok(Math.abs(rebuiltTarget.y - fixedTarget.y) < 1e-9);
});

test('Intensity sets scene strength while Target proximity amplifies it', () => {
    assert.equal(resolveBolidStrength({ bolidTargetDistance: 0 }), 1);
    assert.equal(
        resolveBolidStrength({ bolidTargetDistance: 100 }),
        BOLID_FAR_STRENGTH_RATIO
    );
    assert.equal(resolveBolidStrength({ bolidTargetDistance: 0, bolidIntensity: 40 }), 0.4);
    assert.equal(
        resolveBolidStrength({ bolidTargetDistance: 100, bolidIntensity: 40 }),
        0.4 * BOLID_FAR_STRENGTH_RATIO
    );
    assert.equal(resolveBolidStrength({ bolidTargetDistance: 0, bolidIntensity: 0 }), 0);
});

test('Bolid preserves configured Angry and ignores the removed legacy toggle', () => {
    const animated = settingsAtBolidTime({
        ...settings,
        bolidTargetDistance: 0,
        bolidAngryEyes: true
    }, 0, 5000);
    assert.equal(animated.angry, settings.angry);
});

test('flutter frequency is independent from Duration while every loop stays seamless', () => {
    const shortLoop = resolveBolidPhases(325, 1000);
    const longLoop = resolveBolidPhases(325, 10000);
    assert.deepEqual(longLoop, shortLoop);
    assert.notEqual(resolveBolidPhases(40, 10000).flutter, resolveBolidPhases(0, 10000).flutter);
    [1000, 5000, 10000].forEach((duration) => {
        assert.deepEqual(resolveBolidPhases(duration, duration), resolveBolidPhases(0, duration));
    });
});

test('Bolid is a seamless stationary deformation loop', () => {
    const focus = { x: 240, y: 240 };
    const sceneAt = (timeMs) => buildCharacterGeometry({
        ...settingsAtBolidTime({ ...settings, bolidTargetDistance: 0 }, timeMs, 5000),
        focusX: focus.x,
        focusY: focus.y
    });
    const start = sceneAt(0);
    const middle = sceneAt(1250);
    const seam = sceneAt(5000);
    assert.deepEqual(start.focus, focus);
    assert.deepEqual(middle.focus, focus);
    assert.notEqual(middle.rounded.path, start.rounded.path);
    assert.equal(seam.rounded.path, start.rounded.path);
});

test('Bolid geometry remains finite across ray counts, directions, strengths and phases', () => {
    for (const rayCount of [3, 5, 9, 13]) {
        for (const bolidTargetAngle of [0, 90, 180, 270]) {
            for (const bolidTargetDistance of [0, 40, 100]) {
                for (const timeMs of [0, 833, 2500, 4999]) {
                    const timed = settingsAtBolidTime({
                        ...settings,
                        rayCount,
                        bolidTargetAngle,
                        bolidTargetDistance
                    }, timeMs, 5000);
                    const geometry = buildCharacterGeometry(timed);
                    assert.doesNotMatch(geometry.rounded.path, /NaN|Infinity/);
                }
            }
        }
    }
});
