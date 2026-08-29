import test from 'node:test';
import assert from 'node:assert/strict';

import { CanvasRendererController } from '../src/grid/CanvasRendererController.js';

test('canvas layout fits the full unfolded box into the square editor area', () => {
    const layout = CanvasRendererController.calculateLayout({
        frontWidth: 500,
        frontHeight: 300,
        thickness: 50,
        displaySize: 800,
        padding: 50
    });

    assert.equal(layout.scale, 7 / 6);
    assert.equal(layout.x, 50);
    assert.ok(Math.abs(layout.y - 166.66666666666663) < 1e-9);
    assert.equal(layout.frontWidth, 500 * 7 / 6);
    assert.equal(layout.thickness, 50 * 7 / 6);
});

test('canvas renderer composes grid, side layers, objects and restores zoom', () => {
    const calls = [];
    const values = {
        frontWidth: 500,
        frontHeight: 500,
        thickness: 50,
        showLabels: false,
        showColumns: true,
        showRows: true,
        showBaseline: true,
        showObjects: true
    };
    const svg = {
        innerHTML: 'old',
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; }
    };
    const zoom = {
        zoom: 1.5,
        panX: 20,
        panY: 30,
        reinitializeSVGDimensions() { calls.push('zoom:init'); },
        updateTransform() { calls.push('zoom:restore'); }
    };
    const host = {
        DISPLAY_SIZE: 900,
        PADDING: 60,
        dom: { svg },
        settingsModule: {
            get: key => values[key],
            getAll: () => ({ ...values })
        },
        zoomPanManager: zoom,
        objectDocument: {
            textBlocks: [{ id: 'text-1', surface: 'front' }],
            graphicsBlocks: [{ id: 'graphic-1', surface: 'front' }]
        },
        gridRenderer: {
            drawColumns: () => calls.push('columns'),
            drawRows: () => calls.push('rows'),
            drawBaseline: () => calls.push('baseline')
        },
        surfaceRenderer: { drawSideLayers: () => calls.push('sides') },
        textRenderer: { draw: () => calls.push('text') },
        graphicsRenderer: { draw: () => calls.push('graphics') },
        objectNavigatorController: {
            bindCanvasHover: () => calls.push('hover'),
            render: () => calls.push('navigator')
        },
        typographyUnitController: { updateDisplays: () => calls.push('typography') },
        objectPlacementController: { constrainAll: () => calls.push('constrain') }
    };
    const controller = new CanvasRendererController(host);
    controller.drawBoxSurfaces = () => calls.push('box');

    const layout = controller.render();

    assert.equal(svg.innerHTML, '');
    assert.equal(svg.attributes.width, 900);
    assert.equal(host.currentSurfaceLayout, layout);
    assert.deepEqual(calls, [
        'constrain', 'zoom:init', 'box', 'columns', 'rows', 'baseline', 'sides',
        'text', 'graphics', 'hover', 'typography', 'navigator', 'zoom:restore'
    ]);
    assert.deepEqual(
        { zoom: zoom.zoom, panX: zoom.panX, panY: zoom.panY },
        { zoom: 1.5, panX: 20, panY: 30 }
    );
});

test('box surfaces respect the global sides toggle and per-surface visibility', () => {
    const values = { boxColor: '#82A9D9', showSidePanels: true };
    const host = {
        settingsModule: { get: key => values[key] },
        surfaceManager: { isVisible: surface => surface !== 'right' }
    };
    const controller = new CanvasRendererController(host);
    const rectangles = [];
    controller.createSvgElement = (_type, attrs) => {
        rectangles.push(attrs);
        return {};
    };

    controller.drawBoxSurfaces({}, 0, 0, 100, 80, 10, 2);
    assert.equal(rectangles.length, 4);
    assert.ok(rectangles.every(rect => rect.fill === '#82A9D9'));
    assert.equal(rectangles.some(rect => rect.x === 110), false);

    values.showSidePanels = false;
    rectangles.length = 0;
    controller.drawBoxSurfaces({}, 0, 0, 100, 80, 10, 2);
    assert.equal(rectangles.length, 1);
});
