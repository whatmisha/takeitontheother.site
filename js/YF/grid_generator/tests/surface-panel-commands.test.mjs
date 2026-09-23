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

test('surface panel commands own atomic state changes and side effects', () => {
    const { commands, surfaceManager, calls } = createCommands();

    assert.equal(commands.setGridMode('left', true), true);
    assert.equal(surfaceManager.get('left').gridMode, 'own');
    assert.deepEqual(calls, [
        ['begin', 'change surface grid mode'],
        ['changed'],
        ['constrain'],
        ['render'],
        ['commit']
    ]);
    assert.equal(commands.setGridMode('left', true), false);
    assert.equal(calls.length, 5);
});

test('surface grid values preserve millimeter presentation in modular storage', () => {
    const { commands, surfaceManager, calls } = createCommands();
    commands.switchMarginsUnit('left', 'mm');
    calls.length = 0;
    commands.applyGridValue('left', 'margins', 15);

    const grid = surfaceManager.get('left').grid;
    assert.equal(grid.marginsUnit, 'mm');
    assert.ok(Math.abs(grid.margins * grid.module - 15) < 1e-9);
    assert.deepEqual(calls, [['changed'], ['constrain'], ['render-debounced']]);
});
