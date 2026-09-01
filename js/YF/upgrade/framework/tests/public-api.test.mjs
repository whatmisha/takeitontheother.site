import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const frameworkRoot = path.dirname(testsDir);
const srcRoot = path.join(frameworkRoot, 'src');

function sha256(text) {
    return createHash('sha256').update(text).digest('hex');
}

function localizeFrameworkFonts(text) {
    return text.replaceAll('https://mishaivanov.ru/fonts/', '../fonts/');
}

test('public barrel exports the documented framework surface', async () => {
    const api = await import('../src/index.js');
    const source = await readFile(path.join(srcRoot, 'index.js'), 'utf8');
    const expected = [
        'ApplicationShell', 'CanvasTarget', 'ColorPicker', 'DOMCache', 'DialogHost',
        'DicePanel', 'ExportGuard', 'GradientStrokeEffect', 'HistoryBridge', 'HistoryManager',
        'MathUtils', 'MobileBootstrap', 'NoiseGenerator', 'OverlayDialogHost', 'PanelManager', 'PresetSession', 'PresetStore',
        'RangeSliderController', 'RenderTarget', 'SVGExporter', 'SHARED_SLOT',
        'SeededRandom', 'ShareCodec', 'ShortcutRouter', 'SliderController', 'StripeGeometry',
        'SvgTarget', 'TextToPath', 'TooltipService', 'UnifiedColorPicker',
        'WobblyEffect', 'ZoomPanManager', 'defineTool', 'seedToUint32', 'svgDocumentString'
    ];
    for (const name of expected) assert.ok(name in api, `Missing public export: ${name}`);
    assert.match(source, /PanelManager\.js\?v=g6-panel-1/u);
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
    const forbidden = [
        'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'api.github.com',
        '/dither/', '/grid_generator/', '/keyboarder/', '/label_generator/',
        '/pulsar_coder/', '/sparky/', '/wander_bender/', '/wordplayer/'
    ];
    for (const filePath of files) {
        const text = await readFile(filePath, 'utf8');
        for (const literal of forbidden) assert.ok(!text.includes(literal), `${path.relative(frameworkRoot, filePath)} contains ${literal}`);
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
    assert.equal(files.length, 37);
});

test('working CSS and exporters use checked-in same-origin assets', async () => {
    const css = `${await readFile(path.join(frameworkRoot, 'css/othersite-styles.css'), 'utf8')}\n${await readFile(path.join(frameworkRoot, 'css/tokens.css'), 'utf8')}`;
    assert.ok(!/url\(\s*["']?https?:\/\//i.test(css));
    assert.match(css, /\.\.\/fonts\/CoFoSans-Regular\.woff2/);

    const svgExporter = await readFile(path.join(srcRoot, 'export/SVGExporter.js'), 'utf8');
    const textToPath = await readFile(path.join(srcRoot, 'export/TextToPath.js'), 'utf8');
    assert.match(svgExporter, /new URL\('\.\.\/\.\.\/vendor\/jspdf\/2\.5\.1/);
    assert.match(svgExporter, /new URL\('\.\.\/\.\.\/vendor\/svg2pdf\/2\.2\.3/);
    assert.match(textToPath, /new URL\('\.\.\/\.\.\/vendor\/opentype\/1\.3\.4/);
    assert.match(textToPath, /opentype\.module\.js/);
});

test('working CSS preserves v3 provenance and documents intentional G5/G6 extensions', async () => {
    const provenance = JSON.parse(await readFile(path.join(frameworkRoot, 'CSS_PROVENANCE.json'), 'utf8'));
    const pairs = [
        ['css/othersite-styles.css', provenance.upstreamStylesSha256, provenance.workingStylesSha256],
        ['css/tokens.css', provenance.upstreamTokensSha256, provenance.workingTokensSha256]
    ];
    for (const [relativePath, upstreamHash, workingHash] of pairs) {
        const upstream = await readFile(path.join(frameworkRoot, 'upstream-v3', relativePath), 'utf8');
        const working = await readFile(path.join(frameworkRoot, relativePath), 'utf8');
        assert.equal(sha256(upstream), upstreamHash);
        assert.equal(sha256(working), workingHash);
        if (relativePath === 'css/tokens.css') {
            assert.equal(localizeFrameworkFonts(upstream), working);
            continue;
        }
        assert.notEqual(localizeFrameworkFonts(upstream), working);
        assert.match(working, /font-size: var\(--segmented-control-font-size, 0\.9rem\);/u);
        assert.match(working, /\.checkbox-label\s*\{[^}]*display: flex !important;/su);
        assert.match(working, /\.collapse-icon:focus-visible\s*\{[^}]*outline: 1px solid var\(--color-text\);/su);
    }
});

test('SVG and Canvas demos load host CSS after framework CSS', async () => {
    for (const directory of ['demo', 'demo-canvas']) {
        const html = await readFile(path.join(frameworkRoot, directory, 'index.html'), 'utf8');
        const frameworkIndex = html.indexOf('id="frameworkStyles"');
        const applicationIndex = html.indexOf('id="applicationStyles"');
        assert.ok(frameworkIndex >= 0, `${directory} missing framework stylesheet`);
        assert.ok(applicationIndex > frameworkIndex, `${directory} app stylesheet must load second`);
        assert.match(html, new RegExp(`<script[^>]+src="\\./tool\\.js"`));
    }
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

test('demo uses an isolated storage namespace', async () => {
    const tool = await readFile(path.join(frameworkRoot, 'demo/tool.js'), 'utf8');
    assert.match(tool, /storageKey:\s*'upgrade:framework-demo:presets:v1'/);
});
