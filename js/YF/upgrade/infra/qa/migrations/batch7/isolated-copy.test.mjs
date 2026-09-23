import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../../../../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const frozen = file => read(`infra/qa/migrations/batch7/frozen/${file}`);
const hash = text => createHash('sha256').update(text).digest('hex');
const manifest = JSON.parse(await read('infra/qa/migrations/BATCH7_COPY_MANIFEST.json'));
const baseline = JSON.parse(await read('infra/qa/migrations/SOURCE_BASELINE.json'));
const catalog = JSON.parse(await read('infra/TOOL_CATALOG.json'));
const contracts = JSON.parse(await read('infra/qa/migrations/CONTRACTS.json'));
const uiTextPatches = JSON.parse(await read('infra/qa/migrations/batch7/ui-text-patches.json'));
const ids = ['hyperspace', 'pattern_generator', 'pattern_generator_02', 'random_lines_generator', 'asterisk_pattern_generator', 'calendar-randomizer', 'chladni-sound-pattern'];
const restoreNamespaces = text => Object.entries(manifest.namespaces).reduce((text, [before, after]) => text.replaceAll(`'${after}'`, `'${before}'`).replaceAll(`"${after}"`, `"${before}"`), text);

test('all seven are accepted with evidence while retaining frozen baselines', async () => {
    assert.deepEqual(manifest.tools.map(tool => tool.id), ids);
    assert.equal(manifest.tools.reduce((n, tool) => n + tool.files.length, 0), 29);
    const hub = await read('index.html');
    const audit = await read('infra/qa/ui-audit/index.html');
    for (const id of ids) {
        assert.equal(catalog.tools.find(tool => tool.id === id).state, 'accepted');
        assert.equal(contracts.tools.find(tool => tool.id === id).status, 'accepted');
        assert.equal(contracts.tools.find(tool => tool.id === id).acceptance.status, 'passed');
        assert.ok(audit.includes(`value="${id}" data-tool-state="accepted"`));
        assert.ok(hub.includes(`href="${id}/"`));
    }
});

for (const tool of manifest.tools) {
    test(`T.2 frozen ${tool.id}: complete file set and original copy checksums`, async () => {
        const original = baseline.tools.find(item => item.id === tool.id);
        assert.equal(tool.sourceRoot, original.sourceRoot);
        assert.deepEqual(tool.files.map(file => file.path), original.files.map(file => file.path));
        for (const file of tool.files) {
            assert.equal(file.sourceSha256, original.files.find(item => item.path === file.path).sha256);
            const contents = await frozen(`${tool.id}/${file.path}`);
            const snapshot = file.path.endsWith('.html') ? contents.replaceAll('../infra/framework/', '../../framework/').replaceAll('href="../"', 'href="../../"') : contents;
            assert.equal(hash(snapshot), file.copySha256, file.path);
            assert.equal(Buffer.byteLength(snapshot), file.bytes, file.path);
        }
    });
    test(`T.2 frozen ${tool.id}: original algorithms/assets except settings namespace and service fonts`, async () => {
        for (const file of tool.files.filter(file => /\.(?:js|svg)$/.test(file.path))) {
            const contents = await frozen(`${tool.id}/${file.path}`);
            let restored = restoreNamespaces(contents);
            for (const patch of uiTextPatches.filter(patch => patch.file === `${tool.id}/${file.path}`)) {
                assert.equal(restored.split(patch.after).length, 2, 'One explicit UI text change');
                restored = restored.replace(patch.after, patch.before);
            }
            assert.equal(hash(restored), file.sourceSha256, file.path);
        }
        const html = restoreNamespaces(await frozen(`${tool.id}/index.html`));
        const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(match => !/\bsrc\s*=/.test(match[1])).map(match => hash(match[2]));
        assert.deepEqual(scripts, tool.inlineScriptHashes, 'Inline calendar logic must not silently change');
    });
    test(`T.2 frozen ${tool.id}: every original control, range, default and option is retained`, async () => {
        const html = await frozen(`${tool.id}/index.html`);
        assert.deepEqual([...html.matchAll(/<(?:input|button|select|textarea|option)\b[^>]*>/gi)].map(match => match[0]), tool.htmlControls);
        assert.match(html, /href="\.\.\/"[^>]*>← Upgrade Tools/);
        assert.match(html, /Migration preview/);
        assert.doesNotMatch(html, /<(?:link|script)\b[^>]*(?:src|href)=["']https?:/i);
    });
    test(`${tool.id}: UI fonts have no Arial/CoFo/remote faces or unsupported weights`, async () => {
        const html = await read(`${tool.id}/index.html`);
        const styles = [ ...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]),
            ...await Promise.all(tool.files.filter(file => file.path.endsWith('.css')).map(file => read(`${tool.id}/${file.path}`))) ].join('\n');
        // A historical class name such as .rooftop-font is not an actual font declaration.
        assert.doesNotMatch(styles, /@font-face|font-family\s*:[^;}]*(?:Arial|CoFo|Rooftop)|fonts\.google|font-weight\s*:\s*(?:[1236789]00|bold)/i);
        for (const match of styles.matchAll(/font-family\s*:\s*([^;}]+)/g)) assert.equal(match[1].trim(), '-apple-system, Inter, "Segoe UI", Roboto, sans-serif');
    });
}

