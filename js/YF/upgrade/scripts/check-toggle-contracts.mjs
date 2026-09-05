import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const stripComments = source => source.replace(/\/\*[\s\S]*?\*\//gu, '');

const inputTags = source => source.match(/<input\b[^>]*>/gu) || [];
const countType = (source, type) => inputTags(source)
    .filter(tag => new RegExp(`\\btype=["']${type}["']`, 'u').test(tag))
    .length;
const openingAncestorTag = (source, inputIndex, tagName) => {
    const openingIndex = source.lastIndexOf(`<${tagName}`, inputIndex);
    const closingIndex = source.lastIndexOf(`</${tagName}>`, inputIndex);
    if (openingIndex < 0 || openingIndex < closingIndex) return '';
    const endIndex = source.indexOf('>', openingIndex);
    return endIndex < 0 ? '' : source.slice(openingIndex, endIndex + 1);
};
const tagHasClass = (tag, className) => {
    const classMatch = tag.match(/\bclass=["']([^"']*)["']/u);
    return Boolean(classMatch?.[1].split(/\s+/u).includes(className));
};
const countInputsInLabelClass = (source, className, type = null) => {
    return [...source.matchAll(/<input\b[^>]*>/gu)].filter(match => {
        if (type && !new RegExp(`\\btype=["']${type}["']`, 'u').test(match[0])) return false;
        return tagHasClass(openingAncestorTag(source, match.index, 'label'), className);
    }).length;
};
const countInputsInDivClass = (source, className, type) => {
    return [...source.matchAll(/<input\b[^>]*>/gu)].filter(match => {
        if (!new RegExp(`\\btype=["']${type}["']`, 'u').test(match[0])) return false;
        return tagHasClass(openingAncestorTag(source, match.index, 'div'), className);
    }).length;
};
const countInputsInContainerClass = (source, className, type) => {
    return [...source.matchAll(/<input\b[^>]*>/gu)].filter(match => {
        if (!new RegExp(`\\btype=["']${type}["']`, 'u').test(match[0])) return false;
        return ['div', 'fieldset'].some(tagName =>
            tagHasClass(openingAncestorTag(source, match.index, tagName), className));
    }).length;
};

const [
    sparkyHtml,
    pizzaWorkspace,
    pizzaActions,
    pizzaObjects,
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
    read('grid_generator/src/ui/fragments/actions.html'),
    read('grid_generator/src/ui/fragments/objects.html'),
    read('grid_generator/src/ui/fragments/typography.html'),
    read('grid_generator/src/ui/fragments/object-editors.html'),
    read('label_generator/index.html'),
    read('keyboarder/index.html'),
    read('wordplayer/index.html'),
    read('pulsar_coder/index.html'),
    read('dither/index.html'),
    read('wander_bender/index.html')
]);

const pizzaHtml = [
    pizzaWorkspace,
    pizzaActions,
    pizzaObjects,
    pizzaTypography,
    pizzaEditors
].join('\n');

const [pizzaSurfaceController, wanderScript] = await Promise.all([
    read('grid_generator/src/surfaces/SurfacePanelController.js'),
    read('wander_bender/js/wander-bender.js')
]);

const apps = [
    ['Sparky', sparkyHtml, 5, 3],
    ['Pizza Boxer', pizzaHtml, 21, 15],
    ['Sticky Fingers', stickyHtml, 22, 6],
    ['Keyboarder', keyboarderHtml, 12, 0],
    ['Wordplayer', wordplayerHtml, 11, 2],
    ['Pulsar Coder', pulsarHtml, 1, 3],
    ['Dither', ditherHtml, 3, 7],
    ['Wander Bender', wanderHtml, 0, 3]
];

assert.deepEqual(
    apps.map(([app, html]) => [app, countType(html, 'checkbox'), countType(html, 'radio')]),
    apps.map(([app, , checkbox, radio]) => [app, checkbox, radio]),
    'native toggle/radio inventory changed'
);

const checkboxCount = apps.reduce((total, [, html]) => total + countType(html, 'checkbox'), 0);
const radioCount = apps.reduce((total, [, html]) => total + countType(html, 'radio'), 0);
assert.equal(checkboxCount, 75);
assert.equal(radioCount, 39);
assert.equal(checkboxCount + radioCount, 114);

