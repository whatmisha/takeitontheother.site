import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createBoxNet,
    FIT,
    normalizeDimension,
    normalizePlane
} from '../src/surfaces/PlaneDefinition.js';
import {
    computeNetLayout,
    globalToPlaneLocal,
    NET_ISSUES,
    planeAtPoint,
    resolveContentGeometry,
    resolveDimension
} from '../src/surfaces/NetLayoutEngine.js';

const rect = plane => ({
    x: plane.rect.x,
    y: plane.rect.y,
    width: plane.rect.width,
    height: plane.rect.height
});

/** Realistic tuck-end carton: a panel chain plus flaps and a glue strip. */
function createCartonNet() {
    return {
        rootId: 'back',
        variables: { W: 200, H: 300, D: 80, G: 20 },
        planes: [
            normalizePlane({ id: 'back', size: { width: 'W', height: 'H' }, attach: null }),
            normalizePlane({
                id: 'right',
                size: { width: 'D', height: FIT },
                attach: { to: 'back', edge: 'right' }
            }),
            normalizePlane({
                id: 'front',
                size: { width: 'W', height: FIT },
                attach: { to: 'right', edge: 'right' }
            }),
            normalizePlane({
                id: 'left',
                size: { width: 'D', height: FIT },
                attach: { to: 'front', edge: 'right' }
            }),
            normalizePlane({
                id: 'glue',
                kind: 'glue',
                size: { width: 'G', height: FIT },
                attach: { to: 'left', edge: 'right' }
            }),
            normalizePlane({
                id: 'topFlap',
                kind: 'flap',
                size: { width: FIT, height: 'D' },
                attach: { to: 'front', edge: 'top' }
            }),
            normalizePlane({
                id: 'bottomFlap',
                kind: 'flap',
                size: { width: FIT, height: 'D' },
                attach: { to: 'front', edge: 'bottom' }
            })
        ]
    };
}

test('dimension resolution handles literals, variables and fit', () => {
    assert.equal(resolveDimension(120, {}), 120);
    assert.equal(resolveDimension('D', { D: 45 }), 45);
    assert.equal(resolveDimension(FIT, {}, 300), 300);
    assert.equal(resolveDimension('missing', {}), 0);
    assert.equal(resolveDimension(-5, {}), 0);
    assert.equal(resolveDimension(FIT, {}, null), 0);

    assert.equal(normalizeDimension('  W  '), 'W');
    assert.equal(normalizeDimension(0), FIT);
    assert.equal(normalizeDimension(42), 42);
});

test('box net reproduces the legacy cross and its artboard bounds', () => {
    const layout = computeNetLayout(createBoxNet({ width: 500, height: 400, depth: 50 }));

    assert.equal(layout.rootId, 'front');
    assert.deepEqual(layout.order, ['front', 'left', 'right', 'top', 'bottom']);
    assert.deepEqual(layout.stackOrder, ['front', 'left', 'right', 'top', 'bottom']);
    assert.deepEqual(layout.issues, []);
    assert.deepEqual(layout.bounds, {
        minX: -50, minY: -50, maxX: 550, maxY: 450, width: 600, height: 500
    });

    assert.deepEqual(rect(layout.planes.front), { x: 50, y: 50, width: 500, height: 400 });
    assert.deepEqual(rect(layout.planes.left), { x: 0, y: 50, width: 50, height: 400 });
    assert.deepEqual(rect(layout.planes.right), { x: 550, y: 50, width: 50, height: 400 });
    assert.deepEqual(rect(layout.planes.top), { x: 50, y: 0, width: 500, height: 50 });
    assert.deepEqual(rect(layout.planes.bottom), { x: 50, y: 450, width: 500, height: 50 });
});

test('box net rotation profiles drive content rotation, not plane placement', () => {
    const front = computeNetLayout(createBoxNet({ width: 500, height: 400, depth: 50 }));
    const reverse = computeNetLayout(
        createBoxNet({ width: 500, height: 400, depth: 50, profile: 'reverse' })
    );

    assert.equal(front.planes.left.rotation, 90);
    assert.equal(reverse.planes.left.rotation, 270);
    assert.deepEqual(rect(front.planes.left), rect(reverse.planes.left));

    // 90 degrees swaps the local axes the grid is laid out on.
    assert.equal(front.planes.left.localWidth, 400);
    assert.equal(front.planes.left.localHeight, 50);
    assert.equal(front.planes.top.localWidth, 500);
    assert.equal(front.planes.top.localHeight, 50);
});

