import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { buildLayout } from '../app/kb/grid.js';
import { attachContent } from '../app/kb/legends.js';
import { analyzeSvgBlueprint, blueprintSummaryLines } from '../app/kb/svg-blueprint.js';
import { generatedContentForLayout, generatedContentStatsForLayout } from '../app/kb/content/generated-layouts.js';

const TYPE_DEFAULTS = {
    glyphSize: 15.1999,
    numpadSize: 13.1732,
    secondarySize: 12.0745,
    wordSize: 9.1199
};

const DEFAULT_FILES = [
    '/Users/mishaivanov/Desktop/keyboarder test/test_layout_S.svg',
    '/Users/mishaivanov/Desktop/keyboarder test/test_layout_M.svg',
    '/Users/mishaivanov/Desktop/test_layout_S.svg'
];

const files = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES)
    .filter((file, index, list) => file && list.indexOf(file) === index)
    .filter((file) => existsSync(file));

if (!files.length) {
    console.log('No real SVG import fixtures found. Pass explicit SVG paths to run manual QA.');
    process.exit(0);
}

for (const file of files) {
    const analysis = analyzeSvgBlueprint(readFileSync(file, 'utf8'));
    const draft = analysis.layoutDraft;
    assert.ok(draft?.layout, `${file}: layout draft should exist`);

    const contentStats = generatedContentStatsForLayout(draft.layout);
    draft.stats.content = contentStats;
    const built = buildLayout(draft.layout);
    const content = generatedContentForLayout(draft.layout, TYPE_DEFAULTS, { interline: 13.5279 });
    const attached = attachContent(built.keys, content);
    const labels = content.keys.map((key) => key.elements.map((element) => element.text || element.icon).join('/'));
    const placeholders = labels.filter((label) => /^main \d+(?:\.\d+)?$|^nav \d+(?:\.\d+)?$/.test(label));
    const contentBySemanticId = contentByLayoutSemanticId(draft.layout, content);

    assert.equal(analysis.diagnostics.warnings.length, 0, `${file}: warnings`);
    assert.equal(draft.stats.semanticKeys, draft.stats.keys, `${file}: semantic coverage`);
    assert.equal(contentStats.alphaDualKeys, 26, `${file}: alpha-dual count`);
    assert.equal(contentStats.punctuationDualKeys, 8, `${file}: punctuation-dual count`);
    assert.equal(contentStats.fIconKeys, 13, `${file}: f-icons count`);
    assert.equal(contentStats.placeholderKeys, 0, `${file}: placeholder count`);
    assert.equal(placeholders.length, 0, `${file}: placeholder labels`);
    assert.equal(attached.matched, built.keys.length, `${file}: content attach coverage`);
    assert.equal(attached.orphans, 0, `${file}: content orphans`);
    assertServiceKey(contentBySemanticId, 'esc', 'BL', 'esc', TYPE_DEFAULTS.secondarySize, file);
    assertServiceKey(contentBySemanticId, 'tab', 'BL', 'tab', TYPE_DEFAULTS.secondarySize, file);
    assertServiceKey(contentBySemanticId, 'caps', 'BL', 'caps lock', TYPE_DEFAULTS.secondarySize, file);
    assertServiceKey(contentBySemanticId, 'backspace', 'BR', 'backspace', TYPE_DEFAULTS.secondarySize, file);
    assertServiceKey(contentBySemanticId, 'enter', 'BR', 'enter', TYPE_DEFAULTS.secondarySize, file);
    assertServiceKey(contentBySemanticId, 'lshift', 'BL', 'shift', TYPE_DEFAULTS.secondarySize, file);
    assertServiceKey(contentBySemanticId, 'rshift', 'BR', 'shift', TYPE_DEFAULTS.secondarySize, file);
    assertServiceKey(contentBySemanticId, 'lctrl', 'BL', 'ctrl', TYPE_DEFAULTS.secondarySize, file);
    if (draft.stats.layoutProfile === 'ANSI_NAV_89') assertServiceKey(contentBySemanticId, 'rctrl', 'BR', 'ctrl', TYPE_DEFAULTS.secondarySize, file);
    assert.equal(contentBySemanticId.get('space')?.tpl, 'blank', `${file}: space blank`);
    assert.equal((contentBySemanticId.get('space')?.elements || []).length, 0, `${file}: space has no legend`);
    assertArrowIcon(contentBySemanticId, 'left', 'arrow-left', file);
    assertArrowIcon(contentBySemanticId, 'up', 'arrow-up', file);
    assertArrowIcon(contentBySemanticId, 'down', 'arrow-down', file);
    assertArrowIcon(contentBySemanticId, 'right', 'arrow-right', file);

    if (draft.stats.keys === 78) {
        assert.equal(draft.stats.layoutProfile, 'ANSI_COMPACT_78', `${file}: compact profile`);
        assert.equal(draft.stats.blocks, 1, `${file}: compact block count`);
        assert.equal(draft.stats.stacks, 1, `${file}: compact split-arrow stack`);
    } else if (draft.stats.keys === 89) {
        assert.equal(draft.stats.layoutProfile, 'ANSI_NAV_89', `${file}: nav profile`);
        assert.equal(draft.stats.blocks, 2, `${file}: nav block count`);
    } else {
        throw new Error(`${file}: unexpected key count ${draft.stats.keys}`);
    }

    console.log(`\n${basename(file)}`);
    console.log(blueprintSummaryLines(analysis).join('\n'));
    console.log(`Timing: analyze ${analysis.timings.totalMs} ms, detect ${analysis.timings.detectMs} ms, lines ${analysis.timings.parseLinesMs} ms`);
    console.log(`Attach: matched ${attached.matched}/${built.keys.length}, orphans ${attached.orphans}`);
    console.log(`First row: ${labels.slice(0, 17).join(' | ')}`);
}

