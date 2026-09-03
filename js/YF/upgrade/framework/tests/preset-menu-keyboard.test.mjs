import assert from 'node:assert/strict';
import test from 'node:test';

import { PresetMenuKeyboardController } from '../src/ui/PresetMenuKeyboardController.js';

class ClassList {
    constructor(...names) { this.names = new Set(names); }
    add(name) { this.names.add(name); }
    remove(name) { this.names.delete(name); }
    contains(name) { return this.names.has(name); }
}

function keyEvent(key, target) {
    return {
        key,
        target,
        defaultPrevented: false,
        altKey: false,
        metaKey: false,
        ctrlKey: false,
        prevented: false,
        stopped: false,
        preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; }
    };
}

test('preset keyboard contract opens, traverses, selects and closes an existing menu', () => {
    const menu = { id: 'menu', classList: new ClassList(), querySelectorAll: () => items };
    const makeItem = selected => ({
        classList: new ClassList(...(selected ? ['selected'] : [])),
        attributes: {},
        focused: false,
        clicks: 0,
        setAttribute(name, value) { this.attributes[name] = value; },
        focus() { this.focused = true; },
        click() { this.clicks += 1; },
        closest(selector) {
            if (selector === '[role="option"]') return this;
            if (selector === '[role="listbox"]') return menu;
            return null;
        }
    });
    const items = [makeItem(false), makeItem(true), makeItem(false)];
    const toggle = {
        dataset: {},
        attributes: { 'aria-controls': 'menu', 'aria-expanded': 'false' },
        focused: false,
        getAttribute(name) { return this.attributes[name]; },
        setAttribute(name, value) { this.attributes[name] = value; },
        matches: selector => selector === '[aria-haspopup="listbox"][aria-controls]',
        click() {
            const open = this.attributes['aria-expanded'] !== 'true';
            this.attributes['aria-expanded'] = String(open);
            menu.classList[open ? 'add' : 'remove']('active');
        },
        focus() { this.focused = true; }
    };
    const listeners = new Map();
    const documentRef = {
        addEventListener(type, handler) { listeners.set(type, handler); },
        removeEventListener(type) { listeners.delete(type); },
        querySelectorAll: () => [toggle],
        getElementById: id => id === 'menu' ? menu : null,
        querySelector: () => toggle
    };
    const controller = new PresetMenuKeyboardController({ ownerDocument: documentRef }).init();

    assert.equal(toggle.dataset.presetKeyboardReady, 'true');
    assert.equal(items[1].attributes['aria-selected'], 'true');
    assert.equal(items[0].tabIndex, -1);

    const open = keyEvent('ArrowDown', toggle);
    controller.handleKeydown(open);
    assert.equal(toggle.attributes['aria-expanded'], 'true');
    assert.equal(items[1].focused, true);
    assert.equal(open.prevented, true);

    const next = keyEvent('ArrowDown', items[1]);
    controller.handleKeydown(next);
    assert.equal(items[2].focused, true);

    const select = keyEvent('Enter', items[2]);
    controller.handleKeydown(select);
    assert.equal(items[2].clicks, 1);
    assert.equal(toggle.attributes['aria-expanded'], 'false');
    assert.equal(toggle.focused, true);

    controller.destroy();
    assert.equal(listeners.has('keydown'), false);
});
