import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);

const expectedLiterals = new Map([
    ['keyboarder/app/tool.js', [
        'upgrade:keyboarder:svg-export-mode:v1',
        'upgrade:keyboarder:ui-mode:v1',
        'upgrade:keyboarder:presets:v1'
    ]],
    ['keyboarder/app/perf.js', ['upgrade:keyboarder:perf:v1']],
    ['wordplayer/tool.js', ['upgrade:wordplayer:presets:v1']],
    ['sparky/tool.js', ['upgrade:sparky:presets:v1']],
    ['framework/demo/tool.js', ['upgrade:framework-demo:presets:v1']],
    ['framework/src/preset/PresetStore.js', ['upgrade:framework:presets:v1']],
    ['framework/src/core/ApplicationShell.js', ['upgrade:framework:presets:v1']],
    ['grid_generator/src/persistence/DraftStore.js', ['upgrade-pizza-boxer-v1']]
]);

const pizzaRuntimeEntries = (await readdir(path.join(upgradeRoot, 'grid_generator/runtime/assets')))
    .filter(name => /^PublicEntry-[\w-]+\.js$/.test(name));
assert.equal(pizzaRuntimeEntries.length, 1, 'Expected exactly one Pizza Boxer PublicEntry runtime');
expectedLiterals.set(`grid_generator/runtime/assets/${pizzaRuntimeEntries[0]}`, ['upgrade-pizza-boxer-v1']);

const originalNamespaces = [
    'keyboarder.svgExportTextMode',
    'keyboarder.uiMode',
    'keyboarder.perf',
    "storageKey: 'keyboarder'",
    'wordplayerPresetsV18',
    'lunnenSparkyGeneratorV1',
    'lunnenSparkyGeneratorV2',
    'othersitePatternStudio',
    'othersitePresets',
    'lunnen-grid-generator'
];

const checkedText = [];
for (const [relativePath, literals] of expectedLiterals) {
    const text = await readFile(path.join(upgradeRoot, relativePath), 'utf8');
    checkedText.push([relativePath, text]);
    for (const literal of literals) {
        assert.ok(text.includes(literal), `${relativePath} does not contain ${literal}`);
    }
}

for (const [relativePath, text] of checkedText) {
    for (const original of originalNamespaces) {
        assert.ok(!text.includes(original), `${relativePath} still references original namespace ${original}`);
    }
}

class MemoryStorage {
    constructor(entries = []) {
        this.values = new Map(entries);
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.values.set(String(key), String(value));
    }

    removeItem(key) {
        this.values.delete(String(key));
    }
}

const sentinelEntries = originalNamespaces
    .filter(namespace => !namespace.startsWith('storageKey:') && namespace !== 'lunnen-grid-generator')
    .map(namespace => [namespace, `sentinel:${namespace}`]);
const memoryStorage = new MemoryStorage(sentinelEntries);
globalThis.localStorage = memoryStorage;

const presetStoreUrl = pathToFileURL(path.join(
    upgradeRoot,
    'framework/src/preset/PresetStore.js'
)).href;
const { PresetStore } = await import(`${presetStoreUrl}?storage-isolation-check=1`);

for (const storageKey of [
    'upgrade:keyboarder:presets:v1',
    'upgrade:wordplayer:presets:v1',
    'upgrade:sparky:presets:v1'
]) {
    const store = new PresetStore({ storageKey });
    assert.deepEqual(store.create('Isolation sentinel', { ok: true }), { ok: true });
    store.markSeeded();
    assert.ok(memoryStorage.getItem(storageKey), `${storageKey} was not written`);
    assert.equal(memoryStorage.getItem(`${storageKey}__seeded`), '1');
}

for (const [namespace, sentinel] of sentinelEntries) {
    assert.equal(memoryStorage.getItem(namespace), sentinel, `Original namespace changed: ${namespace}`);
}

console.log(`Storage isolation passed: ${expectedLiterals.size} runtime files and ${sentinelEntries.length} original sentinels checked.`);
