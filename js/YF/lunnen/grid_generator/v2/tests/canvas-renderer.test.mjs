import test from 'node:test';
import assert from 'node:assert/strict';

import { CanvasRendererController } from '../src/grid/CanvasRendererController.js';
import { Settings } from '../src/core/Settings.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';

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
    const settings = new Settings({ ...values });
    const surfaceManager = new SurfaceManager(settings);
    surfaceManager.initialize('+ New');
    const host = {
        DISPLAY_SIZE: 900,
        PADDING: 60,
        dom: { svg },
        settingsModule: {
            get: key => values[key],
            getAll: () => ({ ...values })
        },
        surfaceManager,
        resolveBlockPlane: block => block.planeId || surfaceManager.getRootId(),
        zoomPanManager: zoom,
        objectDocument: {
            textBlocks: [{ id: 'text-1', planeId: 'front' }],
            graphicsBlocks: [{ id: 'graphic-1', planeId: 'front' }]
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

function createBoxSurfaceController({ hidden = [] } = {}) {
    const values = { boxColor: '#82A9D9', showSidePanels: true };
    const settings = new Settings({
        frontWidth: 100,
        frontHeight: 80,
        thickness: 10,
        showSidePanels: true
    });
    const surfaceManager = new SurfaceManager(settings);
    surfaceManager.initialize('+ New');
    for (const surface of hidden) surfaceManager.update(surface, { visible: false });

    const controller = new CanvasRendererController({
        settingsModule: { get: key => values[key] },
        surfaceManager
    });
    const drawn = [];
    controller.createSvgElement = (_type, attrs) => {
        const element = { ...attrs, textContent: '' };
        drawn.push(element);
        return element;
    };
    return { controller, drawn, values };
}

test('box surfaces respect the global sides toggle and per-surface visibility', () => {
    const { controller, drawn, values } = createBoxSurfaceController({ hidden: ['right'] });

    controller.drawBoxSurfaces({}, 0, 0, 100, 80, 10, 2);
    assert.equal(drawn.length, 4);
    assert.ok(drawn.every(rect => rect.fill === '#82A9D9'));
    assert.equal(drawn.some(rect => rect.x === 110), false);
    assert.deepEqual(drawn[0], {
        x: 10, y: 10, width: 100, height: 80,
        fill: '#82A9D9', stroke: '#000000', 'stroke-width': '0.5', textContent: ''
    });

    values.showSidePanels = false;
    drawn.length = 0;
    controller.drawBoxSurfaces({}, 0, 0, 100, 80, 10, 2);
    assert.equal(drawn.length, 1);
});

test('labels are centred per plane and rotated for tall planes', () => {
    const { controller, drawn } = createBoxSurfaceController();

    controller.drawLabels({}, 0, 0, 100, 80, 10, 1);

    assert.deepEqual(
        drawn.map(label => label.textContent),
        ['FRONT', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM']
    );
    assert.deepEqual(
        drawn.map(label => ({ x: label.x, y: label.y, rotated: Boolean(label.transform) })),
        [
            { x: 60, y: 50, rotated: false },
            { x: 5, y: 50, rotated: true },
            { x: 115, y: 50, rotated: true },
            { x: 60, y: 5, rotated: false },
            { x: 60, y: 95, rotated: false }
        ]
    );
});