test('a panel chain with flaps resolves to one union artboard', () => {
    const layout = computeNetLayout(createCartonNet());

    // Placement follows the attachment tree; stacking follows document order.
    assert.deepEqual(layout.order, [
        'back', 'right', 'front', 'left', 'topFlap', 'bottomFlap', 'glue'
    ]);
    assert.deepEqual(layout.stackOrder, [
        'back', 'right', 'front', 'left', 'glue', 'topFlap', 'bottomFlap'
    ]);
    assert.deepEqual(layout.bounds, {
        minX: 0, minY: -80, maxX: 580, maxY: 380, width: 580, height: 460
    });

    assert.deepEqual(rect(layout.planes.back), { x: 0, y: 80, width: 200, height: 300 });
    assert.deepEqual(rect(layout.planes.right), { x: 200, y: 80, width: 80, height: 300 });
    assert.deepEqual(rect(layout.planes.front), { x: 280, y: 80, width: 200, height: 300 });
    assert.deepEqual(rect(layout.planes.left), { x: 480, y: 80, width: 80, height: 300 });
    assert.deepEqual(rect(layout.planes.glue), { x: 560, y: 80, width: 20, height: 300 });
    assert.deepEqual(rect(layout.planes.topFlap), { x: 280, y: 0, width: 200, height: 80 });
    assert.deepEqual(rect(layout.planes.bottomFlap), { x: 280, y: 380, width: 200, height: 80 });
});

test('changing one variable reflows every dependent plane', () => {
    const net = createCartonNet();
    const widened = computeNetLayout({ ...net, variables: { ...net.variables, D: 120 } });

    assert.deepEqual(rect(widened.planes.front), { x: 320, y: 120, width: 200, height: 300 });
    assert.deepEqual(rect(widened.planes.glue), { x: 640, y: 120, width: 20, height: 300 });
    assert.equal(widened.bounds.width, 660);
    assert.equal(widened.bounds.height, 540);
});

test('alignment and offset position partial-width flaps along a parent edge', () => {
    const net = {
        rootId: 'panel',
        variables: {},
        planes: [
            normalizePlane({ id: 'panel', size: { width: 200, height: 100 }, attach: null }),
            normalizePlane({
                id: 'start',
                size: { width: 40, height: 30 },
                attach: { to: 'panel', edge: 'top', align: 'start' }
            }),
            normalizePlane({
                id: 'center',
                size: { width: 40, height: 30 },
                attach: { to: 'panel', edge: 'bottom', align: 'center' }
            }),
            normalizePlane({
                id: 'end',
                size: { width: 40, height: 30 },
                attach: { to: 'panel', edge: 'bottom', align: 'end' }
            }),
            normalizePlane({
                id: 'nudged',
                size: { width: 40, height: 30 },
                attach: { to: 'panel', edge: 'top', align: 'start', offset: 25 }
            })
        ]
    };
    const layout = computeNetLayout(net);

    assert.equal(layout.planes.start.rect.x, 0);
    assert.equal(layout.planes.center.rect.x, 80);
    assert.equal(layout.planes.end.rect.x, 160);
    assert.equal(layout.planes.nudged.rect.x, 25);
    assert.equal(layout.planes.start.rect.y, 0);
    assert.equal(layout.planes.center.rect.y, 130);
});

test('nested attachment places a flap on a flap', () => {
    const layout = computeNetLayout({
        rootId: 'panel',
        variables: {},
        planes: [
            normalizePlane({ id: 'panel', size: { width: 100, height: 100 }, attach: null }),
            normalizePlane({
                id: 'flap',
                size: { width: FIT, height: 40 },
                attach: { to: 'panel', edge: 'bottom' }
            }),
            normalizePlane({
                id: 'tab',
                size: { width: FIT, height: 15 },
                attach: { to: 'flap', edge: 'bottom' }
            })
        ]
    });

    assert.deepEqual(rect(layout.planes.flap), { x: 0, y: 100, width: 100, height: 40 });
    assert.deepEqual(rect(layout.planes.tab), { x: 0, y: 140, width: 100, height: 15 });
    assert.equal(layout.bounds.height, 155);
});

test('origin anchors the artboard for the editor and the export alike', () => {
    const net = createBoxNet({ width: 500, height: 400, depth: 50 });
    const atOrigin = computeNetLayout(net);
    const shifted = computeNetLayout(net, { origin: { x: 10, y: 20 } });

    assert.deepEqual(rect(shifted.planes.left), { x: 10, y: 70, width: 50, height: 400 });
    assert.equal(shifted.planes.front.rect.x - atOrigin.planes.front.rect.x, 10);
    assert.equal(shifted.planes.front.rect.y - atOrigin.planes.front.rect.y, 20);
    assert.deepEqual(shifted.bounds, atOrigin.bounds);
});

