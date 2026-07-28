import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLayout } from '../app/kb/grid.js';
import { attachContent } from '../app/kb/legends.js';
import { generatedContentForLayout } from '../app/kb/content/generated-layouts.js';
import {
    analyzeSvgBlueprint,
    blueprintSummaryLines,
    diagnoseRecognizedKeys,
    extractSvgGroup,
    parseSvgAttributes,
    stripIllustratorPrivateData
} from '../app/kb/svg-blueprint.js';

const synthetic = `<?xml version="1.0"?>
<svg viewBox="0 0 40 30" xmlns="http://www.w3.org/2000/svg">
  <metadata><i:aipgfRef id="adobe_illustrator_pgf"/><i:aipgf>private</i:aipgf></metadata>
  <metadata><dc:title>Keep me</dc:title></metadata>
  <g id="blueprint">
    <g>
      <line x1="1" y1="2" x2="11" y2="2"/>
      <line x1="1" y1="2" x2="1" y2="11"/>
      <line x1="1" y1="2" x2="11" y2="12"/>
      <path d="M1 1L2 2"/>
    </g>
  </g>
  <g id="caps">
    <rect x="1" y="2" width="10" height="9" rx="1" ry="1"/>
    <rect x="13" y="2" width="10" height="9" rx="1" ry="1"/>
    <rect x="1" y="14" width="10" height="9" rx="1" ry="1"/>
    <line x1="0" y1="0" x2="100" y2="0"/>
  </g>
</svg>`;

const stripped = stripIllustratorPrivateData(synthetic);
assert.equal(stripped.removedBlocks.length, 1);
assert.match(stripped.svg, /Keep me/);
assert.doesNotMatch(stripped.svg, /private/);

const attrs = parseSvgAttributes(`<line data-x='1' x1=".5" y1="-2e-1" />`);
assert.deepEqual(attrs, { 'data-x': '1', x1: '.5', y1: '-2e-1' });

const blueprintGroup = extractSvgGroup(synthetic, 'blueprint');
assert.match(blueprintGroup, /<line/);
assert.doesNotMatch(blueprintGroup, /id="caps"/);

const syntheticAnalysis = analyzeSvgBlueprint(synthetic);
assert.equal(syntheticAnalysis.viewBox.w, 40);
assert.equal(syntheticAnalysis.groups.blueprint, true);
assert.equal(syntheticAnalysis.groups.caps, true);
assert.equal(syntheticAnalysis.elements.lines, 3);
assert.equal(syntheticAnalysis.elements.paths, 1);
assert.equal(syntheticAnalysis.lineBuckets.horizontal.length, 1);
assert.equal(syntheticAnalysis.lineBuckets.vertical.length, 1);
assert.equal(syntheticAnalysis.lineBuckets.diagonal.length, 1);
assert.deepEqual(syntheticAnalysis.calibration, {
    caps: 3,
    origin: { x: 1, y: 2 },
    cornerRadius: 1,
    keyWidth1U: 10,
    keyHeight: 9,
    colPitch: 12,
    rowPitch: 12,
    gap: 2
});
assert.equal(syntheticAnalysis.diagnostics.warnings.length, 1);
assert.equal(syntheticAnalysis.diagnostics.warnings[0].code, 'no-keys');
assert.equal(blueprintSummaryLines(syntheticAnalysis).length, 6);

const badDiagnostics = diagnoseRecognizedKeys({
    groups: { blueprint: true, caps: true },
    elements: { lines: 8 },
    calibration: syntheticAnalysis.calibration,
    caps: [],
    recognized: {
        raw: [],
        keys: [
            { i: 0, x: 1, y: 2, w: 10, h: 9, rowSpan: 1 },
            { i: 1, x: 1.5, y: 2.5, w: 10, h: 9, rowSpan: 1 }
        ]
    }
});
assert.equal(badDiagnostics.ok, false);
assert.equal(badDiagnostics.warnings.filter((issue) => issue.code === 'overlap').length, 2);
assert.deepEqual(badDiagnostics.suspiciousKeyIndices, [0, 1]);

