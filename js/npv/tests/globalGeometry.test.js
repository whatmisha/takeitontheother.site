import test from 'node:test';
import assert from 'node:assert/strict';

import {
    SPHERE_AXES,
    animatedEllipseCount,
    buildGlobalScene,
    constrainSettings,
    defaultSettings,
    worldRotationForScreenSettings
} from '../src/geometry/globalGeometry.js';
import { SEEDED_PRESETS } from '../src/core/presets.js';
import { rotationPreviewOffsets } from '../src/GlobalApp.js';

test('the default projection starts with fifteen equally sized physical marks', () => {
    const scene = buildGlobalScene(defaultSettings());
    assert.equal(new Set(scene.elements.map((element) => element.pairIndex)).size, 15);
    const center = scene.elements.find((element) => element.group === 'center');
    assert.ok(center);
    assert.ok(Math.abs(center.cx - 240) < 1e-6);
    assert.ok(Math.abs(center.cy - 240) < 1e-6);
    scene.elements.forEach((element) => {
        assert.ok(Math.abs(element.angularRadius - scene.elements[0].angularRadius) < 1e-9);
    });
});

test('every density slot represents two unique antipodal ellipses', () => {
    assert.equal(SPHERE_AXES.length, 48);
    SPHERE_AXES.forEach((axis) => {
        assert.ok(Math.abs(Math.hypot(axis.x, axis.y, axis.z) - 1) < 1e-9);
    });
    for (let a = 0; a < SPHERE_AXES.length; a += 1) {
        for (let b = a + 1; b < SPHERE_AXES.length; b += 1) {
            const dot = Math.abs(
                SPHERE_AXES[a].x * SPHERE_AXES[b].x
                + SPHERE_AXES[a].y * SPHERE_AXES[b].y
                + SPHERE_AXES[a].z * SPHERE_AXES[b].z
            );
            assert.ok(dot < 0.99999, `axes ${a} and ${b} must not duplicate one another`);
        }
    }
});

test('the regular 18-point core gives every mark the same nearest-neighbor distance', () => {
    const points = SPHERE_AXES.slice(0, 9).flatMap((axis) => [
        axis,
        { x: -axis.x, y: -axis.y, z: -axis.z }
    ]);
    const nearest = points.map((point, index) => Math.min(...points.map((other, otherIndex) => {
        if (index === otherIndex) return Infinity;
        const dot = point.x * other.x + point.y * other.y + point.z * other.z;
        return Math.acos(Math.max(-1, Math.min(1, dot)));
    })));
    nearest.forEach((distance) => assert.ok(Math.abs(distance - nearest[0]) < 1e-9));
});

test('tessellated distribution equalizes nearest-neighbor spacing at the default density', () => {
    const scene = buildGlobalScene({ ...defaultSettings(), topologyMode: 'tessellated', preventOverlap: false });
    const points = scene.axes.flatMap((axis) => [axis, { x: -axis.x, y: -axis.y, z: -axis.z }]);
    const nearest = points.map((point, index) => Math.min(...points.map((other, otherIndex) => {
        if (index === otherIndex) return Infinity;
        const cosine = point.x * other.x + point.y * other.y + point.z * other.z;
        return Math.acos(Math.max(-1, Math.min(1, cosine)));
    })));
    const mean = nearest.reduce((sum, value) => sum + value, 0) / nearest.length;
    const deviation = Math.sqrt(nearest.reduce((sum, value) => sum + (value - mean) ** 2, 0) / nearest.length);
    assert.ok(deviation / mean < 0.025);
});

test('Packed is primary and gives the default spherical neighbors one exact gap', () => {
    const scene = buildGlobalScene({ ...defaultSettings(), showBackside: true });
    assert.equal(scene.settings.topologyMode, 'packed');
    assert.equal(scene.axes.length, 15);
    const points = scene.axes.flatMap((axis) => [axis, { x: -axis.x, y: -axis.y, z: -axis.z }]);
    const radii = points.map((_, index) => {
        const id = `${Math.floor(index / 2)}:${index % 2 ? 'b' : 'a'}`;
        return scene.elements.find((element) => element.id === id).angularRadius;
    });
    points.forEach((point, index) => {
        const distances = points.map((other, otherIndex) => otherIndex === index
            ? Infinity
            : Math.acos(Math.max(-1, Math.min(1,
                point.x * other.x + point.y * other.y + point.z * other.z
            ))));
        const nearest = Math.min(...distances);
        const neighborIndex = distances.indexOf(nearest);
        const gap = (nearest - radii[index] - radii[neighborIndex]) * scene.settings.sphereRadius;
        assert.ok(Math.abs(gap - scene.settings.overlapGap) < 1e-8);
    });
});

