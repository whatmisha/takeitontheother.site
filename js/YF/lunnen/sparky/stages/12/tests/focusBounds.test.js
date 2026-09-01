import assert from 'node:assert/strict';
import test from 'node:test';

import {
    EXTENDED_FOCUS_INSET,
    FOCUS_BOUNDARY_REFERENCE,
    constrainFocusPoint,
    createExtendedFocusRegion,
    focusPointFromPolar,
    focusPointToPolar,
    getFocusSliderBounds
} from '../src/geometry/focusBounds.js';
import { distance } from '../src/geometry/vector.js';
import { rebaseLegacyY } from '../src/geometry/coordinateSpace.js';

const closeTo = (actual, expected, tolerance = 1e-9) => {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

const defaultBoundary = {
    boundaryType: 'circle',
    boundaryCenterX: 240,
    boundaryCenterY: rebaseLegacyY(334),
    boundaryRadius: 240
};

test('Extended inset equals the reference point distance to the guide circumference', () => {
    const centerDistance = Math.hypot(120, 154);
    closeTo(centerDistance, 195.23319389898842);
    closeTo(EXTENDED_FOCUS_INSET, 240 - centerDistance);
    closeTo(EXTENDED_FOCUS_INSET, 44.76680610101158);
});

test('Focus uses a concentric circle through both reference positions', () => {
    const state = { ...defaultBoundary };
    const region = createExtendedFocusRegion(state);

    closeTo(region.radius, 195.23319389898842);
    closeTo(distance(FOCUS_BOUNDARY_REFERENCE.focus, region.center), region.radius);
    closeTo(distance({ x: 360, y: rebaseLegacyY(180) }, region.center), region.radius);
    closeTo(region.minX, 44.76680610101158);
    closeTo(region.maxX, 435.2331938989884);
    closeTo(region.minY, 44.76680610101158);
    closeTo(region.maxY, 435.2331938989885);
});

test('Focus leaves inside positions intact and projects outside positions to the circle', () => {
    const state = { ...defaultBoundary };
    const region = createExtendedFocusRegion(state);
    const inside = { x: 280, y: 300 };
    assert.deepEqual(constrainFocusPoint(inside, state), inside);

    const constrained = constrainFocusPoint({ x: 600, y: 20 }, state);
    closeTo(distance(constrained, region.center), region.radius);
});

test('polar Focus starts at twelve o’clock and increases clockwise', () => {
    const region = createExtendedFocusRegion(defaultBoundary);
    const top = focusPointFromPolar({ angle: 0, distance: 80 }, defaultBoundary);
    closeTo(top.x, region.center.x);
    closeTo(top.y, region.center.y - region.radius * 0.8);

    const right = focusPointFromPolar({ angle: 90, distance: 80 }, defaultBoundary);
    closeTo(right.x, region.center.x + region.radius * 0.8);
    closeTo(right.y, region.center.y);

    const polar = focusPointToPolar(right, defaultBoundary);
    closeTo(polar.angle, 90);
    closeTo(polar.distance, 80);
});

test('100 percent reaches the circular Focus boundary in every direction', () => {
    const region = createExtendedFocusRegion(defaultBoundary);
    [0, 45, 90, 180, 270, 360].forEach((angle) => {
        const focus = focusPointFromPolar({ angle, distance: 100 }, defaultBoundary);
        closeTo(distance(focus, region.center), region.radius);
    });
});

test('the center preserves a chosen angle while its distance stays zero', () => {
    const center = focusPointFromPolar({ angle: 225, distance: 0 }, defaultBoundary);
    const polar = focusPointToPolar(center, defaultBoundary, 225);
    closeTo(polar.angle, 225);
    closeTo(polar.distance, 0);
});

test('legacy Extended flags cannot disable the circular Focus region', () => {
    const region = getFocusSliderBounds({ ...defaultBoundary, extendedFocus: false });
    const constrained = constrainFocusPoint(
        { x: 20, y: 600 },
        { ...defaultBoundary, extendedFocus: false }
    );
    closeTo(distance(constrained, region.center), region.radius);
});

test('changing the guide radius preserves the same safety inset', () => {
    const region = createExtendedFocusRegion({
        ...defaultBoundary,
        boundaryRadius: 300
    });
    closeTo(region.radius, 300 - EXTENDED_FOCUS_INSET);
});
