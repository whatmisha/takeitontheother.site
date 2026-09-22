import assert from 'node:assert/strict';
import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const frameworkRoot = path.dirname(testsDir);
const srcRoot = path.join(frameworkRoot, 'src');

test('public barrel exports the documented framework surface', async () => {
    const api = await import('../src/index.js');
    const source = await readFile(path.join(srcRoot, 'index.js'), 'utf8');
    const expected = [
        'ActionDockController', 'ApplicationShell', 'CanvasTarget', 'ColorPicker', 'DOMCache', 'DialogHost',
        'ExportGuard', 'FileIntakeController', 'GradientStrokeEffect', 'HistoryBridge', 'HistoryManager',
        'MathUtils', 'MobileBootstrap', 'NoiseGenerator', 'OverlayDialogHost', 'PanelManager', 'PresetMenuKeyboardController', 'PresetSession', 'PresetStore',
        'RenderTarget', 'SVGExporter', 'SHARED_SLOT',
        'SeededRandom', 'ShareCodec', 'ShortcutRouter', 'SliderController', 'StripeGeometry',
        'SvgTarget', 'TextToPath', 'TooltipService', 'UnifiedColorPicker',
        'UnifiedUiController', 'WobblyEffect', 'ZoomPanManager', 'defineTool', 'fileMatchesAccept', 'initActionDocks', 'initPresetMenuKeyboards', 'initUnifiedUi', 'resolveApplicationCapabilities', 'seedToUint32', 'svgDocumentString'
    ];
    for (const name of expected) assert.ok(name in api, `Missing public export: ${name}`);
    assert.match(source, /PanelManager\.js/u);
    assert.match(source, /UnifiedUiController\.js/u);
    assert.doesNotMatch(source, /\?v=/u);
});

test('unadopted controls live on the optional framework surface', async () => {
    const optional = await import('../src/experimental.js');
    assert.equal(typeof optional.DicePanel, 'function');
    assert.equal(typeof optional.RangeSliderController, 'function');
});

test('machine-readable API snapshot matches both entrypoints and framework version', async () => {
    const snapshot = JSON.parse(await readFile(path.join(frameworkRoot, 'PUBLIC_API.json'), 'utf8'));
    const version = JSON.parse(await readFile(path.join(frameworkRoot, 'VERSION.json'), 'utf8'));
    const stable = await import('../src/index.js');
    const optional = await import('../src/experimental.js');

    assert.equal(snapshot.frameworkVersion, version.version);
    assert.deepEqual(Object.keys(stable).sort(), snapshot.stable.exports);
    assert.deepEqual(Object.keys(optional).sort(), snapshot.optional.exports);
    assert.equal(snapshot.stable.entrypoint, 'src/index.js');
    assert.equal(snapshot.optional.entrypoint, 'src/experimental.js');
});

test('every public resource-owning controller exposes destroy()', async () => {
    const stable = await import('../src/index.js');
    const optional = await import('../src/experimental.js');
    for (const name of [
        'ActionDockController', 'ApplicationShell', 'CanvasTarget', 'ColorPicker',
        'DialogHost', 'FileIntakeController', 'HistoryBridge', 'MobileBootstrap',
        'OverlayDialogHost', 'PanelManager', 'PresetMenuKeyboardController',
        'DraftStore', 'RenderTarget', 'SVGExporter', 'SliderController', 'SvgTarget',
        'TooltipService', 'UnifiedColorPicker', 'UnifiedUiController', 'ZoomPanManager'
    ]) assert.equal(typeof stable[name]?.prototype?.destroy, 'function', `${name} must expose destroy()`);
    for (const name of ['DicePanel', 'RangeSliderController']) {
        assert.equal(typeof optional[name]?.prototype?.destroy, 'function', `${name} must expose destroy()`);
    }
});

test('every source module has one explicit owner and API surface classification', async () => {
    const ownership = JSON.parse(await readFile(path.join(frameworkRoot, 'MODULE_OWNERSHIP.json'), 'utf8'));
    const actual = [];
    async function walk(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const absolutePath = path.join(directory, entry.name);
            if (entry.isDirectory()) await walk(absolutePath);
            else if (entry.isFile() && entry.name.endsWith('.js')) {
                actual.push(path.relative(frameworkRoot, absolutePath).split(path.sep).join('/'));
            }
        }
    }
    await walk(srcRoot);

    const declared = ownership.modules.map(module => module.path);
    assert.deepEqual(declared, [...declared].sort(), 'ownership rows must stay path-sorted');
    assert.deepEqual(declared, actual.sort());
    assert.equal(new Set(declared).size, 44);
    for (const module of ownership.modules) {
        assert.ok(['stable', 'optional', 'internal'].includes(module.surface), `${module.path}: invalid surface`);
        assert.ok(module.owner, `${module.path}: missing owner`);
        assert.ok(module.lifecycle, `${module.path}: missing lifecycle`);
    }
});

