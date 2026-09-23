import assert from 'node:assert/strict';
import { normalizeSvgGeometry, parseSvgPathSegments, parseSvgTransform } from '../app/kb/svg-geometry.js';

const rectPath = parseSvgPathSegments('M1 2h10v8H1z');
assert.equal(rectPath.length, 4);
assert.deepEqual(rectPath.map(({ x1, y1, x2, y2 }) => [x1, y1, x2, y2]), [
    [1, 2, 11, 2],
    [11, 2, 11, 10],
    [11, 10, 1, 10],
    [1, 10, 1, 2]
]);

const repeatedMove = parseSvgPathSegments('m2 3 4 0 0 5');
assert.deepEqual(repeatedMove.map(({ x1, y1, x2, y2 }) => [x1, y1, x2, y2]), [
    [2, 3, 6, 3],
    [6, 3, 6, 8]
]);

const curve = parseSvgPathSegments('M0 0C0 10 10 10 10 0S20 -10 20 0Q25 5 30 0T40 0A5 5 0 0 1 45 5', { curveSteps: 8 });
assert.ok(curve.length >= 30);
assert.deepEqual([curve.at(-1).x2, curve.at(-1).y2].map((value) => Math.round(value * 1000) / 1000), [45, 5]);

assert.deepEqual(parseSvgTransform('translate(10 20) scale(2)'), [2, 0, 0, 2, 10, 20]);

const normalized = normalizeSvgGeometry(`
<g transform="translate(10 20)">
  <line x1="0" y1="0" x2="5" y2="0"/>
  <polyline points="0,1 5,1 5,6"/>
  <polygon points="0,7 5,7 5,12"/>
  <rect x="1" y="13" width="4" height="3"/>
  <path d="M0 17h5v2"/>
</g>`);
assert.equal(normalized.unsupported.length, 0);
assert.equal(normalized.stats.elements, 5);
assert.equal(normalized.stats.transforms, 1);
assert.ok(normalized.segments.length >= 12);
assert.deepEqual(
    [normalized.segments[0].x1, normalized.segments[0].y1, normalized.segments[0].x2, normalized.segments[0].y2],
    [10, 20, 15, 20]
);

console.log(JSON.stringify({
    pathCommands: rectPath.length,
    curveSegments: curve.length,
    normalizedSegments: normalized.segments.length,
    transforms: normalized.stats.transforms
}, null, 2));
