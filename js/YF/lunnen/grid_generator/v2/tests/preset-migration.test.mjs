import assert from 'node:assert/strict';
import test from 'node:test';

import { PresetFormatAdapter } from '../src/preset/PresetFormatAdapter.js';
import { migratePresetToCurrent } from '../src/preset/PresetMigrations.js';
import { PresetSchemaValidator } from '../src/preset/PresetSchemaValidator.js';

const validator = new PresetSchemaValidator();

const surface = (rotation, extra = {}) => ({
    visible: true,
    rotation,
    gridMode: 'main',
    ...extra
});

/** A minimal but schema-valid 1.2 file, the shape every old export has. */
function createLegacyPreset(overrides = {}) {
    return {
        presetName: 'Airis 14" Back',
        version: '1.2',
        timestamp: '2026-08-10T09:07:58.010Z',
        dimensions: { width: 148.5, height: 203, thickness: 43.5, unit: 'mm' },
        surfaces: {
            front: surface(0),
            left: surface(270),
            right: surface(90),
            top: surface(0),
            bottom: surface(180, {
                gridMode: 'own',
                grid: { module: 4, margins: 1.5, columns: 6, rows: 9, rowHeight: 3 }
            })
        },
        texts: [{
            id: 'text-1',
            content: 'Hello',
            style: 'headline',
            position: { column: 1, row: 0, baseline: 0 },
            width: 3,
            alignment: 'left',
            textAlign: 'left',
            alignmentMode: 'baseline',
            surface: 'bottom',
            showBounds: false,
            visible: true,
            lockPosition: true
        }],
        grid: {
            module: 2.6743,
            margins: 2.4521,
            marginsUnit: 'mod',
            columns: 12,
            rows: 12,
            rowHeight: 5,
            locks: { module: false, margins: false, moduleValue: null, marginsValue: null },
            visibility: { columns: true, rows: true, baseline: true }
        },
        colors: { background: '#cabcac' },
        typography: {
            units: { size: 'mod', lineHeight: 'mod' },
            headline: { size: 1, lineHeight: 2, tracking: 0, useXHeight: false, fontWeight: 500 },
            text: { size: 0.85, lineHeight: 1.47, tracking: 0, useXHeight: false, fontWeight: 450 },
            caption: { size: 0.7, lineHeight: 1.25, tracking: 0, useXHeight: false, fontWeight: 500 },
            lunnenDisplay: { size: 2.7, lineHeight: 3.6, tracking: 0, useXHeight: false }
        },
        display: { dimensions: true, labels: true, sidePanels: true, objects: true },
        graphics: {
            blocks: [{
                id: 'graphic',
                name: 'Logo',
                position: { column: 1, row: 2, baseline: 0 },
                height: 3,
                sizeMode: 'height',
                alignment: 'left',
                surface: 'left',
                showBounds: false,
                visible: true,
                lockPosition: true,
                svg: '<path/>'
            }],
            icons: null,
            claim: null
        },
        ...overrides
    };
}

test('a 1.2 preset migrates to a 2.0 net that satisfies the schema', () => {
    const legacy = createLegacyPreset();
    const migrated = migratePresetToCurrent(legacy);

    assert.equal(migrated.version, '2.0');
    assert.equal(migrated.surfaces, undefined);
    assert.equal(validator.assert(migrated), migrated);

    const planes = Object.fromEntries(migrated.net.planes.map(plane => [plane.id, plane]));
    assert.deepEqual(migrated.net.planes.map(plane => plane.id), [
        'front', 'left', 'right', 'top', 'bottom'
    ]);
    assert.equal(migrated.net.rootId, 'front');
    assert.equal(planes.front.attach, null);
    assert.deepEqual(planes.left.attach, {
        to: 'front', edge: 'left', align: 'start', offset: 0
    });
    assert.deepEqual(planes.left.size, { width: 'D', height: 'fit' });
    assert.deepEqual(planes.top.size, { width: 'fit', height: 'D' });
});

test('migration preserves per-surface rotation, visibility and own grids', () => {
    const legacy = createLegacyPreset();
    legacy.surfaces.right.visible = false;
    const planes = Object.fromEntries(
        migratePresetToCurrent(legacy).net.planes.map(plane => [plane.id, plane])
    );

    assert.equal(planes.left.contentRotation, 270);
    assert.equal(planes.right.contentRotation, 90);
    assert.equal(planes.bottom.contentRotation, 180);
    assert.equal(planes.right.visible, false);
    assert.equal(planes.left.visible, true);
    assert.equal(planes.bottom.grid.mode, 'own');
    assert.deepEqual(planes.bottom.grid.own, {
        module: 4,
        margins: 1.5,
        columns: 6,
        rows: 9,
        rowHeight: 3,
        marginsUnit: 'mod',
        lockedModule: false,
        lockedMargins: false
    });
    // Inheriting planes still carry an own grid, seeded from the master grid.
    assert.equal(planes.left.grid.mode, 'inherit');
    assert.equal(planes.left.grid.own.module, 2.6743);
});

test('migration renames the object surface field to a plane reference', () => {
    const migrated = migratePresetToCurrent(createLegacyPreset());

    assert.equal(migrated.texts[0].plane, 'bottom');
    assert.equal(migrated.texts[0].surface, undefined);
    assert.equal(migrated.graphics.blocks[0].plane, 'left');
    assert.equal(migrated.graphics.blocks[0].surface, undefined);
});

test('a hidden side panel toggle survives as per-plane visibility', () => {
    const legacy = createLegacyPreset();
    legacy.display.sidePanels = false;
    const planes = migratePresetToCurrent(legacy).net.planes;

    assert.deepEqual(
        planes.map(plane => [plane.id, plane.visible]),
        [['front', true], ['left', false], ['right', false], ['top', false], ['bottom', false]]
    );
});

test('the format adapter reads a 1.2 file into the current document model', () => {
    const adapter = new PresetFormatAdapter();
    const document = adapter.normalize(createLegacyPreset());

    assert.equal(document.version, '2.0');
    assert.equal(document.textBlocks[0].planeId, 'bottom');
    assert.equal(document.graphicsBlocks[0].planeId, 'left');
    assert.equal(document.settings.planeDocument.rootId, 'front');
    assert.equal(document.settings.planeDocument.planes.length, 5);
    assert.equal(document.settings.surfaceSettings, undefined);
});

test('a 2.0 file passes through migration untouched', () => {
    const adapter = new PresetFormatAdapter();
    const migrated = migratePresetToCurrent(createLegacyPreset());

    assert.equal(migratePresetToCurrent(migrated), migrated);
    assert.equal(adapter.normalize(migrated).settings.planeDocument.planes.length, 5);
});
