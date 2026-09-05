import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ANIMATION_EXPORT_FPS,
    ANIMATION_EXPORT_SIZE,
    shouldKnockoutPngEyes
} from '../src/export/animationExportDefaults.js';

test('animation export uses one fixed 60 fps / 1080 px profile', () => {
    assert.equal(ANIMATION_EXPORT_FPS, 60);
    assert.equal(ANIMATION_EXPORT_SIZE, 1080);
});

test('PNG eyes are knocked out only when their color matches the removed background', () => {
    assert.equal(shouldKnockoutPngEyes({ eyeColor: '#000000', backgroundColor: '#000000' }), true);
    assert.equal(shouldKnockoutPngEyes({ eyeColor: '#ABCDEF', backgroundColor: '#abcdef' }), true);
    assert.equal(shouldKnockoutPngEyes({ eyeColor: '#000001', backgroundColor: '#000000' }), false);
});
