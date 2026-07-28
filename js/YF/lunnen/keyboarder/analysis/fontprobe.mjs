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

assert.equal(variableProbe.variations.axes.length, 2);
assert.deepEqual(variableProbe.variations.axes.map((axis) => axis.tag), ['wght', 'wdth']);
assert.deepEqual(variableProbe.variations.axes.map((axis) => axis.default), [400, 100]);
assert.ok(variableProbe.variations.instances.length >= 1, 'variable font should expose named instances');
assert.equal(variableParams.eps, YS_TEXT_REGULAR.eps);
assert.equal(variableInvariants.pass, true);

console.log('font probe passed');
