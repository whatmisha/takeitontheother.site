/**
 * Proves the render path carries no five-surface assumption: a net with seven
 * planes renders through the same code, with no renderer change.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { SurfaceRenderer } from '../src/surfaces/SurfaceRenderer.js';
import { CanvasRendererController } from '../src/grid/CanvasRendererController.js';
import { computeNetLayout } from '../src/surfaces/NetLayoutEngine.js';
import { FIT, normalizePlane } from '../src/surfaces/PlaneDefinition.js';

/** Tuck-end carton: four wall panels, a glue strip and two flaps. */
const CARTON = Object.freeze({
    rootId: 'back',
    variables: { W: 200, H: 300, D: 80, G: 20 },
    planes: [
        normalizePlane({ id: 'back', name: 'Back', size: { width: 'W', height: 'H' } }),
        normalizePlane({
            id: 'rightWall',
            name: 'Right Wall',
            size: { width: 'D', height: FIT },
            attach: { to: 'back', edge: 'right' },
            contentRotation: 90
        }),
        normalizePlane({
            id: 'face',
            name: 'Face',
            size: { width: 'W', height: FIT },
            attach: { to: 'rightWall', edge: 'right' }
        }),
        normalizePlane({
            id: 'leftWall',
            name: 'Left Wall',
            size: { width: 'D', height: FIT },
            attach: { to: 'face', edge: 'right' },
            contentRotation: 270
        }),
        normalizePlane({
            id: 'glue',
            name: 'Glue',
            kind: 'glue',
            size: { width: 'G', height: FIT },
            attach: { to: 'leftWall', edge: 'right' }
        }),
        normalizePlane({
            id: 'topFlap',
            name: 'Top Flap',
            kind: 'flap',
            size: { width: FIT, height: 'D' },
            attach: { to: 'face', edge: 'top' },
            contentRotation: 180
        }),
        normalizePlane({
            id: 'bottomFlap',
            name: 'Bottom Flap',
            kind: 'flap',
            size: { width: FIT, height: 'D' },
            attach: { to: 'face', edge: 'bottom' },
            visible: false
        })
    ]
});

class FakeNode {
    constructor(type, attributes = {}) {
        this.type = type;
        this.attributes = { ...attributes };
        this.children = [];
        this.textContent = '';
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    querySelector() {
        return null;
    }
}

function createSurfaceManager(net) {
    const layoutFor = layout => computeNetLayout(net, {
        origin: { x: layout.x ?? 0, y: layout.y ?? 0 }
    });
    return {
        getNetLayout: layoutFor,
        getGeometry: (id, layout) => layoutFor(layout).planes[id],
        isVisible: id => layoutFor({ x: 0, y: 0 }).planes[id]?.visible === true,
        getRootId: () => net.rootId,
        has: id => net.planes.some(plane => plane.id === id)
    };
}

function createRenderer(net, { drawn }) {
    const values = { showObjects: true, showColumns: true, showRows: false, showBaseline: false };
    return new SurfaceRenderer({
        settings: { get: key => values[key] },
        surfaceManager: createSurfaceManager(net),
        getGridContext: id => ({ surface: id }),
        createSvgElement: (type, attributes, container) => {
            const node = new FakeNode(type, attributes);
            container?.appendChild(node);
            return node;
        },
        getContrastColor: () => '#000000',
        getGridOpacity: opacity => opacity,
        getLayerEntries: () => [
            { type: 'text', block: { id: 'onFace', planeId: 'face' } },
            { type: 'text', block: { id: 'onGlue', planeId: 'glue' } },
            { type: 'text', block: { id: 'onFlap', planeId: 'topFlap' } }
        ],
        drawTextBlock: (_container, block) => drawn.push(block.id),
        drawGraphicsBlock: () => {},
        drawGraphicsBlockForExport: () => {}
    });
}

test('every plane of a seven-plane net gets its own clipped, transformed layer', () => {
    const drawn = [];
    const renderer = createRenderer(CARTON, { drawn });
    const container = new FakeNode('svg');

    renderer.drawPlaneLayers(container, { x: 0, y: 0, scale: 1 }, 1);

    const layers = container.children.filter(child => child.type === 'g');
    assert.deepEqual(
        layers.map(layer => layer.attributes['data-surface']),
        ['back', 'rightWall', 'face', 'leftWall', 'glue', 'topFlap']
    );
    assert.ok(
        layers.every(layer => layer.attributes['clip-path'].startsWith('url(#surface-clip-display-')),
        'each layer is clipped to its own plane'
    );

    // Rotated planes carry a rotate() transform and swapped local axes.
    const rightWall = layers.find(layer => layer.attributes['data-surface'] === 'rightWall');
    assert.match(rightWall.attributes.transform, /rotate\(90\)$/);
    const back = layers.find(layer => layer.attributes['data-surface'] === 'back');
    assert.equal(back.attributes.transform, 'translate(0 80)');

    // Objects are drawn into the layer of the plane they belong to.
    assert.deepEqual(drawn, ['onFace', 'onGlue', 'onFlap']);
});

test('an invisible plane is skipped without reflowing the artboard', () => {
    const drawn = [];
    const renderer = createRenderer(CARTON, { drawn });
    const container = new FakeNode('svg');

    renderer.drawPlaneLayers(container, { x: 0, y: 0, scale: 1 }, 1);

    const surfaces = container.children
        .filter(child => child.type === 'g')
        .map(layer => layer.attributes['data-surface']);
    assert.equal(surfaces.includes('bottomFlap'), false);

    const { bounds } = computeNetLayout(CARTON);
    assert.deepEqual(
        { width: bounds.width, height: bounds.height },
        { width: 580, height: 460 }
    );
});

test('drawSideLayers keeps the root plane on its own render path', () => {
    const renderer = createRenderer(CARTON, { drawn: [] });
    const container = new FakeNode('svg');

    renderer.drawSideLayers(container, { x: 0, y: 0, scale: 1 }, 1);

    assert.deepEqual(
        container.children
            .filter(child => child.type === 'g')
            .map(layer => layer.attributes['data-surface']),
        ['rightWall', 'face', 'leftWall', 'glue', 'topFlap']
    );
});

test('the editor scales a seven-plane net by its own artboard', () => {
    const layout = CanvasRendererController.calculateLayout({
        frontWidth: 200,
        frontHeight: 300,
        thickness: 80,
        displaySize: 1000,
        padding: 60,
        net: CARTON
    });

    // The carton artboard is 580 x 460, so width drives the fit.
    assert.equal(layout.scale, 880 / 580);
    assert.equal(layout.totalWidth, 880);
    assert.ok(Math.abs(layout.totalHeight - 460 * (880 / 580)) < 1e-9);
    assert.equal(layout.x, 60);
});
