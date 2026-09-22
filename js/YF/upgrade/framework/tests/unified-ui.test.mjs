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

test('zoom indicator offers Fit on hover without claiming browser size shortcuts', () => {
    const indicator = {
        dataset: {},
        textContent: '125%',
        contains: () => false
    };
    const documentRef = {
        querySelector: selector => selector === '.zoom-indicator' ? indicator : null,
        querySelectorAll: () => []
    };
    const controller = new UnifiedUiController({ ownerDocument: documentRef, ownerWindow: {} });
    const target = { closest: selector => selector === '.zoom-indicator' ? indicator : null };

    controller.handleMouseover({ target, relatedTarget: null });
    assert.equal(indicator.textContent, 'Fit');
    controller.handleMouseout({ target, relatedTarget: null });
    assert.equal(indicator.textContent, '125%');
    assert.equal(controller.shortcutRows().some(([label]) => label.includes('actual size')), false);
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

test('compact summary refresh settles without a self-triggering mutation loop and remeasures on resize', () => {
    let text = '', writes = 0, full = '104 keys · 412.5 mm';
    const target = { clientWidth: 100, get scrollWidth() { return text.length * 10; },
        get textContent() { return text; }, set textContent(value) { text = value; writes++; }, removeAttribute() {} };
    const controller = new UnifiedUiController({ ownerDocument: { getElementById: () => ({ querySelector: () => target }) },
        ownerWindow: {}, profile: { summaries: { panel: () => full } } });
    controller.refreshSummaries();
    assert.equal(text, '104 · 412.5');
    const settledWrites = writes;
    for (let i = 0; i < 50; i++) controller.refreshSummaries();
    assert.equal(writes, settledWrites);
    target.clientWidth = 500;
    controller.refreshSummaries();
    assert.equal(text, full);
    full = '8 rays';
    controller.refreshSummaries();
    assert.equal(text, full);
});

test('escaped shortcut labels cannot keep rewriting their normalized HTML serialization', () => {
    let html = '', writes = 0;
    const popup = { get innerHTML() { return html; }, set innerHTML(value) { html = value.replaceAll('&#39;', "'"); writes++; } };
    const controller = new UnifiedUiController({ ownerDocument: {}, ownerWindow: {} });
    const rows = [["Editor's <SVG>", '⌘E']];
    for (let i = 0; i < 50; i++) controller.renderShortcutHelp(popup, rows);
    assert.equal(writes, 1);
    assert.match(html, /&lt;SVG&gt;/u);
    controller.renderShortcutHelp(popup, [['PNG', '⌘E']]);
    assert.equal(writes, 2);
});

test('file command metadata drives both help and a single keyboard activation', () => {
    const image = { dataset: { fileShortcut: 'o', fileShortcutLabel: 'Open image' }, clicks: 0, click() { this.clicks++; } };
    const layout = { dataset: { fileShortcut: 'i', fileShortcutLabel: 'Open layout' }, clicks: 0, click() { this.clicks++; } };
    const controller = new UnifiedUiController({
        ownerDocument: {
            querySelector: () => null,
            querySelectorAll: selector => selector === '[data-file-shortcut]' ? [image, layout] : []
        }, ownerWindow: {}
    });
    assert.deepEqual(controller.shortcutRows(), [['Open image', '⌘O'], ['Open layout', '⌘I'], ['Shortcuts', '?']]);
    const event = {
        key: 'i', metaKey: true, target: { tagName: 'BODY' },
        preventDefault() { this.defaultPrevented = true; },
        stopImmediatePropagation() { this.stopped = true; }
    };
    controller.handleKeydown(event);
    controller.handleKeydown(event);
    assert.equal(layout.clicks, 1);
    assert.equal(image.clicks, 0);
    assert.equal(event.stopped, true);

    for (const override of [{ repeat: true }, { shiftKey: true }, { altKey: true }, { target: { tagName: 'INPUT' } }, { target: { isContentEditable: true } }]) {
        controller.handleKeydown({ ...event, defaultPrevented: false, ...override });
    }
    assert.equal(layout.clicks, 1);
    layout.disabled = true;
    controller.handleKeydown({ ...event, defaultPrevented: false });
    assert.equal(layout.clicks, 1);
});

test('explicit file shortcuts survive a collapsed panel but never activate a disabled or hidden action', () => {
    const image = {
        dataset: { fileShortcut: 'o', fileShortcutLabel: 'Open image', fileShortcutPersistent: 'true' },
        getClientRects: () => [], clicks: 0, click() { this.clicks++; }
    };
    const layout = { dataset: { fileShortcut: 'i' }, getClientRects: () => [] };
    const controller = new UnifiedUiController({
        ownerDocument: {
            querySelector: () => null,
            querySelectorAll: selector => selector === '[data-file-shortcut]' ? [image, layout] : []
        }, ownerWindow: {}
    });
    assert.deepEqual(controller.shortcutRows(), [['Open image', '⌘O'], ['Shortcuts', '?']]);
    const press = () => controller.handleKeydown({
        key: 'o', metaKey: true, target: { tagName: 'BODY' },
        preventDefault() {}, stopImmediatePropagation() {}
    });
    press();
    assert.equal(image.clicks, 1);
    image.disabled = true;
    press();
    assert.equal(image.clicks, 1);
    image.disabled = false;
    image.hidden = true;
    press();
    assert.equal(image.clicks, 1);
    assert.deepEqual(controller.shortcutRows(), [['Shortcuts', '?']]);
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