const families = {
    pillCheckbox: [sparkyHtml, pizzaHtml, stickyHtml, keyboarderHtml, wordplayerHtml]
        .reduce((total, html) => total + countInputsInLabelClass(html, 'pill-toggle', 'checkbox'), 0),
    pillRadio: countInputsInLabelClass(sparkyHtml, 'pill-toggle', 'radio'),
    chipCheckbox: [pizzaHtml, stickyHtml]
        .reduce((total, html) => total + countInputsInLabelClass(html, 'toggle-chip', 'checkbox'), 0),
    chipRadio: countInputsInLabelClass(pizzaHtml, 'toggle-chip', 'radio'),
    checkboxLabel: [pizzaHtml, stickyHtml, pulsarHtml, ditherHtml]
        .reduce((total, html) => total + countInputsInLabelClass(html, 'checkbox-label', 'checkbox'), 0),
    toggleSwitch: [pizzaHtml, stickyHtml, keyboarderHtml, wordplayerHtml, ditherHtml]
        .reduce((total, html) => total + countInputsInLabelClass(html, 'toggle-label', 'checkbox'), 0),
    segmentedRadio: [sparkyHtml, pizzaHtml, stickyHtml, pulsarHtml, ditherHtml, wanderHtml]
        .reduce((total, html) => total + countInputsInContainerClass(html, 'segmented-control', 'radio'), 0),
    wordplayerModeRadio: countInputsInDivClass(wordplayerHtml, 'mode-nav-options', 'radio'),
    ditherExportCheckbox: countInputsInLabelClass(ditherHtml, 'export-transparency-label', 'checkbox')
};

assert.deepEqual(families, {
    pillCheckbox: 36,
    pillRadio: 0,
    chipCheckbox: 12,
    chipRadio: 0,
    checkboxLabel: 20,
    toggleSwitch: 7,
    segmentedRadio: 37,
    wordplayerModeRadio: 2,
    ditherExportCheckbox: 0
}, 'toggle presentation family ownership changed');

