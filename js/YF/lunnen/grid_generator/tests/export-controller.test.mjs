import test from 'node:test';
import assert from 'node:assert/strict';

import { ExportController } from '../src/svg/ExportController.js';

const settings = {
    frontWidth: 500,
    frontHeight: 400,
    thickness: 50,
    gridModule: 5,
    margins: 2.5,
    columnCount: 12,
    rowCount: 10,
    showSidePanels: true
};
const date = new Date(2026, 7, 10, 9, 7);

test('all export formats share one stable descriptive filename', () => {
    const filename = ExportController.buildFilename({
        settings,
        presetName: 'Front Retail',
        extension: 'svg',
        date
    });

    assert.equal(
        filename,
        'Front_Retail_500×400×50_12col_10rows_module_5.00mm_margins_12.50mm_260810_0907.svg'
    );
});

test('New and Custom filenames omit the synthetic preset name', () => {
    const withoutSides = { ...settings, showSidePanels: false };
    const expected = '500×400_12col_10rows_module_5.00mm_margins_12.50mm_260810_0907.json';

    assert.equal(ExportController.buildFilename({
        settings: withoutSides,
        presetName: '+ New',
        extension: 'json',
        date
    }), expected);
    assert.equal(ExportController.buildFilename({
        settings: withoutSides,
        presetName: 'Custom',
        extension: 'json',
        date
    }), expected);
});

test('SVG export forwards outline mode and generated document once', async () => {
    const calls = [];
    const document = { id: 'svg' };
    const host = {
        settingsModule: { getAll: () => ({ ...settings }) },
        currentPresetName: 'Front Retail',
        dom: { convertToOutlinesCheckbox: { checked: true } },
        exportDocumentBuilder: { build: async () => document },
        svgExporter: {
            exportToFile: async (...args) => { calls.push(args); }
        }
    };
    const controller = new ExportController(host, { now: () => date });

    await controller.exportSvg();

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], document);
    assert.match(calls[0][1], /\.svg$/);
    assert.deepEqual(calls[0][2], {
        removeInteractive: true,
        optimizeSize: true,
        convertTextToOutlines: true
    });
});

test('JSON export reads object data from the document source of truth', () => {
    let exported;
    const textBlocks = [{ id: 'text-1' }];
    const graphicsBlocks = [{ id: 'icons' }, { id: 'claim' }];
    const host = {
        settingsModule: { getAll: () => ({ ...settings }) },
        currentPresetName: 'Front Retail',
        objectDocument: {
            textBlocks,
            graphicsBlocks,
            getGraphicsBlock: id => graphicsBlocks.find(block => block.id === id) || null
        },
        svgExporter: {
            exportSettings: (data, filename) => { exported = { data, filename }; }
        }
    };
    const controller = new ExportController(host, { now: () => date });

    const data = controller.exportSettings();

    assert.equal(data, exported.data);
    assert.equal(data.textBlocks, textBlocks);
    assert.equal(data.graphicsBlocks, graphicsBlocks);
    assert.equal(data.iconsBlock.id, 'icons');
    assert.match(exported.filename, /\.json$/);
});
