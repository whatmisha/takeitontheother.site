import assert from 'node:assert/strict';
import test from 'node:test';
import { ExportFeedbackController } from '../src/ui/ExportFeedbackController.js';
import { UnifiedUiController } from '../src/ui/UnifiedUiController.js';

function fixture() {
    const attributes = new Map();
    const timers = new Map();
    let nextId = 0;
    const button = {
        disabled: false, dataset: {},
        getAttribute: key => attributes.get(key) ?? null,
        setAttribute: (key, value) => attributes.set(key, value),
        removeAttribute: key => attributes.delete(key)
    };
    const status = { textContent: '' };
    const ownerWindow = {
        setTimeout(callback, delay) { timers.set(++nextId, { callback, delay }); return nextId; },
        clearTimeout: id => timers.delete(id)
    };
    return { button, status, timers, ownerWindow, controller: new ExportFeedbackController({ button, status, ownerWindow }) };
}

test('disabled is unavailable, not working or successful', async () => {
    const { button, controller, status } = fixture();
    button.disabled = true;
    assert.equal((await controller.run(() => assert.fail('must not run'))).status, 'unavailable');
    button.disabled = false;
    assert.equal(button.dataset.exportFeedbackState, undefined);
    assert.equal(status.textContent, '');
});

test('feedback waits for the artifact, joins repeated gestures and allows quick retry', async () => {
    const { button, controller, status, timers } = fixture();
    let finish, calls = 0;
    const artifact = new Promise(resolve => { finish = resolve; });
    const pending = controller.run(() => { calls++; return artifact; });
    assert.equal(button.dataset.exportFeedbackState, 'working');
    assert.equal(button.getAttribute('aria-busy'), 'true');
    assert.equal(controller.run(() => assert.fail('duplicate export')), pending);
    await Promise.resolve();
    assert.equal(calls, 1);
    assert.equal(status.textContent, 'Exporting…');
    finish({ filename: 'test.png' });
    assert.deepEqual(await pending, { status: 'success', value: { filename: 'test.png' } });
    assert.equal(button.dataset.exportFeedbackState, 'success');
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute('aria-busy'), null);
    assert.equal([...timers.values()][0].delay, 620);
    await controller.run(() => ++calls);
    assert.equal(calls, 2);
    assert.equal(timers.size, 1);
    [...timers.values()][0].callback();
    assert.equal(button.dataset.exportFeedbackState, undefined);
    assert.equal(button.dataset.exportFeedbackMessage, 'Done', 'Keep the overlay text while opacity fades out');
});

test('sync throws and async rejection become errors, never a transient success', async () => {
    for (const run of [() => { throw new Error('encoder'); }, () => Promise.reject(new Error('encoder'))]) {
        const { button, controller, status, timers } = fixture();
        const result = await controller.run(run);
        assert.equal(result.status, 'error');
        assert.equal(button.dataset.exportFeedbackState, 'error');
        assert.equal(status.textContent, 'Export failed. encoder');
        assert.equal([...timers.values()][0].delay, 2200);
        assert.equal((await controller.run(() => 'retry')).status, 'success');
    }
});

test('destroy prevents late completion from reviving feedback', async () => {
    const { button, controller, status, timers } = fixture();
    let finish;
    const artifact = new Promise(resolve => { finish = resolve; });
    const pending = controller.run(() => artifact);
    controller.destroy();
    finish('done');
    await pending;
    assert.equal(button.dataset.exportFeedbackState, undefined);
    assert.equal(status.textContent, '');
    assert.equal(timers.size, 0);
});

test('legacy DOM observer and capture-click feedback cannot overwrite explicit ownership', () => {
    const { button, ownerWindow } = fixture();
    const legacy = new UnifiedUiController({ ownerDocument: {}, ownerWindow });
    legacy.exportButtons = () => [button];
    for (const disabled of [true, false]) {
        button.disabled = disabled;
        legacy.syncExportStates();
        legacy.showExportFeedback(button);
        assert.equal(button.dataset.exportFeedbackState, undefined);
    }
    button.dataset.exportFeedbackState = 'error';
    legacy.showExportFeedback(button);
    assert.equal(button.dataset.exportFeedbackState, 'error');
});