assert.equal(
    [pizzaEditors, stickyHtml]
        .reduce((total, html) => total + countInputsInLabelClass(html, 'feature-chip', 'checkbox'), 0),
    12,
    'Pizza Boxer and Sticky Fingers must share 12 OpenType feature chips'
);
for (const html of [pizzaEditors, stickyHtml]) {
    assert.match(html, /class=["']control-label opentype-features-label["']>OpenType</u);
}

assert.equal(
    families.pillCheckbox + families.chipCheckbox + families.checkboxLabel
        + families.toggleSwitch + families.ditherExportCheckbox,
    checkboxCount
);
assert.equal(
    families.pillRadio + families.chipRadio + families.segmentedRadio
        + families.wordplayerModeRadio,
    radioCount
);

const keyboarderSegment = keyboarderHtml.match(
    /<div\b[^>]*\bid=["']compModeGroup["'][^>]*>[\s\S]*?<\/div>/u
)?.[0] || '';
assert.equal(keyboarderSegment.match(/<button\b/gu)?.length || 0, 3);
assert.equal(keyboarderSegment.match(/\baria-pressed=/gu)?.length || 0, 3);
assert.match(sparkyHtml, /id=["']motionEditPathBtn["'][^>]*\baria-pressed=["']false["']/u);

const privateStateButtonCount = [
    [sparkyHtml, /\bid=["']motionEditPathBtn["']/gu],
    [pizzaHtml, /\bid=["']surfaceLock(?:Module|Margins)Btn["']/gu],
    [keyboarderSegment, /<button\b/gu],
    [wanderHtml, /\bid=["'](?:strokeAutoBtn|cornerRadiusMaxBtn)["']/gu]
].reduce((total, [source, pattern]) => total + (source.match(pattern)?.length || 0), 0);
assert.equal(privateStateButtonCount, 8, 'private state-button inventory changed');
assert.match(
    pizzaSurfaceController,
    /surfaceLockModuleBtn\?\.setAttribute\('aria-pressed',[\s\S]*?surfaceLockMarginsBtn\?\.setAttribute\('aria-pressed'/u
);
assert.match(wanderScript, /strokeAutoBtn\.classList\.toggle\('active'\)[\s\S]*?strokeAutoBtn\.setAttribute\('aria-pressed', String\(isActive\)\)/u);
assert.match(wanderScript, /cornerRadiusMaxBtn\.classList\.toggle\('active'\)[\s\S]*?cornerRadiusMaxBtn\.setAttribute\('aria-pressed', String\(isActive\)\)/u);
assert.match(
    wanderHtml,
    /id=["']strokeAutoBtn["'][^>]*\baria-pressed=["']false["'][\s\S]*?id=["']cornerRadiusMaxBtn["'][^>]*\baria-pressed=["']false["']/u,
    'Wander Auto/Max must expose synchronized pressed state'
);

const [
    sharedCss,
    uiContractCss,
    sparkyCss,
    keyboarderCss,
    wordplayerCss,
    pizzaPanelCss,
    pizzaEditorCss,
    pizzaActionCss,
    pizzaSideCss,
    pizzaBridgeCss,
    stickyCss,
    stickyBridgeCss,
    pulsarCss,
    pulsarExtensionCss,
    ditherCss,
    ditherBridgeCss,
    wanderCss,
    wanderExtensionCss
] = await Promise.all([
    read('framework/css/othersite-styles.css'),
    read('framework/css/ui-contract.css'),
    read('sparky/styles/sparky.css'),
    read('keyboarder/app/theme.css'),
    read('wordplayer/styles.css'),
    read('grid_generator/styles/layout-panels.css'),
    read('grid_generator/styles/editors.css'),
    read('grid_generator/styles/actions-modal.css'),
    read('grid_generator/styles/sides.css'),
    read('grid_generator/framework-base.css'),
    read('label_generator/style.css'),
    read('label_generator/framework-base.css'),
    read('pulsar_coder/css/yf-styles.css'),
    read('pulsar_coder/pulsar-styles.css'),
    read('dither/style.css'),
    read('dither/framework-base.css'),
    read('wander_bender/css/yf-styles.css'),
    read('wander_bender/css/wander-bender.css')
]);

const activeShared = stripComments(sharedCss);
const activeUiContract = stripComments(uiContractCss);
assert.match(activeShared, /\.pill-toggle\s*\{/u);
assert.match(activeShared, /\.toggle-chip\s*\{/u);
assert.match(activeShared, /\.toggle-switch\s*\{/u);
assert.match(activeShared, /\.segmented-control\s*\{/u);
assert.match(activeShared, /\.checkbox-label\s*\{[^}]*display:\s*flex !important;/su);
assert.match(
    activeShared,
    /\.segmented-control label\s*\{[^}]*font-size:\s*var\(--segmented-control-font-size, 0\.9rem\);/su
);
assert.match(
    activeUiContract,
    /\.controls-panel \.feature-chip > span\s*\{[^}]*min-height:\s*24px;[^}]*padding:\s*4px 10px !important;[^}]*font-size:\s*0\.8rem !important;[^}]*font-weight:\s*500 !important;/su,
    'shared OpenType feature-chip metrics changed'
);
assert.match(
    activeUiContract,
    /\.controls-panel \.feature-chip input:checked \+ span\s*\{[^}]*background:\s*var\(--ui-foreground\) !important;[^}]*color:\s*#000 !important;/su,
    'shared OpenType checked state changed'
);

for (const [app, css] of [
    ['Sparky', sparkyCss],
    ['Keyboarder', keyboarderCss],
    ['Wordplayer', wordplayerCss]
]) {
    assert.doesNotMatch(
        stripComments(css),
        /(?:^|\})\s*\.pill-toggle\s*\{/u,
        `${app} duplicated shared pill base`
    );
    assert.doesNotMatch(
        stripComments(css),
        /(?:^|\})\s*\.toggle-switch\s*\{/u,
        `${app} duplicated shared switch base`
    );
}

assert.match(stripComments(keyboarderCss), /\.segmented-control\s*\{[^}]*display:\s*grid;/su);
assert.match(stripComments(wordplayerCss), /\.mode-nav-options input\[type="radio"\]/u);
assert.doesNotMatch(stripComments(ditherCss), /\.export-transparency-label/u);

for (const [app, css] of [
    ['Wander Bender', wanderCss]
]) {
    assert.match(stripComments(css), /\.(?:toggle-chip|checkbox-label|toggle-switch|segmented-control)\s*\{/u,
        `${app} legacy ownership changed before its rollout`);
}

for (const [family, css, selector] of [
    ['toggle-chip', pizzaPanelCss, /(?:^|\})\s*\.toggle-chip(?:\s|:|\{)/u],
    ['checkbox/segment', pizzaEditorCss, /(?:^|\})\s*\.(?:checkbox-label|segmented-control)(?:\s|:|\{)/u],
    ['toggle-switch', pizzaActionCss, /(?:^|\})\s*\.toggle-switch(?:\s|:|\{)/u]
]) {
    assert.doesNotMatch(stripComments(css), selector,
        `Pizza Boxer reintroduced a local ${family} base after rollout`);
}
assert.doesNotMatch(stripComments(pizzaBridgeCss), /all:\s*revert-layer/u,
    'Pizza Boxer must not restore reset-promotion blocks');
assert.match(
    stripComments(pizzaBridgeCss),
    /\.segmented-control\s*\{\s*--segmented-control-font-size:\s*0\.85rem;\s*\}/u,
    'Pizza Boxer legacy segmented font bridge changed'
);
assert.match(
    stripComments(pizzaBridgeCss),
    /\.control-group \.toggle-chip input\[type="checkbox"\]\s*\{\s*width:\s*0;\s*height:\s*0;\s*\}/u
);
assert.match(
    stripComments(pizzaBridgeCss),
    /\.control-group\.show-toggle-chip-group\s*\{\s*padding-top:\s*0;\s*margin-bottom:\s*var\(--spacing-md\);\s*\}/u
);
assert.match(
    stripComments(pizzaBridgeCss),
    /\.control-group \.segmented-control label\s*\{\s*margin-bottom:\s*0;\s*\}/u
);
assert.match(stripComments(pizzaSideCss), /\.surface-tabs\.segmented-control label\s*\{/u);
assert.match(stripComments(pizzaSideCss), /\.surface-visible-chip,\s*\.surface-own-grid-chip\s*\{/u);
assert.doesNotMatch(pizzaWorkspace, /toggle-chip-icon-wrapper/u, 'Pizza Boxer must not restore eye icons');
assert.doesNotMatch(pizzaObjects, /toggle-chip-icon-wrapper/u, 'Pizza Boxer object visibility must use a plain pill');
assert.match(
    pizzaEditors,
    /class=["']segmented-control segmented-control-compact["'][^>]*>[\s\S]*?id=["']graphicsSizeModeWidth["'][\s\S]*?id=["']graphicsSizeModeHeight["']/u,
    'Pizza Boxer graphics size mode must use the shared segmented control'
);
assert.doesNotMatch(sparkyHtml, /\bid=["']showPoint["']/u, 'Sparky must not expose a redundant Manual pill');
assert.match(
    sparkyHtml,
    /type=["']checkbox["'][^>]*\bid=["']followCursor["']/u,
    'Sparky Follow cursor must be a single checkbox pill'
);

for (const [family, selector] of [
    ['toggle-chip', /(?:^|\})\s*\.toggle-chip(?:\s|:|\{)/u],
    ['checkbox/segment', /(?:^|\})\s*\.(?:checkbox-label|segmented-control)(?:\s|:|\{)/u],
    ['toggle-switch', /(?:^|\})\s*\.toggle-switch(?:\s|:|\{)/u]
]) {
    assert.doesNotMatch(stripComments(stickyCss), selector,
        `Sticky Fingers reintroduced a local ${family} base after rollout`);
}
assert.doesNotMatch(stripComments(stickyBridgeCss), /all:\s*revert-layer/u,
    'Sticky Fingers must not restore reset-promotion blocks');
assert.doesNotMatch(
    stripComments(stickyBridgeCss),
    /(?:^|\})\s*\.toggle-chip span\s*\{/u,
    'Sticky Fingers must consume shared OpenType feature-chip metrics'
);
assert.match(
    stripComments(stickyBridgeCss),
    /\.segmented-control\s*\{\s*--segmented-control-font-size:\s*0\.85rem;\s*\}/u,
    'Sticky Fingers legacy segmented font bridge changed'
);
assert.match(
    stripComments(stickyBridgeCss),
    /\.control-group\.show-toggle-chip-group\s*\{\s*padding-top:\s*0;\s*margin-bottom:\s*var\(--spacing-md\);\s*\}/u
);
assert.match(
    stripComments(stickyBridgeCss),
    /\.control-group \.toggle-chip input\[type="checkbox"\]\s*\{\s*width:\s*0;\s*height:\s*0;\s*\}/u
);
assert.match(
    stripComments(stickyBridgeCss),
    /\.control-group \.segmented-control label\s*\{\s*margin-bottom:\s*0;\s*\}/u
);

assert.doesNotMatch(
    stripComments(ditherCss),
    /(?:^|\})\s*\.(?:checkbox-label|segmented-control)(?:\s|:|\{)/u,
    'Dither reintroduced a local checkbox/segmented base after rollout'
);
assert.doesNotMatch(stripComments(ditherBridgeCss), /all:\s*revert-layer/u,
    'Dither must not restore raster reset-promotion blocks');
assert.match(
    stripComments(ditherBridgeCss),
    /\.control-group \.segmented-control label\s*\{\s*margin-top:\s*1px;\s*margin-left:\s*1px;\s*margin-bottom:\s*var\(--spacing-xs\);\s*gap:\s*normal;\s*\}/u,
    'Dither private segment offsets changed'
);
assert.match(
    stripComments(ditherBridgeCss),
    /\.segmented-control\s*\{\s*--segmented-control-font-size:\s*0\.85rem;\s*\}/u,
    'Dither legacy segmented font bridge changed'
);
assert.doesNotMatch(stripComments(ditherCss), /\.toggle-switch\s*\{/u,
    'Dither must consume the shared export toggle presentation');

assert.doesNotMatch(
    stripComments(pulsarCss),
    /(?:^|\})\s*\.(?:checkbox-label|segmented-control)(?:\s|:|\{)/u,
    'Pulsar reintroduced a local checkbox/segmented base after canary promotion'
);
assert.doesNotMatch(stripComments(pulsarExtensionCss), /all:\s*revert-layer/u,
    'Pulsar must not restore reset-promotion blocks');
assert.match(
    stripComments(pulsarExtensionCss),
    /\.control-group \.segmented-control label\s*\{\s*margin-bottom:\s*0;\s*\}/u,
    'Pulsar compact segment metric changed'
);
assert.match(
    stripComments(pulsarExtensionCss),
    /\.segmented-control\s*\{\s*--segmented-control-font-size:\s*0\.85rem;\s*\}/u,
    'Pulsar legacy segmented font bridge changed'
);

assert.doesNotMatch(
    stripComments(wanderCss),
    /(?:^|\})\s*\.segmented-control(?:\s|:|\{)/u,
    'Wander reintroduced a local segmented-control base after rollout'
);
assert.doesNotMatch(stripComments(wanderExtensionCss), /all:\s*revert-layer/u,
    'Wander must not restore reset-promotion blocks');
assert.match(
    stripComments(wanderExtensionCss),
    /\.segmented-control\s*\{\s*--segmented-control-font-size:\s*0\.85rem;\s*\}/u,
    'Wander legacy segmented font bridge changed'
);

console.log(
    `Toggle contract passed: ${checkboxCount} checkbox + ${radioCount} radio = ${checkboxCount + radioCount} native; `
        + `${families.pillCheckbox + families.pillRadio} pill + `
        + `${families.chipCheckbox + families.chipRadio} chip + `
        + `${families.checkboxLabel} checkbox-label + ${families.toggleSwitch} switch + `
        + `${families.segmentedRadio} segment + ${families.wordplayerModeRadio} private inputs; `
        + `${privateStateButtonCount} private state buttons protected.`
);
