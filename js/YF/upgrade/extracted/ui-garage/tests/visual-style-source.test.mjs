import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const surfaces = [
    'component-lab/index.html',
    'starters/svg-full/index.html',
    'starters/canvas-full/index.html',
    'tests/clean-room-ribbon-field/index.html'
];

test('portable surfaces use the canonical vector chrome icons', async () => {
    for (const relativePath of surfaces) {
        const html = await readFile(path.join(root, relativePath), 'utf8');
        assert.doesNotMatch(html, />\s*[⌄↗]\s*</u, `${relativePath} contains a font-dependent chrome glyph`);
        assert.match(html, /<svg class="preset-dropdown-arrow"[^>]*width="12"[^>]*height="8"/u, `${relativePath} is missing the preset chevron SVG`);
        assert.match(html, /class="preset-toolbar-share-btn"[\s\S]*?<svg[^>]*width="18"[^>]*height="18"/u, `${relativePath} is missing the share-link SVG`);

        const collapseButtons = html.match(/<button class="collapse-icon"[\s\S]*?<\/button>/gu) || [];
        for (const button of collapseButtons) {
            assert.match(button, /<svg[^>]*width="10"[^>]*height="6"/u, `${relativePath} has a non-vector collapse control`);
        }
    }
});

test('portable CSS gives icon, file-intake and ActionDock visuals complete defaults', async () => {
    const css = await readFile(path.join(root, 'css/framework.css'), 'utf8');
    assert.match(css, /\.preset-dropdown-arrow\s*\{[^}]*display:\s*block/isu);
    assert.match(css, /\.preset-toolbar-share-btn svg\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/isu);
    assert.match(css, /\.collapse-icon svg\s*\{[^}]*width:\s*10px[^}]*height:\s*6px/isu);
    assert.match(css, /\.file-intake\s*>\s*\.file-intake__trigger\s*\{[^}]*min-height:\s*var\(--button-height\)/isu);
    assert.match(css, /\.file-intake\s*>\s*\.file-intake__clear\s*\{[^}]*background:\s*transparent/isu);
    assert.match(css, /\.action-dock \.btn-fixed\s*\{[^}]*box-shadow:\s*0 12px 32px -12px/isu);
    assert.match(css, /\.modal\[open\]\s*>\s*\.modal-content\s*\{[^}]*transform:\s*scale\(1\)/isu);
});

test('starter docks reserve the bright treatment for the primary export', async () => {
    for (const relativePath of surfaces.filter(file => file.includes('starters/') || file.includes('clean-room'))) {
        const html = await readFile(path.join(root, relativePath), 'utf8');
        const dock = html.match(/<nav class="bottom-buttons action-dock"[\s\S]*?<\/nav>/u)?.[0] || '';
        assert.ok(dock, `${relativePath} is missing ActionDock markup`);
        assert.match(dock, /class="btn-fixed"[^>]*data-action-dock-primary-export/u);
        const secondaryButtons = dock.match(/class="btn-fixed btn-fixed--muted"/gu) || [];
        assert.ok(secondaryButtons.length >= 6, `${relativePath} does not distinguish secondary actions`);
    }
});
