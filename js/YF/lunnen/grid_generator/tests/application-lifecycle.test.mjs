import assert from 'node:assert/strict';
import test from 'node:test';

import { ApplicationLifecycle } from '../src/core/ApplicationLifecycle.js';
import { ListenerScope } from '../src/core/ListenerScope.js';
import { ApplicationEventController } from '../src/ui/ApplicationEventController.js';

class FakeEventTarget {
    constructor() {
        this.listeners = new Map();
        this.activeElement = { tagName: 'BODY' };
    }

    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }

    removeEventListener(type, listener) {
        this.listeners.get(type)?.delete(listener);
    }

    dispatch(type, event = {}) {
        this.listeners.get(type)?.forEach(listener => listener(event));
    }

    listenerCount(type) {
        return this.listeners.get(type)?.size || 0;
    }

    getElementById() {
        return null;
    }
}

function createHost(label, calls) {
    return {
        dom: {},
        gridSettingsController: { bind() {} },
        typographyUnitController: { bindButtons() {} },
        colorPanelController: { bind() {} },
        exportController: { exportSvg: () => calls.push(label) },
        undo() {},
        redo() {}
    };
}

function exportEvent() {
    return {
        key: 'e',
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        preventDefault() {}
    };
}

test('listener scope removes every owned listener exactly once', () => {
    const target = new FakeEventTarget();
    const scope = new ListenerScope();
    let calls = 0;
    scope.listen(target, 'change', () => calls++);

    target.dispatch('change');
    assert.equal(calls, 1);
    assert.equal(target.listenerCount('change'), 1);
    assert.equal(scope.dispose(), true);
    assert.equal(scope.dispose(), false);
    assert.equal(target.listenerCount('change'), 0);
    target.dispatch('change');
    assert.equal(calls, 1);
});

test('application lifecycle disposes resources in reverse ownership order', () => {
    const order = [];
    const lifecycle = new ApplicationLifecycle();
    lifecycle.add(() => order.push('first'));
    lifecycle.own({ dispose: () => order.push('second') });

    assert.equal(lifecycle.dispose(), true);
    assert.equal(lifecycle.dispose(), false);
    assert.deepEqual(order, ['second', 'first']);
});

test('replacing an application lifecycle leaves one global keyboard owner', () => {
    const documentRef = new FakeEventTarget();
    const calls = [];

    const firstLifecycle = new ApplicationLifecycle();
    const first = firstLifecycle.own(
        new ApplicationEventController(createHost('first', calls), documentRef)
    );
    assert.equal(first.bind(), true);
    assert.equal(first.bind(), false);
    assert.equal(documentRef.listenerCount('keydown'), 1);

    firstLifecycle.dispose();
    assert.equal(documentRef.listenerCount('keydown'), 0);

    const secondLifecycle = new ApplicationLifecycle();
    secondLifecycle.own(
        new ApplicationEventController(createHost('second', calls), documentRef)
    ).bind();
    documentRef.dispatch('keydown', exportEvent());

    assert.deepEqual(calls, ['second']);
    assert.equal(documentRef.listenerCount('keydown'), 1);
    secondLifecycle.dispose();
    assert.equal(documentRef.listenerCount('keydown'), 0);
});
