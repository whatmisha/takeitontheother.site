import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    createDefaultSurfaceSettings,
    getPresetOrientationProfile,
    SurfaceManager
} from '../src/surfaces/SurfaceManager.js';
import { SurfaceCoordinateMapper } from '../src/surfaces/SurfaceCoordinateMapper.js';
import { Settings } from '../src/core/Settings.js';
import { PresetManager } from '../src/preset/PresetManager.js';
import { SVGExporter } from '../src/svg/SVGExporter.js';

test('New and Front presets use the front orientation profile', () => {
    for (const presetName of ['New', '+New', '+ New', 'Airis 14" Front']) {
        assert.equal(getPresetOrientationProfile(presetName), 'front', presetName);
    }

    assert.equal(getPresetOrientationProfile('Airis 14" Back'), 'reverse');
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(createDefaultSurfaceSettings('front'))
                .map(([surface, settings]) => [surface, settings.rotation])
        ),
        { front: 0, left: 90, right: 270, top: 180, bottom: 0 }
    );
});

test('checked-in presets follow the orientation naming contract', async () => {
    const manifest = JSON.parse(
        await readFile(new URL('../presets/manifest.json', import.meta.url), 'utf8')
    );
    const expectedRotations = {
        front: { left: 90, right: 270, top: 180, bottom: 0 },
        reverse: { left: 270, right: 90, top: 0, bottom: 180 }
    };

    for (const preset of manifest.presets.filter(item => item.file)) {
        const data = JSON.parse(
            await readFile(new URL(`../presets/${preset.file}`, import.meta.url), 'utf8')
        );
        const profile = getPresetOrientationProfile(data.presetName || preset.name);

        for (const [surface, rotation] of Object.entries(expectedRotations[profile])) {
            assert.equal(data.surfaces?.[surface]?.rotation, rotation, `${preset.name}: ${surface}`);
            assert.equal(typeof data.surfaces?.[surface]?.visible, 'boolean', `${preset.name}: ${surface} visibility`);
            assert.match(data.surfaces?.[surface]?.gridMode || '', /^(main|own)$/, `${preset.name}: ${surface} grid mode`);
        }
    }
});

test('E-ink preset keeps the approved 2026-08-10 parameters', async () => {
    const data = JSON.parse(
        await readFile(new URL('../presets/E-ink.json', import.meta.url), 'utf8')
    );

    assert.equal(data.presetName, 'E-ink');
    assert.equal(data.version, '1.2');
    assert.equal(data.timestamp, '2026-08-10T09:07:58.010Z');
    assert.deepEqual(data.typography.caption, {
        size: 0.7,
        lineHeight: 1.25,
        tracking: 0,
        useXHeight: false,
        fontWeight: 500
    });
    for (const surface of ['front', 'left', 'right', 'top', 'bottom']) {
        assert.deepEqual(data.surfaces[surface].grid, {
            module: 2.6743,
            margins: 2.4521,
            columns: 12,
            rows: 12,
            rowHeight: 5,
            marginsUnit: 'mod',
            lockedModule: false,
            lockedMargins: false
        });
    }
    assert.equal(
        data.texts.find(block => block.id === 'text-1786014872486').width,
        4.75
    );
    assert.equal(data.graphics.claim.surface, 'front');
});

