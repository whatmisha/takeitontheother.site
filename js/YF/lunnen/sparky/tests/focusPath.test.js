import test from 'node:test';
import assert from 'node:assert/strict';
import {
    generateFocusPath,
    generateFocusPathForSettings,
    normalizeMotionSmoothness,
    pathIsInsideRegion,
    sampleFocusPath,
    tangentContinuityAtAnchor
} from '../src/animation/focusPath.js';
import { focusPathEditorHandlePoints } from '../src/animation/focusPathEditor.js';

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

test('focus path remains inside the focus region', () => {
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

test('a start point on the boundary keeps two non-collapsed seam handles', () => {
    const start = {
        x: options.center.x + options.radius,
        y: options.center.y
    };
    const path = generateFocusPath({
        ...options,
        start,
        pointCount: 16,
        complexity: 100,
        smoothness: 50,
        seed: 9
    });
    const handles = focusPathEditorHandlePoints(path, 0);

    assert.deepEqual(path.anchors[0], start);
    assert.ok(distanceBetween(handles.incoming, start) >= 14);
    assert.ok(distanceBetween(handles.outgoing, start) >= 14);
    assert.equal(pathIsInsideRegion(path, 1e-5), true);
    const continuity = tangentContinuityAtAnchor(path, 0);
    assert.ok(Math.abs(continuity.cross) < 1e-6);
    assert.ok(continuity.dot > 0.999);
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

test('two points produce a finite closed loop instead of a line reversal', () => {
    const path = generateFocusPath({ ...options, pointCount: 2, complexity: 50 });
    const chord = {
        x: path.anchors[1].x - path.anchors[0].x,
        y: path.anchors[1].y - path.anchors[0].y
    };
    const chordLength = Math.hypot(chord.x, chord.y);

    assert.equal(path.anchors.length, 2);
    assert.equal(path.segments.length, 2);
    assert.ok(Number.isFinite(path.totalLength));
    assert.ok(path.totalLength > chordLength * 2);
    path.tangents.forEach((tangent) => {
        assert.ok(Math.abs(tangent.x * chord.x + tangent.y * chord.y) < 1e-5);
    });
    path.anchors.forEach((_, index) => {
        const continuity = tangentContinuityAtAnchor(path, index);
        assert.ok(Math.abs(continuity.cross) < 1e-6);
        assert.ok(continuity.dot > 0.999);
    });
    assert.equal(pathIsInsideRegion(path, 1e-5), true);
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

test('every complexity generates a path that visually touches the outer focus region', () => {
    [0, 50, 100].forEach((complexity) => {
        const path = generateFocusPath({ ...options, complexity });
        const outerAnchors = path.anchors.filter((anchor) => (
            Math.hypot(anchor.x - options.center.x, anchor.y - options.center.y)
                >= options.radius * 0.985
        ));
        assert.ok(
            outerAnchors.length >= 2,
            `complexity ${complexity} only generated ${outerAnchors.length} outer anchor(s)`
        );
    });
});

test('settings-based generation reaches the complete boundary circle', () => {
    const path = generateFocusPathForSettings({
        boundaryType: 'circle',
        boundaryCenterX: 240,
        boundaryCenterY: 240,
        boundaryRadius: 240,
        motionPointCount: 6,
        motionComplexity: 50,
        motionSmoothness: 100,
        motionSeed: 123456
    }, { x: 240, y: 240 });
    assert.equal(path.radius, 240);
    assert.ok(path.anchors.some((anchor) => (
        Math.hypot(anchor.x - path.center.x, anchor.y - path.center.y)
            >= path.radius - 1e-6
    )));
});

test('motion smoothness is normalized to an independent 0–100 range', () => {
    assert.equal(normalizeMotionSmoothness(-20), 0);
    assert.equal(normalizeMotionSmoothness(35), 35);
    assert.equal(normalizeMotionSmoothness(140), 100);
    assert.equal(normalizeMotionSmoothness('75'), 75);
});

test('zero smoothness preserves the legacy generated geometry', () => {
    const legacy = generateFocusPath(options);
    const explicitZero = generateFocusPath({ ...options, smoothness: 0 });
    assert.equal(explicitZero.path, legacy.path);
    assert.deepEqual(explicitZero.anchors, legacy.anchors);
});

test('smoothness enlarges a tight loop without changing its seed, start, or point count', () => {
    const fixture = {
        ...options,
        pointCount: 6,
        complexity: 100,
        seed: 66
    };
    const tight = generateFocusPath({ ...fixture, smoothness: 0 });
    const smooth = generateFocusPath({ ...fixture, smoothness: 100 });
    const minimumChord = (path) => Math.min(...path.anchors.map((anchor, index) => (
        distanceBetween(anchor, path.anchors[(index + 1) % path.anchors.length])
    )));

    assert.deepEqual(smooth.anchors[0], tight.anchors[0]);
    assert.equal(smooth.anchors.length, tight.anchors.length);
    assert.equal(smooth.seed, tight.seed);
    assert.ok(minimumChord(smooth) > minimumChord(tight) * 4);
    assert.notEqual(smooth.path, tight.path);
});

test('maximum smoothness reduces the sharpest sampled direction change', () => {
    const fixture = {
        ...options,
        pointCount: 6,
        complexity: 100,
        seed: 66
    };
    const sharpestTurn = (path) => {
        const samples = Array.from({ length: 241 }, (_, index) => (
            sampleFocusPath(path, index / 240).point
        ));
        let maximum = 0;
        for (let index = 1; index < samples.length - 1; index += 1) {
            const incoming = {
                x: samples[index].x - samples[index - 1].x,
                y: samples[index].y - samples[index - 1].y
            };
            const outgoing = {
                x: samples[index + 1].x - samples[index].x,
                y: samples[index + 1].y - samples[index].y
            };
            const denominator = Math.hypot(incoming.x, incoming.y)
                * Math.hypot(outgoing.x, outgoing.y);
            if (denominator <= 1e-9) continue;
            const cosine = (incoming.x * outgoing.x + incoming.y * outgoing.y) / denominator;
            maximum = Math.max(maximum, Math.acos(Math.max(-1, Math.min(1, cosine))));
        }
        return maximum;
    };
    const tight = generateFocusPath({ ...fixture, smoothness: 0 });
    const smooth = generateFocusPath({ ...fixture, smoothness: 100 });
    assert.ok(sharpestTurn(smooth) < sharpestTurn(tight) * 0.2);
});

test('smoothed paths remain contained and tangent-continuous across complexities', () => {
    [0, 50, 100].forEach((complexity) => {
        for (let seed = 1; seed <= 20; seed += 1) {
            const path = generateFocusPath({
                ...options,
                start: seed % 2 ? { x: 240, y: 240 } : { x: 420, y: 240 },
                complexity,
                smoothness: 100,
                seed
            });
            assert.equal(pathIsInsideRegion(path, 1e-5), true, `${complexity} seed ${seed}`);
            path.anchors.forEach((_, index) => {
                const continuity = tangentContinuityAtAnchor(path, index);
                assert.ok(Math.abs(continuity.cross) < 1e-6);
                assert.ok(continuity.dot > 0.999);
            });
        }
    });
});

function distanceBetween(first, second) {
    return Math.hypot(first.x - second.x, first.y - second.y);
}
