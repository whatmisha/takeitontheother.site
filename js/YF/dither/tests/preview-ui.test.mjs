import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../dither.js', import.meta.url), 'utf8');
const marker = source.indexOf('// Initialize the tool when the page loads');
assert.ok(marker > 0);
const { DitheringTool } = await import(`data:text/javascript;base64,${Buffer.from(`${source.slice(0, marker)}\nexport { DitheringTool };`).toString('base64')}`);

function preview(scale = 0.5) {
    const tool = Object.create(DitheringTool.prototype);
    tool.canvas = { width: 800, height: 600, getBoundingClientRect: () => ({ width: 800 * scale, height: 600 * scale }) };
    tool.overlayCanvas = {
        width: 1200, height: 1000, style: {},
        getBoundingClientRect: () => ({ left: 100, top: 50, width: 1200 * scale, height: 1000 * scale })
    };
    return tool;
}

test('overlay CSS follows the artwork scale, preserving overflow padding and export buffers', () => {
    for (const scale of [0.25, 0.84, 1, 1.5]) {
        const tool = preview(scale);
        tool.syncOverlaySize();
        assert.equal(parseFloat(tool.overlayCanvas.style.width), 1200 * scale);
        assert.equal(parseFloat(tool.overlayCanvas.style.height), 1000 * scale);
        assert.deepEqual([tool.canvas.width, tool.canvas.height, tool.overlayCanvas.width, tool.overlayCanvas.height], [800, 600, 1200, 1000]);
        assert.deepEqual(tool.getOverlayPoint({ clientX: 100 + 300 * scale, clientY: 50 + 400 * scale }), { x: 300, y: 400 });
    }
});

test('hidden canvas keeps the last usable CSS size and never produces NaN input coordinates', () => {
    const tool = preview(0);
    tool.overlayCanvas.style.width = '600px';
    tool.syncOverlaySize();
    assert.equal(tool.overlayCanvas.style.width, '600px');
    assert.deepEqual(tool.getOverlayPoint({ clientX: 100, clientY: 50 }), { x: 0, y: 0 });
});

test('drag and handle hit testing use buffer coordinates at a reduced preview size', () => {
    const tool = preview();
    tool.originalImage = {};
    tool.transform = { x: 0, y: 0, width: 800, height: 600, rotation: 0 };
    tool.interaction = {};
    tool.updateSlidersFromPosition = () => {};
    tool.requestRedraw = () => {};
    // Middle of the image: buffer (600, 500), CSS (400, 300).
    tool.handleMouseDown({ clientX: 400, clientY: 300 });
    assert.equal(tool.interaction.isDragging, true);
    tool.handleMouseMove({ clientX: 410, clientY: 315 });
    assert.equal(tool.transform.x, 20);
    assert.equal(tool.transform.y, 30);
    tool.transform.x = 0;
    tool.transform.y = 0;
    tool.interaction = {};
    // Top-left handle: buffer (200, 200), CSS (200, 150).
    tool.handleMouseDown({ clientX: 200, clientY: 150 });
    assert.equal(tool.interaction.isResizing, true);
    assert.equal(tool.interaction.resizeHandle, 'nw');
});

test('sources and Reset belong in Texture; the bottom dock contains output actions only', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const panel = html.match(/<aside[^>]*id="transformPanel"[\s\S]*?<\/aside>/u)?.[0];
    const dock = html.match(/<nav[^>]*dither-action-dock[\s\S]*?<\/nav>/u)?.[0];
    assert.ok(panel);
    assert.ok(dock);
    for (const id of ['imageInput', 'sampleInput', 'uploadBtnFixed', 'uploadSampleBtn', 'removeImageBtn', 'removeSampleBtn', 'resetTransform']) {
        assert.equal(html.split(`id="${id}"`).length - 1, 1, `${id} must not be duplicated`);
        assert.ok(panel.includes(`id="${id}"`));
        assert.ok(!dock.includes(`id="${id}"`));
    }
    assert.equal(panel.match(/data-file-shortcut-persistent="true"/gu).length, 2);
    assert.match(source, /root: 'imageSourceIntake'/u);
    assert.match(source, /root: 'layoutSourceIntake'/u);
    assert.match(html, /<canvas id="canvas"[^>]*class="ui-artboard"/u);
    assert.doesNotMatch(html, /<canvas id="overlayCanvas"[^>]*class="ui-artboard"/u);
});

function sizedPreview() {
    const tool = preview();
    tool.canvasSize = null;
    tool.dom = { canvasWidth: {}, canvasHeight: {}, canvasSizeStatus: {} };
    tool.cache = { baseValue: 0, processedImage: {} };
    tool.originalImage = { width: 1600, height: 1200 };
    tool.sampleImage = null;
    tool.transform = { originalWidth: 0, scale: 1, rotation: 0, positionX: 0, positionY: 0 };
    tool.applyEffects = () => {};
    return tool;
}

