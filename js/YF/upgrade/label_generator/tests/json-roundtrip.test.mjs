import assert from 'node:assert/strict';
import test from 'node:test';

import { SVGExporter } from '../src/svg/SVGExporter.js';

test('Sticky readable JSON round-trip preserves private fields and accepts readable edits', () => {
    const exporter = new SVGExporter({}, null);
    const source = {
        version: '1.0',
        timestamp: '2026-09-05T12:00:00.000Z',
        settings: {
            frontWidth: 120,
            frontHeight: 48,
            cornerRadius: 2,
            gridModule: 6,
            margins: 1,
            marginsUnit: 'mod',
            columnCount: 12,
            rowCount: 8,
            rowHeight: 3,
            linkMode: 'module',
            showColumns: true,
            showRows: false,
            showBaseline: true,
            boxColor: '#123456',
            headlineSize: 18,
            lineHeight: 22,
            tracking: 0.02,
            useXHeight: true,
            headlineFontWeight: 500,
            textSize: 12,
            textLineHeight: 16,
            textTracking: 0,
            useXHeight2: false,
            textFontWeight: 400,
            showDimensions: false,
            showLabels: true,
            showObjects: true,
            prepressBleed: 3,
            privateFutureSetting: { enabled: true }
        },
        textBlocks: [{
            id: 'headline', content: 'Original', styleRef: 'headline', x: 0, row: 1,
            baselineOffset: 0, width: 4, alignment: 'left', alignmentMode: 'baseline',
            surface: 'front', showBounds: false, useXHeight: true, visible: false,
            fontWeight: 575, fontFeatures: { salt: true }, lockPosition: true
        }],
        graphicsBlocks: [
            {
                id: 'logo', name: 'Logo', isBuiltIn: false, svgContent: '<path/>',
                heightInModules: 3, widthInModules: 5, x: 2, row: 3,
                baselineOffset: 1, alignment: 'center', surface: 'front',
                visible: false, layerIndex: 4
            },
            {
                id: 'icons', name: 'Icons', isBuiltIn: true, svgContent: '<g/>',
                heightInModules: 2, x: 1, row: 2, visible: true
            }
        ],
        iconsBlock: { id: 'legacy-icons', visible: false },
        claimBlock: { id: 'legacy-claim', visible: true }
    };

    const organized = exporter.organizeSettingsForExport(source);
    const serialized = JSON.stringify(organized);
    const edited = JSON.parse(serialized);
    edited.dimensions.width = 125;
    edited.texts[0].content = 'Edited by copywriter';
    const restored = exporter.normalizeImportedData(edited);

    assert.equal(restored.settings.frontWidth, 125, 'readable dimensions remain authoritative');
    assert.equal(restored.settings.prepressBleed, 3);
    assert.deepEqual(restored.settings.privateFutureSetting, { enabled: true });
    assert.equal(restored.textBlocks[0].content, 'Edited by copywriter');
    assert.equal(restored.textBlocks[0].fontWeight, 575);
    assert.deepEqual(restored.textBlocks[0].fontFeatures, { salt: true });
    assert.equal(restored.textBlocks[0].lockPosition, true);
    assert.equal(restored.graphicsBlocks.find(block => block.id === 'logo').layerIndex, 4);
    assert.equal(restored.graphicsBlocks.find(block => block.id === 'icons').isBuiltIn, true);
    assert.deepEqual(restored.iconsBlock, source.iconsBlock);
    assert.deepEqual(restored.claimBlock, source.claimBlock);
});

test('Sticky legacy JSON remains importable without applicationState', () => {
    const exporter = new SVGExporter({}, null);
    const legacy = {
        version: '1.0',
        settings: { gridModule: 6, headlineSize: 18 },
        textBlocks: [],
        graphicsBlocks: []
    };
    assert.deepEqual(exporter.normalizeImportedData(structuredClone(legacy)), legacy);
});

test('Sticky rejects foreign JSON before application state can be mutated', () => {
    const exporter = new SVGExporter({}, null);
    assert.throws(() => exporter.normalizeImportedData(null), /root must be an object/u);
    assert.throws(() => exporter.normalizeImportedData([]), /root must be an object/u);
    assert.throws(() => exporter.normalizeImportedData({ foreign: true }), /Unsupported settings JSON format/u);
    assert.throws(() => JSON.parse('{bad'), SyntaxError);
});
