import assert from 'node:assert/strict';
import test from 'node:test';

import { ShortcutRouter } from '../../framework/src/index.js';

function keyboardEvent(overrides = {}) {
    return {
        key: ' ',
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        target: { tagName: 'BODY', isContentEditable: false },
        prevented: false,
        preventDefault() { this.prevented = true; },
        ...overrides
    };
}

test('space shortcut matches the KeyboardEvent space value', () => {
    const router = new ShortcutRouter({ target: null });
    let calls = 0;
    router.register('space', () => { calls += 1; });
    const event = keyboardEvent();

    router._handle(event);

    assert.equal(calls, 1);
    assert.equal(event.prevented, true);
});

test('space shortcut stays disabled while typing in an input', () => {
    const router = new ShortcutRouter({ target: null });
    let calls = 0;
    router.register('space', () => { calls += 1; });
    const event = keyboardEvent({ target: { tagName: 'INPUT', isContentEditable: false } });

    router._handle(event);

    assert.equal(calls, 0);
    assert.equal(event.prevented, false);
});

test('mod+backslash matches Cmd or Ctrl with a backslash key', () => {
    const router = new ShortcutRouter({ target: null });
    let calls = 0;
    router.register('mod+\\', () => { calls += 1; }, { allowInInput: true });

    const commandEvent = keyboardEvent({
        key: '\\',
        metaKey: true,
        target: { tagName: 'INPUT', isContentEditable: false }
    });
    router._handle(commandEvent);
    const controlEvent = keyboardEvent({ key: '\\', ctrlKey: true });
    router._handle(controlEvent);

    assert.equal(calls, 2);
    assert.equal(commandEvent.prevented, true);
    assert.equal(controlEvent.prevented, true);
});
