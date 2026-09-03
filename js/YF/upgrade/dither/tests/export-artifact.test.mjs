import assert from 'node:assert/strict';
import test from 'node:test';

await import('../js/export/DitherPngExport.js');
const contract = globalThis.DitherPngExport;

test('Dither export resolves 1x/2x/4x/8x dimensions deterministically', () => {
    assert.deepEqual(contract.resolveDimensions(320, 180, {}), { width: 320, height: 180, scale: 1 });
    assert.deepEqual(contract.resolveDimensions(320, 180, { export2x: true }), { width: 640, height: 360, scale: 2 });
    assert.deepEqual(contract.resolveDimensions(320, 180, { export4x: true }), { width: 1280, height: 720, scale: 4 });
    assert.deepEqual(contract.resolveDimensions(320, 180, { export8x: true }), { width: 2560, height: 1440, scale: 8 });
    assert.equal(contract.resolveScale({ export8x: true, export4x: true, export2x: true }), 8);
});

test('Dither PNG download keeps MIME, signature, filename and delayed cleanup', async () => {
    const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const blob = new Blob([signature], { type: 'image/png' });
    const links = [];
    const revoked = [];
    const delays = [];
    const canvas = {
        toBlob(callback, mimeType) {
            assert.equal(mimeType, 'image/png');
            callback(blob);
        }
    };
    const documentRef = {
        body: { appendChild() {}, removeChild() {} },
        createElement(tagName) {
            assert.equal(tagName, 'a');
            const link = { href: '', download: '', clicks: 0, click() { this.clicks += 1; } };
            links.push(link);
            return link;
        }
    };
    const artifact = await contract.downloadCanvas(canvas, {
        documentRef,
        URLRef: {
            createObjectURL: value => (assert.equal(value, blob), 'blob:dither'),
            revokeObjectURL: url => revoked.push(url)
        },
        timeout(callback, delay) {
            delays.push(delay);
            callback();
        }
    });

    assert.equal(artifact.filename, 'dithered-image.png');
    assert.equal(artifact.mimeType, 'image/png');
    assert.deepEqual(new Uint8Array(await artifact.blob.arrayBuffer()), signature);
    assert.equal(links[0].download, 'dithered-image.png');
    assert.equal(links[0].clicks, 1);
    assert.deepEqual(delays, [100]);
    assert.deepEqual(revoked, ['blob:dither']);
});

test('Dither PNG download handles an encoder returning no Blob', async () => {
    const artifact = await contract.downloadCanvas({
        toBlob(callback, mimeType) {
            assert.equal(mimeType, 'image/png');
            callback(null);
        }
    });
    assert.equal(artifact, null);
});
