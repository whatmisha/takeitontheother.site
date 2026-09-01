import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    normalizedFocus,
    resolveEffectivePersistenceState
} from '../src/state/focusState.js';

const state = {
    boundaryCenterX: 240,
    boundaryCenterY: 240,
    boundaryRadius: 240,
    focusAngle: 256,
    focusDistance: 70,
    focusX: 106.589,
    focusY: 273.101,
    followCursor: true
};

test('desktop persistence resolves the transient Follow cursor position', () => {
    const transientFocus = normalizedFocus({ x: 320, y: 180 }, state);
    const resolved = resolveEffectivePersistenceState(state, transientFocus);

    assert.deepEqual(
        { x: resolved.focusX, y: resolved.focusY },
        transientFocus
    );
    assert.notEqual(resolved.focusAngle, state.focusAngle);
    assert.notEqual(resolved.focusDistance, state.focusDistance);
});

test('mobile Basic-only showcase does not overwrite the stored desktop preset state', () => {
    const resolved = resolveEffectivePersistenceState(
        state,
        { x: 320, y: 180 },
        { mobileShowcase: true }
    );

    assert.deepEqual(resolved, state);
    assert.notStrictEqual(resolved, state);
});

test('Follow cursor preview does not dirty presets or create history entries', async () => {
    const toolSource = await readFile(new URL('../tool.js', import.meta.url), 'utf8');
    const transientHandler = toolSource.match(
        /function setTransientFollowFocus\([^)]*\)\s*\{([\s\S]*?)\n\}/
    )?.[1] || '';

    assert.ok(transientHandler, 'setTransientFollowFocus must remain testable');
    assert.doesNotMatch(transientHandler, /markDirty|notifyChange/);
    assert.match(transientHandler, /renderNow/);
});
