import assert from 'node:assert/strict';
import test from 'node:test';

import { UnifiedUiController } from '../src/ui/UnifiedUiController.js';

function classes(initial = []) {
    const values = new Set(initial);
    return {
        contains: name => values.has(name),
        toggle(name, force) {
            if (force) values.add(name);
            else values.delete(name);
        }
    };
}

test('UnifiedUiController synchronizes collapsed panel class and accessibility state', () => {
    const attributes = new Map();
    const icon = {
        classList: classes(),
        setAttribute: (name, value) => attributes.set(name, String(value))
    };
    const panel = {
        classList: classes(),
        querySelector: () => icon
    };
    const controller = new UnifiedUiController({ ownerDocument: {}, ownerWindow: {} });

    controller.setPanelCollapsed(panel, true);
    assert.equal(panel.classList.contains('panel-collapsed'), true);
    assert.equal(icon.classList.contains('collapsed'), true);
    assert.equal(attributes.get('aria-expanded'), 'false');
    assert.equal(attributes.get('aria-label'), 'Expand panel');

    controller.setPanelCollapsed(panel, false);
    assert.equal(panel.classList.contains('panel-collapsed'), false);
    assert.equal(attributes.get('aria-expanded'), 'true');
});

test('Command/Control backslash owns the shared collapse route', () => {
    const controller = new UnifiedUiController({ ownerDocument: {}, ownerWindow: {} });
    let toggles = 0;
    controller.togglePanels = () => { toggles += 1; return true; };
    const event = {
        key: '\\', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, repeat: false,
        prevented: false, stopped: false,
        preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; }
    };

    controller.handleKeydown(event);
    assert.equal(toggles, 1);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
});

test('overflowing summaries drop expendable units before CSS ellipsis', () => {
    const controller = new UnifiedUiController({ ownerDocument: {}, ownerWindow: {} });
    const target = { clientWidth: 120, scrollWidth: 240 };
    assert.equal(
        controller.compactSummary('104 keys · 412.5 mm · 22 characters', target),
        '104 · 412.5 · 22 chars'
    );
    assert.equal(
        controller.compactSummary('104 keys · 412.5 mm', { clientWidth: 240, scrollWidth: 120 }),
        '104 keys · 412.5 mm'
    );
});

test('fast export feedback is restartable and never disables its action', () => {
    const callbacks = [];
    const cleared = [];
    const windowRef = {
        setTimeout(callback) { callbacks.push(callback); return callbacks.length; },
        clearTimeout(id) { cleared.push(id); }
    };
    const button = {
        dataset: {},
        disabled: false,
        closest: () => null
    };
    const controller = new UnifiedUiController({ ownerDocument: {}, ownerWindow: windowRef });

    controller.showExportFeedback(button);
    assert.equal(button.dataset.exportFeedbackState, 'success');
    assert.equal(button.disabled, false);
    controller.showExportFeedback(button);
    assert.deepEqual(cleared, [1]);
    callbacks.at(-1)();
    assert.equal(button.dataset.exportFeedbackState, undefined);
});

test('disabled or aria-busy exports keep a working state until the owner finishes', () => {
    const callbacks = [];
    const windowRef = {
        setTimeout(callback) { callbacks.push(callback); return callbacks.length; },
        clearTimeout() {}
    };
    const button = {
        dataset: {},
        disabled: true,
        closest: () => null,
        getAttribute: name => name === 'aria-busy' ? 'false' : null
    };
    const controller = new UnifiedUiController({ ownerDocument: {}, ownerWindow: windowRef });
    controller.exportButtons = () => [button];

    controller.syncExportStates();
    assert.equal(button.dataset.exportFeedbackState, 'working');
    button.disabled = false;
    controller.syncExportStates();
    assert.equal(button.dataset.exportFeedbackState, 'success');
    callbacks.at(-1)();
    assert.equal(button.dataset.exportFeedbackState, undefined);
});
