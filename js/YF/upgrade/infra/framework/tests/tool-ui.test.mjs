import assert from 'node:assert/strict';
import test from 'node:test';
import { ToolUiController } from '../src/ui/ToolUiController.js';
import { UnifiedUiController } from '../src/ui/UnifiedUiController.js';

function harness() {
    const listeners = new Map(), buttons = new Map(), calls = [], errors = [];
    const dock = { dataset: {}, querySelector: () => buttons.get('png'), querySelectorAll: selector => selector === '[data-action-dock-extra]' ? [buttons.get('json')] : [] };
    for (const id of ['png', 'json', 'generateExport']) {
        const attrs = new Map(), handlers = new Map();
        const button = { textContent: id, dataset: {}, hidden: false, disabled: false,
            getAttribute: name => attrs.get(name) ?? null, setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name),
            closest: selector => selector === '.action-dock' && id !== 'generateExport' ? dock : null,
            addEventListener(type, listener) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(listener); },
            removeEventListener(type, listener) { handlers.get(type)?.delete(listener); },
            click() { return [...(handlers.get('click') || [])].map(listener => listener()).at(-1); }, focus() {} };
        buttons.set(id, button);
    }
    const document = { getElementById: id => buttons.get(id), querySelectorAll: selector => selector === '.action-dock' ? [dock] : [],
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
        removeEventListener(type, fn) { listeners.get(type)?.delete(fn); } };
    let resolve, reject;
    const options = { id: 'new-tool', title: 'New tool', ownerDocument: document, ownerWindow: { setTimeout: () => 1, clearTimeout() {} }, onError: error => errors.push(error), actions: [
        { id: 'png', button: 'png', label: 'PNG', kind: 'export', group: 'primary', shortcut: 'mod+e', run: () => { calls.push('png'); return new Promise((yes, no) => { resolve = yes; reject = no; }); } },
        { id: 'json', button: 'json', label: 'JSON', kind: 'export', group: 'extra', shortcut: 'mod+j', run: () => { calls.push('json'); } },
        { id: 'generate', button: 'generateExport', label: 'Generate', kind: 'command', group: 'panel', shortcut: 'space', run: () => { calls.push('generate'); } }
    ] };
    const make = () => { const ui = new ToolUiController(options); ui.ui.init = () => {}; ui.ui.destroy = () => {}; ui.ui.refreshSummaries = () => {}; return ui; };
    const ui = make().init();
    const key = (key, overrides = {}) => ({ key, target: { tagName: 'BODY' }, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...overrides });
    return { ui, make, options, key, listeners, buttons, calls, errors, document, resolve: value => resolve(value), reject: error => reject(error) };
}

test('one descriptor drives label, help and keyboard; rapid export gestures join one operation', async () => {
    const h = harness(), button = h.buttons.get('png');
    assert.equal(button.textContent, 'PNG ⌘E');
    assert.deepEqual(h.ui.shortcutRows()[0], ['PNG', '⌘E']);
    const pending = button.click();
    h.ui.handleKeydown(h.key('у', { code: 'KeyE', metaKey: true }));
    assert.equal(button.click(), pending);
    await Promise.resolve();
    assert.deepEqual(h.calls, ['png']);
    assert.equal(button.dataset.exportFeedbackState, 'working');
    h.resolve({ ok: true });
    assert.equal((await pending).status, 'success');
    assert.equal(button.disabled, false);
    h.ui.destroy();
});

test('failure is not success, and the same export can be retried immediately', async () => {
    const h = harness(), button = h.buttons.get('png');
    const failed = button.click(); await Promise.resolve(); h.reject(new Error('encoding failed'));
    assert.equal((await failed).status, 'error');
    assert.equal(h.errors.length, 1);
    const retried = button.click(); await Promise.resolve(); h.resolve({ ok: false, error: 'no artifact' });
    assert.equal((await retried).status, 'error');
    assert.equal(h.errors.length, 2);
    h.ui.destroy();
});

test('commands named generate/export never acquire export feedback', async () => {
    const h = harness();
    await h.buttons.get('generateExport').click();
    assert.deepEqual(h.calls, ['generate']);
    assert.equal(h.buttons.get('generateExport').dataset.exportFeedback, undefined);
    assert.equal(h.buttons.get('generateExport').dataset.exportFeedbackState, undefined);
    h.ui.destroy();
});

test('Russian J reveals extras; hidden JSON direct export stays usable', async () => {
    const h = harness();
    assert.equal(h.buttons.get('json').hidden, true);
    h.ui.handleKeydown(h.key('о', { code: 'KeyJ' }));
    assert.equal(h.buttons.get('json').hidden, false);
    h.ui.handleKeydown(h.key('Escape'));
    assert.equal(h.buttons.get('json').hidden, true);
    h.ui.handleKeydown(h.key('о', { code: 'KeyJ', ctrlKey: true }));
    await Promise.resolve();
    assert.deepEqual(h.calls, ['json']);
    h.ui.destroy();
});

