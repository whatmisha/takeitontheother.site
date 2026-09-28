import test from 'node:test';
import assert from 'node:assert/strict';
import { Settings } from '../src/core/Settings.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';
import { SurfaceCoordinateMapper } from '../src/surfaces/SurfaceCoordinateMapper.js';
import { GridCalculator } from '../src/grid/GridCalculator.js';
import { SurfacePanelCommands } from '../src/surfaces/SurfacePanelCommands.js';
import { normalizeConstructionSettings } from '../src/packaging/TubeModel.js';
import { packagingNet } from '../src/packaging/PackagingModel.js';
import { PresetFormatAdapter } from '../src/preset/PresetFormatAdapter.js';

for (const constructionType of ['lid', 'box', 'tuck-box', 'tube', 'telescopic-tube']) {
    test(`${constructionType}: every face rotates its local grid without changing physical dimensions`, () => {
        const settings = new Settings(normalizeConstructionSettings({ constructionType, frontWidth: 210, frontHeight: 120, thickness: 30 }));
        const manager = new SurfaceManager(settings);
        manager.initialize();
        const mapper = new SurfaceCoordinateMapper({ settings, surfaceManager: manager });
        const net = packagingNet(settings.getAll());
        for (const surface of manager.getActiveIds()) for (const rotation of [0, 90, 180, 270]) {
            manager.update(surface, { rotation });
            const geometry = manager.getGeometry(surface, settings.getAll());
            const context = mapper.getGridContext(surface);
            const rect = net.panels[surface];
            assert.equal(geometry.rotation, rotation);
            assert.equal(context.frontWidth, rotation % 180 ? rect.height : rect.width);
            assert.equal(context.frontHeight, rotation % 180 ? rect.width : rect.height);
            const x = geometry.localWidth * .3, y = geometry.localHeight * .4;
            const globalPoint = {
                0: { x: rect.x + x, y: rect.y + y },
                90: { x: rect.x + rect.width - y, y: rect.y + x },
                180: { x: rect.x + rect.width - x, y: rect.y + rect.height - y },
                270: { x: rect.x + y, y: rect.y + rect.height - x }
            }[rotation];
            const local = manager.globalToLocal(surface, globalPoint, settings.getAll());
            assert.ok(Math.abs(local.x - x) < 1e-8 && Math.abs(local.y - y) < 1e-8);
            assert.deepEqual(packagingNet(settings.getAll()), net);
        }
        manager.update('front', { visible: false, gridMode: 'own' });
        assert.equal(manager.get('front').visible, true);
        assert.equal(manager.get('front').gridMode, 'main');
        const calculator = new GridCalculator(settings);
        const context = mapper.getGridContext('front');
        assert.equal(calculator.calculateModule(), context.frontHeight / (2 * context.margins + context.rowCount * context.rowHeight + context.rowCount - 1));
        assert.equal(calculator.calculateColumnWidth(), mapper.getColumnMetrics('front').columnWidth);
        const format = new PresetFormatAdapter();
        const restored = format.normalize(format.organize({ settings: settings.getAll(), textBlocks: [], graphicsBlocks: [] }));
        const reloaded = new SurfaceManager(new Settings(restored.settings));
        reloaded.initialize('', restored.settings.surfaceSettings);
        for (const surface of manager.getActiveIds()) assert.equal(reloaded.get(surface).rotation, 270);
    });
}

test('rotation recalculates main grid only on axis swaps and inside the undo transaction', () => {
    const manager = new SurfaceManager(new Settings()); manager.initialize();
    const calls = [];
    const commands = new SurfacePanelCommands({ surfaceManager: manager,
        onBeginAction: () => calls.push('begin'), onMainRotation: () => calls.push('grid'),
        onConstrainObjects: () => calls.push('bounds'), onRender: () => calls.push('render'),
        onCommitAction: () => calls.push('commit') });
    commands.setRotation('front', 90);
    assert.deepEqual(calls, ['begin', 'grid', 'bounds', 'render', 'commit']);
    calls.length = 0; commands.setRotation('front', 270);
    assert.deepEqual(calls, ['begin', 'bounds', 'render', 'commit']);
    calls.length = 0; commands.setRotation('front', 45);
    assert.deepEqual(calls, []);
    assert.equal(manager.get('front').rotation, 270);
});
