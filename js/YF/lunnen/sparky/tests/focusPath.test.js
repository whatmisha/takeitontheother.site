import test from 'node:test';
import assert from 'node:assert/strict';
import {
    generateFocusPath,
    pathIsInsideRegion,
    tangentContinuityAtAnchor
} from '../src/animation/focusPath.js';

const options = {
    start: { x: 240, y: 240 },
    center: { x: 240, y: 240 },
    radius: 195.233,
    pointCount: 9,
    complexity: 'medium',
    seed: 123456
};

test('focus path is deterministic and closed', () => {
    const first = generateFocusPath(options);
    const second = generateFocusPath(options);
    assert.equal(first.path, second.path);
    assert.deepEqual(first.anchors, second.anchors);
    assert.equal(first.anchors.length, 9);
    assert.deepEqual(first.segments.at(-1).end, first.anchors[0]);
});

test('focus path preserves the requested start point', () => {
    const start = { x: 180, y: 120 };
    const path = generateFocusPath({ ...options, start });
    assert.deepEqual(path.anchors[0], start);
});

test('focus path and its control points remain inside the focus region', () => {
    ['soft', 'medium', 'hard'].forEach((complexity) => {
        for (let seed = 1; seed <= 30; seed += 1) {
            const path = generateFocusPath({
                ...options,
                start: seed % 2 ? { x: 240, y: 45 } : { x: 420, y: 240 },
                complexity,
                seed
            });
            assert.equal(pathIsInsideRegion(path, 1e-5), true, `${complexity} seed ${seed}`);
        }
    });
});

test('focus path has a continuous tangent at every anchor including the seam', () => {
    const path = generateFocusPath({ ...options, complexity: 'hard', pointCount: 12 });
    path.anchors.forEach((_, index) => {
        const continuity = tangentContinuityAtAnchor(path, index);
        assert.ok(Math.abs(continuity.cross) < 1e-6, `cross at ${index}`);
        assert.ok(continuity.dot > 0.999, `direction at ${index}`);
    });
});

test('point count and complexity independently affect the generated path', () => {
    const sixSoft = generateFocusPath({ ...options, pointCount: 6, complexity: 'soft' });
    const twelveSoft = generateFocusPath({ ...options, pointCount: 12, complexity: 'soft' });
    const sixHard = generateFocusPath({ ...options, pointCount: 6, complexity: 'hard' });
    assert.equal(sixSoft.anchors.length, 6);
    assert.equal(twelveSoft.anchors.length, 12);
    assert.notEqual(sixSoft.path, sixHard.path);
});

test('numeric complexity interpolates continuously between legacy profiles', () => {
    const soft = generateFocusPath({ ...options, complexity: 0 });
    const quarter = generateFocusPath({ ...options, complexity: 25 });
    const medium = generateFocusPath({ ...options, complexity: 50 });
    assert.equal(soft.path, generateFocusPath({ ...options, complexity: 'soft' }).path);
    assert.equal(medium.path, generateFocusPath({ ...options, complexity: 'medium' }).path);
    assert.notEqual(quarter.path, soft.path);
    assert.notEqual(quarter.path, medium.path);
});
