import assert from 'node:assert/strict';
import test from 'node:test';

import {
    COORDINATE_SPACE_VERSION,
    migrateCoordinateSpace
} from '../src/geometry/coordinateSpace.js';

test('legacy presets are rebased from the old crop without changing X coordinates', () => {
    const migrated = migrateCoordinateSpace({
        boundaryCenterX: 240,
        boundaryCenterY: 334,
        focusX: 240,
        focusY: 292
    });
    assert.deepEqual(migrated, {
        coordinateSpaceVersion: COORDINATE_SPACE_VERSION,
        boundaryCenterX: 240,
        boundaryCenterY: 240,
        focusX: 240,
        focusY: 198
    });
});

test('versioned presets retain their new coordinate values', () => {
    const current = {
        coordinateSpaceVersion: COORDINATE_SPACE_VERSION,
        boundaryCenterY: 240,
        focusY: 198
    };
    assert.deepEqual(migrateCoordinateSpace(current), current);
});

test('partial legacy state does not invent or shift missing coordinates', () => {
    assert.deepEqual(migrateCoordinateSpace({ focusX: 120 }), {
        coordinateSpaceVersion: COORDINATE_SPACE_VERSION,
        focusX: 120
    });
});
