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
    assert.match(html, /<canvas id="canvas" class="ui-artboard"/u);
    assert.doesNotMatch(html, /<canvas id="overlayCanvas"[^>]*class="ui-artboard"/u);
});
