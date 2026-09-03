import assert from 'node:assert/strict';
import test from 'node:test';

import { createWanderSvgArtifact, downloadWanderSvg } from '../js/export/WanderSvgExport.js';

function fixture() {
    const boundary = { removed: false, remove() { this.removed = true; } };
    const clone = { querySelector: selector => selector === '.area-boundary' ? boundary : null };
    const source = { cloneNode: deep => (assert.equal(deep, true), clone) };
    class Serializer {
        serializeToString(element) {
            assert.equal(element, clone);
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><path d="M0 0L1 1"/>${boundary.removed ? '' : '<rect class="area-boundary"/>'}</svg>`;
        }
    }
    return { boundary, source, Serializer };
}

test('Wander export removes its area boundary and keeps SVG geometry', async () => {
    const svg = fixture();
    const artifact = createWanderSvgArtifact(svg.source, { rays: 3, Serializer: svg.Serializer });
    assert.equal(artifact.filename, 'wander-bender-3-rays.svg');
    assert.equal(artifact.mimeType, 'image/svg+xml');
    assert.equal(artifact.blob.type, 'image/svg+xml');
    assert.match(artifact.content, /viewBox="0 0 1280 720"/u);
    assert.doesNotMatch(artifact.content, /area-boundary/u);
    assert.equal(await artifact.blob.text(), artifact.content);
});

test('Wander download uses the generated filename and revokes its Blob URL', () => {
    const svg = fixture();
    const links = [];
    const revoked = [];
    const documentRef = {
        createElement(tagName) {
            assert.equal(tagName, 'a');
            const link = { href: '', download: '', clicked: false, click() { this.clicked = true; } };
            links.push(link);
            return link;
        }
    };
    const URLRef = {
        createObjectURL: blob => (assert.equal(blob.type, 'image/svg+xml'), 'blob:wander'),
        revokeObjectURL: url => revoked.push(url)
    };
    const artifact = downloadWanderSvg(svg.source, {
        rays: 24,
        documentRef,
        URLRef,
        Serializer: svg.Serializer
    });
    assert.equal(artifact.filename, 'wander-bender-24-rays.svg');
    assert.deepEqual(links[0], {
        href: 'blob:wander', download: 'wander-bender-24-rays.svg', clicked: true, click: links[0].click
    });
    assert.deepEqual(revoked, ['blob:wander']);
});
