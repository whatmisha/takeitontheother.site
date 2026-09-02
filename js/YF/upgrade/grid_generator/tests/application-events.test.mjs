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
        objectNavigatorController: {
            copySelected: () => { calls.push('copy'); return true; },
            pasteCopied: () => { calls.push('paste'); return {}; }
        },
        calls
    };
}

function intakeElement(tagName, id = '') {
    const listeners = new Map();
    const attributes = new Map();
    return {
        tagName: tagName.toUpperCase(),
        id,
        files: [],
        value: '',
        textContent: '',
        dataset: {},
        clickCount: 0,
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(listener);
        },
        removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        click() { this.clickCount += 1; },
        dispatch(type, event = {}) {
            const payload = { target: this, ...event };
            for (const listener of listeners.get(type) || []) listener(payload);
        },
        listenerCount(type) { return listeners.get(type)?.size || 0; }
    };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

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

test('copy and paste shortcuts target objects but preserve native editor behavior', () => {
    const host = createHost();
    const documentRef = { activeElement: { tagName: 'BODY' } };
    const controller = new ApplicationEventController(host, documentRef);
    const copyEvent = keyboardEvent('c', { metaKey: true });
    const pasteEvent = keyboardEvent('V', { ctrlKey: true });

    controller.handleKeyboard(copyEvent);
    controller.handleKeyboard(pasteEvent);

    assert.deepEqual(host.calls, ['copy', 'paste']);
    assert.equal(copyEvent.defaultPrevented, true);
    assert.equal(pasteEvent.defaultPrevented, true);

    documentRef.activeElement = { tagName: 'TEXTAREA' };
    const nativeCopy = keyboardEvent('c', { metaKey: true });
    const nativePaste = keyboardEvent('v', { metaKey: true });
    controller.handleKeyboard(nativeCopy);
    controller.handleKeyboard(nativePaste);

    assert.deepEqual(host.calls, ['copy', 'paste']);
    assert.equal(nativeCopy.defaultPrevented, undefined);
    assert.equal(nativePaste.defaultPrevented, undefined);
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

test('settings import uses one reusable shared FileIntake surface', async () => {
    const host = createHost();
    const trigger = intakeElement('button', 'importSettingsBtn');
    const input = intakeElement('input', 'importSettingsInput');
    const status = intakeElement('span', 'importSettingsStatus');
    const imported = [];
    Object.assign(host.dom, {
        importSettingsBtn: trigger,
        importSettingsInput: input,
        importSettingsStatus: status
    });
    host.exportController.exportPdf = () => {};
    host.exportController.exportSettings = () => {};
    host.importSettings = async file => imported.push(file.name);
    const controller = new ApplicationEventController(host, { activeElement: null });

    controller.bindActionButtons();
    trigger.dispatch('click');
    assert.equal(input.clickCount, 1);

    const file = { name: 'layout.json', type: 'application/json', size: 50 };
    input.files = [file];
    input.value = '/fake/layout.json';
    input.dispatch('change');
    assert.equal(input.value, '');
    await settle();
    input.files = [file];
    input.value = '/fake/layout.json';
    input.dispatch('change');
    await settle();

    assert.deepEqual(imported, ['layout.json', 'layout.json']);
    assert.equal(status.dataset.fileState, 'ready');
    assert.equal(status.textContent, 'Imported layout.json');
    controller.dispose();
    assert.equal(input.listenerCount('change'), 0);
});
