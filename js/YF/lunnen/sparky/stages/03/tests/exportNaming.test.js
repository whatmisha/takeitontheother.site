import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createSparkyExportBaseName,
    createSparkySettingsDocument
} from '../src/export/exportNaming.js';

test('export names use local date and second-level time without the old prefix', () => {
    const date = new Date(2026, 7, 22, 10, 22, 23);
    assert.equal(createSparkyExportBaseName(date), 'sparky_20260822_10-22-23');
});

test('the SVG sidecar identifies its matching asset and preserves settings', () => {
    const date = new Date('2026-08-22T08:22:23.000Z');
    const settings = { width: 480, height: 480, rayCount: 7, focusX: 210 };
    const document = createSparkySettingsDocument(settings, 'sparky_20260822_10-22-23', date);
    assert.equal(document.asset, 'sparky_20260822_10-22-23.svg');
    assert.equal(document.exportedAt, '2026-08-22T08:22:23.000Z');
    assert.deepEqual(document.settings, settings);
});

