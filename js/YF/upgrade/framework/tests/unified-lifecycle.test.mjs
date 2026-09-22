import assert from 'node:assert/strict';
import test from 'node:test';
import { UnifiedUiController } from '../src/ui/UnifiedUiController.js';
import { installDocumentObserver } from '../src/ui/ObservedControllerLifecycle.js';

function fixture({ body = {}, rejectFirstObserve = false } = {}) {
    const listeners = new Map(), timers = new Map(), observers = [];
    let serial = 0, attempts = 0;
    const view = {
        location: { pathname: '/fixture/' },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
            observe(root) { attempts++; if (!root || (rejectFirstObserve && attempts === 1)) throw new TypeError('parameter 1 is not of type Node'); this.root = root; }
            disconnect() { this.disconnected = true; }
        },
        setTimeout(fn) { timers.set(++serial, fn); return serial; },
        clearTimeout(id) { timers.delete(id); },
        setInterval(fn) { timers.set(++serial, fn); return serial; },
        clearInterval(id) { timers.delete(id); }
    };
    const document = {
        body, documentElement: {}, defaultView: view,
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
        removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
        querySelector: () => null, querySelectorAll: () => []
    };
    const ui = new UnifiedUiController({ ownerDocument: document, ownerWindow: view });
    ui.sync = () => {};
    return { ui, document, view, listeners, timers, observers, emit: type => [...(listeners.get(type) || [])].forEach(fn => fn()) };
}

test('Unified UI waits for a body without leaving partial listeners behind', () => {
    const h = fixture({ body: null });
    assert.doesNotThrow(() => h.ui.init());
    h.ui.init();
    assert.equal(h.listeners.get('DOMContentLoaded').size, 1);
    assert.equal(h.listeners.get('click')?.size || 0, 0);
    h.document.body = {};
    h.emit('DOMContentLoaded');
    assert.equal(h.ui.bound, true);
    assert.equal(h.listeners.get('click').size, 1);
    h.ui.init();
    assert.equal(h.listeners.get('click').size, 1);
    h.ui.destroy();
    assert.equal([...h.listeners.values()].reduce((sum, set) => sum + set.size, 0), 0);
    assert.equal(h.timers.size, 0);
});

test('destroy before DOM readiness cancels delayed initialization', () => {
    const h = fixture({ body: null });
    assert.doesNotThrow(() => h.ui.init());
    h.ui.destroy();
    h.document.body = {};
    h.emit('DOMContentLoaded');
    assert.equal(h.ui.bound, false);
    assert.equal(h.observers.length, 0);
});

test('Unified UI survives a rejected first observer attachment and retries once', () => {
    const h = fixture({ rejectFirstObserve: true });
    assert.doesNotThrow(() => h.ui.init());
    const retry = [...h.timers.values()][0];
    retry();
    assert.equal(h.observers[0].root, h.document.documentElement);
    h.ui.destroy();
    assert.equal(h.observers[0].disconnected, true);
});

test('a retired document observer cannot reconnect or synchronize through queued callbacks', () => {
    const h = fixture({ rejectFirstObserve: true });
    let syncs = 0;
    const lifecycle = installDocumentObserver({ sync() { syncs++; } }, { ownerDocument: h.document });
    const retry = [...h.timers.values()][0];
    lifecycle.disconnect();
    retry();
    h.observers[0].callback();
    assert.equal(h.observers[0].root, undefined);
    assert.equal(syncs, 0);
});