test('custom resolution changes the actual artwork and overlay buffers and retains transform settings', () => {
    const tool = sizedPreview();
    tool.updateCanvasSize();
    Object.assign(tool.transform, { scale: 1.5, rotation: 30, positionX: 10, positionY: -20 });
    assert.equal(tool.setCanvasSize('1080', '1350'), true);
    assert.deepEqual([tool.canvas.width, tool.canvas.height], [1080, 1350]);
    assert.deepEqual([tool.overlayCanvas.width, tool.overlayCanvas.height], [1480, 1750]);
    assert.deepEqual([tool.dom.canvasWidth.value, tool.dom.canvasHeight.value], [1080, 1350]);
    assert.deepEqual([tool.transform.scale, tool.transform.rotation, tool.transform.positionX, tool.transform.positionY], [1.5, 30, 10, -20]);
    assert.deepEqual([tool.transform.baseWidth, tool.transform.baseHeight], [1800, 1350]);
    assert.deepEqual([tool.transform.width, tool.transform.height, tool.transform.x, tool.transform.y], [2700, 2025, -630, -697.5]);
    assert.equal(tool.cache.processedImage, null);
});

test('manual dimensions survive source/layout replacement and removal, even on an empty canvas', async () => {
    const tool = sizedPreview();
    tool.originalImage = null;
    assert.equal(tool.setCanvasSize(321, 123), true);
    tool.decodeImageFile = async image => image;
    await tool.loadImage({ width: 2400, height: 1600 });
    await tool.loadSampleImage({ width: 1000, height: 1000 });
    assert.deepEqual([tool.canvas.width, tool.canvas.height], [321, 123]);
    tool.originalImage = null;
    tool.sampleImage = null;
    tool.updateCanvasSize();
    assert.deepEqual([tool.canvas.width, tool.canvas.height], [321, 123]);
});

test('invalid sizes leave the artwork intact and restore the last accepted fields', () => {
    const tool = sizedPreview();
    tool.setCanvasSize(1080, 1350);
    for (const value of ['', ' ', 'no', NaN, Infinity, 0, -1, 1.5, 4097]) {
        assert.equal(tool.setCanvasSize(value, 1350), false);
        assert.equal(tool.setCanvasSize(1080, value), false);
        assert.deepEqual([tool.canvas.width, tool.canvas.height], [1080, 1350]);
        assert.deepEqual([tool.dom.canvasWidth.value, tool.dom.canvasHeight.value], [1080, 1350]);
        assert.match(tool.dom.canvasSizeStatus.textContent, /whole numbers/);
    }
    tool.originalImage = null;
    assert.equal(tool.setCanvasSize(1, 4096), true);
    assert.deepEqual([tool.canvas.width, tool.canvas.height], [1, 4096]);
});

test('automatic size follows the source until edited and refits the image when the layout loads later', () => {
    const tool = sizedPreview();
    tool.updateCanvasSize();
    assert.deepEqual([tool.canvas.width, tool.canvas.height], [800, 600]);
    tool.sampleImage = { width: 1000, height: 1000 };
    tool.updateCanvasSize();
    assert.deepEqual([tool.canvas.width, tool.canvas.height], [600, 600]);
    assert.deepEqual([tool.transform.width, tool.transform.height, tool.transform.x], [800, 600, -100]);
    tool.setCanvasSize(600, 600);
    tool.sampleImage = { width: 500, height: 1000 };
    tool.updateCanvasSize();
    assert.deepEqual([tool.canvas.width, tool.canvas.height], [600, 600]);
});

test('Enter applies dimensions and Escape cancels pending edits', () => {
    const tool = sizedPreview();
    for (const name of ['canvasWidth', 'canvasHeight']) {
        const listeners = {};
        Object.assign(tool.dom[name], {
            addEventListener: (event, callback) => { listeners[event] = callback; },
            blur: () => listeners.blur(),
            listeners
        });
    }
    tool.updateCanvasSize();
    tool.initCanvasSizeInputs();
    tool.dom.canvasWidth.blur();
    assert.equal(tool.canvasSize, null, 'focus without an edit keeps automatic sizing');
    tool.dom.canvasWidth.value = '900';
    tool.dom.canvasWidth.listeners.keydown({ key: 'Escape', preventDefault() {} });
    assert.equal(tool.canvasSize, null, 'cancelled edits keep automatic sizing');
    tool.dom.canvasWidth.value = '1200';
    tool.dom.canvasWidth.listeners.keydown({ key: 'Enter', preventDefault() {} });
    assert.deepEqual([tool.canvas.width, tool.canvas.height], [1200, 600]);
    tool.dom.canvasHeight.value = '900';
    tool.dom.canvasHeight.listeners.keydown({ key: 'Escape', preventDefault() {} });
    assert.deepEqual([tool.canvas.width, tool.canvas.height], [1200, 600]);
    assert.equal(tool.dom.canvasHeight.value, 600);
});
