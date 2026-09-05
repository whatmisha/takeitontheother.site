import assert from 'node:assert/strict';
import test from 'node:test';

import { createSparkyExportBaseName } from '../src/export/exportNaming.js';

test('export names use local date and second-level time without the old prefix', () => {
    const date = new Date(2026, 7, 22, 10, 22, 23);
    assert.equal(createSparkyExportBaseName(date), 'sparky_20260822_10-22-23');
});