test('T.2 frozen Random Lines and Calendar namespaces remain isolated', async () => {
    const allCalls = [];
    for (const tool of manifest.tools) for (const file of tool.files.filter(file => /\.(?:js|html)$/.test(file.path))) {
        const contents = await frozen(`${tool.id}/${file.path}`);
        const accesses = [...contents.matchAll(/(?:localStorage|sessionStorage)\.(getItem|setItem|removeItem)\(\s*['"]([^'"]+)['"]/g)];
        for (const match of accesses) {
            assert.ok(Object.values(manifest.namespaces).includes(match[2]));
            allCalls.push([match[1], match[2]]);
        }
        assert.doesNotMatch(contents, /(?:localStorage|sessionStorage)\s*\[/);
        assert.doesNotMatch(contents, /(?:localStorage|sessionStorage)\.clear\(/);
    }
    assert.equal(allCalls.length, 4);
    assert.equal(allCalls.filter(([method]) => method === 'getItem').length, 2);
    assert.equal(allCalls.filter(([method]) => method === 'setItem').length, 2);
});

test('four Calendar SVGs are standalone artwork, without external assets or scripts', async () => {
    for (const file of manifest.tools.find(tool => tool.id === 'calendar-randomizer').files.filter(file => file.path.endsWith('.svg'))) {
        const svg = await read(`calendar-randomizer/${file.path}`);
        assert.match(svg, /viewBox="0 0 720 320"/);
        assert.doesNotMatch(svg, /<script\b|(?:href|xlink:href)\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/i);
    }
});

test('each p5 app retains its exact original major/minor/patch and local path', async () => {
    for (const [id, version, file] of [['hyperspace', '1.4.0', 'p5.js'], ['pattern_generator_02', '1.7.0', 'p5.min.js'], ['chladni-sound-pattern', '1.9.0', 'p5.min.js']]) {
        const html = await read(`${id}/index.html`);
        assert.ok(html.includes(`../infra/framework/vendor/p5/${version}/lib/${file}`));
    }
    assert.match(await read('chladni-sound-pattern/index.html'), /p5\/1\.9\.0\/lib\/addons\/p5\.sound\.min\.js/);
});

test('T.2 frozen Chladni baseline: setup/draw do not capture audio; Start is explicit', async () => {
    const handlers = new Map();
    const calls = { audio: 0, start: 0, static: 0 };
    const context = vm.createContext({
        console: { log() {}, error() {} },
        createCanvas: () => ({ parent() {} }), pixelDensity() {}, noStroke() {},
        p5: { AudioIn: class { start() { calls.start++; } amp() {} stop() {} }, FFT: class { setInput() {} } },
        select: selector => ({ mousePressed: handler => handlers.set(selector, handler) }),
        userStartAudio: () => { calls.audio++; return Promise.resolve(); }
    });
    vm.runInContext(await frozen('chladni-sound-pattern/sketch.js'), context);
    // Stub only rendering/control construction; execute the real setup, draw and button handlers.
    context.createControlSliders = () => {};
    context.toggleSliderInteractivity = () => {};
    context.drawStaticPattern = () => { calls.static++; };
    context.setup(); context.draw();
    handlers.get('#pause-button')(); handlers.get('#stop-button')();
    assert.deepEqual(calls, { audio: 0, start: 0, static: 1 });
    handlers.get('#start-button')();
    await Promise.resolve();
    assert.deepEqual(calls, { audio: 1, start: 1, static: 1 });
    // This is a fake AudioIn, never the machine microphone. Permission/error lifecycle is T.4 work.
});
