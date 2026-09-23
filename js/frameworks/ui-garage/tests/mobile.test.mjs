import assert from 'node:assert/strict';
import test from 'node:test';

import { MobileBootstrap } from '../src/mobile/MobileBootstrap.js';

function eventTarget(extra = {}) {
    const listeners = new Map();
    return {
        ...extra,
        addEventListener(type, handler) { listeners.set(type, handler); },
        removeEventListener(type, handler) {
            if (listeners.get(type) === handler) listeners.delete(type);
        },
        emit(type) { listeners.get(type)?.(); },
        listeners
    };
}

test('MobileBootstrap is opt-in, publishes viewport state and disposes listeners', () => {
    const media = eventTarget({ matches: true });
    const visualViewport = eventTarget({ width: 390, height: 844, offsetLeft: 2, offsetTop: 4 });
    const windowRef = eventTarget({
        innerWidth: 390,
        innerHeight: 844,
        visualViewport,
        matchMedia: () => media
    });
    const classes = new Set();
    const properties = new Map();
    const root = {
        classList: {
            toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
            remove: name => classes.delete(name)
        },
        style: {
            setProperty: (name, value) => properties.set(name, value),
            removeProperty: name => properties.delete(name)
        }
    };
    const changes = [];
    const mobile = new MobileBootstrap({
        window: windowRef,
        root,
        className: 'test-mobile',
        onChange: active => changes.push(active)
    }).init();

    assert.equal(mobile.active, true);
    assert.equal(classes.has('test-mobile'), true);
    assert.equal(properties.get('--framework-viewport-height'), '844px');
    media.matches = false;
    media.emit('change');
    assert.equal(mobile.active, false);
    assert.deepEqual(changes, [true, false]);

    mobile.destroy();
    assert.equal(windowRef.listeners.size, 0);
    assert.equal(visualViewport.listeners.size, 0);
    assert.equal(media.listeners.size, 0);
    assert.equal(properties.size, 0);
});
