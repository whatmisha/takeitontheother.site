import assert from 'node:assert/strict';
import test from 'node:test';

import { replaceObservedController } from '../src/ui/ObservedControllerLifecycle.js';

test('replacing an observed controller disconnects the previous observer and listener owner', () => {
    const scope = {};
    const key = Symbol('controller');
    const root = {};
    const controllers = [];
    const observers = [];
    const createController = () => {
        const controller = {
            syncCount: 0,
            destroyCount: 0,
            sync() { this.syncCount += 1; },
            destroy() { this.destroyCount += 1; }
        };
        controllers.push(controller);
        return controller;
    };
    const installObserver = controller => {
        const observer = {
            observeCalls: [],
            disconnectCount: 0,
            observe(...args) { this.observeCalls.push(args); },
            disconnect() { this.disconnectCount += 1; }
        };
        observer.callback = () => controller.sync();
        observer.observe(root, { childList: true });
        observers.push(observer);
        return observer;
    };

    const first = replaceObservedController({
        scope,
        key,
        createController,
        installObserver
    });
    observers[0].callback();
    assert.equal(controllers[0].syncCount, 1);
    assert.deepEqual(observers[0].observeCalls, [[root, { childList: true }]]);

    const second = replaceObservedController({
        scope,
        key,
        createController,
        installObserver
    });
    assert.equal(first.destroy(), false, 'replacement already disposed the first lifecycle');
    assert.equal(controllers[0].destroyCount, 1);
    assert.equal(observers[0].disconnectCount, 1);
    assert.equal(scope[key], second);

    assert.equal(second.destroy(), true);
    assert.equal(second.destroy(), false, 'destroy must be idempotent');
    assert.equal(controllers[1].destroyCount, 1);
    assert.equal(observers[1].disconnectCount, 1);
    assert.equal(scope[key], undefined);
});
