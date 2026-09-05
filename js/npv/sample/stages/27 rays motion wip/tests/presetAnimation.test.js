import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
    applyPresetPlaybackPolicy,
    shouldAutoplayPreset
} from '../src/state/presetAnimation.js';

const readPreset = (file) => JSON.parse(readFileSync(
    new URL(`../presets/${file}`, import.meta.url),
    'utf8'
));

test('Basic Wild preserves the Basic character and ships the requested animation', () => {
    const basic = readPreset('basic.json');
    const wild = readPreset('basic-wild.json');
    const characterKeys = [
        'rayCount',
        'centerAngle',
        'angleStep',
        'angleSpan',
        'rayLength',
        'rayWidth',
        'roundness',
        'cornerSmoothing',
        'headColor',
        'eyeColor',
        'backgroundColor',
        'eyePerspective',
        'eyeSize',
        'eyeDistance',
        'cute',
        'angry'
    ];

    characterKeys.forEach((key) => assert.deepEqual(wild[key], basic[key], key));
    assert.deepEqual({
        focusMode: wild.focusMode,
        duration: wild.motionDuration,
        points: wild.motionPointCount,
        complexity: wild.motionComplexity,
        smoothness: wild.motionSmoothness,
        stops: wild.motionStopCount,
        speedVariation: wild.motionSpeedVariation,
        blinks: wild.motionBlinkCount,
        emotionVariation: wild.motionEmotionVariation,
        motionBlur: wild.motionBlur
    }, {
        focusMode: 'animate',
        duration: 10,
        points: 16,
        complexity: 100,
        smoothness: 100,
        stops: 6,
        speedVariation: 100,
        blinks: 12,
        emotionVariation: 100,
        motionBlur: 100
    });
});

test('only presets saved in Animate mode opt into autoplay', () => {
    assert.equal(shouldAutoplayPreset({ focusMode: 'animate' }), true);
    assert.equal(shouldAutoplayPreset({ focusMode: 'manual', motionDuration: 10 }), false);
    assert.equal(shouldAutoplayPreset({}), false);
});

test('opening an animated preset clears a previous user pause', () => {
    const playback = {
        paused: true,
        pausedByUser: true,
        editing: true,
        selectedEditorControl: 'anchor:2'
    };
    assert.equal(applyPresetPlaybackPolicy(playback, { focusMode: 'animate' }), true);
    assert.deepEqual(playback, {
        paused: false,
        pausedByUser: false,
        editing: false,
        selectedEditorControl: null
    });
});
