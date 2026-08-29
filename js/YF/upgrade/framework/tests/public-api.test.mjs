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
    const expected = [
        'ApplicationShell', 'CanvasTarget', 'ColorPicker', 'DOMCache', 'DialogHost',
        'DicePanel', 'GradientStrokeEffect', 'HistoryBridge', 'HistoryManager',
        'MathUtils', 'NoiseGenerator', 'PanelManager', 'PresetSession', 'PresetStore',
        'RangeSliderController', 'RenderTarget', 'SVGExporter', 'SHARED_SLOT',
        'ShareCodec', 'ShortcutRouter', 'SliderController', 'StripeGeometry',
        'SvgTarget', 'TextToPath', 'TooltipService', 'UnifiedColorPicker',
        'WobblyEffect', 'ZoomPanManager', 'defineTool'
    ];
    for (const name of expected) assert.ok(name in api, `Missing public export: ${name}`);
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
    assert.equal(files.length, 33);
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
});

test('demo uses an isolated storage namespace', async () => {
    const tool = await readFile(path.join(frameworkRoot, 'demo/tool.js'), 'utf8');
    assert.match(tool, /storageKey:\s*'upgrade:framework-demo:presets:v1'/);
});
