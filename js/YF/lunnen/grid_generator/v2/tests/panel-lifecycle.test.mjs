import assert from 'node:assert/strict';
import test from 'node:test';

import { PanelManager } from '../src/ui/PanelManager.js';

function createElement(id, { display = '', collapsed = false } = {}) {
    const classes = new Set(collapsed ? ['panel-collapsed'] : []);
    return {
        id,
        style: { display },
        listeners: {},
        classList: {
            contains: name => classes.has(name),
            toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
        },
        addEventListener(type, listener) { this.listeners[type] = listener; },
        getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 })
    };
}

test('panel lifecycle shares one document drag binding across registered panels', () => {
    const elements = new Map([
        ['first', createElement('first')],
        ['firstHeader', createElement('firstHeader')],
        ['second', createElement('second', { display: 'none', collapsed: true })],
        ['secondHeader', createElement('secondHeader')]
    ]);
    const documentListeners = {};
    const documentRef = {
        getElementById: id => elements.get(id) || null,
        addEventListener(type, listener) { documentListeners[type] = listener; }
    };
    const manager = new PanelManager(documentRef, { innerWidth: 1000, innerHeight: 800 });

    manager.registerPanel('first', { headerId: 'firstHeader' });
    manager.registerPanel('second', { headerId: 'secondHeader' });

    assert.deepEqual(Object.keys(documentListeners).sort(), ['mousemove', 'mouseup']);
    assert.equal(manager.isOpen('second'), false);
    assert.equal(manager.isCollapsed('second'), true);
    manager.open('second');
    manager.setCollapsed('second', false);
    manager.setPosition('second', 30, 40);
    assert.equal(elements.get('second').style.display, 'block');
    assert.equal(elements.get('second').style.left, '30px');
    assert.deepEqual(manager.getPosition('second'), { x: 30, y: 40 });
    assert.equal(manager.isCollapsed('second'), false);
});
