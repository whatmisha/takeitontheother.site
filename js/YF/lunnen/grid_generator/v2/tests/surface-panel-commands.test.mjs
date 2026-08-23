import assert from 'node:assert/strict';
import test from 'node:test';

import { Settings } from '../src/core/Settings.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';
import { SurfacePanelCommands } from '../src/surfaces/SurfacePanelCommands.js';

function createCommands() {
    const settings = new Settings({ showSidePanels: true });
    const surfaceManager = new SurfaceManager(settings);
    surfaceManager.initialize('+ New');
    const calls = [];
    const commands = new SurfacePanelCommands({
        surfaceManager,
        onBeginAction: label => calls.push(['begin', label]),
        onCommitAction: () => calls.push(['commit']),
        onMarkChanged: () => calls.push(['changed']),
        onConstrainObjects: () => calls.push(['constrain']),
        onRender: () => calls.push(['render']),
        onRenderDebounced: () => calls.push(['render-debounced'])
    });
    return { commands, surfaceManager, calls };
}

test('plane panel commands own atomic state changes and side effects', () => {
    const { commands, surfaceManager, calls } = createCommands();

    assert.equal(commands.setGridMode('left', true), true);
    assert.equal(surfaceManager.getPlane('left').grid.mode, 'own');
    assert.deepEqual(calls, [
        ['begin', 'change plane grid mode'],
        ['changed'],
        ['constrain'],
        ['render'],
        ['commit']
    ]);
    assert.equal(commands.setGridMode('left', true), false);
    assert.equal(calls.length, 5);
});

test('plane grid values preserve millimeter presentation in modular storage', () => {
    const { commands, surfaceManager, calls } = createCommands();
    commands.switchMarginsUnit('left', 'mm');
    calls.length = 0;
    commands.applyGridValue('left', 'margins', 15);

    const grid = surfaceManager.getPlane('left').grid.own;
    assert.equal(grid.marginsUnit, 'mm');
    assert.ok(Math.abs(grid.margins * grid.module - 15) < 1e-9);
    assert.deepEqual(calls, [['changed'], ['constrain'], ['render-debounced']]);
});

test('plane management commits through history and takes children with it', () => {
    const { commands, surfaceManager, calls } = createCommands();

    const flap = commands.addPlane({ name: 'Top flap', parentId: 'top', edge: 'top' });
    assert.equal(surfaceManager.getPlaneIds().length, 6);
    assert.equal(flap.attach.to, 'top');
    assert.deepEqual(calls[0], ['begin', 'add plane']);

    assert.equal(commands.renamePlane(flap.id, 'Lid'), true);
    assert.equal(surfaceManager.getPlane(flap.id).name, 'Lid');

    const orphaned = [];
    const removed = commands.removePlane('top', ids => orphaned.push(...ids));
    assert.deepEqual(removed, ['top', flap.id]);
    assert.deepEqual(orphaned, ['top', flap.id]);
    assert.deepEqual(surfaceManager.getPlaneIds(), ['front', 'left', 'right', 'bottom']);

    assert.deepEqual(commands.removePlane('front'), [], 'the root cannot be removed');
    assert.ok(surfaceManager.has('front'));
});

test('reordering planes changes paint order without changing attachment', () => {
    const { commands, surfaceManager } = createCommands();

    assert.equal(commands.reorderPlane('bottom', 1), true);
    assert.deepEqual(surfaceManager.getPlaneIds(), ['front', 'bottom', 'left', 'right', 'top']);
    assert.equal(surfaceManager.getPlane('bottom').attach.to, 'front');
});