test('surface coordinate mapper keeps grid and pointer math surface-local', () => {
    const settings = new Settings({
        frontWidth: 500,
        frontHeight: 500,
        thickness: 50,
        gridModule: 5,
        margins: 2.5,
        columnCount: 12,
        rowCount: 12,
        rowHeight: 7,
        showSidePanels: true
    });
    const surfaceManager = new SurfaceManager(settings);
    surfaceManager.initialize('+ New');
    const layout = {
        x: 10,
        y: 20,
        frontWidth: 250,
        frontHeight: 250,
        thickness: 25,
        scale: 0.5
    };
    const mapper = new SurfaceCoordinateMapper({
        settings,
        surfaceManager,
        getLayout: () => layout,
        clientToSvgPoint: (x, y) => ({ x, y })
    });

    assert.equal(mapper.rowBaselineToY(2, 3, 'left'), 19);
    assert.deepEqual(mapper.yToRowBaseline(19, 'left'), { row: 2, baselineOffset: 3 });

    const width = mapper.columnsToMm(3, 'left');
    assert.ok(Math.abs(mapper.mmToColumns(width, 'left') - 3) < 1e-9);

    const pointer = mapper.getSurfacePointer(22.5, 170);
    assert.equal(pointer.surface, 'left');
    assert.deepEqual(pointer.local, { x: 250, y: 25 });
});

test('surface settings and object surfaces survive JSON export/import', () => {
    const exporter = new SVGExporter({});
    const surfaces = createDefaultSurfaceSettings('front', {
        module: 5,
        margins: 2.5,
        columns: 12,
        rows: 12,
        rowHeight: 7
    });
    surfaces.left = {
        ...surfaces.left,
        visible: false,
        rotation: 180,
        gridMode: 'own',
        grid: {
            ...surfaces.left.grid,
            module: 4,
            margins: 1.5,
            marginsUnit: 'mm',
            lockedModule: true
        }
    };

    const organized = exporter.organizeSettingsForExport({
        version: 'test',
        timestamp: 'test',
        currentPresetName: 'New',
        settings: {
            frontWidth: 500,
            frontHeight: 500,
            thickness: 50,
            gridModule: 5,
            margins: 2.5,
            columnCount: 12,
            rowCount: 12,
            rowHeight: 7,
            surfaceSettings: surfaces,
            showSidePanels: true
        },
        textBlocks: [{ id: 'text', content: 'Text', surface: 'top' }],
        graphicsBlocks: [
            { id: 'graphic', surface: 'bottom', svgContent: '<path/>' },
            { id: 'icons', isBuiltIn: true, surface: 'right', svgContent: '<g/>' },
            { id: 'claim', isBuiltIn: true, surface: 'left', svgContent: '<g/>' }
        ]
    });
    const normalized = exporter.normalizeImportedData(organized);

    assert.equal(normalized.settings.surfaceSettings.left.rotation, 180);
    assert.equal(normalized.settings.surfaceSettings.left.gridMode, 'own');
    assert.equal(normalized.textBlocks[0].surface, 'top');
    assert.equal(normalized.graphicsBlocks.find(block => block.id === 'graphic').surface, 'bottom');
    assert.equal(normalized.graphicsBlocks.find(block => block.id === 'icons').surface, 'right');
    assert.equal(normalized.graphicsBlocks.find(block => block.id === 'claim').surface, 'left');
});

test('re-exporting an imported preset keeps its descriptive name stable', () => {
    const exporter = new SVGExporter({});
    const importedName = 'Custom — E-ink, 148.5×203×43.5mm — 26.08.10, 11:07';

    assert.equal(exporter.generatePresetName({}, importedName), importedName.replace('Custom — ', ''));
    assert.doesNotMatch(exporter.generatePresetName({}, '+ New'), /^\+\s*New/);
});

test('imported presets are cloned and selected through PresetManager', async () => {
    const manager = new PresetManager();
    let selected = null;
    manager.addImportedPresetToDropdown = () => {};
    manager.selectPreset = async (id, name) => {
        selected = { id, name };
    };
    const data = { settings: { gridModule: 5 } };

    const id = await manager.addImportedPreset(data, 'Custom — New');
    data.settings.gridModule = 10;

    assert.match(id, /^imported-/);
    assert.deepEqual(selected, { id, name: 'Custom — New' });
    assert.equal(manager.importedPresets[0].data.settings.gridModule, 5);

    manager.markAsChanged();
    assert.equal(manager.hasUnsavedChanges(), true);
    manager.markAsSaved();
    assert.equal(manager.hasUnsavedChanges(), false);
});