test('Packed coverage changes every local mark radius without a hidden ceiling', () => {
    const half = buildGlobalScene({ ...defaultSettings(), packingCoverage: 50, showBackside: true });
    const full = buildGlobalScene({ ...defaultSettings(), packingCoverage: 100, showBackside: true });
    full.elements.forEach((element) => {
        const smaller = half.elements.find((candidate) => candidate.id === element.id);
        assert.ok(smaller);
        assert.ok(Math.abs(element.angularRadius - smaller.angularRadius * 2) < 1e-9);
    });
});

test('the Iconic Five Y preview makes one closed 360-degree turn', () => {
    const preset = SEEDED_PRESETS['Iconic Five'];
    const { axis, degrees, easing } = preset.rotationAnimation;
    const start = buildGlobalScene(preset, rotationPreviewOffsets(0, axis, degrees, easing));
    const finish = buildGlobalScene(preset, rotationPreviewOffsets(1, axis, degrees, easing));
    const finishedById = new Map(finish.elements.map((element) => [element.id, element]));
    start.elements.forEach((element) => {
        const closed = finishedById.get(element.id);
        assert.ok(closed);
        assert.ok(Math.abs(closed.cx - element.cx) < 1e-9);
        assert.ok(Math.abs(closed.cy - element.cy) < 1e-9);
        assert.ok(Math.abs(closed.rx - element.rx) < 1e-9);
        assert.ok(Math.abs(closed.ry - element.ry) < 1e-9);
    });
});

test('the Person Five preview is exactly one half-turn on Y', () => {
    const { axis, degrees, easing } = SEEDED_PRESETS['Person Five'].rotationAnimation;
    assert.deepEqual(rotationPreviewOffsets(1, axis, degrees, easing), {
        rotationX: 0,
        rotationY: 180,
        rotationZ: 0
    });
});

test('Transform X is horizontal, Y is vertical, and legacy JSON keeps its view', () => {
    assert.deepEqual(worldRotationForScreenSettings({ rotationX: 30, rotationY: 0, rotationZ: 5 }), {
        x: 0,
        y: 30,
        z: 5
    });
    assert.deepEqual(worldRotationForScreenSettings({ rotationX: 0, rotationY: 30, rotationZ: 5 }), {
        x: 30,
        y: 0,
        z: 5
    });
    const migrated = constrainSettings({ rotationX: 30, rotationY: 10 });
    assert.equal(migrated.rotationX, 10);
    assert.equal(migrated.rotationY, 30);
    assert.equal(migrated.rotationCoordinateMode, 'screen');
});

test('progressive and rings remain distinct optional distributions', () => {
    const progressive = buildGlobalScene({ ...defaultSettings(), topologyMode: 'progressive' });
    const rings = buildGlobalScene({ ...defaultSettings(), topologyMode: 'rings' });
    assert.notDeepEqual(progressive.axes, rings.axes);
    assert.equal(progressive.axes.length, 15);
    assert.equal(rings.axes.length, 15);
});

test('rotation reveals backside ellipses without changing the active density', () => {
    const settings = { ...defaultSettings(), rotationX: 23, rotationY: 41 };
    const scene = buildGlobalScene(settings);
    assert.equal(new Set(scene.elements.map((element) => element.pairIndex)).size, 15);
    assert.ok(scene.elements.some((element) => element.side === -1));
});

