#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const args = parseArgs(process.argv.slice(2));

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (error) {
    throw new Error('Playwright is required for browser smoke. Run with a Node environment that can resolve `playwright`.', {
        cause: error
    });
}

const MIME = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

function insideRoot(path) {
    const rel = path.slice(ROOT.length);
    return path === ROOT || (path.startsWith(ROOT + sep) && !rel.split(sep).includes('..'));
}

function staticServer() {
    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url || '/', 'http://127.0.0.1');
            const pathname = decodeURIComponent(url.pathname || '/');
            let file = resolve(ROOT, `.${pathname}`);
            if (!insideRoot(file)) {
                res.writeHead(403).end('Forbidden');
                return;
            }
            let info = await stat(file);
            if (info.isDirectory()) {
                file = resolve(file, 'index.html');
                info = await stat(file);
            }
            res.writeHead(200, {
                'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
                'content-length': info.size
            });
            createReadStream(file).pipe(res);
        } catch {
            res.writeHead(404).end('Not found');
        }
    });
    return new Promise((resolveServer, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolveServer({
                url: `http://127.0.0.1:${address.port}/`,
                close: () => new Promise((resolveClose) => server.close(resolveClose))
            });
        });
    });
}

function parseArgs(argv = []) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--url') out.url = argv[++i];
        else if (arg === '--executable-path') out.executablePath = argv[++i];
    }
    return out;
}

function defaultBrowserExecutable() {
    const candidates = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ];
    return candidates.find((path) => existsSync(path)) || '';
}

const MAIN_WEIGHT_INPUT = '[data-style-id="main"][data-style-prop="weight"][data-style-script=""]';

async function setMainWeight(page, value) {
    const input = page.locator(MAIN_WEIGHT_INPUT).first();
    await input.fill(String(value));
    await input.press('Enter');
    await page.waitForFunction((next) =>
        document.querySelector('[data-style-id="main"][data-style-prop="weight"][data-style-script=""]')?.value === String(next), value);
}

async function snapshot(page) {
    return page.evaluate(() => {
        const clean = window.KeyboarderExport?.cleanSvgSnapshot?.() || {};
        const paths = [...document.querySelectorAll('#glyphs path')];
        const boxes = paths
            .map((path) => {
                const box = path.getBBox();
                return { x: box.x, y: box.y, width: box.width, height: box.height };
            })
            .filter((box) => Number.isFinite(box.width) && Number.isFinite(box.height));
        return {
            slider: document.querySelector('[data-style-id="main"][data-style-prop="weight"][data-style-script=""]')?.value || '',
            valueText: document.querySelector('[data-style-id="main"][data-style-prop="weight"][data-style-script=""]')?.value || '',
            status: document.querySelector('#fontProbeStatus')?.textContent || '',
            liveGlyphPaths: document.querySelectorAll('#glyphs path').length,
            liveGlyphTexts: document.querySelectorAll('#glyphs text').length,
            firstPath: document.querySelector('#glyphs path')?.getAttribute('d') || '',
            pathSignature: paths.map((path) => path.getAttribute('d') || '').join('|'),
            maxGlyphHeight: Math.max(...boxes.map((box) => box.height), 0),
            cleanBytes: clean.bytes || 0,
            cleanHasInteractive: !!clean.hasInteractive,
            cleanHasText: /<text\b/i.test(clean.svg || ''),
            cleanLayerCounts: clean.layerCounts || {}
        };
    });
}

async function uploadCustomIcon(page) {
    await page.evaluate(() => window.KeyboarderUI?.setAdvanced?.(true));
    await page.waitForFunction(() => document.querySelectorAll('#legendKeySelect option').length > 20);
    await page.locator('#legendKeySelect').evaluate((select) => {
        select.value = '20';
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => {
        const button = document.querySelector('#uploadLegendIconBtn');
        return button && !button.disabled;
    });

    const before = await page.evaluate(() => {
        const clean = window.KeyboarderExport.cleanSvgSnapshot();
        const count = (clean.layerCounts.icons || 0) + (clean.layerCounts.fIcons || 0);
        window.__keyboarderSmokeBeforeIconPaths = count;
        return count;
    });
    await page.setInputFiles('#legendIconFileInput', {
        name: 'spark.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('<svg viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg"><path d="M0 0L8 0L4 8Z"/></svg>')
    });
    await page.waitForFunction(() =>
        [...document.querySelectorAll('.legend-icon-input')].some((select) => select.value === 'custom:spark'));
    await page.locator('#applyLegendEditBtn').evaluate((button) => button.click());
    await page.waitForTimeout(300);
    return page.evaluate(() => {
        const clean = window.KeyboarderExport.cleanSvgSnapshot();
        return {
            beforeIconPaths: window.__keyboarderSmokeBeforeIconPaths || 0,
            optionVisible: [...document.querySelectorAll('.legend-icon-input option')]
                .some((option) => option.value === 'custom:spark'),
            customRows: [...document.querySelectorAll('.legend-icon-input')]
                .filter((select) => select.value === 'custom:spark').length,
            editorRows: document.querySelectorAll('#legendElementEditor .legend-edit-row').length,
            applyDisabled: !!document.querySelector('#applyLegendEditBtn')?.disabled,
            cleanIconPaths: (clean.layerCounts.icons || 0) + (clean.layerCounts.fIcons || 0),
            cleanSvgHasCustomPath: /M0 0L8 0L4 8Z/.test(clean.svg || '')
        };
    });
}

const server = args.url
    ? { url: args.url, close: async () => {} }
    : await staticServer();
const executablePath = args.executablePath || defaultBrowserExecutable();
const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {})
});