test('framework source graph stays local and application-agnostic', async () => {
    const files = [];
    async function walk(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const absolutePath = path.join(directory, entry.name);
            if (entry.isDirectory()) await walk(absolutePath);
            else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolutePath);
        }
    }
    await walk(srcRoot);
    const forbiddenRemoteHosts = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'api.github.com'];
    for (const filePath of files) {
        const text = await readFile(filePath, 'utf8');
        for (const literal of forbiddenRemoteHosts) {
            assert.ok(!text.toLowerCase().includes(literal.toLowerCase()), `${path.relative(frameworkRoot, filePath)} contains ${literal}`);
        }
        const imports = [
            ...text.matchAll(/^\s*(?:import|export)\s+(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/gm),
            ...text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)
        ];
        for (const match of imports) {
            if (!match[1].startsWith('.')) continue;
            const candidate = path.resolve(path.dirname(filePath), match[1].split('?')[0]);
            const resolved = await realpath(candidate);
            assert.ok(resolved.startsWith(`${frameworkRoot}${path.sep}`));
        }
    }
    assert.equal(files.length, 44);
});

test('working CSS and exporters use checked-in same-origin assets', async () => {
    const css = `${await readFile(path.join(frameworkRoot, 'css/framework.css'), 'utf8')}\n${await readFile(path.join(frameworkRoot, 'css/tokens.css'), 'utf8')}`;
    assert.ok(!/url\(\s*["']?https?:\/\//i.test(css));
    assert.match(css, /\.\.\/fonts\/CoFoSans-Regular\.woff2/);

    const svgExporter = await readFile(path.join(srcRoot, 'export/SVGExporter.js'), 'utf8');
    const textToPath = await readFile(path.join(srcRoot, 'export/TextToPath.js'), 'utf8');
    assert.match(svgExporter, /new URL\('\.\.\/\.\.\/vendor\/jspdf\/2\.5\.1/);
    assert.match(svgExporter, /new URL\('\.\.\/\.\.\/vendor\/svg2pdf\/2\.2\.3/);
    assert.match(textToPath, /new URL\('\.\.\/\.\.\/vendor\/opentype\/1\.3\.4/);
    assert.match(textToPath, /opentype\.module\.js/);
    assert.match(textToPath, /CoFoSans-Regular\.woff/u);
    assert.match(textToPath, /CoFoSans-Medium\.woff/u);
});

test('bundled outline fonts are parseable by the local OpenType runtime', async () => {
    const opentype = await import('../vendor/opentype/1.3.4/opentype.module.js');
    for (const fileName of ['CoFoSans-Regular.woff', 'CoFoSans-Medium.woff']) {
        const data = await readFile(path.join(frameworkRoot, 'fonts', fileName));
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const font = opentype.parse(buffer);
        assert.ok(font.numGlyphs > 0, `${fileName} contains no glyphs`);
    }
});

test('portable CSS contains the accepted component contracts', async () => {
    const working = await readFile(path.join(frameworkRoot, 'css/framework.css'), 'utf8');
    assert.match(working, /font-size: var\(--segmented-control-font-size, 0\.9rem\);/u);
    assert.match(working, /\.checkbox-label\s*\{[^}]*display: flex !important;/su);
    assert.match(working, /\.collapse-icon:focus-visible\s*\{[^}]*outline: 1px solid var\(--color-text\);/su);
    assert.match(working, /\.bottom-buttons\.action-dock\s*\{[^}]*left: 50%;[^}]*width: max-content;[^}]*display: flex;[^}]*justify-content: center;/su);
    assert.match(working, /\.action-dock__slot--primary\s*\{[^}]*order: 2;/su);
    assert.match(working, /\.action-dock__slot--utility\s*\{[^}]*order: 1;/su);
    assert.match(working, /\.action-dock__slot--options\s*\{[^}]*order: 3;/su);
    assert.match(working, /\[data-action-dock-extra\]\[hidden\]\s*\{[^}]*display: none !important;/su);
    assert.match(working, /\.file-intake\.is-dragover\s*\{[^}]*outline: 1px dashed var\(--color-text\);/su);
    assert.match(working, /\.file-intake__trigger\[aria-busy="true"\]\s*\{[^}]*cursor: progress;/su);
});

test('Component Lab loads only CSS inside the portable folder', async () => {
    const html = await readFile(path.join(frameworkRoot, 'component-lab/index.html'), 'utf8');
    assert.match(html, /href="\.\.\/css\/framework\.css/u);
    assert.match(html, /href="\.\/styles\.css/u);
    assert.doesNotMatch(html, /https?:\/\//u);
});

test('preset save supports a tool-provided suggested name', async () => {
    const source = await readFile(path.join(srcRoot, 'core/ApplicationShell.js'), 'utf8');
    assert.match(source, /presets\?\.suggestSaveName/);
    assert.match(source, /value:\s*suggestedName/);
});

test('SVG render and export honor tool-level interaction and exclusion markers', async () => {
    const target = await readFile(path.join(srcRoot, 'render/SvgTarget.js'), 'utf8');
    const zoom = await readFile(path.join(srcRoot, 'ui/ZoomPanManager.js'), 'utf8');
    const exporter = await readFile(path.join(srcRoot, 'export/SVGExporter.js'), 'utf8');
    assert.match(target, /interactive:\s*options\.interactive/);
    assert.match(target, /data-export-exclude/);
    assert.match(zoom, /dataset\?\.fitArtboard/);
    assert.match(exporter, /data-export-exclude/);
});
