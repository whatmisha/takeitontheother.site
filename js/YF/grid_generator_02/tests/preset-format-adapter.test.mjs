import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PresetFormatAdapter } from '../src/preset/PresetFormatAdapter.js';

const adapter = new PresetFormatAdapter();

test('organized preset JSON round-trips every editable document setting', () => {
    const surfaceSettings = {
        front: { visible: true, rotation: 0, gridMode: 'main' },
        left: {
            visible: false,
            rotation: 180,
            gridMode: 'own',
            grid: { module: 4, margins: 1.5, columns: 6, rows: 9, rowHeight: 3 }
        }
    };
    const source = {
        version: '1.2',
        timestamp: '2026-08-10T12:00:00.000Z',
        currentPresetName: 'Round trip',
        settings: {
            frontWidth: 148.5,
            frontHeight: 203,
            thickness: 43.5,
            surfaceSettings,
            gridModule: 2.6743,
            margins: 2.4521,
            marginsUnit: 'mm',
            columnCount: 12,
            rowCount: 12,
            rowHeight: 5,
            linkMode: 'module',
            lockedModule: true,
            lockedMargins: false,
            lockedModuleValue: 2.6743,
            lockedMarginsValue: null,
            showColumns: true,
            showRows: false,
            showBaseline: true,
            boxColor: '#cabcac',
            fontSizeUnit: 'pt',
            lineHeightUnit: 'pt',
            headlineSize: 1,
            lineHeight: 2,
            tracking: -0.015,
            useXHeight: true,
            headlineFontWeight: 500,
            textSize: 0.85,
            textLineHeight: 1.47,
            textTracking: 0,
            useXHeight2: false,
            textFontWeight: 450,
            captionSize: 0.37,
            captionLineHeight: 1.25,
            captionTracking: 0.045,
            useXHeightCaption: true,
            captionFontWeight: 350,
            lunnenDisplaySize: 2.7,
            lunnenDisplayLineHeight: 3.6,
            lunnenDisplayTracking: 0.02,
            useXHeightLunnenDisplay: true,
            showDimensions: false,
            showLabels: true,
            showSidePanels: true,
            showObjects: true
        },
        textBlocks: [
            {
                id: 'caption',
                content: 'Caption',
                styleRef: 'caption',
                x: 0,
                row: 2,
                baselineOffset: 0,
                width: 4.75,
                alignment: 'right',
                textAlign: 'center',
                alignmentMode: 'x-height',
                surface: 'left',
                showBounds: true,
                visible: false,
                lockPosition: false,
                layerIndex: 1
            },
            {
                id: 'display',
                content: 'Lunnen',
                styleRef: 'lunnenDisplay',
                x: 3,
                row: 4,
                baselineOffset: 1,
                width: 6,
                alignment: 'left',
                textAlign: 'left',
                alignmentMode: 'baseline',
                surface: 'front',
                showBounds: false,
                visible: true,
                lockPosition: true,
                layerIndex: 4,
                fontWeight: 275,
                fontFeatures: { salt: true, ss01: false, tnum: true }
            }
        ],
        graphicsBlocks: [
            {
                id: 'graphic',
                name: 'Logo',
                isBuiltIn: false,
                svgContent: '<path/>',
                sizeMode: 'width',
                heightInModules: 2.5,
                widthInColumns: 5.5,
                widthInModules: 8,
                alignment: 'center',
                surface: 'bottom',
                x: 0,
                row: 3,
                baselineOffset: 2,
                showBounds: true,
                visible: false,
                originalWidth: 120,
                originalHeight: 30,
                lockPosition: false,
                layerIndex: 3
            },
            {
                id: 'icons',
                name: 'Icons',
                isBuiltIn: true,
                svgContent: '<g id="icons"/>',
                sizeMode: 'width',
                heightInModules: 2,
                widthInColumns: 4.5,
                alignment: 'right',
                surface: 'right',
                x: 5,
                row: 6,
                baselineOffset: 1,
                showBounds: true,
                visible: true,
                originalWidth: 205,
                originalHeight: 29,
                lockPosition: false,
                layerIndex: 0
            },
            {
                id: 'claim',
                name: 'Claim',
                isBuiltIn: true,
                svgContent: '<g id="claim"/>',
                sizeMode: 'height',
                heightInModules: 3.25,
                widthInColumns: 3.5,
                alignment: 'left',
                surface: 'top',
                x: 7,
                row: 8,
                baselineOffset: 0,
                showBounds: false,
                visible: false,
                originalWidth: 187,
                originalHeight: 29,
                lockPosition: true,
                layerIndex: 2
            },
            {
                id: 'claim2026',
                name: 'Claim 2026',
                isBuiltIn: true,
                svgContent: '<g id="claim-2026"/>',
                sizeMode: 'height',
                heightInModules: 3,
                widthInColumns: null,
                alignment: 'left',
                surface: 'front',
                x: 4,
                row: 11,
                baselineOffset: 4,
                showBounds: false,
                visible: true,
                originalWidth: 202.0335404,
                originalHeight: 32.7559817,
                lockPosition: true,
                layerIndex: 5
            }
        ]
    };

    const organized = adapter.organize(source, { presetName: 'Round trip export' });
    const normalized = adapter.normalize(JSON.parse(JSON.stringify(organized)));

    assert.equal(organized.presetName, 'Round trip export');
    assert.deepEqual(organized.grid.locks, {
        module: true,
        margins: false,
        moduleValue: 2.6743,
        marginsValue: null
    });
    assert.deepEqual(organized.typography.units, { size: 'pt', lineHeight: 'pt' });
    assert.deepEqual(organized.typography.caption, {
        size: 0.37,
        lineHeight: 1.25,
        tracking: 0.045,
        useXHeight: true,
        fontWeight: 350
    });
    assert.deepEqual(organized.typography.lunnenDisplay, {
        size: 2.7,
        lineHeight: 3.6,
        tracking: 0.02,
        useXHeight: true
    });

    for (const key of [
        'fontSizeUnit', 'lineHeightUnit',
        'lockedModule', 'lockedMargins', 'lockedModuleValue', 'lockedMarginsValue',
        'captionSize', 'captionLineHeight', 'captionTracking',
        'useXHeightCaption', 'captionFontWeight',
        'lunnenDisplaySize', 'lunnenDisplayLineHeight', 'lunnenDisplayTracking',
        'useXHeightLunnenDisplay'
    ]) {
        assert.deepEqual(normalized.settings[key], source.settings[key], key);
    }
    assert.deepEqual(normalized.settings.surfaceSettings, surfaceSettings);
    assert.equal(normalized.textBlocks[0].x, 0);
    assert.equal(normalized.textBlocks[0].lockPosition, false);
    assert.equal(normalized.textBlocks[0].layerIndex, 1);
    assert.equal(normalized.textBlocks[1].fontWeight, 275);
    assert.deepEqual(normalized.textBlocks[1].fontFeatures, {
        salt: true,
        ss01: false,
        tnum: true
    });

    const customGraphic = normalized.graphicsBlocks.find(block => block.id === 'graphic');
    assert.equal(customGraphic.x, 0);
    assert.equal(customGraphic.sizeMode, 'width');
    assert.equal(customGraphic.widthInColumns, 5.5);
    assert.equal(customGraphic.widthInModules, 8);
    assert.equal(customGraphic.lockPosition, false);
    assert.equal(customGraphic.showBounds, true);
    assert.equal(customGraphic.layerIndex, 3);

    const icons = normalized.graphicsBlocks.find(block => block.id === 'icons');
    assert.equal(icons.sizeMode, 'width');
    assert.equal(icons.widthInColumns, 4.5);
    assert.equal(icons.alignment, 'right');
    assert.equal(icons.lockPosition, false);
    assert.equal(icons.originalWidth, 205);
    assert.equal(icons.showBounds, true);

    const claim2026 = normalized.graphicsBlocks.find(block => block.id === 'claim2026');
    assert.equal(claim2026.x, 4);
    assert.equal(claim2026.row, 11);
    assert.equal(claim2026.baselineOffset, 4);
    assert.equal(claim2026.heightInModules, 3);
    assert.equal(claim2026.originalHeight, 32.7559817);
    assert.equal(claim2026.svgContent, '<g id="claim-2026"/>');
    assert.equal(claim2026.layerIndex, 5);
});

test('legacy and incomplete preset documents are rejected explicitly', async () => {
    const current = JSON.parse(
        await readFile(new URL('../presets/E-ink.json', import.meta.url), 'utf8')
    );
    assert.throws(
        () => adapter.normalize({ settings: { gridModule: 5 }, textBlocks: [] }),
        /Unsupported preset format/
    );
    assert.throws(
        () => adapter.normalize({ ...current, version: '1.1' }),
        /version must be 1\.2/
    );
    const incomplete = structuredClone(current);
    delete incomplete.typography.caption;
    assert.throws(() => adapter.normalize(incomplete), /typography\.caption/);
});
