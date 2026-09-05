import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const countRanges = source => source.match(/<input\b[^>]*\btype=["']range["'][^>]*>/gu)?.length || 0;
const stripComments = source => source.replace(/\/\*[\s\S]*?\*\//gu, '');

const [
    sparkyHtml,
    pizzaWorkspace,
    pizzaTypography,
    pizzaEditors,
    stickyHtml,
    keyboarderHtml,
    wordplayerHtml,
    pulsarHtml,
    ditherHtml,
    wanderHtml
] = await Promise.all([
    read('sparky/index.html'),
    read('grid_generator/src/ui/fragments/workspace.html'),
    read('grid_generator/src/ui/fragments/typography.html'),
    read('grid_generator/src/ui/fragments/object-editors.html'),
    read('label_generator/index.html'),
    read('keyboarder/index.html'),
    read('wordplayer/index.html'),
    read('pulsar_coder/index.html'),
    read('dither/index.html'),
    read('wander_bender/index.html')
]);

const inventory = [
    { app: 'Sparky', staticOrdinary: countRanges(sparkyHtml), sharedHsb: 3, privateCount: 0 },
    {
        app: 'Pizza Boxer',
        staticOrdinary: countRanges(pizzaWorkspace + pizzaTypography + pizzaEditors) - 3,
        sharedHsb: 0,
        privateCount: 3
    },
    { app: 'Sticky Fingers', staticOrdinary: 0, sharedHsb: 0, privateCount: countRanges(stickyHtml) },
    { app: 'Keyboarder', staticOrdinary: countRanges(keyboarderHtml), sharedHsb: 3, privateCount: 0 },
    { app: 'Wordplayer', staticOrdinary: countRanges(wordplayerHtml), sharedHsb: 3, privateCount: 0 },
    { app: 'Pulsar Coder', staticOrdinary: countRanges(pulsarHtml), sharedHsb: 0, privateCount: 0 },
    { app: 'Dither', staticOrdinary: 0, sharedHsb: 0, privateCount: countRanges(ditherHtml) },
    { app: 'Wander Bender', staticOrdinary: countRanges(wanderHtml), sharedHsb: 0, privateCount: 0 }
];

assert.deepEqual(
    inventory.map(({ app, staticOrdinary, sharedHsb, privateCount }) => [app, staticOrdinary, sharedHsb, privateCount]),
    [
        ['Sparky', 24, 3, 0],
        ['Pizza Boxer', 26, 0, 3],
        ['Sticky Fingers', 0, 0, 6],
        ['Keyboarder', 0, 3, 0],
        ['Wordplayer', 20, 3, 0],
        ['Pulsar Coder', 8, 0, 0],
        ['Dither', 0, 0, 13],
        ['Wander Bender', 19, 0, 0]
    ],
    'range inventory or ownership changed'
);

const sharedOrdinary = inventory.reduce((sum, item) => sum + item.staticOrdinary, 0);
const sharedHsb = inventory.reduce((sum, item) => sum + item.sharedHsb, 0);
const privateRanges = inventory.reduce((sum, item) => sum + item.privateCount, 0);
assert.equal(sharedOrdinary, 97);
assert.equal(sharedHsb, 9);
assert.equal(privateRanges, 22);
assert.equal(sharedOrdinary + sharedHsb + privateRanges, 128);

const sharedOrdinaryApps = await Promise.all([
    ['Sparky', 'sparky/styles/sparky.css'],
    ['Pizza Boxer', 'grid_generator/styles/controls.css'],
    ['Keyboarder', 'keyboarder/app/theme.css'],
    ['Wordplayer', 'wordplayer/styles.css'],
    ['Pulsar Coder', 'pulsar_coder/css/yf-styles.css'],
    ['Wander Bender', 'wander_bender/css/yf-styles.css']
].map(async ([app, path]) => [app, stripComments(await read(path))]));

const ordinaryPseudo = /\.control-group input\[type=["']range["']\](?::focus)?::(?:-webkit-slider-thumb|-moz-range-thumb|-webkit-slider-runnable-track|-moz-range-track)/u;
for (const [app, css] of sharedOrdinaryApps) {
    assert.doesNotMatch(css, ordinaryPseudo, `${app} reintroduced a private ordinary range skin`);
}

const [sharedCss, pizzaCss, ditherCss, stickyCss] = await Promise.all([
    read('framework/css/othersite-styles.css'),
    read('grid_generator/styles/controls.css'),
    read('dither/style.css'),
    read('label_generator/style.css')
]);
assert.match(sharedCss, /\.hsb-control-group input\[type="range"\]::-webkit-slider-thumb\s*\{[^}]*width:\s*12px;[^}]*height:\s*12px;/su);
assert.match(pizzaCss, /\.hsb-control-group input\[type="range"\]::-webkit-slider-thumb\s*\{[^}]*width:\s*var\(--slider-thumb-size\);[^}]*height:\s*var\(--slider-thumb-size\);/su);
assert.match(ditherCss, /--slider-thumb-size:\s*10px;/u);
assert.match(ditherCss, /\.control-group input\[type="range"\]::-webkit-slider-thumb:hover\s*\{[^}]*transform:\s*scale\(1\.3\);/su);
assert.match(stripComments(stickyCss), /\.control-group input\[type="range"\]\s*\{/u);

console.log(
    `Range contract passed: ${sharedOrdinary} shared ordinary + ${sharedHsb} shared HSB + ${privateRanges} private = 128 static; Sticky Fingers also owns dynamic custom-column ranges.`
);
