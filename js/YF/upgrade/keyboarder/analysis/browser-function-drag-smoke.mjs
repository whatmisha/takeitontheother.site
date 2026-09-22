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

function parseArgs(argv = []) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--url') out.url = argv[++i];
        else if (arg === '--executable-path') out.executablePath = argv[++i];
    }
    return out;
}

function insideRoot(path) {
    const rel = path.slice(ROOT.length);
    return path === ROOT || (path.startsWith(ROOT + sep) && !rel.split(sep).includes('..'));
}

function staticServer() {
    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url || '/', 'http://127.0.0.1');
            let file = resolve(ROOT, `.${decodeURIComponent(url.pathname || '/')}`);
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

function defaultBrowserExecutable() {
    const candidates = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ];
    return candidates.find((path) => existsSync(path)) || '';
}

async function keys(page) {
    return page.evaluate(() => window.KeyboarderFunctionDrag.keys());
}

async function keyBy(page, predicateSource) {
    const list = await keys(page);
    const predicate = Function(`return (${predicateSource});`)();
    return list.find(predicate) || null;
}

async function dragBetween(page, sourceEditId, targetEditId) {
    const [from, to] = await page.evaluate(([source, target]) => [
        window.KeyboarderFunctionDrag.centerOf(source),
        window.KeyboarderFunctionDrag.centerOf(target)
    ], [sourceEditId, targetEditId]);
    assert.ok(from && to, `missing drag centers for ${sourceEditId} -> ${targetEditId}`);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 });
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(250);
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
    await page.waitForFunction(() =>
        !!window.KeyboarderFunctionDrag?.keys
        && !!window.KeyboarderExport?.cleanSvgSnapshot
        && window.KeyboarderFunctionDrag.keys().length >= 100);
    await page.evaluate(() => {
        document.querySelectorAll('.controls-panel').forEach((panel) => panel.classList.add('panel-collapsed'));
    });

    const esc = await keyBy(page, "(k) => k.row === 0 && k.block === 'main' && k.text.includes('esc')");
    const f1 = await keyBy(page, "(k) => k.row === 0 && k.block === 'main' && k.text.includes('F1')");
    assert.deepEqual(esc.icons, []);
    assert.deepEqual(f1.icons, ['volume-mute']);
    await dragBetween(page, f1.editId, esc.editId);

    const afterF = await keys(page);
    const escAfter = afterF.find((k) => k.editId === esc.editId);
    const f1After = afterF.find((k) => k.editId === f1.editId);
    assert.deepEqual(escAfter.text, ['esc']);
    assert.deepEqual(f1After.text, ['F1']);
    assert.deepEqual(escAfter.icons, ['volume-mute']);
    assert.deepEqual(f1After.icons, []);
    assert.equal(escAfter.x, esc.x);
    assert.equal(f1After.x, f1.x);

    const rightAlt = afterF
        .filter((k) => k.row === 5 && k.block === 'main' && k.text.join('/') === 'alt/cmd')
        .sort((a, b) => b.x - a.x)[0];
    const rightFn = afterF
        .filter((k) => k.row === 5 && k.block === 'main' && k.text.join('/') === 'fn')
        .sort((a, b) => b.x - a.x)[0];
    assert.ok(rightAlt && rightFn, 'expected right bottom-row alt/cmd and fn keys');
    await dragBetween(page, rightFn.editId, rightAlt.editId);

    const afterBottom = await keys(page);
    const altAfter = afterBottom.find((k) => k.editId === rightAlt.editId);
    const fnAfter = afterBottom.find((k) => k.editId === rightFn.editId);
    assert.deepEqual(altAfter.text, ['fn']);
    assert.deepEqual(fnAfter.text, ['alt', 'cmd']);
    assert.equal(altAfter.x, rightAlt.x);
    assert.equal(fnAfter.x, rightFn.x);

    const numpad4 = afterBottom.find((k) => k.block === 'numpad' && k.text.join('/') === '4');
    const numpad6 = afterBottom.find((k) => k.block === 'numpad' && k.text.join('/') === '6');
    assert.ok(numpad4 && numpad6, 'expected numpad 4 and 6 keys');
    await dragBetween(page, numpad4.editId, numpad6.editId);

    const afterNumpad = await keys(page);
    const numpad4After = afterNumpad.find((k) => k.editId === numpad4.editId);
    const numpad6After = afterNumpad.find((k) => k.editId === numpad6.editId);
    assert.deepEqual(numpad4After.text, ['6']);
    assert.deepEqual(numpad4After.icons, ['numpad-right']);
    assert.deepEqual(numpad6After.text, ['4']);
    assert.deepEqual(numpad6After.icons, ['numpad-left']);
    assert.equal(numpad4After.x, numpad4.x);
    assert.equal(numpad6After.x, numpad6.x);

    const clean = await page.evaluate(() => window.KeyboarderExport.cleanSvgSnapshot());
    assert.equal(clean.hasInteractive, false);
    assert.equal(clean.layerCounts.interactive, 0);

    console.log(JSON.stringify({
        url: server.url,
        fRow: {
            source: f1.editId,
            target: esc.editId,
            targetIcons: escAfter.icons,
            sourceText: f1After.text
        },
        bottomRow: {
            source: rightFn.editId,
            target: rightAlt.editId,
            targetText: altAfter.text,
            sourceText: fnAfter.text
        },
        numpad: {
            source: numpad4.editId,
            target: numpad6.editId,
            targetText: numpad6After.text,
            sourceText: numpad4After.text
        }
    }, null, 2));
    console.log('browser function drag smoke passed');
} finally {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
}
