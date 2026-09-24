import test from 'node:test';
import assert from 'node:assert/strict';
import { Settings } from '../src/core/Settings.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';
import { SurfaceAdditionCommands } from '../src/packaging/SurfaceAddition.js';

function setup() {
    const settings = new Settings({ frontWidth: 300, frontHeight: 200, thickness: 45, flapDepth: 20, constructionType: 'lid' });
    const surfaceManager = new SurfaceManager(settings);
    surfaceManager.initialize('');
    const calls = [];
    const commands = new SurfaceAdditionCommands({ settings, surfaceManager,
        ...Object.fromEntries(['begin', 'commit', 'changed', 'render', 'fit'].map(key => [key, () => calls.push(key)])) });
    return { settings, surfaceManager, commands, calls };
}

test('add base then flap grows the construction, each as one undoable action', () => {
    const { settings, commands, calls, surfaceManager } = setup();
    assert.deepEqual(commands.available().map(item => item.id), ['base']);
    assert.equal(commands.add('base'), true);
    assert.equal(settings.get('constructionType'), 'box');
    assert.equal(surfaceManager.getActiveIds().length, 6);
    assert.deepEqual(calls, ['begin', 'render', 'commit', 'changed', 'fit']);
    assert.deepEqual(commands.available().map(item => item.id), ['flap']);
    assert.equal(commands.add('flap'), true);
    assert.equal(settings.get('constructionType'), 'tuck-box');
    assert.equal(surfaceManager.getActiveIds().length, 7);
    assert.deepEqual(commands.available(), []);
});

test('restoring a hidden face preserves its grid and orientation without changing construction', () => {
    const { settings, surfaceManager, commands, calls } = setup();
    surfaceManager.update('left', { visible: false, rotation: 270, gridMode: 'own', grid: { columns: 3, module: 4.75 } });
    assert.equal(commands.available()[0].restore, true);
    commands.add('left');
    assert.equal(settings.get('constructionType'), 'lid');
    assert.equal(surfaceManager.isVisible('left'), true);
    assert.equal(surfaceManager.get('left').grid.module, 4.75);
    assert.equal(surfaceManager.get('left').rotation, 270);
    assert.deepEqual(calls, ['begin', 'render', 'commit', 'changed']);
});

test('adding a base restores its connecting wall but keeps unrelated hidden faces hidden', () => {
    const { commands, surfaceManager } = setup();
    surfaceManager.setAllSideVisibility(false);
    commands.add('base');
    assert.equal(surfaceManager.isVisible('base'), true);
    assert.equal(surfaceManager.isVisible('top'), true);
    assert.equal(surfaceManager.isVisible('left'), false);
});

test('unavailable or duplicate additions have no history or document side effects', () => {
    const { settings, commands, calls } = setup();
    const before = JSON.stringify(settings.getAll());
    for (const id of ['front', 'flap', 'left', 'unknown']) assert.equal(commands.add(id), false);
    assert.equal(JSON.stringify(settings.getAll()), before);
    assert.deepEqual(calls, []);
});
