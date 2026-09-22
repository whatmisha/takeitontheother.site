import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('browser smoke uses only portable public resources', async () => {
    const html = await readFile(path.join(root, 'tests/browser-smoke/index.html'), 'utf8');
    const source = await readFile(path.join(root, 'tests/browser-smoke/smoke.js'), 'utf8');
    assert.match(html, /src="\.\/smoke\.js"/u);
    assert.match(html, /href="\.\/favicon\.svg"/u);
    assert.match(html, /href="\.\.\/\.\.\/css\/framework\.css"/u);
    assert.match(source, /from '\.\.\/\.\.\/src\/index\.js'/u);
    const networkReferences = `${html}\n${source}`.replace('http://www.w3.org/2000/svg', '');
    assert.doesNotMatch(networkReferences, /https?:\/\//u);
    assert.doesNotMatch(source, /(?:\.\.\/){3}/u);
    for (const format of ['Svg', 'Png', 'Pdf', 'Json']) {
        assert.match(source, new RegExp(`verify${format}Artifact\\b`, 'u'));
    }
});
