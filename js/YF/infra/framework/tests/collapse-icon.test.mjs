import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { createCollapseButton } from '../src/ui/GeneratorHost.js';

test('generator collapse button uses the canonical accessible vector chevron', async () => {
    const element = (tag, namespace = null) => ({
        tag, namespace, attributes: {}, children: [],
        setAttribute(name, value) { this.attributes[name] = value; },
        append(child) { this.children.push(child); }
    });
    const button = createCollapseButton({
        createElement: tag => element(tag),
        createElementNS: (namespace, tag) => element(tag, namespace)
    });
    assert.equal(button.tag, 'button');
    assert.equal(button.type, 'button');
    assert.equal(button.className, 'collapse-icon');
    assert.deepEqual(button.attributes, { 'aria-label': 'Collapse panel', 'aria-expanded': 'true' });
    assert.equal(button.children.length, 1);
    const svg = button.children[0], path = svg.children[0];
    assert.equal(svg.tag, 'svg');
    assert.equal(svg.namespace, 'http://www.w3.org/2000/svg');
    assert.deepEqual(svg.attributes, { width: '10', height: '6', viewBox: '0 0 12 8', fill: 'none', 'aria-hidden': 'true', focusable: 'false' });
    assert.equal(svg.children.length, 1);
    assert.equal(path.tag, 'path');
    assert.equal(path.namespace, svg.namespace);
    assert.deepEqual(path.attributes, { d: 'M1 1L6 6L11 1', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    for (const tool of ['sparky', 'wordplayer']) {
        const reference = await readFile(new URL(`../../../${tool}/index.html`, import.meta.url), 'utf8');
        assert.ok(reference.includes('width="10" height="6" viewBox="0 0 12 8"'));
        assert.ok(reference.includes(`d="${path.attributes.d}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`));
    }
    const host = await readFile(new URL('../src/ui/GeneratorHost.js', import.meta.url), 'utf8');
    assert.match(host, /const collapse = createCollapseButton\(\)/);
});

test('working framework and demos cannot reintroduce the font-dependent collapse glyph', async () => {
    let checked = 0;
    async function scan(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
            if (entry.isDirectory()) await scan(file);
            else if (/\.(?:js|html|css)$/.test(entry.name)) {
                assert.doesNotMatch(await readFile(file, 'utf8'), /\u2304/u, file.pathname);
                checked++;
            }
        }
    }
    // Immutable upstream-v3 provenance is not the working runtime.
    for (const folder of ['src', 'css', 'demo', 'demo-canvas', 'component-lab']) await scan(new URL(`../${folder}/`, import.meta.url));
    assert.ok(checked >= 51);
});
