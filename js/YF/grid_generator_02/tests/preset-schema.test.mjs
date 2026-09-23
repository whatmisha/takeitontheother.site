import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';

import { PresetSchemaValidator } from '../src/preset/PresetSchemaValidator.js';

const presetsUrl = new URL('../presets/', import.meta.url);
const validator = new PresetSchemaValidator();

async function readPreset(name = 'E-ink.json') {
    return JSON.parse(await readFile(new URL(name, presetsUrl), 'utf8'));
}

test('every checked-in source-of-truth preset satisfies schema 1.2', async () => {
    const files = (await readdir(presetsUrl))
        .filter(name => name.endsWith('.json') && name !== 'manifest.json');
    assert.ok(files.length > 0);
    for (const name of files) {
        const preset = await readPreset(name);
        assert.equal(validator.assert(preset), preset, name);
    }
});

test('schema rejects invalid nested editor values with useful paths', async () => {
    const preset = await readPreset();
    preset.surfaces.left.rotation = 45;
    preset.typography.units.size = 'px';
    delete preset.typography.caption;
    preset.grid.unknownSetting = true;

    assert.throws(
        () => validator.assert(preset),
        error => {
            assert.match(error.message, /surfaces\.left\.rotation/);
            assert.match(error.message, /typography\.units\.size/);
            assert.match(error.message, /typography\.caption is required/);
            assert.match(error.message, /grid\.unknownSetting is not supported/);
            return true;
        }
    );
});
