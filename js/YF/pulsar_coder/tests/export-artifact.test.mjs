import assert from 'node:assert/strict';
import test from 'node:test';

import { createPulsarSvgArtifact, downloadPulsarSvg } from '../js/export/PulsarSvgExport.js';
import { createPulsarPngArtifact, downloadPulsarPng, rasterizePulsarSvg } from '../js/export/PulsarPngExport.js';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 720"><path d="M1 2L3 4"/></svg>';

test('Pulsar export preserves the generated SVG and deterministic filename contract', async () => {
    const artifact = createPulsarSvgArtifact(SVG, { timestamp: 123456789 });
    assert.equal(artifact.filename, 'pulsar-code-123456789.svg');
    assert.equal(artifact.mimeType, 'image/svg+xml');
    assert.equal(artifact.blob.type, 'image/svg+xml');
    assert.equal(artifact.content, SVG);
    assert.equal(await artifact.blob.text(), SVG);
    assert.throws(() => createPulsarSvgArtifact('not svg'), /Pulsar SVG is required/u);
});

test('Pulsar download clicks once and always revokes the generated Blob URL', () => {
    const links = [];
    const revoked = [];
    const artifact = downloadPulsarSvg(SVG, {
        timestamp: 42,
        documentRef: {
            createElement(tagName) {
                assert.equal(tagName, 'a');
                const link = { href: '', download: '', clicks: 0, click() { this.clicks += 1; } };
                links.push(link);
                return link;
            }
        },
        URLRef: {
            createObjectURL: blob => (assert.equal(blob.type, 'image/svg+xml'), 'blob:pulsar'),
            revokeObjectURL: url => revoked.push(url)
        }
    });
    assert.equal(artifact.filename, 'pulsar-code-42.svg');
    assert.equal(links[0].download, 'pulsar-code-42.svg');
    assert.equal(links[0].href, 'blob:pulsar');
    assert.equal(links[0].clicks, 1);
    assert.deepEqual(revoked, ['blob:pulsar']);
});

test('Pulsar PNG export preserves raster dimensions and download cleanup', async () => {
    const pngBlob = new Blob(['png'], { type: 'image/png' });
    const rasterize = async svg => {
        assert.equal(svg, SVG);
        return { blob: pngBlob, width: 1800, height: 1296 };
    };
    const artifact = await createPulsarPngArtifact(SVG, { timestamp: 77, rasterize });
    assert.equal(artifact.filename, 'pulsar-code-77.png');
    assert.equal(artifact.mimeType, 'image/png');
    assert.equal(artifact.blob, pngBlob);
    assert.equal(artifact.width, 1800);
    assert.equal(artifact.height, 1296);
    await assert.rejects(createPulsarPngArtifact('not svg', { rasterize }), /Pulsar SVG is required/u);

    const links = [];
    const revoked = [];
    const downloaded = await downloadPulsarPng(SVG, {
        timestamp: 78,
        rasterize,
        documentRef: {
            createElement(tagName) {
                assert.equal(tagName, 'a');
                const link = { href: '', download: '', clicks: 0, click() { this.clicks += 1; } };
                links.push(link);
                return link;
            }
        },
        URLRef: {
            createObjectURL: blob => (assert.equal(blob, pngBlob), 'blob:pulsar-png'),
            revokeObjectURL: url => revoked.push(url)
        }
    });
    assert.equal(downloaded.filename, 'pulsar-code-78.png');
    assert.equal(links[0].download, 'pulsar-code-78.png');
    assert.equal(links[0].clicks, 1);
    assert.deepEqual(revoked, ['blob:pulsar-png']);
});

test('Pulsar SVG rasterizer sizes the canvas from viewBox and releases its source URL', async () => {
    const revoked = [];
    const calls = [];
    const canvas = {
        width: 0,
        height: 0,
        getContext() {
            return {
                clearRect: (...args) => calls.push(['clearRect', ...args]),
                drawImage: (...args) => calls.push(['drawImage', ...args.slice(1)])
            };
        },
        toBlob(callback, type) {
            callback(new Blob(['png'], { type }));
        }
    };
    class FakeImage {
        set src(value) {
            assert.equal(value, 'blob:pulsar-source');
            this.onload();
        }
    }
    const rendered = await rasterizePulsarSvg(SVG, {
        maxDimension: 1800,
        documentRef: { createElement: tag => (assert.equal(tag, 'canvas'), canvas) },
        URLRef: {
            createObjectURL: blob => (assert.equal(blob.type, 'image/svg+xml'), 'blob:pulsar-source'),
            revokeObjectURL: url => revoked.push(url)
        },
        ImageClass: FakeImage
    });
    assert.equal(rendered.width, 1800);
    assert.equal(rendered.height, 1296);
    assert.equal(rendered.blob.type, 'image/png');
    assert.deepEqual(calls[0], ['clearRect', 0, 0, 1800, 1296]);
    assert.deepEqual(calls[1].slice(0, 1), ['drawImage']);
    assert.deepEqual(revoked, ['blob:pulsar-source']);
});
