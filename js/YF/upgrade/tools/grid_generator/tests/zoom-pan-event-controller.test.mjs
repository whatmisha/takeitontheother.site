import test from 'node:test';
import assert from 'node:assert/strict';
import { ZoomPanEventController } from '../src/ui/ZoomPanEventController.js';

class FakeTarget {
    constructor() {
        this.listeners = new Map();
        this.style = {};
    }

    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }

    removeEventListener(type, listener) {
        this.listeners.get(type)?.delete(listener);
    }

    emit(type, event = {}) {
        this.listeners.get(type)?.forEach(listener => listener(event));
    }

    listenerCount() {
        return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0);
    }
}

const event = values => ({
    preventDefault() {},
    stopPropagation() {},
    target: { tagName: 'DIV' },
    ...values
});

test('zoom and pan gestures share one removable listener owner', () => {
    const container = new FakeTarget();
    const documentRef = new FakeTarget();
    const windowRef = new FakeTarget();
    container.getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 600 });
    const calls = [];
    const host = {
        container,
        zoom: 1,
        panX: 0,
        panY: 0,
        getViewBox: () => ({ x: 0, y: 0, width: 400, height: 300 }),
        screenDeltaToSvg: (x, y) => ({ x: x / 2, y: y / 2 }),
        updateTransform: () => calls.push('transform'),
        updateViewRotation: () => calls.push('resize'),
        zoomTo: (...args) => calls.push(['zoom', ...args]),
        fitToScreen: () => calls.push('fit'),
        resetZoom: () => calls.push('reset'),
        zoomIn: () => calls.push('in'),
        zoomOut: () => calls.push('out')
    };
    const controller = new ZoomPanEventController(host, { documentRef, windowRef });
    controller.init();

    container.emit('wheel', event({
        clientX: 110,
        clientY: 120,
        deltaX: 20,
        deltaY: 10,
        metaKey: false,
        ctrlKey: false
    }));
    assert.deepEqual({ panX: host.panX, panY: host.panY }, { panX: 10, panY: 5 });

    container.emit('wheel', event({
        clientX: 210,
        clientY: 220,
        deltaX: 0,
        deltaY: -1,
        metaKey: true,
        ctrlKey: false
    }));
    assert.deepEqual(calls.at(-1), ['zoom', 1.05, 200, 200]);

    documentRef.emit('keydown', event({ code: 'Space' }));
    container.emit('mousedown', event({ button: 0, clientX: 100, clientY: 100 }));
    documentRef.emit('mousemove', event({ clientX: 120, clientY: 110 }));
    documentRef.emit('mouseup', event({}));
    assert.deepEqual({ panX: host.panX, panY: host.panY }, { panX: 0, panY: 0 });
    assert.equal(container.style.cursor, 'grab');
    documentRef.emit('keyup', event({ code: 'Space' }));
    assert.equal(container.style.cursor, 'default');

    assert.ok(container.listenerCount() > 0);
    assert.ok(documentRef.listenerCount() > 0);
    assert.ok(windowRef.listenerCount() > 0);
    controller.destroy();
    assert.equal(container.listenerCount(), 0);
    assert.equal(documentRef.listenerCount(), 0);
    assert.equal(windowRef.listenerCount(), 0);
});