test('marks wrap across the horizon without intermediate front-side opacity', () => {
    const scene = buildGlobalScene({ ...defaultSettings(), topologyMode: 'tessellated' });
    const wrapped = scene.elements.find((element) => element.frontPath && element.depth < 0);
    assert.ok(wrapped, 'a spherical cap may remain visible after its center passes the horizon');
    const backScene = buildGlobalScene({ ...defaultSettings(), showBackside: true });
    assert.equal(backScene.elements.length, 30);
    assert.equal(backScene.backsideOpacity, 0.2);
    assert.ok(backScene.elements.some((element) => element.backPath));
});

test('maximum perspective is extreme but keeps the complete sphere inside the artboard', () => {
    const flat = buildGlobalScene(defaultSettings());
    const extreme = buildGlobalScene({ ...defaultSettings(), perspective: 100, showBackside: true });
    const flatCenter = flat.elements.find((element) => element.id === '0:a');
    const extremeCenter = extreme.elements.find((element) => element.id === '0:a');
    assert.ok(extremeCenter.rx > flatCenter.rx * 2);
    const points = extreme.elements.flatMap((element) => [...element.frontPoints, ...element.backPoints]);
    points.forEach((point) => {
        assert.ok(point.x >= 15.9 && point.x <= 464.1);
        assert.ok(point.y >= 15.9 && point.y <= 464.1);
    });
});

test('guides provide projected front and back sphere wireframes', () => {
    const scene = buildGlobalScene({ ...defaultSettings(), showGuides: true, rotationX: 17, perspective: 35 });
    assert.match(scene.wireframe.frontPath, /^M/);
    assert.match(scene.wireframe.backPath, /^M/);
    const segments = (scene.wireframe.frontPath.match(/M/g) || []).length
        + (scene.wireframe.backPath.match(/M/g) || []).length;
    assert.equal(segments, 1224);
});

test('an oblique mark is a spherical patch rather than a plane tangent at its anchor', () => {
    const scene = buildGlobalScene({ ...defaultSettings(), topologyMode: 'tessellated' });
    const oblique = scene.elements.find((element) => element.pairIndex === 2 && element.side === 1);
    assert.ok(oblique.frontPoints.length > 20);
    assert.ok(Math.hypot(oblique.cx - oblique.anchorX, oblique.cy - oblique.anchorY) > 5);
});

test('fractional density grows the next ellipse continuously from zero', () => {
    const settings = { ...defaultSettings(), ellipseCount: 9.5 };
    const scene = buildGlobalScene(settings);
    const newest = scene.elements.find((element) => element.pairIndex === 9);
    assert.ok(newest);
    assert.ok(newest.activation > 0 && newest.activation < 1);
});

test('grow mode forms a seamless add-and-remove loop', () => {
    const settings = { ...defaultSettings(), animationMode: 'grow', animationFrom: 2, ellipseCount: 14, duration: 4 };
    assert.equal(animatedEllipseCount(settings, 0), 2);
    assert.equal(animatedEllipseCount(settings, 2), 14);
    assert.ok(Math.abs(animatedEllipseCount(settings, 4) - 2) < 1e-9);
});

test('relative and fixed overrides retain distinct contracts', () => {
    const defaults = { ...defaultSettings(), preventOverlap: false };
    const base = buildGlobalScene(defaults).elements.find((element) => element.id === '0:a');
    const relative = buildGlobalScene({
        ...defaults,
        overrides: { '0:a': { mode: 'relative', value: 200 } }
    }).elements.find((element) => element.id === '0:a');
    const fixed = buildGlobalScene({
        ...defaults,
        overrides: { '0:a': { mode: 'fixed', value: 80 } }
    }).elements.find((element) => element.id === '0:a');
    assert.ok(Math.abs(relative.angularRadius - base.angularRadius * 2) < 1e-9);
    assert.ok(Math.abs(fixed.angularRadius - Math.asin(40 / defaults.sphereRadius)) < 1e-9);
});

