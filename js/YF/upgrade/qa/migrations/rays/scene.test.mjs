import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildRaysScene, DEFAULT_PARAMETERS, ALLOWED_RAY_COUNTS, nearestAllowedRayCount } from '../../../tools/rays_pattern_generator/engine/scene.js';
import { createLegacy, svgLines, roundedGeometry } from './harness.mjs';

const fixtures = JSON.parse(await readFile(new URL('./geometry-fixtures.json', import.meta.url), 'utf8'));
const flatten = scene => scene.items.flatMap(item => item.kind === 'module'
    ? item.lines.map(line => ({ ...line, points: line.points.map((value, index) => value + (index % 2 ? item.y : item.x)) }))
    : [item]);
const saved = legacy => JSON.parse(legacy.storage.get('rayPatternSettings') || '{}');
const geometry = scene => roundedGeometry(flatten(scene));

for (const fixture of fixtures.cases) {
    test(`new scene matches frozen golden: ${fixture.id}`, () => {
        const legacy = createLegacy();
        for (const [id, value] of fixture.changes) legacy.change(id, value);
        const scene = buildRaysScene(saved(legacy));
        const lines = geometry(scene);
        assert.equal(createHash('sha256').update(JSON.stringify(lines)).digest('hex'), fixture.expected.geometrySha256);
        assert.deepEqual(lines, roundedGeometry(svgLines(legacy.export().svg)));
        assert.deepEqual(lines, roundedGeometry(legacy.context.lines));
        assert.equal(scene.items.filter(item => item.kind === 'module').length, fixture.expected.modules);
        assert.equal(scene.items.filter(item => item.kind === 'divider').length, fixture.expected.dividers);
    });
}

test('all allowed counts, row polarity, caps and divider visibility match legacy', () => {
    for (const count of ALLOWED_RAY_COUNTS) for (const classic of [false, true]) for (const dividers of [false, true]) {
        const legacy = createLegacy();
        legacy.change('rayCountSlider', count);
        legacy.change('offsetRowsCheckbox', classic);
        legacy.change('roundCapCheckbox', true);
        legacy.change('hideConnectingLinesCheckbox', dividers);
        assert.deepEqual(geometry(buildRaysScene(saved(legacy))), roundedGeometry(svgLines(legacy.export().svg)));
    }
});

test('decoded RGB tone, alpha, contrast and inversion retain legacy sampling and gradient precedence', () => {
    const imageData = { width: 3, height: 2, data: Uint8ClampedArray.from([
        0,0,0,255, 128,128,128,255, 255,255,255,255,
        255,0,0,255, 0,255,0,0, 0,0,255,255
    ]) };
    for (const contrast of [0.1, 1, 3]) for (const invert of [false, true]) {
        const legacy = createLegacy();
        legacy.change('imageRasterModeCheckbox', true);
        legacy.upload(imageData);
        legacy.change('brightnessContrastSlider', contrast);
        legacy.change('imageInvertCheckbox', invert);
        legacy.change('zeroRayLengthSlider', 70);
        legacy.change('hundredLineWidthSlider', 4);
        assert.deepEqual(geometry(buildRaysScene(saved(legacy), { imageData })), roundedGeometry(svgLines(legacy.export().svg)));
        legacy.change('rasterModeCheckbox', true);
        assert.deepEqual(geometry(buildRaysScene(saved(legacy), { imageData })), roundedGeometry(svgLines(legacy.export().svg)));
    }
    assert.deepEqual(geometry(buildRaysScene({imageRasterMode:true})), geometry(buildRaysScene()));
});

test('count snapping and default parameters remain legacy-compatible', () => {
    for (let value = 3; value <= 24; value++) {
        const legacy = createLegacy(); legacy.change('rayCountSlider', value);
        assert.equal(nearestAllowedRayCount(value), +legacy.nodes.get('rayCountSlider').value);
    }
    assert.equal(nearestAllowedRayCount(7), 6);
    assert.equal(DEFAULT_PARAMETERS.rayLength, 56);
    assert.equal(DEFAULT_PARAMETERS.offsetRows, false);
});

test('scene is deterministic and does not mutate or retain the input parameter objects', () => {
    const parameters = Object.freeze({ ...DEFAULT_PARAMETERS });
    const first = buildRaysScene(parameters);
    assert.deepEqual(first, buildRaysScene(parameters));
    first.items[0].lines[0].points[0] = 999;
    assert.notDeepEqual(first, buildRaysScene(parameters));
    assert.deepEqual(parameters.vanishingPoint, {x:75,y:75});
    assert.throws(() => buildRaysScene({scale:0}), RangeError);
    assert.throws(() => buildRaysScene({rayCount:Infinity}), RangeError);
    assert.throws(() => buildRaysScene({scale:Number.MIN_VALUE}), RangeError);
});