try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(server.url, { waitUntil: 'networkidle' });
    await page.waitForSelector(MAIN_WEIGHT_INPUT);
    await page.waitForFunction(() =>
        !!window.KeyboarderExport?.cleanSvgSnapshot
        && document.querySelectorAll('#glyphs text').length >= 170
        && /YS Text Variable/.test(document.querySelector('#fontProbeStatus')?.textContent || ''));

    const editable = await page.evaluate(() => {
        const clean = window.KeyboarderExport.cleanSvgSnapshot();
        const first = document.querySelector('#glyphs text');
        return {
            outlineChecked: !!document.querySelector('#convertToOutlinesCheckbox')?.checked,
            glyphPaths: clean.layerCounts.glyphPaths || 0,
            glyphTexts: clean.layerCounts.glyphTexts || 0,
            hasEmbeddedFont: /id=["']font-faces["']|data:font\//i.test(clean.svg || ''),
            family: first?.getAttribute('font-family') || '',
            postScriptName: first?.getAttribute('data-font-postscript-name') || '',
            weight: first?.getAttribute('font-weight') || '',
            stretch: first?.getAttribute('font-stretch') || '',
            variation: first?.getAttribute('style') || '',
            anchors: [...document.querySelectorAll('#glyphs text')].reduce((counts, element) => {
                const anchor = element.getAttribute('text-anchor') || 'start';
                counts[anchor] = (counts[anchor] || 0) + 1;
                return counts;
            }, {})
        };
    });
    assert.equal(editable.outlineChecked, false, 'editable SVG text should be the default mode');
    assert.equal(editable.glyphPaths, 0, 'editable SVG should not contain outlined legend paths');
    assert.equal(editable.glyphTexts, 176, 'editable SVG should contain one text element per legend');
    assert.equal(editable.hasEmbeddedFont, false, 'editable SVG should reference installed fonts instead of embedding them');
    assert.equal(editable.family, 'YS Text', 'editable SVG should preserve the installed font family name');
    assert.ok(editable.postScriptName, 'editable SVG should include the PostScript font name');
    assert.equal(editable.weight, '400', 'editable SVG should preserve the selected weight');
    assert.equal(editable.stretch, '100%', 'editable SVG should preserve the selected width');
    assert.match(editable.variation, /"wght" 400/, 'editable SVG should preserve the selected variable-font instance');
    assert.ok(editable.anchors.end > 0, 'right-aligned legends should export with text-anchor=end');
    assert.ok(editable.anchors.middle > 0, 'centered legends should export with text-anchor=middle');

    await page.locator('#convertToOutlinesCheckbox').check();
    await page.waitForFunction(() => document.querySelectorAll('#glyphs path').length >= 170);

    const regular = await snapshot(page);
    await setMainWeight(page, 100);
    const light = await snapshot(page);
    await setMainWeight(page, 900);
    const black = await snapshot(page);
    const customIcon = await uploadCustomIcon(page);

    for (const row of [regular, light, black]) {
        assert.equal(row.liveGlyphPaths, 176, `live glyph path count at wght=${row.slider}`);
        assert.equal(row.liveGlyphTexts, 0, `live glyph text count at wght=${row.slider}`);
        assert.equal(row.cleanLayerCounts.glyphPaths, 176, `clean glyph path count at wght=${row.slider}`);
        assert.equal(row.cleanLayerCounts.glyphTexts, 0, `clean glyph text count at wght=${row.slider}`);
        assert.equal(row.cleanLayerCounts.selection, 0, `clean selection count at wght=${row.slider}`);
        assert.equal(row.cleanHasInteractive, false, `clean interactive state at wght=${row.slider}`);
        assert.equal(row.cleanHasText, false, `clean SVG text state at wght=${row.slider}`);
        assert.ok(row.cleanBytes > 200000, `clean SVG should not be empty at wght=${row.slider}`);
        assert.ok(row.maxGlyphHeight < 32, `glyph bbox spike guard at wght=${row.slider}`);
    }
    assert.equal(regular.slider, '400');
    assert.equal(light.slider, '100');
    assert.equal(black.slider, '900');
    assert.notEqual(light.pathSignature, black.pathSignature, 'wght axis should change live path data');
    assert.match(black.status, /wght 900\b/, 'font status should reflect wght=900');
    assert.equal(customIcon.optionVisible, true, 'uploaded SVG icon should appear in icon picker');
    assert.ok(
        customIcon.cleanIconPaths > customIcon.beforeIconPaths,
        `clean SVG should include an extra uploaded icon: ${JSON.stringify(customIcon)}`
    );
    assert.equal(customIcon.cleanSvgHasCustomPath, true, 'clean SVG should contain uploaded icon path');

    console.log(JSON.stringify({
        url: server.url,
        editable: { glyphTexts: editable.glyphTexts, family: editable.family, weight: editable.weight },
        regular: { glyphPaths: regular.liveGlyphPaths, cleanBytes: regular.cleanBytes },
        light: { glyphPaths: light.liveGlyphPaths, maxGlyphHeight: Number(light.maxGlyphHeight.toFixed(3)) },
        black: { glyphPaths: black.liveGlyphPaths, maxGlyphHeight: Number(black.maxGlyphHeight.toFixed(3)) },
        customIcon: { cleanIconPaths: customIcon.cleanIconPaths }
    }, null, 2));
    console.log('browser variable font smoke passed');
} finally {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
}