test('broken topology is reported instead of throwing', () => {
    const unknownParent = computeNetLayout({
        rootId: 'root',
        variables: {},
        planes: [
            normalizePlane({ id: 'root', size: { width: 10, height: 10 }, attach: null }),
            normalizePlane({
                id: 'orphan',
                size: { width: 5, height: 5 },
                attach: { to: 'ghost', edge: 'right' }
            })
        ]
    });
    assert.deepEqual(unknownParent.order, ['root']);
    assert.deepEqual(unknownParent.issues, [
        { code: NET_ISSUES.UNKNOWN_PARENT, planeId: 'orphan' }
    ]);

    const cycle = computeNetLayout({
        rootId: 'root',
        variables: {},
        planes: [
            normalizePlane({ id: 'root', size: { width: 10, height: 10 }, attach: null }),
            normalizePlane({ id: 'a', size: { width: 5, height: 5 }, attach: { to: 'b', edge: 'right' } }),
            normalizePlane({ id: 'b', size: { width: 5, height: 5 }, attach: { to: 'a', edge: 'right' } })
        ]
    });
    assert.deepEqual(cycle.order, ['root']);
    assert.deepEqual(
        cycle.issues.map(issue => issue.code).sort(),
        [NET_ISSUES.CYCLE, NET_ISSUES.CYCLE]
    );

    const duplicate = computeNetLayout({
        rootId: 'root',
        variables: {},
        planes: [
            normalizePlane({ id: 'root', size: { width: 10, height: 10 }, attach: null }),
            normalizePlane({ id: 'root', size: { width: 20, height: 20 }, attach: null })
        ]
    });
    assert.deepEqual(duplicate.issues, [{ code: NET_ISSUES.DUPLICATE_ID, planeId: 'root' }]);

    const empty = computeNetLayout({ rootId: 'root', variables: {}, planes: [] });
    assert.deepEqual(empty.issues, [{ code: NET_ISSUES.MISSING_ROOT }]);
    assert.deepEqual(empty.bounds, {
        minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0
    });
});

test('a plane without explicit attachment is treated as the root', () => {
    const layout = computeNetLayout({
        variables: {},
        planes: [normalizePlane({ id: 'only', size: { width: 30, height: 40 } })]
    });

    assert.equal(layout.rootId, 'only');
    assert.deepEqual(rect(layout.planes.only), { x: 0, y: 0, width: 30, height: 40 });
});

test('content geometry round-trips artboard points through every rotation', () => {
    const target = { x: 100, y: 50, width: 80, height: 40 };
    const probes = [
        { x: 100, y: 50 }, { x: 180, y: 50 }, { x: 180, y: 90 },
        { x: 100, y: 90 }, { x: 140, y: 70 }
    ];

    for (const rotation of [0, 90, 180, 270]) {
        const geometry = { rect: target, ...resolveContentGeometry(target, rotation) };
        for (const point of probes) {
            const local = globalToPlaneLocal(point, geometry);
            assert.ok(
                local.x >= -1e-9 && local.x <= geometry.localWidth + 1e-9,
                `rotation ${rotation} local x in range`
            );
            assert.ok(
                local.y >= -1e-9 && local.y <= geometry.localHeight + 1e-9,
                `rotation ${rotation} local y in range`
            );
        }
        // The rotation origin always maps to the local origin.
        assert.deepEqual(
            globalToPlaneLocal(
                {
                    0: { x: 100, y: 50 },
                    90: { x: 180, y: 50 },
                    180: { x: 180, y: 90 },
                    270: { x: 100, y: 90 }
                }[rotation],
                geometry
            ),
            { x: 0, y: 0 }
        );
    }
});

test('hit-testing returns the topmost visible plane', () => {
    const layout = computeNetLayout(createCartonNet());

    assert.equal(planeAtPoint(layout, { x: 100, y: 200 }), 'back');
    assert.equal(planeAtPoint(layout, { x: 380, y: 40 }), 'topFlap');
    assert.equal(planeAtPoint(layout, { x: 570, y: 200 }), 'glue');
    assert.equal(planeAtPoint(layout, { x: -5, y: 200 }), null);

    // Earlier planes in document order win where rectangles touch or overlap.
    assert.equal(planeAtPoint(layout, { x: 200, y: 200 }), 'back');
    assert.equal(
        planeAtPoint(layout, { x: 100, y: 200 }, { isVisible: plane => plane.id !== 'back' }),
        null
    );
});

test('invisible planes still define the artboard so hiding a panel cannot reflow it', () => {
    const net = createBoxNet({ width: 500, height: 400, depth: 50 });
    const hidden = {
        ...net,
        planes: net.planes.map(plane => (
            plane.id === 'left' ? { ...plane, visible: false } : plane
        ))
    };
    const layout = computeNetLayout(hidden);

    assert.equal(layout.planes.left.visible, false);
    assert.equal(layout.bounds.width, 600);
    assert.equal(planeAtPoint(layout, { x: 10, y: 200 }), null);
});
