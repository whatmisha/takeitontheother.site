import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getPresetOrientationProfile, SurfaceManager } from '../src/surfaces/SurfaceManager.js';
import { PlaneDocumentStore } from '../src/surfaces/PlaneDocumentStore.js';
import { SurfaceCoordinateMapper } from '../src/surfaces/SurfaceCoordinateMapper.js';
import { Settings } from '../src/core/Settings.js';
import { PresetManager } from '../src/preset/PresetManager.js';
import { SVGExporter } from '../src/svg/SVGExporter.js';

/** A store detached from any preset, used to read defaults and projections. */
const createStore = (values = {}) => new PlaneDocumentStore(new Settings({
    gridModule: 5,
    margins: 2.5,
    columnCount: 12,
    rowCount: 12,
    rowHeight: 7,
    ...values
}));

test('New and Front presets use the front orientation profile', () => {
    for (const presetName of ['New', '+New', '+ New', 'Airis 14" Front']) {
        assert.equal(getPresetOrientationProfile(presetName), 'front', presetName);
    }

    assert.equal(getPresetOrientationProfile('Airis 14" Back'), 'reverse');
    assert.deepEqual(
        Object.fromEntries(
            createStore().createDefaultDocument('+ New').planes
                .map(plane => [plane.id, plane.contentRotation])
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
        const planes = Object.fromEntries(data.net.planes.map(plane => [plane.id, plane]));

        for (const [surface, rotation] of Object.entries(expectedRotations[profile])) {
            assert.equal(planes[surface]?.contentRotation, rotation, `${preset.name}: ${surface}`);
            assert.equal(typeof planes[surface]?.visible, 'boolean', `${preset.name}: ${surface} visibility`);
            assert.match(planes[surface]?.grid?.mode || '', /^(inherit|own)$/, `${preset.name}: ${surface} grid mode`);
        }
    }
});

test('E-ink preset keeps the approved 2026-08-10 parameters', async () => {
    const data = JSON.parse(
        await readFile(new URL('../presets/E-ink.json', import.meta.url), 'utf8')
    );

    assert.equal(data.presetName, 'E-ink');
    assert.equal(data.version, '2.0');
    assert.equal(data.timestamp, '2026-08-10T09:07:58.010Z');
    assert.deepEqual(data.typography.caption, {
        size: 0.7,
        lineHeight: 1.25,
        tracking: 0,
        useXHeight: false,
        fontWeight: 500
    });
    const planes = Object.fromEntries(data.net.planes.map(plane => [plane.id, plane]));
    for (const surface of ['front', 'left', 'right', 'top', 'bottom']) {
        assert.deepEqual(planes[surface].grid.own, {
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
    assert.equal(data.graphics.claim.plane, 'front');
});

test('New preset places Claim 2026 by its full SVG artboard', async () => {
    const data = JSON.parse(
        await readFile(new URL('../presets/New.json', import.meta.url), 'utf8')
    );
    const claim = data.graphics.claim2026;

    assert.deepEqual(claim.position, { column: 4, row: 11, baseline: 4 });
    assert.equal(claim.height, 3);
    assert.equal(claim.sizeMode, 'height');
    assert.equal(claim.originalWidth, 202.0335404);
    assert.equal(claim.originalHeight, 32.7559817);
    assert.equal(claim.visible, true);
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

test('the net and object planes survive JSON export/import', () => {
    const exporter = new SVGExporter({});
    const store = createStore();
    const planeDocument = store.createDefaultDocument('+ New');
    planeDocument.planes = planeDocument.planes.map(plane => (
        plane.id === 'left'
            ? {
                ...plane,
                visible: false,
                contentRotation: 180,
                grid: {
                    mode: 'own',
                    own: { ...plane.grid.own, module: 4, margins: 1.5, marginsUnit: 'mm', lockedModule: true }
                }
            }
            : plane
    ));
    // A plane outside the box cross is exactly what the 1.2 format could not carry.
    planeDocument.planes.push({
        id: 'glue',
        name: 'Glue',
        kind: 'glue',
        size: { width: 12, height: 'fit' },
        attach: { to: 'right', edge: 'right', align: 'start', offset: 0 },
        contentRotation: 0,
        grid: { mode: 'inherit', own: { ...planeDocument.planes[0].grid.own } },
        visible: true
    });

    const organized = exporter.organizeSettingsForExport({
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
            planeDocument,
            showSidePanels: true
        },
        textBlocks: [{ id: 'text', content: 'Text', planeId: 'top' }],
        graphicsBlocks: [
            { id: 'graphic', planeId: 'glue', svgContent: '<path/>' },
            { id: 'icons', isBuiltIn: true, planeId: 'right', svgContent: '<g/>' },
            { id: 'claim', isBuiltIn: true, planeId: 'left', svgContent: '<g/>' }
        ]
    });
    const normalized = exporter.normalizeImportedData(organized);
    const planes = Object.fromEntries(
        normalized.settings.planeDocument.planes.map(plane => [plane.id, plane])
    );

    assert.equal(organized.version, '2.0');
    assert.equal(organized.texts[0].plane, 'top');
    assert.equal(planes.left.contentRotation, 180);
    assert.equal(planes.left.grid.mode, 'own');
    assert.equal(planes.left.grid.own.module, 4);
    assert.equal(planes.glue.kind, 'glue');
    assert.deepEqual(planes.glue.attach, { to: 'right', edge: 'right', align: 'start', offset: 0 });
    assert.equal(normalized.textBlocks[0].planeId, 'top');
    assert.equal(normalized.graphicsBlocks.find(block => block.id === 'graphic').planeId, 'glue');
    assert.equal(normalized.graphicsBlocks.find(block => block.id === 'icons').planeId, 'right');
    assert.equal(normalized.graphicsBlocks.find(block => block.id === 'claim').planeId, 'left');
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
