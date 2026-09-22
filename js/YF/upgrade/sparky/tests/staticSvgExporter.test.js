import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCharacterGeometry } from '../src/geometry/characterGeometry.js';
import { buildEyeGeometry } from '../src/geometry/eyeGeometry.js';
import {
    buildVisibleEyeContours,
    createStaticSparkySvg
} from '../src/export/staticSvgExporter.js';

const settings = {
    width: 480,
    height: 480,
    focusX: 240,
    focusY: 240,
    rayCount: 5,
    rayLength: 240,
    rayWidth: 80,
    roundness: 60,
    cornerSmoothing: 100,
    eyePerspective: 100,
    eyeSize: 50,
    eyeDistance: 0,
    cute: 50,
    angry: 0,
    headColor: '#ffffff',
    eyeColor: '#000000',
    backgroundColor: '#000000'
};

function scene(overrides = {}) {
    const values = { ...settings, ...overrides };
    const characterGeometry = buildCharacterGeometry(values);
    const eyeGeometry = buildEyeGeometry(values, characterGeometry);
    return { settings: values, characterGeometry, eyeGeometry };
}

const count = (source, pattern) => source.match(pattern)?.length || 0;

test('matching eye and background colors export exactly two vector objects', () => {
    const svg = createStaticSparkySvg(scene({
        eyeColor: '#ABCDEF',
        backgroundColor: '#abcdef'
    }));

    assert.equal(count(svg, /<rect\b/g), 1);
    assert.equal(count(svg, /<path\b/g), 1);
    assert.equal(count(svg, /<(?:g|defs|mask|clipPath)\b/g), 0);
    assert.equal(count(svg, /\bM\s/g) >= 3, true);
    assert.match(svg, /<rect id="back"/);
    assert.match(svg, /<path id="head"/);
    assert.doesNotMatch(svg, /id="eyes"/);
    assert.match(svg, /fill-rule="evenodd"/);
});

test('different eye color exports background, punched head and one compound eye object', () => {
    const svg = createStaticSparkySvg(scene({
        eyeColor: '#ff3300',
        backgroundColor: '#000000'
    }));
    const paths = [...svg.matchAll(/<path\b[^>]*d="([^"]+)"[^>]*>/g)];

    assert.equal(count(svg, /<rect\b/g), 1);
    assert.equal(paths.length, 2);
    assert.equal(count(svg, /<(?:g|defs|mask|clipPath)\b/g), 0);
    assert.ok(count(paths[0][1], /\bM\s/g) >= 3);
    assert.ok(count(paths[1][1], /\bM\s/g) >= 2);
    assert.match(svg, /<rect id="back"/);
    assert.match(paths[0][0], /id="head"/);
    assert.match(paths[1][0], /id="eyes"/);
    assert.match(paths[1][0], /fill="#ff3300"/);
});

test('visible eye booleans remain finite across focus and emotion extremes', () => {
    const variants = [
        { focusX: 120, focusY: 142.1, cute: 0, angry: 0 },
        { focusX: 360, focusY: 142.1, cute: 100, angry: 0 },
        { focusX: 120, focusY: 352.1, cute: 0, angry: 100 },
        { focusX: 360, focusY: 352.1, cute: 100, angry: 100 }
    ];

    variants.forEach((overrides) => {
        const { eyeGeometry } = scene(overrides);
        ['left', 'right'].forEach((side) => {
            const contours = buildVisibleEyeContours(eyeGeometry[side]);
            assert.ok(contours.length >= 1);
            contours.forEach((points) => {
                assert.ok(points.length >= 3);
                points.forEach((point) => {
                    assert.ok(Number.isFinite(point.x));
                    assert.ok(Number.isFinite(point.y));
                });
            });
        });
    });
});
