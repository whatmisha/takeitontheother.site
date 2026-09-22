import assert from 'node:assert/strict';
import test from 'node:test';
import { bindPageLifecycle } from '../src/ui/GeneratorHost.js';

test('generator lifecycle suspends and resumes on every BFCache visit, then removes handlers on unload', () => {
    const listeners = new Map(), trace = [];
    const target = {
        addEventListener(type, callback) { listeners.set(type, callback); },
        removeEventListener(type) { listeners.delete(type); }
    };
    bindPageLifecycle({ suspend: () => trace.push('stop'), resume: () => trace.push('bind') }, target);
    listeners.get('pageshow')({ persisted: false });
    for (let index = 0; index < 3; index++) {
        listeners.get('pagehide')({ persisted: true });
        listeners.get('pageshow')({ persisted: true });
    }
    assert.deepEqual(trace, ['stop', 'bind', 'stop', 'bind', 'stop', 'bind']);
    listeners.get('pagehide')({ persisted: false });
    assert.equal(listeners.size, 0); assert.equal(trace.at(-1), 'stop');
});