const real = analyzeSvgBlueprint(readFileSync('LCAKB23.svg', 'utf8'));
assert.equal(real.groups.blueprint, true);
assert.equal(real.groups.caps, true);
assert.equal(real.lineBuckets.horizontal.length, 1658);
assert.equal(real.lineBuckets.vertical.length, 1388);
assert.equal(real.lineBuckets.diagonal.length, 884);
assert.equal(real.elements.lines, 3930);
assert.equal(real.elements.paths, 866);
assert.equal(real.calibration.caps, 110);
assert.equal(real.calibration.keyWidth1U, 46.4941);
assert.equal(real.calibration.keyHeight, 46.1885);
assert.equal(real.calibration.colPitch, 53.861);
assert.equal(real.calibration.rowPitch, 53.5121);
assert.equal(real.recognized.cornerOffset, 3.3779);
assert.equal(real.recognized.raw.length, 220);
assert.equal(real.recognized.keys.length, 110);
assert.equal(real.diagnostics.ok, true);
assert.equal(real.diagnostics.suspiciousKeys, 0);
assert.equal(real.diagnostics.warnings.length, 0);
assert.equal(real.diagnostics.notices.length, 4);
assert.equal(real.layoutDraft.schema, 'keyboarder.layoutDraft.v1');
assert.equal(real.layoutDraft.stats.blocks, 3);
assert.equal(real.layoutDraft.stats.rows, 6);
assert.equal(real.layoutDraft.stats.keys, 110);
assert.equal(real.layoutDraft.stats.rowSpans, 2);
assert.equal(real.layoutDraft.layout.rows.flatMap((row) => Object.values(row)).flat().length, 32);
assert.equal(real.layoutDraft.layout.rows.flatMap((row) => Object.values(row)).flat().filter((item) => item.repeat).length, 16);
assert.equal(real.layoutDraft.layout.rows.flatMap((row) => Object.values(row)).flat().filter((item) => item.id).length, 0);

const builtDraft = buildLayout(real.layoutDraft.layout);
assert.equal(builtDraft.keys.length, 110);
let worstDraftDelta = 0;
for (let i = 0; i < real.recognized.keys.length; i++) {
    const key = real.recognized.keys[i];
    const built = builtDraft.keys[i];
    for (const [a, b] of [['x', 'x'], ['y', 'y'], ['w', 'w'], ['h', 'h']]) {
        worstDraftDelta = Math.max(worstDraftDelta, Math.abs(key[a] - built[b]));
    }
}
assert.ok(worstDraftDelta < 0.03, `draft layout drifted by ${worstDraftDelta}px`);

const draftContent = generatedContentForLayout(real.layoutDraft.layout, { secondarySize: 12 }, { interline: 13.5 });
assert.equal(draftContent.keys[0].elements[0].text, 'main 1');
const contentResult = attachContent(builtDraft.keys, draftContent);
assert.equal(contentResult.matched, 110);
assert.equal(contentResult.orphans, 0);
assert.deepEqual(
    real.recognized.keys.reduce((acc, key) => {
        acc[key.rowSpan] = (acc[key.rowSpan] || 0) + 1;
        return acc;
    }, {}),
    { 1: 108, 2: 2 }
);

const caps = [...real.caps].sort((a, b) => a.y - b.y || a.x - b.x);
let worstCapDelta = 0;
for (let i = 0; i < real.recognized.keys.length; i++) {
    const key = real.recognized.keys[i];
    const cap = caps[i];
    for (const prop of ['x', 'y', 'w', 'h']) {
        worstCapDelta = Math.max(worstCapDelta, Math.abs(key[prop] - cap[prop]));
    }
}
assert.ok(worstCapDelta < 0.03, `recognized caps drifted by ${worstCapDelta}px`);

console.log('blueprint import passed');
