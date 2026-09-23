import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = path.join(root, 'scripts/create-tool.mjs');

test('create-tool writes a public-only SVG or Canvas scaffold and never overwrites', async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'ui-garage-create-tool-'));
    try {
        for (const renderer of ['svg', 'canvas']) {
            const output = path.join(temporaryRoot, `${renderer} clean tool`);
            const { stdout } = await execFileAsync(process.execPath, [
                script, output, '--id', `${renderer}-clean-tool`, '--renderer', renderer, '--name', `${renderer.toUpperCase()} Clean Tool`
            ]);
            assert.match(stdout, new RegExp(`Created ${renderer} tool`, 'u'));
            const files = await Promise.all(['index.html', 'app.js', 'app.css', 'README.md', 'favicon.svg']
                .map(file => readFile(path.join(output, file), 'utf8')));
            const [html, source] = files;
            assert.match(source, /src\/index\.js/u);
            assert.doesNotMatch(source, /src\/(?:core|ui|export|history|preset|render)\//u);
            assert.match(source, new RegExp(`renderer: "${renderer}"`, 'u'));
            assert.match(html, new RegExp(renderer === 'svg' ? '<svg id="artboard"' : '<canvas id="artboard"', 'u'));
            await assert.rejects(
                execFileAsync(process.execPath, [script, output, '--id', `${renderer}-clean-tool`]),
                /Output path already exists/u
            );
        }
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('create-tool rejects unsafe ids, renderers and destinations inside UI Garage', async () => {
    await assert.rejects(execFileAsync(process.execPath, [script, path.join(root, 'generated'), '--id', 'valid-id']), /outside the UI Garage/u);
    await assert.rejects(execFileAsync(process.execPath, [script, path.join(os.tmpdir(), 'bad-id-tool'), '--id', '../bad']), /must match/u);
    await assert.rejects(execFileAsync(process.execPath, [script, path.join(os.tmpdir(), 'bad-renderer-tool'), '--id', 'valid-id', '--renderer', 'webgl']), /svg or canvas/u);
});
