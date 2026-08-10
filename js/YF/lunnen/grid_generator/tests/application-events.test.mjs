import assert from 'node:assert/strict';
import test from 'node:test';

import { ApplicationEventController } from '../src/ui/ApplicationEventController.js';

function keyboardEvent(key, overrides = {}) {
    return {
        key,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault() {
            this.defaultPrevented = true;
        },
        ...overrides
    };
}

function createHost() {
    const calls = [];
    return {
        dom: {},
        exportController: {
            exportSvg: () => calls.push('export')
        },
        undo: () => calls.push('undo'),
        redo: () => calls.push('redo'),
        calls
    };
}

test('export and history keyboard commands are routed through one controller', () => {
    const host = createHost();
    const activeElement = { tagName: 'INPUT', blur: () => host.calls.push('blur') };
    const controller = new ApplicationEventController(host, { activeElement });

    const exportEvent = keyboardEvent('e', { metaKey: true });
    const undoEvent = keyboardEvent('z', { ctrlKey: true });
    const redoEvent = keyboardEvent('Z', { ctrlKey: true, shiftKey: true });
    controller.handleKeyboard(exportEvent);
    controller.handleKeyboard(undoEvent);
    controller.handleKeyboard(redoEvent);

    assert.deepEqual(host.calls, ['export', 'blur', 'undo', 'blur', 'redo']);
    assert.equal(exportEvent.defaultPrevented, true);
    assert.equal(undoEvent.defaultPrevented, true);
    assert.equal(redoEvent.defaultPrevented, true);
});

test('delete ignores editor keystrokes and removes the selected canvas object otherwise', () => {
    const host = createHost();
    const deleteButton = {};
    host.currentEditingBlock = { id: 'text-1' };
    host.objectDocument = {
        textBlocks: [{ id: 'text-1', content: 'Selected text block' }]
    };
    host.dom.elementsList = {
        querySelector: () => ({
            parentElement: { querySelector: () => deleteButton }
        })
    };
    host.objectEditorPanelController = {
        closeTextPanel: () => host.calls.push('close')
    };
    host.objectNavigatorController = {
        startDelete: (...args) => host.calls.push(['delete', ...args])
    };

    const documentRef = { activeElement: { tagName: 'INPUT' } };
    const controller = new ApplicationEventController(host, documentRef);
    controller.handleKeyboard(keyboardEvent('Backspace'));
    assert.deepEqual(host.calls, []);

    documentRef.activeElement = { tagName: 'BODY' };
    const deleteEvent = keyboardEvent('Delete');
    controller.handleKeyboard(deleteEvent);
    assert.equal(deleteEvent.defaultPrevented, true);
    assert.equal(host.calls[0], 'close');
    assert.deepEqual(host.calls[1], [
        'delete',
        deleteButton,
        'text',
        'text-1',
        'Selected text block'
    ]);
});
