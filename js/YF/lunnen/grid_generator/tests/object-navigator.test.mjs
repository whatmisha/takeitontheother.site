import test from 'node:test';
import assert from 'node:assert/strict';

import { ObjectNavigatorController } from '../src/elements/ObjectNavigatorController.js';
import { ObjectDocumentController } from '../src/elements/ObjectDocumentController.js';

function createHost() {
    const history = [];
    const objectDocument = new ObjectDocumentController({ includeBuiltIns: false });
    objectDocument.replaceTextBlocks([{
        id: 'text-1',
        content: 'Text',
        styleRef: 'text',
        surface: 'front',
        x: 1,
        row: 0,
        baselineOffset: 0,
        width: 3,
        visible: true
    }]);
    objectDocument.replaceGraphicsBlocks([{
        id: 'icons',
        name: 'Icons',
        isBuiltIn: true,
        surface: 'front',
        x: 1,
        visible: true
    }]);
    return {
        dom: { elementsList: null },
        objectDocument,
        objectPlacementController: {
            constrain(block) { block.x = Math.min(block.x, 12); }
        },
        textDragState: { isDragging: false },
        deletionTimers: {},
        historyManager: {
            beginAction: label => history.push(`begin:${label}`),
            commitAction: () => history.push('commit')
        },
        getStateSnapshot: () => ({}),
        updateGrid() {},
        panelUiController: { updatePanelParams() {} },
        getStyleFontWeight: () => 500,
        getBlockNumber: () => 1,
        history
    };
}

test('object navigator maps built-in and custom graphics types', () => {
    const host = createHost();
    const controller = new ObjectNavigatorController(host);

    assert.equal(controller.getGraphicsType(host.objectDocument.graphicsBlocks[0]), 'icons');
    assert.equal(controller.getGraphicsType({ id: 'claim', isBuiltIn: true }), 'claim');
    assert.equal(controller.getGraphicsType({ id: 'custom', isBuiltIn: false }), 'graphics');
});

test('duplicate records one history transaction and creates an independent object', () => {
    const host = createHost();
    const controller = new ObjectNavigatorController(host);
    let renders = 0;
    controller.render = () => { renders += 1; };

    const duplicate = controller.duplicate('text', 'text-1', true);

    assert.equal(host.objectDocument.textBlocks.length, 2);
    assert.notEqual(duplicate.id, 'text-1');
    assert.equal(duplicate.x, 2);
    assert.equal(duplicate.visible, true);
    assert.equal(renders, 1);
    assert.deepEqual(host.history, ['begin:duplicate text', 'commit']);
});

test('clipboard survives a preset document replacement and pastes one undoable copy', () => {
    const host = createHost();
    const controller = new ObjectNavigatorController(host);
    const source = host.objectDocument.getTextBlock('text-1');
    host.currentEditingBlock = source;
    controller.render = () => {};
    controller.scheduleSelection = callback => callback();
    let selected = null;
    controller.select = (type, id) => { selected = { type, id }; };

    assert.equal(controller.copySelected(), true);
    host.objectDocument.replaceTextBlocks([{
        id: 'preset-b',
        content: 'Other preset',
        styleRef: 'headline',
        surface: 'front',
        x: 1,
        width: 2,
        visible: true
    }]);
    host.currentEditingBlock = null;

    const pasted = controller.pasteCopied();

    assert.equal(host.objectDocument.textBlocks.length, 2);
    assert.equal(pasted.content, 'Text');
    assert.equal(pasted.styleRef, 'text');
    assert.equal(pasted.x, 2);
    assert.equal(pasted.visible, true);
    assert.notEqual(pasted.id, source.id);
    assert.deepEqual(selected, { type: 'text', id: pasted.id });
    assert.deepEqual(host.history, ['begin:paste text', 'commit']);
});

test('copying a built-in graphic pastes it as an independent custom object', () => {
    const host = createHost();
    const controller = new ObjectNavigatorController(host);
    const source = host.objectDocument.getGraphicsBlock('icons');
    host.currentEditingGraphicsId = source.id;
    controller.render = () => {};
    controller.scheduleSelection = () => {};

    assert.equal(controller.copySelected(), true);
    const pasted = controller.pasteCopied();

    assert.equal(pasted.name, 'Icons');
    assert.equal(pasted.isBuiltIn, false);
    assert.notEqual(pasted.id, 'icons');
});

test('adding text is owned by the navigator transaction', () => {
    const host = createHost();
    const controller = new ObjectNavigatorController(host);
    let renders = 0;
    let selected = null;
    const previousSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = callback => { callback(); return 1; };
    controller.render = () => { renders += 1; };
    controller.select = (type, id) => { selected = { type, id }; };

    try {
        const block = controller.addText({ content: 'New object' });

        assert.equal(block.content, 'New object');
        assert.equal(renders, 1);
        assert.deepEqual(selected, { type: 'text', id: block.id });
        assert.deepEqual(host.history, ['begin:add text block', 'commit']);
    } finally {
        globalThis.setTimeout = previousSetTimeout;
    }
});

test('visibility action updates the model in one history transaction', () => {
    const host = createHost();
    const controller = new ObjectNavigatorController(host);
    let itemVisibility = null;
    controller.syncVisibilityItem = (_id, visible) => { itemVisibility = visible; };
    controller.syncOpenGraphicsPanel = () => {};

    controller.toggleVisibility('text', 'text-1');

    assert.equal(host.objectDocument.textBlocks[0].visible, false);
    assert.equal(itemVisibility, false);
    assert.deepEqual(host.history, ['begin:toggle visibility text', 'commit']);
});

test('delete ignores a missing graphics object instead of splicing the wrong item', () => {
    const host = createHost();
    const controller = new ObjectNavigatorController(host);
    let renders = 0;
    controller.render = () => { renders += 1; };

    assert.equal(controller.delete('graphics', 'missing'), false);
    assert.equal(host.objectDocument.graphicsBlocks.length, 1);
    assert.equal(renders, 0);
});
