import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.WANDER_NODE_MODULES ? resolve(process.env.WANDER_NODE_MODULES, 'playwright') : 'playwright');
const sharp = require(process.env.WANDER_NODE_MODULES ? resolve(process.env.WANDER_NODE_MODULES, 'sharp') : 'sharp');
const browser = await chromium.launch({ headless: true, executablePath: process.env.WANDER_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const checks = [];
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(process.env.WANDER_URL || 'http://127.0.0.1:8016/wander_wall/');
    await page.waitForSelector('html[data-ready="true"]');
    await page.evaluate(async () => { window.wall = await import('./tool.js'); });
    const snapshot = () => page.evaluate(() => wall.app.getSnapshot());
    const idle = async () => { await page.waitForFunction(() => !document.getElementById('compositionFieldset').disabled); await page.evaluate(async () => { await wall.assets.prepare(wall.app.settings.items); wall.app.renderNow(); }); };
    const initial = await snapshot();
    assert.equal(initial.items.length, 10);
    assert.ok(initial.items.every(item => item.asset));
    const pixelCount = await page.evaluate(() => {
        const canvas = document.getElementById('mainCanvas'), data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let opaque = 0, colorful = 0;
        for (let i = 0; i < data.length; i += 4) { if (data[i + 3]) opaque++; if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 60) colorful++; }
        return { opaque, colorful };
    });
    assert.ok(pixelCount.opaque > 200000 && pixelCount.colorful > 100000);
    checks.push('Desktop startup: loaded assets, nonblank colorful canvas, no console errors.');
    await page.screenshot({ path: '/tmp/wander-wall-desktop.png', fullPage: true });

    const visiblePoint = id => page.evaluate(id => {
        const scene = wall.app.settings, item = id ? scene.items.find(item => item.id === id) : scene.items.at(-1), size = wall.geometry.dimensions(item, scene);
        for (let y = -.4; y <= .4; y += .1) for (let x = -.4; x <= .4; x += .1) {
            const px = item.x * scene.width + size.width * x, py = item.y * scene.height + size.height * y;
            if (!wall.geometry.contains(item, scene, px, py)) continue;
            const rect = document.getElementById('mainCanvas').getBoundingClientRect(), target = wall.app.target;
            return { id: item.id, x: rect.x + target.panX + px * target.zoom, y: rect.y + target.panY + py * target.zoom };
        }
    }, id);
    const clickPoint = await visiblePoint();
    await page.mouse.click(clickPoint.x, clickPoint.y); await idle();
    let state = await snapshot(), changed = state.items.find(item => item.id === clickPoint.id);
    assert.notEqual(changed.asset, initial.items.at(-1).asset); assert.equal(changed.pinned, true);
    await page.locator('#undoBtn').click(); await idle();
    assert.deepEqual(await snapshot(), initial);
    await page.locator('#redoBtn').click(); await idle();
    assert.equal((await snapshot()).items.find(item => item.id === changed.id).asset, changed.asset);
    checks.push('Click cycles a letter variant, pins the edit, and undo/redo restores exact scenes.');

    const beforeDrag = await snapshot();
    const dragPoint = await visiblePoint(clickPoint.id);
    await page.mouse.move(dragPoint.x, dragPoint.y); await page.mouse.down(); await page.mouse.move(dragPoint.x - 22, dragPoint.y - 16, { steps: 8 }); await page.mouse.up();
    state = await snapshot();
    const dragged = state.items.find(item => item.id === clickPoint.id);
    assert.ok(dragged.x !== changed.x || dragged.y !== changed.y);
    await page.locator('#undoBtn').click(); await idle(); assert.deepEqual(await snapshot(), beforeDrag);
    await page.locator('#redoBtn').click(); await idle();
    const pinned = (await snapshot()).items.find(item => item.id === clickPoint.id);
    await page.locator('#generateBtn').click(); await idle();
    assert.deepEqual((await snapshot()).items.find(item => item.id === pinned.id), pinned);
    checks.push('Dragging is one undo step; Generate keeps the exact pinned element.');

    await page.locator('[data-item="form-0"]').click();
    const handle = await page.evaluate(() => {
        const item = wall.editor.item(), handle = wall.editor.handles(item).rotate, rect = wall.app.target.canvas.getBoundingClientRect(), t = wall.app.target;
        const cx = item.x * wall.app.settings.width, cy = item.y * wall.app.settings.height, dx = handle.x - cx, dy = handle.y - cy;
        return { x: rect.x + t.panX + handle.x * t.zoom, y: rect.y + t.panY + handle.y * t.zoom,
            toX: rect.x + t.panX + (cx + dx * Math.cos(.4) - dy * Math.sin(.4)) * t.zoom,
            toY: rect.y + t.panY + (cy + dx * Math.sin(.4) + dy * Math.cos(.4)) * t.zoom, before: item.rotation };
    });
    await page.mouse.move(handle.x, handle.y); await page.mouse.down(); await page.mouse.move(handle.toX, handle.toY, { steps: 6 }); await page.mouse.up();
    assert.ok(Math.abs((await snapshot()).items.find(item => item.id === 'form-0').rotation - handle.before) > 10);
    const beforeScale = (await snapshot()).items.find(item => item.id === 'form-0').scale;
    await page.locator('#scaleSlider').evaluate(element => { element.value = '40'; element.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(240);
    assert.notEqual((await snapshot()).items.find(item => item.id === 'form-0').scale, beforeScale);
    await page.locator('#xInput').fill('50'); await page.locator('#xInput').press('Tab');
    assert.equal((await snapshot()).items.find(item => item.id === 'form-0').x, .5);
    checks.push('Rotation handle, scale control, and position inputs edit and pin selected elements.');

    await page.locator('#formCountSlider').evaluate(element => { element.value = '2'; element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); }); await idle();
    assert.equal((await snapshot()).items.filter(item => item.kind === 'form').length, 2);
    await page.locator('label:has(#formsToggle)').click(); await idle(); assert.equal((await snapshot()).items.filter(item => item.kind === 'form').length, 0);
    await page.locator('label:has(#formsToggle)').click(); await idle(); assert.equal((await snapshot()).items.filter(item => item.kind === 'form').length, 2);
    await page.locator('#textInput').fill('ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF'); await page.locator('#applyTextBtn').click(); await idle();
    assert.equal((await snapshot()).items.filter(item => item.kind === 'letter').length, 32);
    await page.locator('label:has(#shuffleToggle)').click(); await idle(); assert.equal((await snapshot()).shuffle, true);
    await page.locator('label[for="formatPhone"]').click(); await idle();
    state = await snapshot(); assert.equal(state.width, 1290); assert.equal(state.height, 2796);
    const withinBounds = await page.evaluate(() => wall.app.settings.items.every(item => {
        const scene = wall.app.settings, box = wall.geometry.box(item, scene);
        return item.x * scene.width - box.width / 2 >= 0 && item.y * scene.height - box.height / 2 >= 0 && item.x * scene.width + box.width / 2 <= scene.width && item.y * scene.height + box.height / 2 <= scene.height;
    }));
    assert.ok(withinBounds);
    checks.push('Forms on/off/count, 32 letters, shuffle, and iPhone format keep all elements inside the canvas.');

    // Import a known six-letter document for full-resolution artifact and mobile checks.
    await page.locator('#jsonFileInput').setInputFiles({ name: 'wall.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ type: 'wander-wall', version: 1, settings: initial })) }); await idle();
    assert.deepEqual(await snapshot(), initial);
    await page.locator('[data-item="letter-1"]').click();
    await page.screenshot({ path: '/tmp/wander-wall-selection.png', fullPage: true });
    const exportWithoutUI = async () => page.evaluate(async () => Array.from(new Uint8Array(await (await wall.renderPNG(wall.app.getSnapshot(), wall.assets, wall.geometry)).arrayBuffer())));
    const selectedPNG = Buffer.from(await exportWithoutUI());
    await page.evaluate(() => wall.editor.select(null));
    assert.deepEqual(Buffer.from(await exportWithoutUI()), selectedPNG);
    const [desktopDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#exportPngBtn').click()]);
    await desktopDownload.saveAs('/tmp/wander-wall-export-desktop.png');
    const desktopImage = await sharp('/tmp/wander-wall-export-desktop.png').metadata();
    assert.equal(desktopImage.width, 3840); assert.equal(desktopImage.height, 2160);
    assert.deepEqual(await readFile('/tmp/wander-wall-export-desktop.png'), selectedPNG);
    checks.push('Real 3840 x 2160 PNG download exactly matches the artwork renderer and excludes selection handles.');

    await page.locator('label[for="formatPhone"]').click(); await idle();
    const [phoneDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#exportPngBtn').click()]);
    await phoneDownload.saveAs('/tmp/wander-wall-export-phone.png');
    const phoneImage = await sharp('/tmp/wander-wall-export-phone.png').metadata();
    assert.equal(phoneImage.width, 1290); assert.equal(phoneImage.height, 2796);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: '/tmp/wander-wall-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 430, height: 932 }); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    checks.push('Real 1290 x 2796 PNG download; responsive iPhone preview at 390 and 430 px without horizontal overflow.');

    await page.setViewportSize({ width: 1440, height: 900 });
    const beforeInvalid = await snapshot();
    await page.locator('#jsonFileInput').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"type":"other","version":1}') });
    await page.waitForFunction(() => document.getElementById('operationStatus').textContent.includes('Wander Wall'));
    assert.deepEqual(await snapshot(), beforeInvalid);
    await page.locator('#savePresetBtn').click();
    await page.locator('#dialog[open]').waitFor(); await page.locator('#dialogInput').fill('Browser check');
    await page.locator('#dialogButtons button').filter({ hasText: /^Save$/ }).click();
    await page.waitForFunction(() => !document.getElementById('dialog').open);
    await page.reload(); await page.waitForSelector('html[data-ready="true"]');
    await page.evaluate(async () => { window.wall = await import('./tool.js'); }); await idle();
    assert.deepEqual(await snapshot(), beforeInvalid);
    await page.locator('#presetToolbarShareBtn').click();
    const sharedURL = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(sharedURL.includes('#p='));
    const shared = await context.newPage(); await shared.goto(sharedURL); await shared.waitForSelector('html[data-ready="true"]');
    const sharedState = await shared.evaluate(async () => (await import('./tool.js')).app.getSnapshot());
    assert.deepEqual(sharedState, beforeInvalid);
    await shared.close();
    checks.push('JSON round trip, invalid-import recovery, saved-preset reload, and share-link round trip preserve exact compositions.');
    assert.deepEqual(errors, []);
    await writeFile(new URL('./acceptance.json', import.meta.url), JSON.stringify({ date: '2026-10-09', status: 'passed', checks, consoleErrors: errors, screenshots: ['/tmp/wander-wall-desktop.png', '/tmp/wander-wall-selection.png', '/tmp/wander-wall-mobile.png'], artifacts: ['/tmp/wander-wall-export-desktop.png', '/tmp/wander-wall-export-phone.png'] }, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} finally { await browser.close(); }
