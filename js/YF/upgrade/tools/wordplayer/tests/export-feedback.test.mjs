import assert from 'node:assert/strict';
import test from 'node:test';
import { WordplayerUI } from '../src/ui/controls.js';
import { ExportFeedbackController } from '../../../framework/src/index.js';

function fixture() {
    const originalDocument = globalThis.document, originalWindow = globalThis.window;
    const elements = new Map(), errors = [], calls = [], timers = new Map();
    for (const id of ['exportPngBtn', 'exportSvgBtn']) {
        const attrs = new Map(), listeners = new Map();
        elements.set(id, {
            dataset: {}, disabled: false,
            getAttribute: key => attrs.get(key) ?? null,
            setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key),
            addEventListener: (type, listener) => listeners.set(type, listener), click: () => listeners.get('click')()
        });
        elements.set(`${id}Status`, { textContent: '' });
    }
    globalThis.document = { getElementById: id => elements.get(id) };
    globalThis.window = { setTimeout: fn => { timers.set(fn, fn); return fn; }, clearTimeout: id => timers.delete(id) };
    const scene = { width: 12, height: 8, glyphs: [] };
    let resolve, reject;
    const operation = (...args) => { calls.push(args); return new Promise((yes, no) => { resolve = yes; reject = no; }); };
    const ui = new WordplayerUI({ exporter: { exportPng: operation, exportCurvedSvg: operation }, getScene: () => scene, ExportFeedbackController });
    ui.showExportError = (_app, title, error) => errors.push({ title, error });
    const app = { settings: { exportTransparent: true } };
    ui.bindExportActions(app);
    ui.bindExportActions(app);
    return {
        elements, errors, calls, ui, scene, resolve: value => resolve(value), reject: error => reject(error),
        restore() { globalThis.document = originalDocument; globalThis.window = originalWindow; }
    };
}

for (const [id, name] of [['exportPngBtn', 'png'], ['exportSvgBtn', 'curves']]) {
    test(`Wordplayer ${name} waits, joins repeats, reports failure and permits retry`, async () => {
        const h = fixture();
        try {
            const button = h.elements.get(id);
            assert.equal(button.dataset.exportFeedbackState, undefined);
            const pending = button.click();
            assert.equal(button.click(), pending);
            await Promise.resolve();
            assert.equal(h.calls.length, 1);
            assert.equal(button.dataset.exportFeedbackState, 'working');
            assert.equal(h.calls[0][0], h.scene);
            if (name === 'png') assert.deepEqual(h.calls[0][1], { transparent: true, scale: 3 });
            h.reject(new Error('encode failed'));
            assert.equal((await pending).status, 'error');
            assert.equal(button.dataset.exportFeedbackState, 'error');
            assert.equal(h.errors.length, 1);
            assert.equal(window.wordplayerLastAction, `${name}-export-error`);
            const retry = button.click();
            await Promise.resolve();
            h.resolve('artifact');
            assert.equal((await retry).status, 'success');
            assert.equal(window.wordplayerLastAction, `${name}-export-complete`);
            assert.equal(h.calls.length, 2);
            button.disabled = true;
            assert.equal((await button.click()).status, 'unavailable');
            assert.equal(h.calls.length, 2);
        } finally { h.restore(); }
    });
}

test('Wordplayer empty scene is an error, not a completed export', async () => {
    const h = fixture();
    try {
        h.ui.getScene = () => null;
        assert.equal((await h.elements.get('exportSvgBtn').click()).status, 'error');
        assert.equal(h.calls.length, 0);
        assert.equal(h.errors.length, 1);
    } finally { h.restore(); }
});
