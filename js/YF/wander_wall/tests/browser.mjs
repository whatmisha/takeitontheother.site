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
    await page.goto(process.env.WANDER_URL || 'http://127.0.0.1:8020/wander_wall/');
    await page.waitForSelector('html[data-ready="true"]');
    await page.evaluate(async () => { window.wall = await import('./tool.js'); });
    const snapshot = () => page.evaluate(() => wall.app.getSnapshot());
    const idle = async () => { await page.waitForFunction(() => !document.getElementById('compositionFieldset').disabled && !document.getElementById('exportPngBtn').disabled); await page.evaluate(async () => { await wall.assets.prepare(wall.app.settings.items); wall.app.renderNow(); }); };
    const history = async (redo = false) => { await page.locator('#canvasContainer').focus(); await page.keyboard.press(redo ? 'ControlOrMeta+Shift+z' : 'ControlOrMeta+z'); };
    const selectLayer = async id => { await page.locator(`[data-item="${id}"] .layer-select`).click(); assert.equal(await page.locator('#variantDialog').isVisible(), false); };
    const initial = await snapshot();
    assert.equal(initial.text, 'Wander');
    assert.equal(initial.items.length, 17);
    assert.equal(initial.formCount, 10);
    assert.deepEqual([initial.width, initial.height], [2560, 1440]);
    for (const id of ['selectionPanel', 'selectionTab', 'seedInput', 'shuffleToggle', 'formsToggle', 'groundToggle', 'shadowOptions', 'outlineEnabledToggle', 'pinCount', 'layoutHeading', 'effectsHeading']) assert.equal(await page.locator('#' + id).count(), 0);
    assert.equal(initial.shadowEnabled, true); assert.equal(initial.shadowBlur, 80);
    assert.equal(await page.locator('#textInput').getAttribute('rows'), '2');
    assert.ok(await page.locator('#backgroundPanel').evaluate(node => node.classList.contains('panel-collapsed')));
    const surfaceIndex = initial.items.findIndex(item => item.kind === 'ground');
    assert.ok(surfaceIndex >= 0 && surfaceIndex <= Math.floor((initial.items.length - 1) / 2));
    const withoutSurface = scene => scene.items.filter(item => item.kind !== 'ground');
    assert.ok(initial.items.every(item => item.asset));
    assert.equal(await page.locator('.stage-toolbar').count(), 0);
    await page.locator('#resolutionSelect').selectOption('fhd'); await idle();
    assert.equal((await snapshot()).width, 1920);
    assert.deepEqual((await snapshot()).items, initial.items);
    for (const id of ['widthInput', 'heightInput']) {
        assert.equal(await page.locator('#' + id).isVisible(), false);
        assert.equal(await page.locator('#' + id).isEnabled(), false);
    }
    assert.equal(await page.locator('#resolutionSelect option').last().getAttribute('value'), 'custom');
    assert.equal(await page.locator('#resolutionSelect option[value="custom"]').isEnabled(), true);
    await page.locator('#resolutionSelect').selectOption('qhd'); await idle();
    assert.equal((await snapshot()).format, 'qhd');
    assert.deepEqual((await snapshot()).items, initial.items);
    await history(); await idle(); assert.equal((await snapshot()).format, 'fhd');
    await history(); await idle(); assert.deepEqual(await snapshot(), initial);
    await page.locator('#resolutionSelect').selectOption('custom'); await idle();
    assert.equal(await page.locator('#widthInput').isVisible(), true);
    assert.equal(await page.locator('#heightInput').isEnabled(), true);
    await page.locator('#widthInput').press('ArrowUp');
    await page.waitForFunction(() => wall.app.settings.width === 2561); await idle();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'widthInput');
    await history(); await idle();
    await page.locator('#heightInput').press('Shift+ArrowDown');
    await page.waitForFunction(() => wall.app.settings.height === 1430); await idle();
    await history(); await idle(); await history(); await idle();
    assert.deepEqual(await snapshot(), initial);
    assert.equal(await page.locator('#widthInput').isVisible(), false);
    checks.push('Custom is last, reveals dimensions and supports 1px/Shift-10px arrow edits; undo restores the resolution and visibility.');
    const pixelCount = await page.evaluate(() => {
        const canvas = document.getElementById('mainCanvas'), data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let opaque = 0, colorful = 0;
        for (let i = 0; i < data.length; i += 4) { if (data[i + 3]) opaque++; if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 60) colorful++; }
        return { opaque, colorful };
    });
    assert.ok(pixelCount.opaque > 200000 && pixelCount.colorful > 100000);
    checks.push('Desktop startup: loaded assets, nonblank colorful canvas, no console errors.');
    await page.screenshot({ path: '/tmp/wander-wall-desktop.png', fullPage: true });

    await selectLayer('ground-0');
    assert.equal(await page.locator('[data-item="ground-0"] .layer-grip').isDisabled(), false);
    await page.evaluate(() => wall.editor.transform({ scale: .5, rotation: 25, x: .4 })); await idle();
    assert.equal((await snapshot()).items[surfaceIndex].scale, .5);
    assert.equal((await snapshot()).items[surfaceIndex].rotation, 25);
    assert.deepEqual(withoutSurface(await snapshot()), withoutSurface(initial));
    await history(); await idle(); assert.deepEqual(await snapshot(), initial);
    await page.locator('[data-item="ground-0"] .layer-select').dblclick();
    assert.ok(await page.locator('#closeVariantsBtn').evaluate(node => node.classList.contains('modal-close')));
    await page.locator('#variantGrid button:not([aria-pressed="true"])').first().click(); await idle();
    assert.notEqual((await snapshot()).items[surfaceIndex].asset, initial.items[surfaceIndex].asset);
    assert.deepEqual(withoutSurface(await snapshot()), withoutSurface(initial));
    await history(); await idle();
    await page.locator('[data-item="ground-0"] [data-action="visibility"]').click(); await idle();
    assert.equal((await snapshot()).items[surfaceIndex].visible, false);
    assert.deepEqual(withoutSurface(await snapshot()), withoutSurface(initial));
    await history(); await idle(); assert.deepEqual(await snapshot(), initial);
    checks.push('Surface supports transforms and per-layer visibility; single layer click selects and double click opens variants.');

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
    assert.deepEqual(await snapshot(), initial);
    await page.mouse.dblclick(clickPoint.x, clickPoint.y); await idle();
    let state = await snapshot(), changed = state.items.find(item => item.id === clickPoint.id);
    assert.notEqual(changed.asset, initial.items.at(-1).asset); assert.equal(changed.pinned, false);
    await history(); await idle();
    assert.deepEqual(await snapshot(), initial);
    await history(true); await idle();
    assert.equal((await snapshot()).items.find(item => item.id === changed.id).asset, changed.asset);
    checks.push('Single click selects; double-click cycles without auto-pinning; keyboard undo/redo restores exact scenes.');

    const movePoint = await visiblePoint(clickPoint.id), beforeSelect = await snapshot();
    await page.mouse.click(movePoint.x, movePoint.y); await idle();
    assert.deepEqual(await snapshot(), beforeSelect);
    checks.push('Clicking selects artwork without changing its variant or history.');

    const beforeDrag = await snapshot();
    const dragPoint = await visiblePoint(clickPoint.id);
    await page.mouse.move(dragPoint.x, dragPoint.y); await page.mouse.down(); await page.mouse.move(dragPoint.x - 22, dragPoint.y - 16, { steps: 8 }); await page.mouse.up();
    state = await snapshot();
    const dragged = state.items.find(item => item.id === clickPoint.id);
    assert.ok(dragged.x !== changed.x || dragged.y !== changed.y);
    await history(); await idle(); assert.deepEqual(await snapshot(), beforeDrag);
    await history(true); await idle();
    assert.equal((await snapshot()).items.find(item => item.id === clickPoint.id).pinned, false);
    await page.locator('#elementList .is-selected [data-action="pin"]').click();
    const pinned = (await snapshot()).items.find(item => item.id === clickPoint.id);
    await page.locator('#generateBtn').click(); await idle();
    assert.deepEqual((await snapshot()).items.find(item => item.id === pinned.id), pinned);
    checks.push('Dragging is one undo step and does not pin; explicit pins survive Generate.');

    await selectLayer('form-0');
    const handle = await page.evaluate(() => {
        const item = wall.editor.item(), top = wall.editor.handles(item).resizeN, rect = wall.app.target.canvas.getBoundingClientRect(), t = wall.app.target;
        const angle = item.rotation * Math.PI / 180;
        const handle = { x: top.x + Math.sin(angle) * 20 / t.zoom, y: top.y - Math.cos(angle) * 20 / t.zoom };
        const cx = item.x * wall.app.settings.width, cy = item.y * wall.app.settings.height, dx = handle.x - cx, dy = handle.y - cy;
        return { x: rect.x + t.panX + handle.x * t.zoom, y: rect.y + t.panY + handle.y * t.zoom,
            toX: rect.x + t.panX + (cx + dx * Math.cos(.4) - dy * Math.sin(.4)) * t.zoom,
            toY: rect.y + t.panY + (cy + dx * Math.sin(.4) + dy * Math.cos(.4)) * t.zoom, before: item.rotation };
    });
    await page.mouse.move(handle.x, handle.y); await page.mouse.down(); await page.mouse.move(handle.toX, handle.toY, { steps: 6 }); await page.mouse.up();
    assert.ok(Math.abs((await snapshot()).items.find(item => item.id === 'form-0').rotation - handle.before) > 10);
    const beforeScale = (await snapshot()).items.find(item => item.id === 'form-0').scale;
    await page.evaluate(() => wall.editor.transform({ scale: .4 }));
    await page.waitForTimeout(240);
    assert.notEqual((await snapshot()).items.find(item => item.id === 'form-0').scale, beforeScale);
    await page.evaluate(() => wall.editor.transform({ x: -3.5 }));
    assert.equal((await snapshot()).items.find(item => item.id === 'form-0').x, -3.5);
    const offboard = (await snapshot()).items.find(item => item.id === 'form-0');
    await page.locator('#elementList .is-selected [data-action="visibility"]').click(); await page.locator('#elementList .is-selected [data-action="visibility"]').click();
    assert.deepEqual((await snapshot()).items.find(item => item.id === 'form-0'), offboard);
    await page.evaluate(() => wall.editor.transform({ x: .5 }));
    assert.equal((await snapshot()).items.find(item => item.id === 'form-0').x, .5);
    assert.equal((await snapshot()).items.find(item => item.id === 'form-0').pinned, false);
    await page.evaluate(() => wall.editor.transform({ rotation: 12.5 }));
    assert.equal((await snapshot()).items.find(item => item.id === 'form-0').rotation, 12.5);
    await page.evaluate(() => wall.editor.transform({ scale: .285 }));
    assert.equal((await snapshot()).items.find(item => item.id === 'form-0').scale, .285);
    checks.push('Rotation zones and editor transforms preserve free positions, size and angle without auto-pinning.');

    const listOrder = () => page.locator('#elementList [data-item]').evaluateAll(rows => rows.map(row => row.dataset.item));
    assert.deepEqual(await listOrder(), (await snapshot()).items.map(item => item.id).reverse());
    const beforeOrder = await snapshot();
    await page.locator('#canvasContainer').focus(); await page.keyboard.press(']');
    assert.equal((await snapshot()).items.at(-1).id, 'form-0');
    await page.keyboard.press('[');
    assert.equal((await snapshot()).items[0].id, 'form-0');
    await history(); await idle(); await history(); await idle(); assert.deepEqual(await snapshot(), beforeOrder);
    await page.locator('#canvasContainer').focus(); await page.keyboard.press('ControlOrMeta+]');
    assert.notDeepEqual(await snapshot(), beforeOrder);
    assert.deepEqual(await listOrder(), (await snapshot()).items.map(item => item.id).reverse());
    await history(); await idle(); assert.deepEqual(await snapshot(), beforeOrder);
    await history(true); await idle();
    await page.locator('[data-item="letter-5"] .layer-grip').scrollIntoViewIfNeeded();
    const grip = await page.locator('[data-item="letter-5"] .layer-grip').boundingBox();
    const targetRow = await page.locator('[data-item="letter-4"]').boundingBox();
    const beforeReorder = await snapshot();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, targetRow.y + targetRow.height - 5, { steps: 10 }); await page.mouse.up();
    assert.notDeepEqual(await snapshot(), beforeReorder);
    assert.deepEqual(await listOrder(), (await snapshot()).items.map(item => item.id).reverse());
    await history(); await idle(); assert.deepEqual(await snapshot(), beforeReorder);
    checks.push('Layer rows reflect front-to-back order; arrow and pointer reordering are undoable.');

    await page.locator('[data-item="letter-4"] [data-action="pin"]').click();
    const beforeUnpin = await snapshot(); assert.ok(beforeUnpin.items.filter(item => item.pinned).length >= 2);
    await page.locator('[data-item="letter-4"] [data-action="pin"]').click();
    assert.equal((await snapshot()).items.find(item => item.id === 'letter-4').pinned, false);
    await history(); await idle(); assert.deepEqual(await snapshot(), beforeUnpin);
    for (const item of (await snapshot()).items.filter(item => item.pinned)) await page.locator(`[data-item="${item.id}"] [data-action="pin"]`).click();
    assert.equal(await page.locator('#unpinAllBtn').count(), 0);
    checks.push('Per-row pins are explicit and undoable; the bulk unpin command is absent.');

    await page.locator('#textInput').fill('HeLlo');
    await page.locator('#textInput').press('Tab'); await idle();
    assert.equal((await snapshot()).text, 'HeLlo'); assert.equal(await page.locator('#textInput').inputValue(), 'HeLlo');
    await page.locator('#textInput').fill('WORLD'); await idle(); assert.equal((await snapshot()).text, 'WORLD');
    await history(); await idle(); assert.equal((await snapshot()).text, 'HeLlo');
    await history(true); await idle(); assert.equal((await snapshot()).text, 'WORLD');
    await page.route('**/graphics/**/*.png', async route => { await new Promise(resolve => setTimeout(resolve, 500)); await route.continue(); });
    await page.locator('#textInput').fill('QZX');
    await page.waitForFunction(() => document.getElementById('compositionFieldset').disabled);
    await page.locator('#textInput').fill('QUICK'); await idle();
    assert.equal((await snapshot()).text, 'QUICK'); assert.equal(await page.locator('#textInput').inputValue(), 'QUICK');
    await page.unroute('**/graphics/**/*.png');
    checks.push('Text auto-applies, survives another control change, and retains edits made during asset loading.');

    const beforeFill = (await snapshot()).fill;
    await page.locator('#fillSlider').evaluate((slider, original) => {
        slider.value = String(original + 5); slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.value = String(original); slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, beforeFill);
    await page.waitForTimeout(240); await idle(); assert.equal((await snapshot()).fill, beforeFill);
    await page.locator('#fillValue').fill('110'); await page.locator('#fillValue').press('Enter'); await idle();
    assert.equal((await snapshot()).fill, 110);
    checks.push('Composition values accept exact input; reversing a pending slider edit leaves the original value.');

    await page.locator('#formCountSlider').evaluate(element => { element.value = '2'; element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); }); await idle();
    assert.equal((await snapshot()).items.filter(item => item.kind === 'form').length, 2);
    await page.locator('#formCountValue').fill('0'); await page.locator('#formCountValue').press('Enter'); await idle(); assert.equal((await snapshot()).items.filter(item => item.kind === 'form').length, 0);
    await page.locator('#formCountValue').fill('2'); await page.locator('#formCountValue').press('Enter'); await idle(); assert.equal((await snapshot()).items.filter(item => item.kind === 'form').length, 2);
    await page.locator('#textInput').fill('ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF'); await idle();
    assert.equal((await snapshot()).items.filter(item => item.kind === 'letter').length, 32);
    assert.equal((await snapshot()).shuffle, false);
    await page.locator('#resolutionSelect').selectOption('phone'); await idle();
    state = await snapshot(); assert.equal(state.width, 1290); assert.equal(state.height, 2796);
    const withinBounds = await page.evaluate(() => wall.app.settings.items.filter(item => item.kind !== 'ground').every(item => {
        const scene = wall.app.settings, box = wall.geometry.box(item, scene);
        return item.x * scene.width - box.width / 2 >= 0 && item.y * scene.height - box.height / 2 >= 0 && item.x * scene.width + box.width / 2 <= scene.width && item.y * scene.height + box.height / 2 <= scene.height;
    }));
    assert.ok(withinBounds);
    checks.push('Object count including zero, 32 letters in order, and iPhone format keep generated elements inside the canvas.');

    // Import a known six-letter document for full-resolution artifact and mobile checks.
    await page.locator('#jsonFileInput').setInputFiles({ name: 'wall.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ type: 'wander-wall', version: 1, settings: initial })) }); await idle();
    assert.deepEqual(await snapshot(), initial);
    await selectLayer('letter-1');
    await page.screenshot({ path: '/tmp/wander-wall-selection.png', fullPage: true });
    const exportWithoutUI = async () => page.evaluate(async () => Array.from(new Uint8Array(await (await wall.renderPNG(wall.app.getSnapshot(), wall.assets, wall.geometry)).arrayBuffer())));
    const selectedPNG = Buffer.from(await exportWithoutUI());
    await page.evaluate(() => wall.editor.select(null));
    assert.deepEqual(Buffer.from(await exportWithoutUI()), selectedPNG);
    const [desktopDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#exportPngBtn').click()]);
    await desktopDownload.saveAs('/tmp/wander-wall-export-desktop.png');
    const desktopImage = await sharp('/tmp/wander-wall-export-desktop.png').metadata();
    assert.equal(desktopImage.width, 2560); assert.equal(desktopImage.height, 1440);
    assert.deepEqual(await readFile('/tmp/wander-wall-export-desktop.png'), selectedPNG);
    checks.push('Real QHD PNG download exactly matches the artwork renderer and excludes selection handles.');

    await page.locator('#resolutionSelect').selectOption('phone'); await idle();
    const [phoneDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#exportPngBtn').click()]);
    await phoneDownload.saveAs('/tmp/wander-wall-export-phone.png');
    const phoneImage = await sharp('/tmp/wander-wall-export-phone.png').metadata();
    assert.equal(phoneImage.width, 1290); assert.equal(phoneImage.height, 2796);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await page.locator('#elementsTab').click();
    await selectLayer('letter-5');
    assert.equal(await page.locator('#elementsTab').getAttribute('aria-selected'), 'true');
    const mobileArtwork = await page.locator('#canvasContainer').boundingBox();
    await page.evaluate(() => wall.editor.transform({ scale: .25 }));
    assert.equal((await snapshot()).items.find(item => item.id === 'letter-5').scale, .25);
    assert.deepEqual(await page.locator('#canvasContainer').boundingBox(), mobileArtwork);
    const panel = await page.locator('#elementsPanel').boundingBox(), dock = await page.locator('.action-dock').boundingBox();
    assert.ok(mobileArtwork.y + mobileArtwork.height < panel.y);
    assert.ok(panel.y + panel.height <= dock.y + 1);
    await page.screenshot({ path: '/tmp/wander-wall-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), true);
    await page.locator('#sheetToggleBtn').click(); await page.waitForTimeout(100);
    assert.ok((await page.locator('#canvasContainer').boundingBox()).height > mobileArtwork.height);
    await page.locator('#compositionTab').click();
    await page.setViewportSize({ width: 430, height: 932 }); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    checks.push('Real phone PNG download; mobile layer selection keeps the list and canvas stationary, with collapsible panels and no dock overlap.');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#jsonFileInput').setInputFiles({ name: 'visibility.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ type: 'wander-wall', version: 1, settings: initial })) }); await idle();
    await selectLayer('letter-5');
    const beforeHide = await snapshot(), hiddenPoint = await visiblePoint('letter-5');
    await page.keyboard.press('Delete');
    assert.equal((await snapshot()).items.find(item => item.id === 'letter-5').visible, false);
    assert.equal((await snapshot()).text, beforeHide.text);
    assert.equal(await page.locator('[data-item="letter-5"] .ui-meta').textContent(), 'Hidden');
    assert.equal(await page.locator('[data-item="letter-5"] [data-action="visibility"]').getAttribute('aria-label'), 'Show Letter R 6');
    const hiddenExport = await page.evaluate(async () => {
        const scene = wall.app.getSnapshot(), digest = async snapshot => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await (await wall.renderPNG(snapshot, wall.assets, wall.geometry)).arrayBuffer()))).join(',');
        return [await digest(scene), await digest({ ...scene, items: scene.items.filter(item => item.visible !== false) })];
    });
    assert.equal(hiddenExport[0], hiddenExport[1]);
    await page.mouse.click(hiddenPoint.x, hiddenPoint.y);
    assert.notEqual(await page.evaluate(() => wall.editor.selected), 'letter-5');
    await history(); await idle(); assert.deepEqual(await snapshot(), beforeHide);
    await history(true); await idle();
    await page.locator('#generateBtn').click(); await idle();
    assert.equal((await snapshot()).items.find(item => item.id === 'letter-5').visible, false);
    await page.locator('[data-item="letter-5"] [data-action="visibility"]').click(); assert.ok((await snapshot()).items.every(item => item.visible));
    await page.locator('[data-item="form-0"] [data-action="visibility"]').click();
    assert.equal((await snapshot()).items.find(item => item.id === 'form-0').visible, false);
    await page.locator('[data-item="form-0"] [data-action="visibility"]').click();
    assert.equal(await page.locator('#showAllBtn, #backgroundDirection').count(), 0);
    checks.push('Delete and eye buttons hide layers without editing text; hidden layers survive Generate, ignore canvas clicks, and are absent from PNG. Eye buttons and undo restore them.');

    await selectLayer('letter-1');
    await page.evaluate(() => {
        const load = wall.assets.load;
        wall.assets.load = async function(id) { this.load = load; await new Promise(resolve => setTimeout(resolve, 500)); return load.call(this, id); };
        const slider = document.getElementById('rotationRangeSlider');
        slider.value = '80'; slider.dispatchEvent(new Event('input', { bubbles: true }));
        wall.editor.nextVariant(wall.editor.selected);
    });
    await idle(); assert.equal((await snapshot()).rotationRange, 80);
    await page.locator('#rotationRangeValue').fill('0'); await page.locator('#rotationRangeValue').press('Enter'); await idle();
    assert.ok((await snapshot()).items.every(item => item.rotation === 0));
    await selectLayer('letter-0');
    await page.evaluate(() => wall.editor.transform({ rotation: 43 }));
    await page.locator('#elementList .is-selected [data-action="pin"]').click();
    await page.locator('#rotationRangeValue').fill('65'); await page.locator('#rotationRangeValue').press('Enter'); await idle();
    await page.locator('#generateBtn').click(); await idle();
    assert.equal((await snapshot()).items.find(item => item.id === 'letter-0').rotation, 43);
    assert.ok((await snapshot()).items.filter(item => !item.pinned).every(item => Math.abs(item.rotation) <= 65));
    for (const item of (await snapshot()).items.filter(item => item.pinned)) await page.locator(`[data-item="${item.id}"] [data-action="pin"]`).click();
    checks.push('Rotation range survives overlapping variant loads, zero makes free layers upright, and pinned angles survive regeneration.');

    await page.locator('#overflowValue').fill('25'); await page.locator('#overflowValue').press('Enter'); await idle();
    await selectLayer('letter-5');
    await page.evaluate(() => wall.editor.transform({ x: 0 }));
    const leftOverflow = () => page.evaluate(() => {
        const scene = wall.app.settings, item = scene.items.find(item => item.id === 'letter-5'), box = wall.geometry.box(item, scene);
        return (box.width / 2 - item.x * scene.width) / box.width;
    });
    assert.ok(Math.abs(await leftOverflow() - .5) < 1e-6);
    await page.locator('#elementList .is-selected [data-action="pin"]').click();
    await page.locator('#overflowValue').fill('0'); await page.locator('#overflowValue').press('Enter'); await idle();
    assert.ok(Math.abs(await leftOverflow() - .5) < 1e-6);
    assert.equal((await snapshot()).items.find(item => item.id === 'letter-5').pinned, true);
    await page.locator('#overflowValue').fill('20'); await page.locator('#overflowValue').press('Enter'); await idle();
    await page.locator('[data-item="letter-0"] [data-action="visibility"]').click();
    await page.evaluate(() => { wall.editor.select(null); wall.app.renderNow(); });
    await page.screenshot({ path: '/tmp/wander-wall-layout-controls.png' });
    const newSettings = await snapshot();
    await page.locator('#jsonFileInput').setInputFiles({ name: 'controls.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ type: 'wander-wall', version: 1, settings: newSettings })) }); await idle();
    assert.deepEqual(await snapshot(), newSettings);
    checks.push('Manual placement ignores generation overflow; pins preserve it after changing the limit, and JSON retains all settings.');

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

    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const touch = await touchContext.newPage();
    touch.on('pageerror', error => errors.push(error.message));
    await touch.goto(process.env.WANDER_URL || 'http://127.0.0.1:8020/wander_wall/');
    await touch.waitForSelector('html[data-ready="true"]');
    await touch.evaluate(async () => { window.wall = await import('./tool.js'); });
    const touchPoint = await touch.evaluate(() => {
        const scene = wall.app.settings, item = scene.items.at(-1), size = wall.geometry.dimensions(item, scene), t = wall.app.target, rect = t.canvas.getBoundingClientRect();
        for (let y = -.35; y <= .35; y += .1) for (let x = -.35; x <= .35; x += .1) {
            const px = item.x * scene.width + size.width * x, py = item.y * scene.height + size.height * y;
            if (wall.geometry.contains(item, scene, px, py)) return { id: item.id, asset: item.asset, x: rect.x + t.panX + px * t.zoom, y: rect.y + t.panY + py * t.zoom };
        }
    });
    await touch.touchscreen.tap(touchPoint.x, touchPoint.y);
    assert.equal(await touch.locator('#generalTab').getAttribute('aria-selected'), 'true');
    assert.equal(await touch.evaluate(id => wall.app.settings.items.find(item => item.id === id).asset, touchPoint.id), touchPoint.asset);
    await touch.locator('#elementsTab').tap();
    const touchOrder = () => touch.locator('#elementList [data-item]').evaluateAll(rows => rows.map(row => row.dataset.item));
    const oldTouchOrder = await touchOrder();
    const touchGrip = await touch.locator('#elementList .layer-grip').first().boundingBox(), touchTarget = await touch.locator('#elementList .layer-row').nth(1).boundingBox();
    const cdp = await touchContext.newCDPSession(touch), tx = touchGrip.x + touchGrip.width / 2, ty = touchGrip.y + touchGrip.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty }] });
    for (let step = 1; step <= 8; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx, y: ty + (touchTarget.y + touchTarget.height - 5 - ty) * step / 8 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.notDeepEqual(await touchOrder(), oldTouchOrder);
    assert.deepEqual(await touchOrder(), await touch.evaluate(() => wall.app.settings.items.map(item => item.id).reverse()));
    await touch.locator('#backgroundTab').tap();
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
        await touch.setViewportSize(viewport); await touch.waitForTimeout(100);
        const bounds = await touch.evaluate(() => {
            const canvas = document.getElementById('canvasContainer').getBoundingClientRect(), tabs = document.querySelector('.mobile-panel-tabs').getBoundingClientRect();
            return { overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight, canvasHeight: canvas.height, canvasBottom: canvas.bottom, tabTop: tabs.top,
                backgroundHeight: document.getElementById('backgroundPanel').getBoundingClientRect().height };
        });
        assert.equal(bounds.overflow, false); assert.ok(bounds.canvasHeight > 20);
        assert.ok(bounds.backgroundHeight > 80, 'collapsed desktop Background must expand to the full mobile sheet');
        if (viewport.width <= 768 || (viewport.width <= 1000 && viewport.height <= 600)) assert.ok(bounds.canvasBottom <= bounds.tabTop);
    }
    await touch.setViewportSize({ width: 390, height: 844 });
    await touch.locator('#generalTab').tap(); await touch.locator('#resolutionSelect').selectOption('phone');
    await touch.waitForFunction(() => !document.getElementById('exportPngBtn').disabled);
    await touch.locator('#elementsTab').tap();
    await touch.locator('#elementList [data-action="visibility"]').first().tap();
    assert.equal(await touch.locator('#elementList .is-hidden').count(), 1);
    await touch.locator('#elementList .is-hidden [data-action="visibility"]').tap();
    assert.equal(await touch.locator('#elementList .is-hidden').count(), 0);
    await touch.screenshot({ path: '/tmp/wander-wall-mobile-layers.png' });
    await touch.locator('#generalTab').tap();
    await touch.evaluate(() => {
        Object.defineProperty(visualViewport, 'height', { configurable: true, value: 480 });
        Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 30 });
        visualViewport.dispatchEvent(new Event('resize'));
    });
    const keyboardBounds = await touch.evaluate(() => ({
        keyboard: document.querySelector('.wander-wall').dataset.keyboard,
        dockBottom: document.querySelector('.action-dock').getBoundingClientRect().bottom,
        canvasHeight: document.getElementById('canvasContainer').getBoundingClientRect().height,
        inputBottom: document.getElementById('textInput').getBoundingClientRect().bottom
    }));
    assert.equal(keyboardBounds.keyboard, 'true'); assert.ok(keyboardBounds.canvasHeight > 80);
    assert.ok(keyboardBounds.dockBottom <= 510); assert.ok(keyboardBounds.inputBottom < 440);
    await touch.evaluate(() => { delete visualViewport.height; delete visualViewport.offsetTop; visualViewport.dispatchEvent(new Event('resize')); });
    await touchContext.close();
    checks.push('Real touch selection and layer dragging work; narrow/landscape screens and a simulated keyboard viewport keep the canvas and controls visible.');
    const renderChecks = await context.newPage();
    await renderChecks.goto(new URL('tests/render.html', process.env.WANDER_URL || 'http://127.0.0.1:8020/wander_wall/').href);
    await renderChecks.waitForSelector('html[data-result]');
    assert.equal(await renderChecks.locator('html').getAttribute('data-result'), 'passed', await renderChecks.locator('#results').textContent());
    await renderChecks.close();
    checks.push('Pixel-level checks: shadows affect lower objects only, never the background, and PNG matches the preview.');
    assert.deepEqual(errors, []);
    await writeFile(new URL('./acceptance.json', import.meta.url), JSON.stringify({ date: new Date().toISOString(), status: 'passed', checks, consoleErrors: errors, screenshots: ['/tmp/wander-wall-desktop.png', '/tmp/wander-wall-selection.png', '/tmp/wander-wall-mobile.png'], artifacts: ['/tmp/wander-wall-export-desktop.png', '/tmp/wander-wall-export-phone.png'] }, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} finally { await browser.close(); }
