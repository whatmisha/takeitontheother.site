import assert from 'node:assert/strict';
import test from 'node:test';

import {
    AnimationExporter,
    animationResultBlob
} from '../src/export/animationExporter.js';

test('animation exporter reuses a worker-built Blob without copying it', () => {
    const workerBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/zip' });
    assert.equal(animationResultBlob({ blob: workerBlob }), workerBlob);
    const fallback = animationResultBlob({
        data: new Uint8Array([4, 5]).buffer,
        mimeType: 'video/mp4'
    });
    assert.equal(fallback.type, 'video/mp4');
    assert.equal(fallback.size, 2);
});

test('animation exporter transfers a manually edited path to its worker', async () => {
    const OriginalWorker = globalThis.Worker;
    let worker = null;
    globalThis.Worker = class FakeWorker {
        constructor() {
            this.listeners = new Map();
            worker = this;
        }

        addEventListener(type, callback) {
            this.listeners.set(type, callback);
        }

        postMessage(message) {
            this.message = message;
        }

        terminate() {}
    };
    const motionPath = { version: 1, segments: [{ start: { x: 1, y: 2 } }] };
    const exporter = new AnimationExporter();

    try {
        const pending = exporter.export({
            format: 'mp4',
            settings: { motionDuration: 1 },
            startFocus: { x: 240, y: 240 },
            motionPath,
            baseName: 'edited-path'
        });
        assert.equal(worker.message.motionPath, motionPath);
        exporter.cancel();
        await assert.rejects(pending, { name: 'AbortError' });
    } finally {
        if (OriginalWorker === undefined) delete globalThis.Worker;
        else globalThis.Worker = OriginalWorker;
    }
});

test('animation exporter morphs both actions into one progress surface', () => {
    const classes = new Set();
    const container = {
        classList: {
            toggle(name, active) {
                if (active) classes.add(name);
                else classes.delete(name);
            }
        }
    };
    const properties = new Map();
    const status = {
        hidden: true,
        dataset: {},
        style: { setProperty: (name, value) => properties.set(name, value) }
    };
    const progress = { max: 1, value: 0 };
    const message = { textContent: '' };
    const cancelButton = { hidden: false, addEventListener() {} };
    const exportButtons = [{ disabled: false }, { disabled: false }];
    const exporter = new AnimationExporter({
        container,
        status,
        progress,
        message,
        cancelButton,
        exportButtons
    });

    exporter.setBusy(true);
    exporter.updateProgress(25, 100, 'Encoding frame 25 of 100');
    assert.equal(classes.has('is-exporting'), true);
    assert.equal(status.hidden, false);
    assert.equal(status.dataset.state, 'working');
    assert.equal(properties.get('--sparky-export-progress'), '25%');
    assert.equal(message.textContent, 'Encoding frame 25 of 100');
    assert.ok(exportButtons.every((button) => button.disabled));

    exporter.showComplete(100);
    assert.equal(status.dataset.state, 'complete');
    assert.equal(message.textContent, 'Done');
    assert.equal(cancelButton.hidden, true);
    assert.equal(properties.get('--sparky-export-progress'), '100%');
    exporter.clearRestoreTimer();
});
