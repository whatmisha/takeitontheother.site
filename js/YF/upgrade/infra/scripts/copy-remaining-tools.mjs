// One-time mechanical copy. Originals are read-only; output is confined to upgrade.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = new URL('../../', import.meta.url);
const sourceBase = new URL('../', root);
const ids = ['hyperspace', 'pattern_generator', 'pattern_generator_02', 'random_lines_generator', 'asterisk_pattern_generator', 'calendar-randomizer', 'chladni-sound-pattern'];
const hash = text => createHash('sha256').update(text).digest('hex');
const font = '-apple-system, Inter, "Segoe UI", Roboto, sans-serif';
const namespaces = { randomLinesSettings: 'upgrade:random-lines:settings:v1', controlsCollapsed: 'upgrade:calendar-randomizer:controls-collapsed:v1' };
const vendors = {
    'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js': '../infra/framework/vendor/p5/1.4.0/lib/p5.js',
    'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js': '../infra/framework/vendor/p5/1.7.0/lib/p5.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js': '../infra/framework/vendor/p5/1.9.0/lib/p5.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/addons/p5.sound.min.js': '../infra/framework/vendor/p5/1.9.0/lib/addons/p5.sound.min.js'
};
const style = css => css.replace(/@font-face\s*\{[^}]*\}\s*/g, '').replace(/font-family\s*:[^;}]+/g, `font-family: ${font}`).replace(/font-weight\s*:\s*(?:[1-9]00|bold|normal|bolder)\b/g, match => `font-weight: ${/(?:400|normal)\b/.test(match) ? 400 : 500}`);
const controls = html => [...html.matchAll(/<(?:input|button|select|textarea|option)\b[^>]*>/gi)].map(match => match[0]);
const inlineScripts = html => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(match => !/\bsrc\s*=/.test(match[1])).map(match => hash(match[2]));
const baseline = JSON.parse(await readFile(new URL('infra/qa/migrations/SOURCE_BASELINE.json', root), 'utf8'));
const uiTextPatches = JSON.parse(await readFile(new URL('infra/qa/migrations/batch7/ui-text-patches.json', root), 'utf8'));
const catalog = JSON.parse(await readFile(new URL('infra/TOOL_CATALOG.json', root), 'utf8'));
const contracts = JSON.parse(await readFile(new URL('infra/qa/migrations/CONTRACTS.json', root), 'utf8'));
const manifest = { schemaVersion: 1, scope: 'isolated-copy-not-acceptance', note: 'Original algorithms preserved. Explicit exceptions: storage namespaces and the four service-text font substitutions listed in batch7/ui-text-patches.json (including exported Asterisk grid labels). HTML/CSS dependency, UI font and preview-navigation edits only; full acceptance is pending.', namespaces, tools: [] };
const pending = [];
const canonicalSources = await realpath(sourceBase);
for (const id of ids) {
    const source = baseline.tools.find(tool => tool.id === id);
    assert.ok(source);
    assert.equal(catalog.tools.find(tool => tool.id === id).state, 'planned');
    try { await lstat(new URL(`${id}/`, root)); throw Error(`${id}: target exists; refusing overwrite`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const record = { id, sourceRoot: source.sourceRoot, files: [] };
    for (const file of source.files) {
        const sourceUrl = new URL(`${source.sourceRoot}/${file.path}`, sourceBase);
        const canonical = await realpath(sourceUrl);
        assert.ok(canonical.startsWith(canonicalSources + path.sep));
        assert.ok((await lstat(sourceUrl)).isFile(), 'No source symlinks');
        const original = await readFile(sourceUrl, 'utf8');
        assert.equal(hash(original), file.sha256, `${id}/${file.path}: source changed`);
        let contents = original;
        for (const patch of uiTextPatches.filter(patch => patch.file === `${id}/${file.path}`)) {
            assert.equal(contents.split(patch.before).length, 2);
            contents = contents.replace(patch.before, patch.after);
        }
        if (/\.(?:js|html)$/.test(file.path)) for (const [before, after] of Object.entries(namespaces)) {
            contents = contents.replaceAll(`'${before}'`, `'${after}'`).replaceAll(`"${before}"`, `"${after}"`);
        }
        if (file.path.endsWith('.css')) contents = style(contents);
        if (file.path === 'index.html') {
            for (const [remote, local] of Object.entries(vendors)) {
                contents = contents.replaceAll(remote, local);
                if (original.includes(remote)) await lstat(new URL(local, new URL(`${id}/index.html`, root)));
            }
            contents = contents.replace(/\s*<link\b[^>]*href=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '');
            contents = contents.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_, attrs, css) => `<style${attrs}>${style(css)}</style>`);
            contents = contents.replace('</head>', '    <link rel="icon" href="data:,">\n    <link rel="stylesheet" href="../infra/framework/styles/migration-preview.css">\n</head>');
            contents = contents.replace(/<body([^>]*)>/, '<body$1>\n    <a class="upgrade-migration-preview" href="../" aria-label="Upgrade Tools — return to main page">← Upgrade Tools <span>Migration preview</span></a>');
            record.htmlControls = controls(original);
            record.inlineScriptHashes = inlineScripts(original);
        }
        const target = `${id}/${file.path}`;
        assert.ok(fileURLToPath(new URL(target, root)).startsWith(fileURLToPath(root)));
        pending.push({ target, contents });
        record.files.push({ path: file.path, sourceSha256: file.sha256, copySha256: hash(contents), bytes: Buffer.byteLength(contents) });
    }
    manifest.tools.push(record);
}
if (!process.argv.includes('--apply')) {
    console.log(`Verified ${ids.length} tools / ${pending.length} files; use --apply to copy into upgrade/.`);
} else {
    for (const { target, contents } of pending) {
        const url = new URL(target, root);
        await mkdir(new URL('./', url), { recursive: true });
        await writeFile(url, contents, { flag: 'wx' });
    }
    for (const tool of catalog.tools) if (ids.includes(tool.id)) tool.state = 'migrating';
    for (const tool of contracts.tools) if (ids.includes(tool.id)) tool.status = 'isolated-copy';
    for (const [file, data] of [['infra/TOOL_CATALOG.json', catalog], ['infra/qa/migrations/CONTRACTS.json', contracts], ['infra/qa/migrations/BATCH7_COPY_MANIFEST.json', manifest]]) {
        await writeFile(new URL(file, root), JSON.stringify(data, null, 2) + '\n');
    }
    console.log(`Copied ${ids.length} tools / ${pending.length} files; all are migrating, none marked accepted.`);
}
