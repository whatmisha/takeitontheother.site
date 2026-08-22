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

test('ray count keeps the same 144 degree fan from three through thirteen rays', () => {
    const three = createRayProfiles({ ...DEFAULT_GEOMETRY, rayCount: 3 });
    const thirteen = createRayProfiles({ ...DEFAULT_GEOMETRY, rayCount: 13 });
    assert.deepEqual(three.map((ray) => ray.angleDeg), [-162, -90, -18]);
    closeTo(thirteen[0].angleDeg, -162);
    closeTo(thirteen[1].angleDeg - thirteen[0].angleDeg, 12);
    closeTo(thirteen[12].angleDeg, -18);
});

test('every supported ray count produces one tip and one joining vertex per ray', () => {
    for (let rayCount = 3; rayCount <= 13; rayCount += 1) {
        const geometry = buildCharacterGeometry({ rayCount });
        assert.equal(geometry.rays.length, rayCount);
        assert.equal(geometry.vertices.length, rayCount * 2);
        assert.ok(geometry.vertices.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
    }
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

test('default outline is horizontally symmetric with relative fillets', () => {
    const geometry = buildCharacterGeometry();
    closeTo(geometry.baseClosure.x, DEFAULT_GEOMETRY.boundaryCenterX);
    closeTo(geometry.rays[0].tip.x + geometry.rays[4].tip.x, DEFAULT_GEOMETRY.boundaryCenterX * 2);
    closeTo(geometry.rays[1].tip.x + geometry.rays[3].tip.x, DEFAULT_GEOMETRY.boundaryCenterX * 2);
    assert.match(geometry.rounded.path, /^M /);
    assert.match(geometry.rounded.path, / A /);
    assert.match(geometry.rounded.path, / Z$/);
    closeTo(geometry.rounded.normalizedAmount, 0.6);
    geometry.rounded.corners.forEach((corner, index) => {
        closeTo(corner.radius, geometry.rounded.maximumRadii[index] * 0.6);
    });
    closeTo(geometry.rounded.corners[0].radius, geometry.rounded.corners[2].radius);
    closeTo(geometry.rounded.corners[4].radius, geometry.rounded.corners[8].radius);
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
        roundnessWeight: 1,
        tipRadius: 4,
        valleyRadius: 6
    });
    assert.equal(profiles[4].angleDeg, -13);
    assert.equal(profiles[4].length, 210);
});

test('maximum relative rounding leaves a safe gap before neighbouring arcs touch', () => {
    const geometry = buildCharacterGeometry({ roundness: 100 });
    geometry.rounded.corners.forEach((corner, index) => {
        closeTo(corner.radius, geometry.rounded.requestedRadii[index]);
        const next = geometry.rounded.corners[(index + 1) % geometry.rounded.corners.length];
        const remainingEdge = corner.nextLength - corner.idealDistance - next.idealDistance;
        assert.ok(remainingEdge > 0, `corner arcs overlap on edge ${index}`);
    });
});

test('Corner smoothing follows the Figma scale and backs off when an edge has no room', () => {
    const circular = buildCharacterGeometry({ cornerSmoothing: 0 });
    const ios = buildCharacterGeometry({ cornerSmoothing: 60 });
    const maximum = buildCharacterGeometry({ cornerSmoothing: 100 });
    closeTo(circular.rounded.effectiveSmoothing, 0);
    closeTo(ios.rounded.requestedSmoothing, 0.6);
    closeTo(ios.rounded.effectiveSmoothing, 0.6);
    closeTo(maximum.rounded.requestedSmoothing, 1);
    assert.ok(maximum.rounded.effectiveSmoothing > 0.6);
    assert.ok(maximum.rounded.effectiveSmoothing < 1);
    assert.doesNotMatch(circular.rounded.path, / C /);
    assert.match(ios.rounded.path, / C /);
    assert.ok(ios.rounded.contour.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
});

test('each joining radius equals the smaller neighbouring tip radius', () => {
    const geometry = buildCharacterGeometry({ focusX: 120, roundness: 100 });
    const tips = new Map();
    geometry.vertexMeta.forEach((meta, index) => {
        if (meta.kind === 'tip') tips.set(meta.rayIndex, geometry.rounded.corners[index].radius);
    });
    geometry.vertexMeta.forEach((meta, index) => {
        const radius = geometry.rounded.corners[index].radius;
        if (meta.kind === 'valley') {
            closeTo(radius, Math.min(tips.get(meta.afterRayIndex), tips.get(meta.afterRayIndex + 1)));
        } else if (meta.kind === 'base') {
            closeTo(radius, Math.min(tips.get(0), tips.get(geometry.rays.length - 1)));
        }
    });
    assert.ok(tips.get(4) > tips.get(0), 'the nearer right ray should have the larger tip fillet');
});

test('legacy pixel cornerRadius migrates to the relative scale', () => {
    const migrated = buildCharacterGeometry({ cornerRadius: 10 });
    const current = buildCharacterGeometry({ roundness: 60 });
    closeTo(migrated.values.roundness, 60);
    migrated.rounded.corners.forEach((corner, index) => {
        closeTo(corner.radius, current.rounded.corners[index].radius);
    });
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
