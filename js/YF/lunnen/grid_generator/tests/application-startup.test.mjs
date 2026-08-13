import test from 'node:test';
import assert from 'node:assert/strict';

import { ApplicationStartupController } from '../src/core/ApplicationStartupController.js';

test('startup waits for presets, graphics, final render and fit in order', async () => {
    const events = [];
    const controller = new ApplicationStartupController({
        loadPresets: async () => {
            events.push('presets:start');
            await Promise.resolve();
            events.push('presets:end');
        },
        loadBuiltInGraphics: async () => {
            events.push('graphics:start');
            await Promise.resolve();
            events.push('graphics:end');
        },
        finalize: () => { events.push('render'); },
        recover: async () => { events.push('recover'); },
        nextFrame: async () => { events.push('frame'); },
        fit: () => { events.push('fit'); }
    });

    const first = controller.initialize();
    const second = controller.initialize();
    await Promise.all([first, second]);

    assert.equal(first, second);
    assert.deepEqual(events, [
        'presets:start',
        'presets:end',
        'graphics:start',
        'graphics:end',
        'render',
        'recover',
        'frame',
        'fit'
    ]);
});