console.log('\nreal SVG import QA passed');

function assertServiceKey(contentBySemanticId, id, slot, text, size, file) {
    const key = contentBySemanticId.get(id);
    const el = key?.elements?.[0];
    assert.ok(key, `${file}: ${id} generated content`);
    assert.equal(key.tpl, slot === 'BC' ? 'word-center' : 'word-outer', `${file}: ${id} template`);
    assert.equal(el?.slot, slot, `${file}: ${id} slot`);
    assert.equal(el?.text, text, `${file}: ${id} text`);
    assert.equal(el?.size, size, `${file}: ${id} size`);
}

function assertArrowIcon(contentBySemanticId, id, icon, file) {
    const key = contentBySemanticId.get(id);
    const el = key?.elements?.[0];
    assert.ok(key, `${file}: ${id} generated content`);
    assert.equal(key.tpl, 'icon-center', `${file}: ${id} template`);
    assert.equal(el?.slot, 'MC', `${file}: ${id} slot`);
    assert.equal(el?.icon, icon, `${file}: ${id} icon`);
    assert.equal(el?.group, 'icons', `${file}: ${id} icon group`);
}

function contentByLayoutSemanticId(layout, content) {
    const out = new Map();
    let contentIndex = 0;
    for (const row of layout.rows || []) {
        for (const items of Object.values(row || {})) {
            for (const item of expandedItems(items)) {
                if (item.skip) continue;
                if (Array.isArray(item.stack) && item.stack.length) {
                    for (const child of item.stack) {
                        if (child.id) out.set(child.id, content.keys[contentIndex]);
                        contentIndex += 1;
                    }
                    continue;
                }
                if (item.id) out.set(item.id, content.keys[contentIndex]);
                contentIndex += 1;
            }
        }
    }
    return out;
}

function expandedItems(items = []) {
    const out = [];
    for (const item of items || []) {
        const n = item.repeat || 1;
        const ids = Array.isArray(item.ids) ? item.ids : null;
        for (let i = 0; i < n; i++) {
            const copy = { ...item };
            delete copy.repeat;
            delete copy.ids;
            if (n > 1) {
                if (ids && ids[i]) copy.id = ids[i];
                else delete copy.id;
            }
            out.push(copy);
        }
    }
    return out;
}
