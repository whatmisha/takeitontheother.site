import test from 'node:test';
import assert from 'node:assert/strict';

import { ObjectDragController } from '../src/elements/ObjectDragController.js';

function createHost() {
    const text = {
        id: 'text-1',
        surface: 'front',
        x: 1,
        row: 0,
        baselineOffset: 0
    };
    const graphics = {
        id: 'graphics-1',
        surface: 'front',
        x: 1,
        row: 0,
        baselineOffset: 0,
        isBuiltIn: false
    };
    const history = [];
    let updates = 0;
    let changes = 0;
    return {
        text,
        graphics,
        history,
        get updates() { return updates; },
        get changes() { return changes; },
        textDragState: { kind: null, isDragging: false },
        getTextBlock: id => id === text.id ? text : null,
        getGraphicsBlock: id => id === graphics.id ? graphics : null,
        getBlockPointerOffset: () => ({ x: 2, y: 3 }),
        positionBlockAtPointer(block, clientX, clientY, type) {
            block.surface = type === 'text' ? 'left' : 'right';
            block.x = Math.round(clientX / 10);
            block.row = Math.round(clientY / 10);
            return true;
        },
        historyManager: {
            beginAction: label => history.push(`begin:${label}`),
            commitAction: () => history.push('commit')
        },
        getStateSnapshot: () => ({}),
        updateGridThrottled: () => { updates += 1; },
        updateGrid: () => { updates += 1; },
        markAsChanged: () => { changes += 1; },
        duplicateElement: () => null
    };
}

function withDocument(callback) {
    const previousDocument = globalThis.document;
    globalThis.document = {
        getElementById: () => null,
        addEventListener() {},
        removeEventListener() {}
    };
    try {
        callback();
    } finally {
        globalThis.document = previousDocument;
    }
}

test('text drag can move to another surface and commits one transaction', () => {
    withDocument(() => {
        const host = createHost();
        const controller = new ObjectDragController(host);

        assert.equal(controller.startText('text-1', 10, 20), true);
        assert.equal(host.textDragState.kind, 'text');
        assert.equal(controller.moveText({ clientX: 40, clientY: 30, altKey: false, metaKey: false }), true);
        assert.equal(host.text.surface, 'left');
        assert.equal(host.text.x, 4);
        assert.equal(controller.endText(), true);

        assert.equal(host.textDragState.isDragging, false);
        assert.equal(host.changes, 1);
        assert.deepEqual(host.history, ['begin:drag text block', 'commit']);
    });
});

test('text document handlers do not finish a graphics drag', () => {
    withDocument(() => {
        const host = createHost();
        const controller = new ObjectDragController(host);

        controller.startGraphics(host.graphics, 10, 10);
        assert.equal(controller.isDragging('graphics'), true);
        assert.equal(controller.isDragging('text'), false);
        assert.equal(controller.endText(), false);
        assert.equal(host.textDragState.isDragging, true);
        assert.deepEqual(host.history, ['begin:drag graphics block']);

        assert.equal(controller.moveGraphics(
            { clientX: 50, clientY: 20, altKey: false, metaKey: false },
            host.graphics
        ), true);
        assert.equal(host.graphics.surface, 'right');
        assert.equal(controller.endGraphics(), true);
        assert.deepEqual(host.history, ['begin:drag graphics block', 'commit']);
    });
});
