import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPackagingModel, packagingNet, activePanelIds } from '../src/packaging/PackagingModel.js';
import { panelPoint, panelUV } from '../src/preview/LidGeometry.js';
import { Settings } from '../src/core/Settings.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';
import { PresetFormatAdapter } from '../src/preset/PresetFormatAdapter.js';

const dimensions = { frontWidth: 310, frontHeight: 185, thickness: 42, flapDepth: 25 };
function close(a, b) { a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < 1e-8, `${a} != ${b}`)); }

for (const constructionType of ['lid', 'box', 'tuck-box']) {
    test(`${constructionType}: every flat panel corner and its artwork UV coincide with the 2D net`, () => {
        const { panels, net } = createPackagingModel({ ...dimensions, constructionType });
        const front = net.panels.front;
        for (const panel of panels) for (const u of [0, 1]) for (const v of [0, 1]) {
            const uv = panelUV(panel, u, v);
            const point = panelPoint(panel, (u - 0.5) * panel.width, (v - 0.5) * panel.height, 0, panels);
            close(point, [uv[0] * net.width - front.x - front.width / 2,
                front.y + front.height / 2 - (1 - uv[1]) * net.height, 0]);
        }
    });
}

test('closed six-panel box has opposing lid/base and matching wall edges', () => {
    const { panels } = createPackagingModel({ ...dimensions, constructionType: 'box' });
    const byId = Object.fromEntries(panels.map(panel => [panel.id, panel]));
    close(panelPoint(byId.front, 0, 0, 1, panels), [0, 0, 0]);
    close(panelPoint(byId.base, 0, 0, 1, panels), [0, 0, -42]);
    close(panelPoint(byId.left, -21, 92.5, 1, panels), [-155, -92.5, 0]);
    close(panelPoint(byId.bottom, -155, 21, 1, panels), [-155, -92.5, 0]);
    close(panelPoint(byId.right, 21, -92.5, 1, panels), [155, 92.5, 0]);
    close(panelPoint(byId.top, 155, -21, 1, panels), [155, 92.5, 0]);
});

test('lid opening keeps the base and its three attached walls fixed at all fold positions', () => {
    const { panels, type } = createPackagingModel({ ...dimensions, constructionType: 'tuck-box' });
    for (const fold of [0.25, 0.6, 1]) for (const opening of [0.3, 0.7, 1]) {
        for (const panel of panels.filter(panel => ['base', 'left', 'right', 'bottom'].includes(panel.id))) {
            close(panelPoint(panel, 0, 0, fold, panels, opening, type), panelPoint(panel, 0, 0, fold, panels, 0, type));
        }
    }
    const flap = panels.find(panel => panel.id === 'flap');
    close(panelPoint(flap, 0, -flap.height / 2, 1, panels), [0, -92.5, -25]);
});

test('a hidden structural parent does not deactivate dependent faces', () => {
    const settings = new Settings({ ...dimensions, constructionType: 'tuck-box' });
    const manager = new SurfaceManager(settings);
    manager.initialize('+ New');
    manager.update('top', { visible: false });
    assert.equal(manager.isVisible('base'), true);
    assert.equal(manager.isVisible('top'), false);
    settings.set('constructionType', 'lid');
    assert.equal(manager.isVisible('base'), false);
    assert.equal(manager.isVisible('flap'), false);
    assert.equal(manager.get('base').visible, true);
});

test('v1.2 presets migrate to a lid and v2 preserves construction, inactive faces, grids and object assignments', async () => {
    const adapter = new PresetFormatAdapter();
    const source = JSON.parse(await readFile(new URL('../presets/New.json', import.meta.url), 'utf8'));
    const data = adapter.normalize(source);
    assert.equal(data.settings.constructionType, 'lid');
    const settings = new Settings({ ...data.settings, ...dimensions, constructionType: 'tuck-box' });
    const manager = new SurfaceManager(settings);
    manager.initialize('+ New', data.settings.surfaceSettings);
    manager.update('base', { rotation: 180, gridMode: 'own', grid: { columns: 5, module: 4.25 } });
    const block = { ...data.textBlocks[0], id: 'base-text', surface: 'base', content: 'Основание\nВторой абзац' };
    for (const type of ['tuck-box', 'lid']) {
        settings.set('constructionType', type);
        const serialized = adapter.organize({ ...data, settings: settings.getAll(), textBlocks: [block] });
        assert.equal(serialized.version, '2.0');
        const restored = adapter.normalize(JSON.parse(JSON.stringify(serialized)));
        assert.equal(restored.settings.constructionType, type);
        assert.equal(restored.settings.flapDepth, 25);
        assert.equal(restored.settings.surfaceSettings.base.grid.module, 4.25);
        assert.equal(restored.settings.surfaceSettings.base.rotation, 180);
        assert.deepEqual(restored.textBlocks[0].content, block.content);
        assert.equal(restored.textBlocks[0].surface, 'base');
    }
    assert.throws(() => adapter.normalize({ ...source, version: '2.0' }), /construction/);
    const invalid = adapter.organize({ ...data, settings: settings.getAll() });
    invalid.construction.type = 'unrecognized';
    assert.throws(() => adapter.normalize(invalid), /construction.type/);
});

test('flap is bounded by box depth and the net contains exactly the active panels', () => {
    const settings = { ...dimensions, constructionType: 'tuck-box', flapDepth: 100 };
    const net = packagingNet(settings);
    assert.equal(net.panels.flap.height, 42);
    assert.equal(net.height, 2 * 185 + 3 * 42);
    assert.equal(activePanelIds(settings).length, 7);
    assert.equal(activePanelIds({ ...settings, constructionType: 'box' }).length, 6);
});
