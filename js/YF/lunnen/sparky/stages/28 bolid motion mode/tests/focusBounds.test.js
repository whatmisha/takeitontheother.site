import assert from 'node:assert/strict';
import test from 'node:test';

import {
    EXTENDED_FOCUS_INSET,
    FOCUS_BOUNDARY_REFERENCE,
    constrainFocusControlPoint,
    constrainFocusPoint,
    createExtendedFocusRegion,
    createMotionPathRegion,
    focusPointFromPolar,
    focusPointToPolar,
    getFocusSliderBounds,
    mapFocusPointToGeometry
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

test('motion paths use the complete guide circle without the Focus inset', () => {
    const region = createMotionPathRegion(defaultBoundary);
    closeTo(region.radius, defaultBoundary.boundaryRadius);
    closeTo(region.minX, 0);
    closeTo(region.maxX, 480);
    closeTo(region.minY, 0);
    closeTo(region.maxY, 480);
});

test('authored Focus uses the whole Sphere while rendered Focus stays constructible', () => {
    const state = { ...defaultBoundary };
    const controlRegion = createMotionPathRegion(state);
    const geometryRegion = createExtendedFocusRegion(state);
    const halfway = { x: 360, y: 240 };
    const mapped = mapFocusPointToGeometry(halfway, state);
    closeTo(distance(mapped, geometryRegion.center), geometryRegion.radius * 0.5);

    const edge = constrainFocusControlPoint({ x: 600, y: 240 }, state);
    closeTo(distance(edge, controlRegion.center), controlRegion.radius);
    const effectiveEdge = constrainFocusPoint(edge, state);
    closeTo(distance(effectiveEdge, geometryRegion.center), geometryRegion.radius);
});

test('polar Focus starts at twelve o’clock and increases clockwise', () => {
    const region = createMotionPathRegion(defaultBoundary);
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

test('100 percent reaches the Sphere and maps to the geometric Focus boundary', () => {
    const controlRegion = createMotionPathRegion(defaultBoundary);
    const geometryRegion = createExtendedFocusRegion(defaultBoundary);
    [0, 45, 90, 180, 270, 360].forEach((angle) => {
        const focus = focusPointFromPolar({ angle, distance: 100 }, defaultBoundary);
        closeTo(distance(focus, controlRegion.center), controlRegion.radius);
        closeTo(
            distance(mapFocusPointToGeometry(focus, defaultBoundary), geometryRegion.center),
            geometryRegion.radius
        );
    });
});

test('the center preserves a chosen angle while its distance stays zero', () => {
    const center = focusPointFromPolar({ angle: 225, distance: 0 }, defaultBoundary);
    const polar = focusPointToPolar(center, defaultBoundary, 225);
    closeTo(polar.angle, 225);
    closeTo(polar.distance, 0);
});

test('legacy Extended flags cannot disable the complete visible Focus region', () => {
    const region = getFocusSliderBounds({ ...defaultBoundary, extendedFocus: false });
    const constrained = constrainFocusControlPoint(
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
