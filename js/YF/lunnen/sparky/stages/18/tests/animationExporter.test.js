import assert from 'node:assert/strict';
import test from 'node:test';

import { AnimationExporter } from '../src/export/animationExporter.js';

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
