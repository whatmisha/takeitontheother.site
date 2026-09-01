import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildBolidColorTrailLayers,
    buildBolidEyeColorTrailLayers,
    colorToOklch,
    normalizeBolidColorTrail,
    normalizeBolidHueSpread,
    resolveBolidTrailColors,
    resolveBolidTrailSpectrum
} from '../src/animation/bolidColorTrail.js';
import { DEFAULT_GEOMETRY } from '../src/geometry/characterGeometry.js';

const settings = {
    ...DEFAULT_GEOMETRY,
    boundaryCenterY: 240,
    focusMode: 'bolid',
    motionDuration: 5,
    bolidTargetAngle: 180,
    bolidTargetDistance: 0,
    bolidIntensity: 100,
    bolidColorTrail: 100,
    headColor: '#ffffff',
    eyeColor: '#000000',
    roundness: 60,
    cornerSmoothing: 100
};

const angularDelta = (from, to) => ((to - from + 540) % 360) - 180;

test('Bolid color controls normalize to their UI contracts', () => {
    assert.equal(normalizeBolidColorTrail(undefined), 0);
    assert.equal(normalizeBolidHueSpread(undefined), 90);
    assert.equal(normalizeBolidColorTrail(-10), 0);
    assert.equal(normalizeBolidColorTrail(130), 100);
    assert.equal(normalizeBolidHueSpread(-10), 0);
    assert.equal(normalizeBolidHueSpread(130), 90);
});

test('Color trail always renders with the maximum hue spread', () => {
    const focus = { x: 240, y: 240 };
    const chromatic = { ...settings, headColor: '#00ff00' };
    const legacyMinimum = buildBolidColorTrailLayers({
        ...chromatic,
        bolidHueSpread: 0
    }, focus);
    const maximum = buildBolidColorTrailLayers({
        ...chromatic,
        bolidHueSpread: 90
    }, focus);
    assert.deepEqual(
        legacyMinimum.map((layer) => layer.color),
        maximum.map((layer) => layer.color)
    );
});

test('achromatic heads use the fixed red and electric-blue aberration pair', () => {
    const white = resolveBolidTrailColors('#ffffff', 32);
    const black = resolveBolidTrailColors('#000000', 80);
    const gray = resolveBolidTrailColors('#777777', 12);
    assert.deepEqual(
        [white.minus, white.plus],
        ['#ff334d', '#2868ff']
    );
    assert.deepEqual(
        [black.minus, black.plus],
        [white.minus, white.plus]
    );
    assert.deepEqual(
        [gray.minus, gray.plus],
        [white.minus, white.plus]
    );
});

test('each aberration side changes lightness and chroma across three spectral bands', () => {
    const spectrum = resolveBolidTrailSpectrum('#ffffff', 32);
    ['minus', 'plus'].forEach((side) => {
        const inner = colorToOklch(spectrum[side].inner);
        const middle = colorToOklch(spectrum[side].middle);
        const outer = colorToOklch(spectrum[side].outer);
        assert.ok(inner.L > middle.L);
        assert.ok(middle.L > outer.L);
        assert.ok(inner.C < middle.C);
        assert.ok(inner.C < outer.C);
        assert.equal(new Set(Object.values(spectrum[side])).size, 3);
    });
});

test('eye aberration reuses all bands at a shorter scale and reacts to eye inertia', () => {
    const focus = { x: 240, y: 240 };
    const headLayers = buildBolidColorTrailLayers(settings, focus);
    const still = buildBolidEyeColorTrailLayers(settings, headLayers);
    const moving = buildBolidEyeColorTrailLayers(settings, headLayers, {
        x: 5,
        y: -2,
        scaleRatio: 0.96
    });
    assert.equal(still.length, 6);
    assert.deepEqual(still.map((layer) => layer.band), headLayers.map((layer) => layer.band));
    assert.ok(still.every((layer, index) => (
        Math.hypot(layer.offsetX, layer.offsetY)
        < Math.hypot(headLayers[index].offsetX, headLayers[index].offsetY)
    )));
    assert.ok(moving.some((layer, index) => layer.offsetX !== still[index].offsetX));
    assert.ok(moving.every((layer, index) => layer.opacity >= still[index].opacity));
    assert.equal(new Set(still.filter((layer) => layer.side < 0)
        .map((layer) => layer.color)).size, 3);
});

test('eye aberration disappears when eyes have no contrast with the head', () => {
    const focus = { x: 240, y: 240 };
    const matching = { ...settings, eyeColor: settings.headColor };
    const headLayers = buildBolidColorTrailLayers(matching, focus);
    assert.deepEqual(buildBolidEyeColorTrailLayers(matching, headLayers), []);
});

test('chromatic heads use neighbouring OKLCH hues on opposite sides', () => {
    const source = colorToOklch('#00ff00');
    const colors = resolveBolidTrailColors('#00ff00', 32);
    const minus = colorToOklch(colors.minus);
    const plus = colorToOklch(colors.plus);
    assert.equal(colors.chromaticMix, 1);
    assert.ok(angularDelta(source.h, minus.h) < -20);
    assert.ok(angularDelta(source.h, plus.h) > 20);
    assert.notEqual(colors.minus, '#ff334d');
    assert.notEqual(colors.plus, '#2868ff');
});

test('the achromatic and hue-neighbour modes blend continuously by source chroma', () => {
    const gray = resolveBolidTrailColors('#777777', 32);
    const tinted = resolveBolidTrailColors('#887777', 32);
    const saturated = resolveBolidTrailColors('#ff0000', 32);
    assert.equal(gray.chromaticMix, 0);
    assert.ok(tinted.chromaticMix > 0 && tinted.chromaticMix < 1);
    assert.equal(saturated.chromaticMix, 1);
});

test('Color trail creates six opposing, locally sampled and seamless layers', () => {
    const focus = { x: 240, y: 240 };
    const start = buildBolidColorTrailLayers(settings, focus, {
        timeMs: 0,
        durationMs: 5000
    });
    const loop = buildBolidColorTrailLayers(settings, focus, {
        timeMs: 5000,
        durationMs: 5000
    });
    assert.equal(start.length, 6);
    assert.deepEqual(loop, start);
    assert.ok(start.every((layer) => /^M .* Z$/.test(layer.path)));
    assert.deepEqual(start.map((layer) => layer.band), [
        'outer', 'outer', 'middle', 'middle', 'inner', 'inner'
    ]);
    assert.ok(start[0].offsetX * start[1].offsetX < 0);
    assert.notEqual(start[0].path, start[1].path);
    assert.equal(new Set(start.filter((layer) => layer.side < 0)
        .map((layer) => layer.color)).size, 3);
});

test('Color trail is independent but still multiplied by scene Intensity', () => {
    const focus = { x: 240, y: 240 };
    const disabled = buildBolidColorTrailLayers({
        ...settings,
        bolidColorTrail: 0
    }, focus);
    const noIntensity = buildBolidColorTrailLayers({
        ...settings,
        bolidIntensity: 0
    }, focus);
    const half = buildBolidColorTrailLayers({
        ...settings,
        bolidColorTrail: 50
    }, focus);
    const full = buildBolidColorTrailLayers(settings, focus);
    assert.deepEqual(disabled, []);
    assert.deepEqual(noIntensity, []);
    assert.ok(full[0].opacity > half[0].opacity);
    assert.ok(Math.hypot(full[0].offsetX, full[0].offsetY)
        > Math.hypot(half[0].offsetX, half[0].offsetY));
});