test('no-overlap uses one rotation-invariant physical size for the complete pattern', () => {
    const settings = {
        ...defaultSettings(),
        ellipseCount: 20,
        diameter: 150,
        topologyMode: 'tessellated',
        preventOverlap: true,
        overlapGap: 3
    };
    const first = buildGlobalScene(settings);
    const rotated = buildGlobalScene({ ...settings, rotationX: 47, rotationY: -83 });
    const firstRadii = new Set(first.elements.map((element) => element.angularRadius.toFixed(9)));
    const rotatedRadii = new Set(rotated.elements.map((element) => element.angularRadius.toFixed(9)));
    assert.equal(firstRadii.size, 1);
    assert.deepEqual(rotatedRadii, firstRadii);
});

test('non-packed Diameter is constrained to its visible effective maximum', () => {
    const requested = {
        ...defaultSettings(),
        topologyMode: 'tessellated',
        diameter: 480,
        preventOverlap: true,
        overlapGap: 4
    };
    const constrained = constrainSettings(requested);
    assert.ok(constrained.diameter < requested.diameter);
    const scene = buildGlobalScene(requested);
    assert.equal(scene.settings.diameter, constrained.diameter);
    const expectedRadius = Math.asin(constrained.diameter * 0.5 / constrained.sphereRadius);
    scene.elements.forEach((element) => {
        assert.ok(Math.abs(element.angularRadius - expectedRadius) < 1e-9);
    });

    const widerGap = constrainSettings({ ...requested, overlapGap: 40 });
    assert.equal(widerGap.overlapGap, 40);
    assert.ok(widerGap.diameter < constrained.diameter);
});

test('magnet growth remains effective after the base no-overlap packing is full', () => {
    const saturated = {
        ...defaultSettings(),
        topologyMode: 'tessellated',
        diameter: 480,
        preventOverlap: true,
        magnetX: 240,
        magnetY: 240
    };
    const base = buildGlobalScene(saturated).elements.find((element) => element.id === '0:a');
    const grown = buildGlobalScene({ ...saturated, magnetStrength: 100 })
        .elements.find((element) => element.id === '0:a');
    assert.ok(grown.angularRadius > base.angularRadius);
});

test('magnet enlarges nearby surface marks without pulling their anchors', () => {
    const base = buildGlobalScene(defaultSettings()).elements.find((element) => element.id === '0:a');
    const magnetized = buildGlobalScene({
        ...defaultSettings(),
        magnetStrength: 100,
        magnetRadius: 42,
        magnetX: 240,
        magnetY: 240
    }).elements.find((element) => element.id === '0:a');
    assert.ok(magnetized.angularRadius > base.angularRadius);
    assert.ok(Math.abs(magnetized.anchorX - base.anchorX) < 1e-9);
    assert.ok(Math.abs(magnetized.anchorY - base.anchorY) < 1e-9);
});

test('magnet strength falls gradually across the field and includes partial mark overlap', () => {
    const settings = {
        ...SEEDED_PRESETS['Iconic Five'],
        magnetStrength: 100,
        magnetRadius: 8,
        magnetFollow: false,
        magnetX: 240
    };
    const influenceAt = (magnetY) => buildGlobalScene({ ...settings, magnetY })
        .elements.find((element) => element.id === '0:a')?.magnetInfluence || 0;
    const center = influenceAt(240);
    const middle = influenceAt(340);
    const partial = influenceAt(380);
    const outside = influenceAt(400);
    assert.ok(center > middle && middle > partial && partial > outside);
    assert.ok(center > 0.99);
    assert.equal(outside, 0);
});

test('the supplied small-field rotation changes magnet growth without frame spikes', () => {
    const settings = {
        ...SEEDED_PRESETS['Iconic Five'],
        rotationX: 22,
        magnetStrength: 107,
        magnetRadius: 8,
        magnetX: 240,
        magnetY: 480,
        magnetFollow: false
    };
    let previous = new Map();
    let maximumStep = 0;
    for (let frame = 0; frame <= 240; frame += 1) {
        const scene = buildGlobalScene(settings, rotationPreviewOffsets(frame / 240));
        const current = new Map(scene.elements.map((element) => [element.id, element.magnetInfluence]));
        current.forEach((influence, id) => {
            if (previous.has(id)) maximumStep = Math.max(maximumStep, Math.abs(influence - previous.get(id)));
        });
        previous = current;
    }
    assert.ok(maximumStep < 0.18, `maximum frame step was ${maximumStep}`);
});
