import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFont } from '../app/kb/typography.js';
import {
    autoCompensationParams,
    probeTypeface,
    runCompensationInvariants
} from '../app/kb/fontprobe.js';
import { YS_TEXT_REGULAR } from '../app/kb/compensate.js';

function loadTypeface(path) {
    const buf = readFileSync(new URL(path, import.meta.url));
    return parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

const regular = loadTypeface('../Fonts/YS Text/YS Text-Regular.ttf');
const regularProbe = probeTypeface(regular);
const regularParams = autoCompensationParams(regular, regularProbe);
const regularInvariants = runCompensationInvariants(regular, regularParams);

assert.equal(regularProbe.id, 'YS Text Regular');
assert.equal(regularProbe.metrics.unitsPerEm.value, 1000);
assert.deepEqual(regularProbe.metrics.capHeight, { value: 717, source: 'glyph:H' });
assert.deepEqual(regularProbe.metrics.xHeight, { value: 519, source: 'glyph:x' });
assert.equal(regularProbe.stems.vertical.value, 94);
assert.equal(regularProbe.stems.vertical.source, 'glyph:I');
assert.equal(regularProbe.variations.axes.length, 0);
assert.equal(regularParams.eps, YS_TEXT_REGULAR.eps);
assert.equal(regularParams.w, YS_TEXT_REGULAR.w);
assert.deepEqual(regularParams.coef, YS_TEXT_REGULAR.coef);
assert.equal(regularParams.calibration.stemScale, 1);
assert.equal(regularParams.calibration.sidebearingScale, 1);
assert.ok(Object.keys(regularParams.table).length > 0, 'auto punctuation table should not be empty');
assert.equal(regularInvariants.pass, true);
assert.equal(regularInvariants.flatStem.sigmaPx, 0);
assert.equal(regularInvariants.monotonic.bySide.L.values.map((v) => v.ch).join(''), 'HSOAW');

const variable = loadTypeface('../Fonts/YS Text Variable/YSText-Upright-weight-VF.ttf');
const variableProbe = probeTypeface(variable);
const variableParams = autoCompensationParams(variable, variableProbe);
const variableInvariants = runCompensationInvariants(variable, variableParams);
assert.equal(variableProbe.names.family, 'YS Text');
assert.equal(variableProbe.names.subfamily, 'Regular');
assert.equal(variableProbe.names.postScriptName, 'YSText-Regular');
variable.setVariations({ wght: 100, wdth: 100 });
const variableLightH = {
    advance: variable.advance('H'),
    path: variable.pathData('H', 72, 0, [0, 72])
};
variable.setVariations({ wght: 900, wdth: 100 });
const variableBlackH = {
    advance: variable.advance('H'),
    path: variable.pathData('H', 72, 0, [0, 72])
};
const cyrillicCompositePairs = [
    ['К', 'K'],
    ['Е', 'E'],
    ['Н', 'H'],
    ['Х', 'X'],
    ['В', 'B'],
    ['А', 'A'],
    ['Р', 'P'],
    ['О', 'O'],
    ['С', 'C'],
    ['М', 'M'],
    ['Т', 'T']
];
const variableBlackCompositePaths = cyrillicCompositePairs.map(([cyrillic, latin]) => ({
    cyrillic,
    latin,
    samePath: variable.pathData(cyrillic, 72, 0, [0, 72]) === variable.pathData(latin, 72, 0, [0, 72]),
    box: variable.box(cyrillic)
}));
variable.setVariations({ wght: 400, wdth: 100 });

assert.equal(variableProbe.variations.axes.length, 2);
assert.deepEqual(variableProbe.variations.axes.map((axis) => axis.tag), ['wght', 'wdth']);
assert.deepEqual(variableProbe.variations.axes.map((axis) => axis.default), [400, 100]);
assert.ok(variableProbe.variations.instances.length >= 1, 'variable font should expose named instances');
assert.notEqual(variableLightH.path, variableBlackH.path, 'wght axis should change outline path data');
assert.ok(variableBlackH.advance > variableLightH.advance, 'wght axis should update advance width');
assert.ok(variableBlackCompositePaths.every((sample) => sample.samePath), 'Cyrillic composite outlines should follow their Latin base glyphs');
assert.ok(variableBlackCompositePaths.every((sample) => sample.box?.[3] < 820), 'Cyrillic composite outlines should not spike outside the cap zone');
assert.equal(variableParams.eps, YS_TEXT_REGULAR.eps);
assert.equal(variableInvariants.pass, true);

const weightSamples = [
    ['light', '../Fonts/YS Text/YS Text-Light.ttf'],
    ['regular', '../Fonts/YS Text/YS Text-Regular.ttf'],
    ['bold', '../Fonts/YS Text/YS Text-Bold.ttf'],
    ['heavy', '../Fonts/YS Text/YS Text-Heavy.ttf'],
    ['black', '../Fonts/YS Text/YS Text-Black.ttf']
].map(([id, path]) => {
    const tf = loadTypeface(path);
    const probe = probeTypeface(tf);
    const params = autoCompensationParams(tf, probe);
    const invariants = runCompensationInvariants(tf, params);
    return { id, probe, params, invariants };
});

for (const sample of weightSamples) {
    assert.ok(sample.probe.id.startsWith('YS Text '), `${sample.id} should expose a readable family name`);
    assert.ok(sample.probe.stems.vertical.value > 0, `${sample.id} should expose a measured stem`);
    assert.ok(sample.params.eps > 0, `${sample.id} should produce positive eps`);
    assert.ok(sample.params.w > 0, `${sample.id} should produce positive w`);
    assert.ok(sample.invariants.flatStem.pass, `${sample.id} should keep flat stems stable`);
}

const epsByWeight = weightSamples.map((sample) => sample.params.eps);
for (let i = 1; i < epsByWeight.length; i++) {
    assert.ok(epsByWeight[i] > epsByWeight[i - 1], 'eps should grow monotonically with YS Text weight');
}
assert.ok(weightSamples.some((sample) => !sample.invariants.pass), 'diagnostic checks should be allowed to flag heavy weights');

console.log('font probe passed');
