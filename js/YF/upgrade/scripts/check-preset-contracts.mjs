import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const readJson = async relativePath => JSON.parse(await read(relativePath));
const stripComments = source => source.replace(/\/\*[\s\S]*?\*\//gu, '');
const count = (source, pattern) => source.match(pattern)?.length || 0;
const countClass = (source, className) => [...source.matchAll(/\bclass=["']([^"']*)["']/gu)]
    .filter(match => match[1].split(/\s+/u).includes(className))
    .length;
const jsonFiles = async directory => (await readdir(new URL(directory, root)))
    .filter(name => name.endsWith('.json') && name !== 'manifest.json')
    .sort();

const appHtmlPaths = {
    Sparky: 'sparky/index.html',
    'Pizza Boxer': 'grid_generator/src/ui/fragments/workspace.html',
    'Sticky Fingers': 'label_generator/index.html',
    Keyboarder: 'keyboarder/index.html',
    Wordplayer: 'wordplayer/index.html',
    'Pulsar Coder': 'pulsar_coder/index.html',
    Dither: 'dither/index.html',
    'Wander Bender': 'wander_bender/index.html'
};

const appHtml = Object.fromEntries(await Promise.all(
    Object.entries(appHtmlPaths).map(async ([name, path]) => [name, await read(path)])
));

const dropdownInventory = Object.fromEntries(
    Object.entries(appHtml).map(([name, html]) => [name, countClass(html, 'preset-dropdown')])
);
assert.deepEqual(dropdownInventory, {
    Sparky: 1,
    'Pizza Boxer': 1,
    'Sticky Fingers': 1,
    Keyboarder: 1,
    Wordplayer: 1,
    'Pulsar Coder': 1,
    Dither: 0,
    'Wander Bender': 0
}, 'active top preset-dropdown inventory changed');

const directSharedApps = ['Sparky', 'Keyboarder', 'Wordplayer'];
for (const name of directSharedApps) {
    const html = appHtml[name];
    assert.equal(countClass(html, 'preset-toolbar-cluster'), 1, `${name} toolbar cluster changed`);
    assert.equal(count(html, /\bid=["']presetDropdownToggle["']/gu), 1, `${name} preset toggle changed`);
    assert.equal(count(html, /\bid=["']presetDropdownMenu["']/gu), 1, `${name} preset menu changed`);
    assert.equal(count(html, /\bid=["']presetToolbarShareBtn["']/gu), 1, `${name} share action changed`);
    assert.equal(count(html, /\bid=["']savePresetBtn["']/gu), 1, `${name} Save action changed`);
    assert.match(html, /id=["']presetDropdownToggle["'][^>]*\btype=["']button["']/u,
        `${name} preset toggle must remain a non-submit button`);
    assert.match(html, /id=["']presetDropdownToggle["'][^>]*\baria-haspopup=["']listbox["']/u,
        `${name} preset toggle popup semantics changed`);
    assert.match(html, /id=["']presetDropdownToggle["'][^>]*\baria-controls=["']presetDropdownMenu["']/u,
        `${name} preset toggle/menu relationship changed`);
    assert.match(html, /id=["']presetDropdownMenu["'][^>]*\brole=["']listbox["']/u,
        `${name} preset listbox role changed`);
}

const manifestSpecs = [
    ['Sparky', 'sparky/presets/manifest.json', 'sparky/presets/', 5, 5, 0],
    ['Keyboarder', 'keyboarder/presets/manifest.json', 'keyboarder/presets/', 10, 10, 0],
    ['Wordplayer', 'wordplayer/presets/manifest.json', 'wordplayer/presets/', 1, 3, 0],
    ['Pizza Boxer', 'grid_generator/presets/manifest.json', 'grid_generator/presets/', 19, 19, 2],
    ['Sticky Fingers', 'label_generator/presets/manifest.json', 'label_generator/presets/', 3, 3, 0]
];

let selectableManifestPresets = 0;
let manifestRows = 0;
let shippedJsonFiles = 0;
for (const [name, manifestPath, directory, selectable, files, dividers] of manifestSpecs) {
    const manifest = await readJson(manifestPath);
    const entries = Array.isArray(manifest.presets) ? manifest.presets : [];
    const selectableEntries = entries.filter(entry => typeof entry.file === 'string' && entry.file.length > 0);
    const dividerEntries = entries.filter(entry => entry.file == null);
    const directoryJson = await jsonFiles(directory);
    assert.equal(selectableEntries.length, selectable, `${name} selectable manifest count changed`);
    assert.equal(dividerEntries.length, dividers, `${name} manifest divider count changed`);
    assert.equal(directoryJson.length, files, `${name} shipped JSON file count changed`);
    for (const entry of selectableEntries) {
        assert.ok(directoryJson.includes(entry.file), `${name} manifest references missing ${entry.file}`);
    }
    selectableManifestPresets += selectableEntries.length;
    manifestRows += entries.length;
    shippedJsonFiles += directoryJson.length;
}
assert.equal(selectableManifestPresets, 38);
assert.equal(manifestRows, 40);
assert.equal(shippedJsonFiles, 40);

const wordplayerManifest = await readJson('wordplayer/presets/manifest.json');
assert.deepEqual(wordplayerManifest.presets, [{ name: 'Default', file: 'default.json' }],
    'Wordplayer must not silently expose its two unlisted JSON examples');

const [
    sharedCss,
    applicationShell,
    presetStore,
    presetSession,
    sparkyTool,
    keyboarderTool,
    wordplayerTool,
    sparkyCss,
    keyboarderCss,
    wordplayerCss,
    pizzaCss,
    stickyCss,
    pulsarCss,
    wanderCss,
    ditherCss,
    pizzaManager,
    pizzaRepository,
    pizzaFormat,
    pizzaSchema,
    pizzaDraftStore,
    stickyScript,
    pulsarScript
] = await Promise.all([
    read('framework/css/othersite-styles.css'),
    read('framework/src/core/ApplicationShell.js'),
    read('framework/src/preset/PresetStore.js'),
    read('framework/src/preset/PresetSession.js'),
    read('sparky/tool.js'),
    read('keyboarder/app/tool.js'),
    read('wordplayer/tool.js'),
    read('sparky/styles/sparky.css'),
    read('keyboarder/app/theme.css'),
    read('wordplayer/styles.css'),
    read('grid_generator/styles/toolbar.css'),
    read('label_generator/style.css'),
    read('pulsar_coder/css/yf-styles.css'),
    read('wander_bender/css/yf-styles.css'),
    read('dither/style.css'),
    read('grid_generator/src/preset/PresetManager.js'),
    read('grid_generator/src/preset/PresetRepository.js'),
    read('grid_generator/src/preset/PresetFormatAdapter.js'),
    read('grid_generator/schemas/preset-1.2.schema.json'),
    read('grid_generator/src/persistence/DraftStore.js'),
    read('label_generator/script.js'),
    read('pulsar_coder/pulsar-main.js')
]);

const activeSharedCss = stripComments(sharedCss);
for (const selector of [
    'preset-toolbar-cluster',
    'preset-dropdown',
    'preset-dropdown-toggle',
    'preset-toolbar-share-btn',
    'preset-dropdown-menu',
    'preset-dropdown-item',
    'preset-dropdown-item-action',
    'preset-dropdown-color-dot'
]) {
    assert.match(activeSharedCss, new RegExp(`\\.${selector}(?:[\\s:{.#]|$)`, 'u'),
        `shared ${selector} presentation missing`);
}

for (const marker of [
    '_bootstrapPresets()',
    '_initPresetChrome()',
    '_renderPresetDropdown()',
    '_guardUnsaved()',
    'restoreDefaultPresets()',
    'savePreset()',
    'copyShareLink()'
]) {
    assert.ok(applicationShell.includes(marker), `shared preset lifecycle lost ${marker}`);
}
assert.match(presetStore, /if \(all\[clean\] && !overwrite\) return \{ ok: false, reason: 'exists' \}/u,
    'shared duplicate-name guard changed');
assert.match(presetStore, /async loadSeed\(/u, 'shared manifest seeding changed');
assert.match(presetSession, /histories = new Map\(\)/u, 'shared per-preset history changed');
assert.match(presetSession, /openShared\(blob\)/u, 'shared ephemeral share slot changed');

const sharedConfigs = [
    ['Sparky', sparkyTool, 'upgrade:sparky:presets:v1'],
    ['Keyboarder', keyboarderTool, 'upgrade:keyboarder:presets:v1'],
    ['Wordplayer', wordplayerTool, 'upgrade:wordplayer:presets:v1']
];
for (const [name, source, storageKey] of sharedConfigs) {
    assert.match(source, new RegExp(`storageKey:\\s*['"]${storageKey}['"]`, 'u'),
        `${name} isolated preset namespace changed`);
    assert.match(source, /presets:\s*\{/u, `${name} shared preset config missing`);
}
assert.match(sparkyTool, /defaultName:\s*['"]Basic['"]/u);
assert.match(sparkyTool, /forceSeed:\s*true/u);
assert.match(sparkyTool, /pinnedPrefix:\s*['"]\+['"]/u);
assert.match(keyboarderTool, /defaultName:\s*['"]Work 2\.0 L['"]/u);
assert.match(keyboarderTool, /suggestSaveName:/u);
assert.match(wordplayerTool, /hasRandom:\s*\(\)\s*=>\s*false/u);

const localPresetBase = css => /(?:^|\})\s*\.preset-dropdown-toggle\s*\{/u.test(stripComments(css));
for (const [name, css] of [
    ['Sparky', sparkyCss],
    ['Keyboarder', keyboarderCss],
    ['Wordplayer', wordplayerCss]
]) {
    assert.doesNotMatch(stripComments(css), /(?:^|\})\s*\.preset-dropdown-toggle\s*\{/u,
        `${name} reintroduced a local shared preset base`);
    assert.match(stripComments(css), /\.preset-toolbar-cluster\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*gap:\s*var\(--spacing-md\);/su,
        `${name} family-A toolbar layout extension changed`);
}
assert.equal(localPresetBase(pizzaCss), false, 'Pizza reintroduced a local preset component base');
assert.equal(localPresetBase(stickyCss), false, 'Sticky reintroduced a local preset component base');
assert.equal(localPresetBase(pulsarCss), false, 'Pulsar reintroduced a local preset component base');
assert.equal(localPresetBase(wanderCss), true, 'Wander dormant legacy preset CSS changed before cleanup');
assert.equal(localPresetBase(ditherCss), false, 'Dither acquired preset-dropdown CSS');
for (const [name, css] of [
    ['Pulsar', await read('pulsar_coder/pulsar-styles.css')],
    ['Sticky', await read('label_generator/framework-base.css')],
    ['Pizza', await read('grid_generator/framework-base.css')]
]) {
    const bridge = stripComments(css);
    assert.doesNotMatch(bridge, /all:\s*revert-layer/u,
        `${name} must not restore preset reset-promotion blocks`);
    assert.match(bridge,
        /\.preset-dropdown-toggle\s*\{[\s\S]*?font-size:\s*0\.9rem;[\s\S]*?font-weight:\s*600;[\s\S]*?\}/u,
        `${name} preset toggle metrics changed`);
    assert.match(bridge,
        /\.preset-dropdown-menu\s*\{\s*max-height:\s*400px;\s*overflow-y:\s*auto;\s*\}/u,
        `${name} preset viewport metrics changed`);
    assert.match(bridge,
        /\.preset-dropdown-item\s*\{[\s\S]*?white-space:\s*nowrap;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?\}/u,
        `${name} preset item metrics changed`);
}

assert.match(pizzaManager, /class PresetManager/u);
assert.match(pizzaManager, /hasChanges = false/u);
assert.match(pizzaManager, /addImportedPreset/u);
assert.match(pizzaRepository, /importedPresets = \[\]/u);
assert.match(pizzaRepository, /const id = `imported-/u);
assert.match(pizzaFormat, /PresetSchemaValidator/u);
assert.match(pizzaSchema, /"const":\s*"1\.2"/u);
assert.match(pizzaDraftStore, /DATABASE_NAME = 'upgrade-pizza-boxer-v1'/u,
    'Pizza draft storage isolation changed');

assert.match(stickyScript, /async loadPresetsManifest\(\)/u);
assert.match(stickyScript, /this\.availablePresets = presets\.sort/u);
assert.match(stickyScript, /this\.maxPresetWidth = Math\.max/u);
assert.match(stickyScript, /async loadPreset\(filename\)/u);
assert.match(stickyScript, /async loadDataFromGoogleSheets\(\)/u,
    'Sticky Google Sheets boundary changed');

const pulsarPresetObject = pulsarScript.match(/const presets = \{([\s\S]*?)\n\};\n\nfunction applyPreset/u)?.[1] || '';
assert.equal(count(pulsarPresetObject, /^\s{4}(?:voyager|dense|minimal|accurate):\s*\{/gmu), 4,
    'Pulsar inline preset inventory changed');
assert.match(pulsarScript, /function applyPreset\(presetName\)/u);
assert.doesNotMatch(pulsarScript, /PresetStore|PresetSession|ShareCodec/u,
    'Pulsar data was coupled to shared CRUD before its dedicated task');

assert.equal(count(appHtml.Dither, /\bid=["']lunnenBlue["']/gu), 1,
    'Dither private color shortcut id changed');
assert.equal(countClass(appHtml.Dither, 'color-preset'), 1,
    'Dither private color shortcut class changed');

console.log(
    `Preset contract passed: ${Object.values(dropdownInventory).reduce((sum, value) => sum + value, 0)} active dropdowns; `
    + `${selectableManifestPresets} selectable manifest presets in ${manifestRows} rows / ${shippedJsonFiles} JSON files; `
    + '4 inline Pulsar presets; 3 shared CRUD + 3 private data + 2 no-toolbar tools.'
);
