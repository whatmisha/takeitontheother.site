import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPackagingModel, packagingNet, activePanelIds } from '../src/packaging/PackagingModel.js';
import { TUBE_DEFAULTS, constructionPatch, normalizeConstructionSettings, tubeParameters } from '../src/packaging/TubeModel.js';
import { tubePoint, tubePanelCenter } from '../src/preview/TubeGeometry.js';
import { panelUV } from '../src/preview/LidGeometry.js';
import { CanvasRendererController } from '../src/grid/CanvasRendererController.js';
import { Settings } from '../src/core/Settings.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';
import { PresetFormatAdapter } from '../src/preset/PresetFormatAdapter.js';
import { surfaceAdditions } from '../src/packaging/SurfaceAddition.js';
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const settings = type => normalizeConstructionSettings({ ...TUBE_DEFAULTS, constructionType: type, frontWidth: 500, frontHeight: 400, thickness: 50, flapDepth: 20 });

for (const type of ['tube', 'telescopic-tube']) {
    test(`${type}: exact circumference, flat UV registration and a closed cylindrical seam`, () => {
        const model = createPackagingModel(settings(type));
        for (const panel of model.panels) {
            close(panel.width, Math.PI * 2 * panel.radius);
            for (const u of [0, 0.2, 0.5, 0.8, 1]) for (const v of [0, 0.5, 1]) {
                const flat = tubePoint(panel, u, v, 0);
                const rolled = tubePoint(panel, u, v, 1);
                close(flat[0], (u - 0.5) * panel.width);
                close(flat[2], 0);
                close(Math.hypot(rolled[0], rolled[2]), panel.radius);
                const uv = panelUV(panel, u, v);
                close(uv[0] * model.net.width, panel.rect.x + u * panel.width);
                close((1 - uv[1]) * model.net.height, panel.rect.y + (1 - v) * panel.height);
                close(tubePanelCenter(panel, model, 0, 0) + flat[1], model.net.height / 2 - (1 - uv[1]) * model.net.height);
            }
            const left = tubePoint(panel, 0, 0.5, 1), right = tubePoint(panel, 1, 0.5, 1);
            left.forEach((value, i) => close(value, right[i]));
        }
        assert.equal(model.panels.length, type === 'tube' ? 1 : 2);
        assert.deepEqual(activePanelIds(settings(type)), model.panels.map(p => p.id));
    });
    test(`${type}: canvas scale preserves both wrap sizes and their separation`, () => {
        const source = settings(type), net = packagingNet(source);
        for (const displaySize of [320, 720, 1400]) {
            const layout = CanvasRendererController.calculateLayout({ ...source, displaySize, padding: 40 });
            const scaled = packagingNet(layout);
            close(scaled.width, net.width * layout.scale);
            close(scaled.height, net.height * layout.scale);
            for (const id of activePanelIds(source)) {
                close(scaled.panels[id].width, net.panels[id].width * layout.scale);
                close(scaled.panels[id].y, layout.y + net.panels[id].y * layout.scale);
            }
        }
    });
}

test('cap fits around the body with explicit wall/clearance and opens without moving the body', () => {
    const model = createPackagingModel(settings('telescopic-tube')), p = model.parameters;
    const [body, cap] = model.panels;
    close(cap.radius - p.wall - body.radius, p.clearance);
    close(tubePanelCenter(cap, model, 1, 0) - cap.height / 2, body.height / 2 - p.overlap);
    close(tubePanelCenter(cap, model, 1, 0) + cap.height / 2 + body.height / 2, p.assembledHeight);
    for (const fold of [0, 0.3, 0.8, 1]) close(tubePanelCenter(body, model, fold, 0), tubePanelCenter(body, model, fold, 1));
    assert.ok(tubePanelCenter(cap, model, 1, 1) - cap.height / 2 > body.height / 2);
});

test('invalid dimensions and overlap are bounded without intersecting the round closures', () => {
    const p = tubeParameters({ ...settings('telescopic-tube'), tubeDiameter: -1, tubeBodyHeight: 10, tubeCapHeight: 5, tubeWall: 100, tubeOverlap: 10000, tubeClearance: -4 });
    assert.equal(p.diameter, 10);
    assert.equal(p.wall, 1.25);
    assert.equal(p.overlap, 3.75);
    assert.equal(p.clearance, 0);
    assert.ok(p.assembledHeight > 0);
});

test('switching box to tube and back restores box dimensions and remembers tube parameters', () => {
    const box = { ...settings('lid'), frontWidth: 475, frontHeight: 300, thickness: 42 };
    const tube = constructionPatch(box, { constructionType: 'tube', tubeDiameter: 86 });
    close(tube.frontWidth, Math.PI * 86);
    const returned = constructionPatch(tube, { constructionType: 'box' });
    assert.deepEqual([returned.frontWidth, returned.frontHeight, returned.thickness], [475, 300, 42]);
    assert.equal(returned.tubeDiameter, 86);
    close(constructionPatch(returned, { constructionType: 'telescopic-tube' }).frontWidth, Math.PI * 86);
});

test('only lateral surfaces are editable and the second wrap is addable and restorable', () => {
    const state = new Settings(settings('tube')), manager = new SurfaceManager(state);
    manager.initialize('+ New');
    assert.deepEqual(manager.getActiveIds(), ['front']);
    assert.deepEqual(surfaceAdditions(state.getAll(), id => manager.isVisible(id)).map(x => x.id), ['tubeCap']);
    state.set('constructionType', 'telescopic-tube');
    manager.syncMasterVisibility();
    assert.equal(manager.isVisible('tubeCap'), true);
    manager.update('tubeCap', { visible: false });
    assert.equal(surfaceAdditions(state.getAll(), id => manager.isVisible(id))[0].restore, true);
});

test('preset round trip retains tube geometry, independent cap grid, artwork and saved box dimensions', async () => {
    const adapter = new PresetFormatAdapter();
    const original = adapter.normalize(JSON.parse(await readFile(new URL('../presets/New.json', import.meta.url), 'utf8')));
    const state = new Settings(constructionPatch(original.settings, { constructionType: 'telescopic-tube', tubeDiameter: 82.5, tubeCapHeight: 45, tubeOverlap: 17.5 }));
    const manager = new SurfaceManager(state);
    manager.initialize('+ New', original.settings.surfaceSettings);
    manager.update('tubeCap', { rotation: 180, gridMode: 'own', grid: { columns: 4, module: 2.75 } });
    const data = { ...original, settings: state.getAll(), textBlocks: [{ ...original.textBlocks[0], surface: 'tubeCap', content: 'Cap\nSecond paragraph' }] };
    const serialized = adapter.organize(data);
    const restored = adapter.normalize(JSON.parse(JSON.stringify(serialized)));
    assert.equal(restored.settings.tubeDiameter, 82.5);
    assert.equal(restored.settings.tubeOverlap, 17.5);
    assert.equal(restored.settings.surfaceSettings.tubeCap.grid.module, 2.75);
    assert.equal(restored.settings.surfaceSettings.tubeCap.rotation, 180);
    assert.deepEqual(restored.textBlocks[0].content, data.textBlocks[0].content);
    assert.equal(restored.textBlocks[0].surface, 'tubeCap');
    assert.equal(restored.settings.boxDimensions.frontWidth, original.settings.frontWidth);
    const inconsistent = structuredClone(serialized);
    inconsistent.dimensions.width = 100;
    close(adapter.normalize(inconsistent).settings.frontWidth, Math.PI * 82.5);
    const missing = structuredClone(serialized);
    delete missing.construction.tube;
    assert.throws(() => adapter.normalize(missing), /tube/);
});
