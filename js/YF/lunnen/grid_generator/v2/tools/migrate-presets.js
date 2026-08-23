import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { migratePresetToCurrent, CURRENT_PRESET_VERSION } from '../src/preset/PresetMigrations.js';
import { PresetSchemaValidator } from '../src/preset/PresetSchemaValidator.js';

const presetsUrl = new URL('../presets/', import.meta.url);
const checkOnly = process.argv.includes('--check');
const validator = new PresetSchemaValidator();

const files = (await readdir(presetsUrl))
    .filter(name => name.endsWith('.json') && name !== 'manifest.json')
    .sort();

let stale = 0;
for (const name of files) {
    const fileUrl = new URL(name, presetsUrl);
    const source = await readFile(fileUrl, 'utf8');
    const data = JSON.parse(source);
    validator.assert(data);
    const migrated = migratePresetToCurrent(data);
    validator.assert(migrated);
    const nextSource = `${JSON.stringify(migrated, null, 2)}\n`;

    if (source === nextSource) continue;
    if (checkOnly) {
        console.error(`${name} is not on preset format ${CURRENT_PRESET_VERSION}.`);
        stale += 1;
        continue;
    }
    await writeFile(fileUrl, nextSource, 'utf8');
    console.log(`Migrated ${fileURLToPath(fileUrl)}`);
}

if (stale > 0) {
    console.error('Run: npm --prefix tools run presets:migrate');
    process.exitCode = 1;
} else if (checkOnly) {
    console.log(`All ${files.length} presets are on format ${CURRENT_PRESET_VERSION}.`);
}
