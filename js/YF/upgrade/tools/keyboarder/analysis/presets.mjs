import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LAYOUTS, LCAKB23 } from '../app/kb/layouts.js';

const manifest = JSON.parse(await readFile(new URL('../presets/manifest.json', import.meta.url), 'utf8'));
const entries = Array.isArray(manifest.presets) ? manifest.presets : [];
assert.ok(entries.length, 'manifest should contain presets');

const seen = new Set();
for (const entry of entries) {
    assert.ok(entry.name, 'preset entry should have a name');
    assert.ok(entry.file, `${entry.name}: preset entry should have a file`);
    assert.ok(!seen.has(entry.name), `${entry.name}: duplicate preset name`);
    seen.add(entry.name);
    const blob = JSON.parse(await readFile(new URL(`../presets/${entry.file}`, import.meta.url), 'utf8'));
    const layoutName = blob.layoutName || LCAKB23.meta.name;
    assert.ok(LAYOUTS[layoutName], `${entry.name}: unknown layoutName ${layoutName}`);
}

console.log('preset manifest passed');
