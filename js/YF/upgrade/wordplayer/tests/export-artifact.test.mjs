import assert from 'node:assert/strict';
import test from 'node:test';

import { WordplayerExporter } from '../src/export/exporters.js';

function installDownloadHarness({ pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) } = {}) {
    const originals = {
        document: globalThis.document,
        URL: globalThis.URL,
        setTimeout: globalThis.setTimeout
    };
    const downloads = [];
    const canvases = [];

    globalThis.URL = {
        createObjectURL(blob) {
            const download = { blob, filename: '', revoked: false };
            downloads.push(download);
            return `blob:wordplayer-${downloads.length - 1}`;
        },
        revokeObjectURL(url) {
            const index = Number(url.split('-').at(-1));
            if (downloads[index]) downloads[index].revoked = true;
        }
    };
    globalThis.setTimeout = callback => {
        callback();
        return 0;
    };
    globalThis.document = {
        body: { appendChild() {} },
        createElement(tagName) {
            if (tagName === 'a') {
                return {
                    href: '',
                    download: '',
                    click() {
                        const index = Number(this.href.split('-').at(-1));
                        downloads[index].filename = this.download;
                    },
                    remove() {}
                };
            }
            assert.equal(tagName, 'canvas');
            const context = {
                save() {}, restore() {}, fillRect() {}, fillText() {},
                setTransform() {}, translate() {}, rotate() {}
            };
            const canvas = {
                width: 0,
                height: 0,
                getContext(type) {
                    assert.equal(type, '2d');
                    return context;
                },
                toBlob(callback, type) {
                    assert.equal(type, 'image/png');
                    callback(new Blob([pngBytes], { type }));
                }
            };
            canvases.push(canvas);
            return canvas;
        }
    };

    return {
        downloads,
        canvases,
        restore() {
            globalThis.document = originals.document;
            globalThis.URL = originals.URL;
            globalThis.setTimeout = originals.setTimeout;
        }
    };
}

test('Wordplayer curved SVG export emits a clean, sized vector artifact', async () => {
    const harness = installDownloadHarness();
    try {
        const exporter = new WordplayerExporter();
        const font = {
            unitsPerEm: 1000,
            ascender: 800,
            descender: -200,
            charToGlyph: char => ({
                advanceWidth: char === 'A' ? 600 : 500,
                getPath: () => ({ toPathData: () => 'M0 0L10 0L5 12Z' })
            })
        };
        exporter.loadFont = async weight => {
            exporter.fonts.set(weight, font);
            return font;
        };

        await exporter.exportCurvedSvg({
            width: 640,
            height: 360,
            bgColor: '#fff&"',
            glyphs: [{
                char: 'A', weight: 400, size: 50, baseline: 'middle',
                fill: '#123&"', x: 100, y: 80, rotation: 12
            }]
        });

        assert.equal(harness.downloads.length, 1);
        const [download] = harness.downloads;
        assert.equal(download.filename, 'wordplayer-curves.svg');
        assert.equal(download.blob.type, 'image/svg+xml;charset=utf-8');
        const text = await download.blob.text();
        assert.match(text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="640" height="360" viewBox="0 0 640 360">/u);
        assert.match(text, /fill="#fff&amp;&quot;"/u);
        assert.match(text, /<path d="M0 0L10 0L5 12Z" fill="#123&amp;&quot;"/u);
        assert.match(text, /translate\(100\.000 80\.000\) rotate\(12\.000\)/u);
        assert.match(text, /<\/svg>$/u);
        assert.equal(download.revoked, true);
    } finally {
        harness.restore();
    }
});

test('Wordplayer PNG export preserves scale, MIME, signature and filename', async () => {
    const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const harness = installDownloadHarness({ pngBytes: signature });
    try {
        const exporter = new WordplayerExporter();
        await exporter.exportPng({ width: 320, height: 180, bgColor: '#fff', glyphs: [] }, {
            scale: 3,
            transparent: true
        });

        assert.equal(harness.canvases.length, 1);
        assert.deepEqual(
            { width: harness.canvases[0].width, height: harness.canvases[0].height },
            { width: 960, height: 540 }
        );
        assert.equal(harness.downloads.length, 1);
        const [download] = harness.downloads;
        assert.equal(download.filename, 'wordplayer.png');
        assert.equal(download.blob.type, 'image/png');
        assert.deepEqual(new Uint8Array(await download.blob.arrayBuffer()), signature);
        assert.equal(download.revoked, true);
    } finally {
        harness.restore();
    }
});
