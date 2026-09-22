import assert from 'node:assert/strict';
import test from 'node:test';
import { bindKeyboarderExportActions } from '../app/export-actions.js';
import { ExportFeedbackController } from '../../framework/src/index.js';

function fixture() {
    const originalWindow = globalThis.window;
    globalThis.window = { setTimeout: () => 1, clearTimeout() {} };
    const buttons = new Map(), errors = [], calls = [];
    for (const id of ['exportSvgBtn', 'exportPngBtn', 'exportPdfBtn', 'exportJsonBtn']) {
        const attrs = new Map(), listeners = new Map();
        buttons.set(id, {
            dataset: {}, disabled: false,
            getAttribute: key => attrs.get(key) ?? null,
            setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key),
            addEventListener: (type, fn) => listeners.set(type, fn),
            removeEventListener: type => listeners.delete(type), click: () => listeners.get('click')?.()
        });
        buttons.set(`${id}Status`, { textContent: '' });
    }
    let resolve, reject;
    const operation = format => { calls.push(format); return new Promise((yes, no) => { resolve = yes; reject = no; }); };
    const app = {
        exporter: {}, target: { type: 'svg' }, dialog: { alert: options => errors.push(options) },
        exportSVG: () => operation('SVG'), exportPNG: () => operation('PNG'), exportPDF: () => operation('PDF')
    };
    const binding = bindKeyboarderExportActions({
        app, ExportFeedbackController, exportJSON: () => operation('JSON'),
        ownerDocument: { getElementById: id => buttons.get(id) }
    });
    return {
        app, binding, buttons, errors, calls, resolve: value => resolve(value), reject: error => reject(error),
        restore() { binding.destroy(); globalThis.window = originalWindow; }
    };
}

for (const [id, format] of [['exportSvgBtn', 'SVG'], ['exportPngBtn', 'PNG'], ['exportPdfBtn', 'PDF'], ['exportJsonBtn', 'JSON']]) {
    test(`Keyboarder ${format} waits for its operation, joins repeat clicks and permits retry`, async () => {
        const h = fixture();
        try {
            const button = h.buttons.get(id);
            assert.equal(button.dataset.exportFeedbackState, undefined);
            const pending = button.click();
            assert.equal(button.click(), pending);
            await Promise.resolve();
            assert.deepEqual(h.calls, [format]);
            assert.equal(button.dataset.exportFeedbackState, 'working');
            h.reject(new Error('broken export'));
            assert.equal((await pending).status, 'error');
            assert.equal(button.dataset.exportFeedbackState, 'error');
            assert.equal(h.errors.length, 1);
            const retry = button.click();
            await Promise.resolve();
            h.resolve(format === 'PDF' ? { ok: true } : undefined);
            assert.equal((await retry).status, 'success');
            assert.equal(button.disabled, false);
            button.disabled = true;
            assert.equal((await button.click()).status, 'unavailable');
            assert.deepEqual(h.calls, [format, format]);
        } finally { h.restore(); }
    });
}

test('Keyboarder normalizes handled PDF errors and missing results without false Done', async () => {
    const h = fixture();
    try {
        const button = h.buttons.get('exportPdfBtn');
        const pending = button.click();
        await Promise.resolve();
        h.resolve({ ok: false, reported: true, error: 'font missing' });
        assert.equal((await pending).status, 'error');
        assert.equal(h.errors.length, 0, 'The original PDF dialog has already reported this error');
        const retry = button.click();
        await Promise.resolve();
        h.resolve(undefined);
        assert.equal((await retry).status, 'error');
        assert.equal(h.errors.length, 1);
    } finally { h.restore(); }
});

test('Keyboarder does not execute an unready exporter and destroy removes click bindings', async () => {
    const h = fixture();
    try {
        h.app.exporter = null;
        const button = h.buttons.get('exportSvgBtn');
        assert.equal((await button.click()).status, 'error');
        assert.deepEqual(h.calls, []);
        h.binding.destroy();
        assert.equal(button.click(), undefined);
        assert.equal(button.dataset.exportFeedbackState, undefined);
    } finally { h.restore(); }
});
