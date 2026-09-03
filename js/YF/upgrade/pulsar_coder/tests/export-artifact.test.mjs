import assert from 'node:assert/strict';
import test from 'node:test';

import { createPulsarSvgArtifact, downloadPulsarSvg } from '../js/export/PulsarSvgExport.js';

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