test('typing, composition, repeats, modifiers, dialogs and disabled actions do not export', () => {
    const h = harness();
    for (const patch of [{ target: { tagName: 'INPUT' } }, { target: { isContentEditable: true } }, { isComposing: true }, { keyCode: 229 }, { repeat: true }, { defaultPrevented: true }, { altKey: true }, { shiftKey: true }]) {
        h.ui.handleKeydown(h.key('e', { metaKey: true, ...patch }));
    }
    h.buttons.get('png').disabled = true;
    h.ui.handleKeydown(h.key('e', { metaKey: true }));
    h.buttons.get('png').disabled = false;
    h.document.querySelectorAll = () => [{ getClientRects: () => [{}], closest: () => null }];
    h.ui.handleKeydown(h.key('e', { metaKey: true }));
    assert.deepEqual(h.calls, []);
    h.ui.destroy();
});

test('mode availability is checked at execution time, not only when the label refreshes', async () => {
    const h = harness(); h.ui.destroy();
    let available = true;
    h.options.actions[2].enabled = () => available;
    const ui = h.make().init();
    available = false;
    await h.buttons.get('generateExport').click();
    ui.handleKeydown(h.key(' ', { code: 'Space' }));
    assert.deepEqual(h.calls, []);
    ui.refresh();
    assert.equal(h.buttons.get('generateExport').disabled, true);
    available = true;
    ui.refresh();
    ui.handleKeydown(h.key(' ', { code: 'Space' }));
    assert.deepEqual(h.calls, ['generate']);
    ui.destroy();
});

test('replacement and repeated init leave one command listener and no late error feedback', async () => {
    const h = harness();
    h.ui.init();
    assert.equal(h.listeners.get('keydown').size, 1);
    const pending = h.buttons.get('png').click(); await Promise.resolve();
    const replacement = h.make().init();
    assert.equal(h.listeners.get('keydown').size, 1);
    h.reject(new Error('late failure')); await pending;
    assert.equal(h.errors.length, 0);
    await h.buttons.get('generateExport').click();
    assert.deepEqual(h.calls, ['png', 'generate']);
    replacement.destroy(); replacement.destroy();
    assert.equal(h.listeners.get('keydown').size, 0);
    assert.equal(h.buttons.get('generateExport').click(), undefined);
});

test('invalid, duplicate and browser-reserved commands fail before binding', () => {
    const h = harness(); h.ui.destroy();
    for (const shortcut of ['mod+0', 'mod+1', 'mod+\\', 'j', 'escape', '?']) {
        const options = { ...h.options, actions: [{ ...h.options.actions[0], shortcut }] };
        assert.throws(() => new ToolUiController(options), /Reserved/u);
    }
    assert.throws(() => new ToolUiController({ ...h.options, actions: [h.options.actions[0], { ...h.options.actions[1], shortcut: 'mod+e', group: 'primary' }] }), /Duplicate/u);
    assert.throws(() => new ToolUiController({ ...h.options, actions: [{ ...h.options.actions[2], group: 'primary' }] }), /must be exports/u);
    for (const shortcut of ['mod', 'mod+', 'e+j', 'esc']) {
        assert.throws(() => new ToolUiController({ ...h.options, actions: [{ ...h.options.actions[0], shortcut }] }), /key|Reserved/u);
    }
    assert.throws(() => new ToolUiController({ ...h.options, actions: [{ ...h.options.actions[0], enabled: true }] }), /callback/u);
    const aliases = new ToolUiController({ ...h.options, actions: [h.options.actions[0], { ...h.options.actions[1], button: h.buttons.get('png') }] });
    assert.throws(() => aliases.init(), /different button/u);
});

test('profile identity and summaries do not require an app-name branch in the framework', () => {
    const target = { textContent: '', removeAttribute() {} };
    const document = { getElementById: () => ({ querySelector: () => target }), querySelectorAll: () => [] };
    const ui = new UnifiedUiController({ ownerDocument: document, ownerWindow: {}, profile: { id: 'unlisted-tool', title: 'Unlisted tool', summaries: { shapePanel: () => '8 rays' }, shortcuts: () => [['Regenerate', 'Space']] } });
    assert.equal(ui.detectTool(), 'unlisted-tool');
    ui.refreshSummaries();
    assert.equal(target.textContent, '8 rays');
    assert.deepEqual(ui.shortcutRows(), [['Regenerate', 'Space'], ['Shortcuts', '?']]);
    assert.deepEqual(ui.exportButtons(), []);
});
