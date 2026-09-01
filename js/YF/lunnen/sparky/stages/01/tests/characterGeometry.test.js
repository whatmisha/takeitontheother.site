import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createEllipseBoundary } from '../src/geometry/boundaries.js';
import {
    DEFAULT_GEOMETRY,
    buildCharacterGeometry,
    createRayProfiles
} from '../src/geometry/characterGeometry.js';
import { directionFromDegrees, distance, point } from '../src/geometry/vector.js';

const closeTo = (actual, expected, tolerance = 1e-6) => {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

test('default profile preserves five rays with an exact 36 degree step', () => {
    const profiles = createRayProfiles(DEFAULT_GEOMETRY);
    assert.deepEqual(profiles.map((ray) => ray.angleDeg), [-162, -126, -90, -54, -18]);
    assert.ok(profiles.every((ray) => ray.length === 240 && ray.width === 80));
});

test('default tips lie on the mathematical guide circle', () => {
    const geometry = buildCharacterGeometry();
    assert.equal(geometry.rays.length, 5);
    assert.equal(geometry.vertices.length, 10);
    geometry.rays.forEach((ray) => {
        closeTo(distance(ray.tip, geometry.boundary.center), geometry.boundary.radius);
        closeTo(distance(ray.basePlus, ray.baseMinus), 80);
        closeTo(distance(ray.tip, ray.baseCenter), 240);
    });
});

test('default outline is horizontally symmetric and rounded with ten-pixel fillets', () => {
    const geometry = buildCharacterGeometry();
    closeTo(geometry.baseClosure.x, DEFAULT_GEOMETRY.boundaryCenterX);
    closeTo(geometry.rays[0].tip.x + geometry.rays[4].tip.x, DEFAULT_GEOMETRY.boundaryCenterX * 2);
    closeTo(geometry.rays[1].tip.x + geometry.rays[3].tip.x, DEFAULT_GEOMETRY.boundaryCenterX * 2);
    assert.match(geometry.rounded.path, /^M /);
    assert.match(geometry.rounded.path, / A /);
    assert.match(geometry.rounded.path, / Z$/);
    geometry.rounded.corners.forEach((corner) => closeTo(corner.radius, 10));
});

test('per-ray overrides support non-linear future distributions', () => {
    const profiles = createRayProfiles({
        ...DEFAULT_GEOMETRY,
        rayOverrides: [
            { angleOffset: -3, length: 260, width: 64, tipRadius: 4, valleyRadius: 6 },
            {}, {}, {},
            { angleOffset: 5, length: 210, width: 120, tipRadius: 18, valleyRadius: 2 }
        ]
    });
    assert.deepEqual(profiles[0], {
        index: 0,
        angleDeg: -165,
        length: 260,
        width: 64,
        tipRadius: 4,
        valleyRadius: 6
    });
    assert.equal(profiles[4].angleDeg, -13);
    assert.equal(profiles[4].length, 210);
});

test('ellipse boundary already satisfies the same ray-intersection contract', () => {
    const boundary = createEllipseBoundary({ cx: 0, cy: 0, radiusX: 200, radiusY: 100 });
    const top = boundary.intersectRay(point(0, 0), directionFromDegrees(-90));
    const right = boundary.intersectRay(point(0, 0), directionFromDegrees(0));
    closeTo(top.x, 0);
    closeTo(top.y, -100);
    closeTo(right.x, 200);
    closeTo(right.y, 0);
});

test('every shipped preset produces a finite closed contour', () => {
    const manifest = JSON.parse(readFileSync(new URL('../presets/manifest.json', import.meta.url), 'utf8'));
    manifest.presets.forEach(({ file }) => {
        const preset = JSON.parse(readFileSync(new URL(`../presets/${file}`, import.meta.url), 'utf8'));
        const geometry = buildCharacterGeometry(preset);
        assert.equal(geometry.vertices.length, preset.rayCount * 2);
        assert.ok(geometry.vertices.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
        assert.match(geometry.rounded.path, /^M .* Z$/);
    });
});
