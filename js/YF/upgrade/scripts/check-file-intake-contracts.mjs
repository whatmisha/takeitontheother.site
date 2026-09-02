import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const count = (source, pattern) => source.match(pattern)?.length || 0;

const htmlPaths = {
    Wordplayer: ['wordplayer/index.html'],
    'Pizza Boxer': [
        'grid_generator/src/ui/fragments/actions.html',
        'grid_generator/src/ui/fragments/object-editors.html'
    ],
    'Sticky Fingers': ['label_generator/index.html'],
    Keyboarder: ['keyboarder/index.html'],
    Sparky: ['sparky/index.html'],
    Dither: ['dither/index.html'],
    'Wander Bender': ['wander_bender/index.html'],
    'Pulsar Coder': ['pulsar_coder/index.html']
};
const expectedInputs = {
    Wordplayer: ['imageInput', 'formInput'],
    'Pizza Boxer': ['importSettingsInput', 'svgFileInput'],
    'Sticky Fingers': ['importSettingsInput', 'svgFileInput'],
    Keyboarder: [
        'newLayoutInput', 'importJsonInput', 'drawingSvgInput',
        'fontFileInput', 'legendIconFileInput'
    ],
    Sparky: ['motionImportPathInput'],
    Dither: ['imageInput', 'sampleInput'],
    'Wander Bender': [],
    'Pulsar Coder': []
};

const html = Object.fromEntries(await Promise.all(
    Object.entries(htmlPaths).map(async ([name, paths]) => [
        name,
        (await Promise.all(paths.map(read))).join('\n')
    ])
));

for (const [name, inputIds] of Object.entries(expectedInputs)) {
    const source = html[name];
    const actualIds = [...source.matchAll(
        /<input\b(?=[^>]*\btype=["']file["'])(?=[^>]*\bid=["']([^"']+)["'])[^>]*>/gu
    )].map(match => match[1]);
    assert.deepEqual(actualIds.sort(), [...inputIds].sort(), `${name} file-surface inventory changed`);
    for (const id of inputIds) {
        assert.match(source, new RegExp(`\\bid=["']${id}["']`, 'u'), `${name} lost ${id}`);
    }
}

assert.equal(
    Object.values(expectedInputs).flat().length,
    14,
    'UPG-062 must own exactly 14 file surfaces in six tools'
);
assert.match(html['Sticky Fingers'], /id=["']googleSheetsUrl["']/u,
    'Sticky Fingers must retain its private Google Sheets URL flow');
assert.match(html['Sticky Fingers'], /id=["']loadDataBtn["']/u,
    'Sticky Fingers must retain its private Google Sheets load action');

const [
    controller,
    publicBarrel,
    sharedCss,
    wordplayer,
    wordplayerAssets,
    pizzaSettings,
    pizzaGraphics,
    sticky,
    keyboarder,
    sparky,
    dither
] = await Promise.all([
    read('framework/src/ui/FileIntakeController.js'),
    read('framework/src/index.js'),
    read('framework/css/othersite-styles.css'),
    read('wordplayer/src/ui/controls.js'),
    read('wordplayer/src/io/assets.js'),
    read('grid_generator/src/ui/ApplicationEventController.js'),
    read('grid_generator/src/elements/GraphicsEditorEventController.js'),
    read('label_generator/script.js'),
    read('keyboarder/app/tool.js'),
    read('sparky/tool.js'),
    read('dither/dither.js')
]);

for (const marker of [
    'export class FileIntakeController',
    "this._listen(this.input, 'change'",
    "event.target.value = ''",
    "this._listen(zone, 'drop'",
    'this.selectFile(candidates)',
    "this.setState('loading'",
    "this.setState('ready'",
    "this.setState('error'",
    "this.setState('empty'",
    "this.status.setAttribute?.('aria-live', 'polite')",
    'destroy()'
]) {
    assert.ok(controller.includes(marker), `shared FileIntake lost ${marker}`);
}
assert.match(publicBarrel, /FileIntakeController/u, 'FileIntake is missing from the public barrel');
assert.match(sharedCss, /\.file-intake\.is-dragover/u, 'shared drop state presentation missing');
assert.match(sharedCss, /\.file-intake__status\[data-state="error"\]/u,
    'shared error state presentation missing');

assert.equal(count(wordplayer, /create\(\{\s*inputId:/gu), 2,
    'Wordplayer must keep two FileIntake instances');
assert.equal(count(pizzaSettings, /new FileIntakeController\(\{/gu), 1,
    'Pizza settings must keep one FileIntake instance');
assert.equal(count(pizzaGraphics, /new FileIntakeController\(\{/gu), 1,
    'Pizza graphics must keep one FileIntake instance');
assert.equal(count(sticky, /new FileIntakeController\(\{/gu), 2,
    'Sticky Fingers must keep two FileIntake instances');
for (const key of ['model', 'newLayout', 'drawing', 'font', 'legendIcon']) {
    assert.match(keyboarder, new RegExp(`create\\('${key}'`, 'u'),
        `Keyboarder lost its ${key} FileIntake adapter`);
}
assert.equal(count(sparky, /new FileIntakeController\(\{/gu), 1,
    'Sparky must keep one FileIntake instance');
assert.equal(count(dither, /new FileIntakeController\(\{/gu), 2,
    'Dither must keep two FileIntake instances');

assert.match(wordplayerAssets, /async loadImageFile\(file\)/u);
assert.match(wordplayerAssets, /async loadFormFile\(file\)/u);
assert.match(pizzaSettings, /this\.host\.importSettings\(file\)/u);
assert.match(pizzaGraphics, /this\.host\.graphicsAssetController\.handleFile\(file\)/u);
assert.match(sticky, /this\.importSettings\(file\)/u);
assert.match(sticky, /this\.handleSvgFile\(file\)/u);
assert.match(keyboarder, /createNewLayoutFromFile\(app, file\)/u);
assert.match(keyboarder, /importFontFile\(app, file\)/u);
assert.match(keyboarder, /importLegendIconFile\(app, file\)/u);
assert.match(sparky, /importSvgMotionPath\(await file\.text\(\)/u);
assert.match(sparky, /maxBytes:\s*2 \* 1024 \* 1024/u,
    'Sparky must retain its private 2 MB motion-path guard');
assert.match(dither, /this\.decodeImageFile\(file\)/u);
assert.match(dither, /dropzone:\s*document\.querySelector\('\.canvas-container'\)/u,
    'Dither source image must retain its Canvas drop target');

console.log(
    'FileIntake contract passed: 14 surfaces in six tools; 0 in Wander/Pulsar; '
    + 'shared picker/drop/state semantics; private parsers and Sticky Google Sheets retained.'
);
