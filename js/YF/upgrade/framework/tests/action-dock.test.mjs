import assert from 'node:assert/strict';
import test from 'node:test';

import { ActionDockController } from '../src/ui/ActionDockController.js';

function action({ hidden = false } = {}) {
    return {
        disabled: false,
        hidden,
        clicks: 0,
        click() { this.clicks += 1; }
    };
}

function keyboardEvent(key, overrides = {}) {
    return {
        key,
        target: { tagName: 'BODY', isContentEditable: false },
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        repeat: false,
        defaultPrevented: false,
        prevented: false,
        stopped: false,
        preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; },
        ...overrides
    };
}

test('ActionDockController reveals extras and routes canonical export shortcuts', () => {
    const primary = action();
    const jsonExport = action({ hidden: true });
    const jsonImport = action({ hidden: true });
    const extras = [jsonExport, jsonImport];
    const dock = {
        dataset: {},
        querySelectorAll(selector) {
            if (selector === '[data-action-dock-extra]') return extras;
            return [];
        }
    };
    const selectors = {
        '[data-action-dock-primary-export]': [primary],
        '[data-action-dock-json-export]': [jsonExport],
        '[data-action-dock-json-import]': [jsonImport]
    };
    const listeners = new Map();
    const documentRef = {
        addEventListener(type, handler) { listeners.set(type, handler); },
        removeEventListener(type) { listeners.delete(type); },
        querySelectorAll(selector) {
            if (selector === '.action-dock') return [dock];
            return selectors[selector] || [];
        }
    };
    const controller = new ActionDockController({ ownerDocument: documentRef }).init();
    assert.equal(jsonExport.hidden, true);

    const reveal = keyboardEvent('j');
    controller.handleKeydown(reveal);
    assert.equal(jsonExport.hidden, false);
    assert.equal(jsonImport.hidden, false);
    assert.equal(reveal.prevented, true);

    const exportEvent = keyboardEvent('e', { metaKey: true });
    controller.handleKeydown(exportEvent);
    assert.equal(primary.clicks, 1);

    const jsonEvent = keyboardEvent('j', { metaKey: true });
    controller.handleKeydown(jsonEvent);
    assert.equal(jsonExport.clicks, 1);

    const importEvent = keyboardEvent('j', { metaKey: true, shiftKey: true });
    controller.handleKeydown(importEvent);
    assert.equal(jsonImport.clicks, 1);
    assert.equal(importEvent.stopped, true);

    controller.destroy();
    assert.equal(listeners.has('keydown'), false);
});

test('ActionDockController ignores plain J while typing', () => {
    const controller = new ActionDockController({ ownerDocument: { querySelectorAll: () => [] } });
    const event = keyboardEvent('j', { target: { tagName: 'INPUT' } });
    controller.handleKeydown(event);
    assert.equal(event.prevented, false);
});
