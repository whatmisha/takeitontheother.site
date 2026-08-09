import test from 'node:test';
import assert from 'node:assert/strict';

import { ObjectNavigatorController } from '../src/elements/ObjectNavigatorController.js';

function createHost() {
    const history = [];
    return {
        dom: { elementsList: null },
        textBlocks: [{
            id: 'text-1',
            content: 'Text',
            styleRef: 'text',
            surface: 'front',
            x: 1,
            row: 0,
            baselineOffset: 0,
            width: 3,
            visible: true
        }],
        graphicsBlocks: [{
            id: 'icons',
            name: 'Icons',
            isBuiltIn: true,
            surface: 'front',
            x: 1,
            visible: true
        }],
        textDragState: { isDragging: false },
        deletionTimers: {},
        historyManager: {
            beginAction: label => history.push(`begin:${label}`),
            commitAction: () => history.push('commit')
        },
        getStateSnapshot: () => ({}),
        getGraphicsBlock(id) {
            return this.graphicsBlocks.find(block => block.id === id);
        },
        constrainBlockToSurface(block) {
            block.x = Math.min(block.x, 12);
        },
        updateGrid() {},
        updatePanelParams() {},
        getStyleFontWeight: () => 500,
        getBlockNumber: () => 1,
        history
    };
}

test('object navigator maps built-in and custom graphics types', () => {
    const host = createHost();
    const controller = new ObjectNavigatorController(host);

    assert.equal(controller.getGraphicsType(host.graphicsBlocks[0]), 'icons');
    assert.equal(controller.getGraphicsType({ id: 'claim', isBuiltIn: true }), 'claim');
    assert.equal(controller.getGraphicsType({ id: 'custom', isBuiltIn: false }), 'graphics');
});

test('duplicate records one history transaction and creates an independent object', () => {
    const host = createHost();
    const controller = new ObjectNavigatorController(host);
    let renders = 0;
    controller.render = () => { renders += 1; };

    const duplicate = controller.duplicate('text', 'text-1', true);

    assert.equal(host.textBlocks.length, 2);
    assert.notEqual(duplicate.id, 'text-1');
    assert.equal(duplicate.x, 2);
    assert.equal(duplicate.visible, true);
    assert.equal(renders, 1);
    assert.deepEqual(host.history, ['begin:duplicate text', 'commit']);
});

test('visibility action updates the model in one history transaction', () => {
    const host = createHost();
    const controller = new ObjectNavigatorController(host);
    let itemVisibility = null;
    controller.syncVisibilityItem = (_id, visible) => { itemVisibility = visible; };
    controller.syncOpenGraphicsPanel = () => {};

    controller.toggleVisibility('text', 'text-1');

    assert.equal(host.textBlocks[0].visible, false);
    assert.equal(itemVisibility, false);
    assert.deepEqual(host.history, ['begin:toggle visibility text', 'commit']);
});

test('delete ignores a missing graphics object instead of splicing the wrong item', () => {
    const host = createHost();
    const controller = new ObjectNavigatorController(host);
    let renders = 0;
    controller.render = () => { renders += 1; };

    assert.equal(controller.delete('graphics', 'missing'), false);
    assert.equal(host.graphicsBlocks.length, 1);
    assert.equal(renders, 0);
});
