import assert from 'node:assert/strict';
import test from 'node:test';
import { ApplicationShell } from '../src/core/ApplicationShell.js';

function harness() {
    const originals = Object.fromEntries(['document', 'Image', 'URL', 'setTimeout'].map(key => [key, globalThis[key]]));
    const downloads = [], revoked = [], links = [], images = [], canvases = [];
    globalThis.URL = {
        createObjectURL: blob => { downloads.push(blob); return `blob:${downloads.length}`; },
        revokeObjectURL: url => revoked.push(url)
    };
    globalThis.Image = class {
        constructor() { images.push(this); }
        set src(value) { this.url = value; }
    };
    globalThis.setTimeout = callback => { queueMicrotask(callback); return 1; };
    globalThis.document = {
        body: { appendChild() {} },
        createElement(tag) {
            if (tag === 'a') {
                const link = { click() { this.clicked = true; }, remove() { this.removed = true; } };
                links.push(link);
                return link;
            }
            assert.equal(tag, 'canvas');
            const canvas = {
                getContext: () => ({ setTransform() {}, drawImage() {} }),
                toBlob(callback, type) { this.finish = callback; assert.equal(type, 'image/png'); }
            };
            canvases.push(canvas);
            return canvas;
        }
    };
    const app = Object.create(ApplicationShell.prototype);
    Object.assign(app, {
        config: { export: { filename: 'test.svg' } },
        target: { type: 'canvas', element: {} }, _logicalSize: () => ({ width: 20, height: 10 }),
        _activeOperations: new Map(), _operationController: new AbortController(),
        _ownedObjectUrls: new Set(), _ownedTimeouts: new Set()
    });
    return {
        app, downloads, revoked, links, images, canvases,
        restore() {
            for (const [key, value] of Object.entries(originals)) {
                if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
            }
        }
    };
}

test('shared canvas PNG waits for encoding and preserves scale, type and name', async () => {
    const h = harness();
    try {
        let complete = false;
        const pending = h.app.exportPNG(undefined, 3).then(() => { complete = true; });
        await Promise.resolve();
        assert.equal(complete, false);
        assert.equal(h.downloads.length, 0);
        assert.equal(h.canvases[0].width, 60);
        assert.equal(h.canvases[0].height, 30);
        const png = new Blob(['png'], { type: 'image/png' });
        h.canvases[0].finish(png);
        await pending;
        assert.equal(h.downloads[0], png);
        assert.equal(h.links[0].download, 'test.png');
        assert.equal(h.links[0].clicked, true);
        assert.deepEqual(h.revoked, ['blob:1']);
    } finally { h.restore(); }
});

test('shared SVG rasterization also waits for PNG and releases the intermediate URL', async () => {
    const h = harness();
    try {
        const pending = h.app._rasterizeSVG('<svg/>', 90, 60, 'svg.png');
        await Promise.resolve();
        h.images[0].onload();
        await Promise.resolve();
        assert.equal(h.links.length, 0);
        assert.equal(h.canvases[0].width, 90);
        h.canvases[0].finish(new Blob(['png']));
        await pending;
        assert.equal(h.links[0].download, 'svg.png');
        assert.deepEqual(h.revoked, ['blob:2', 'blob:1']);
    } finally { h.restore(); }
});

test('null PNG, encoder throws and download failure reject instead of succeeding', async () => {
    const h = harness();
    try {
        await assert.rejects(h.app._downloadCanvasPNG({ toBlob: cb => cb(null) }, 'none.png'), /empty file/);
        await assert.rejects(h.app._downloadCanvasPNG({ toBlob() { throw new Error('encoder'); } }, 'none.png'), /encoder/);
        const originalCreate = document.createElement;
        document.createElement = tag => {
            const link = originalCreate(tag);
            link.click = () => { throw new Error('download'); };
            return link;
        };
        await assert.rejects(h.app._downloadCanvasPNG({ toBlob: cb => cb(new Blob(['png'])) }, 'bad.png'), /download/);
        assert.equal(h.links[0].removed, true);
        assert.deepEqual(h.revoked, ['blob:1']);
    } finally { h.restore(); }
});

test('SVG decode failure rejects and releases its URL without creating a download', async () => {
    const h = harness();
    try {
        const pending = h.app._rasterizeSVG('<broken/>', 20, 20, 'bad.png');
        await Promise.resolve();
        h.images[0].onerror();
        await assert.rejects(pending, /Could not render SVG/);
        assert.equal(h.links.length, 0);
        assert.deepEqual(h.revoked, ['blob:1']);
    } finally { h.restore(); }
});
