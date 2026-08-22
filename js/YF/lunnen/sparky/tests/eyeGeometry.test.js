import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCharacterGeometry } from '../src/geometry/characterGeometry.js';
import {
    EYE_DEFAULTS,
    buildFaceFieldContour,
    buildEyeGeometry,
    createEyeRigModel,
    interpolateLidOffset
} from '../src/geometry/eyeGeometry.js';
import { distance } from '../src/geometry/vector.js';

const closeTo = (actual, expected, tolerance = 1e-6) => {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

function assertPoint(actual, expected, tolerance = 1e-6) {
    closeTo(actual.x, expected.x, tolerance);
    closeTo(actual.y, expected.y, tolerance);
}

test('the four SVG emotion references are exact in eye1-local coordinates', () => {
    assertPoint(interpolateLidOffset('left', 'top', 0, 0), { x: 0, y: -64 });
    assertPoint(interpolateLidOffset('left', 'bottom', 0, 0), { x: 0, y: 64 });
    assertPoint(interpolateLidOffset('left', 'bottom', 100, 0), { x: -21.6692, y: 39.4962158 });
    assertPoint(interpolateLidOffset('right', 'bottom', 100, 0), { x: 21.6692, y: 39.4962158 });
    assertPoint(interpolateLidOffset('left', 'top', 0, 100), { x: 21.6692, y: -39.4962044 });
    assertPoint(interpolateLidOffset('right', 'top', 0, 100), { x: -21.6692, y: -39.4962044 });
    assertPoint(interpolateLidOffset('left', 'top', 100, 100), { x: 21.6692, y: -45.1654063 });
    assertPoint(interpolateLidOffset('left', 'bottom', 100, 100), { x: -21.6692, y: 45.1654053 });
});

test('Cute and Angry never move or resize either primary eye1', () => {
    const neutral = createEyeRigModel({ cute: 0, angry: 0 });
    const combined = createEyeRigModel({ cute: 100, angry: 100 });
    ['left', 'right'].forEach((side) => {
        assert.deepEqual(combined[side].eye1, neutral[side].eye1);
        closeTo(combined[side].eye1.radius, 16);
    });
});

test('combined maximum emotions preserve a gap between the two lid cutters', () => {
    const rig = createEyeRigModel({ cute: 100, angry: 100 });
    ['left', 'right'].forEach((side) => {
        assert.ok(distance(rig[side].top.center, rig[side].bottom.center) > EYE_DEFAULTS.lidRadius * 2);
    });
});

test('Eye Size 100 exactly reproduces the supplied neutral SVG reference', () => {
    const rig = createEyeRigModel({ eyeSize: 100, cute: 0, angry: 0 });
    closeTo(rig.left.eye1.center.x, -36);
    closeTo(rig.right.eye1.center.x, 36);
    closeTo(rig.left.eye1.radius, 24);
    closeTo(rig.left.top.radius, 72);
    assertPoint(rig.left.top.offset, { x: 0, y: -96 });
    assertPoint(rig.left.bottom.offset, { x: 0, y: 96 });
});

test('Eye Distance controls the clear gap and bottoms out at ten percent', () => {
    const minimum = createEyeRigModel({ eyeDistance: -90 });
    const neutral = createEyeRigModel({ eyeDistance: 0 });
    const maximum = createEyeRigModel({ eyeDistance: 100 });
    closeTo(minimum.eyeGap, 3.2);
    closeTo(neutral.eyeGap, 32);
    closeTo(maximum.eyeGap, 64);
    assert.ok(minimum.left.eye1.center.x + minimum.left.eye1.radius
        < minimum.right.eye1.center.x - minimum.right.eye1.radius);
});

test('default geometry applies the new minus-twenty eye distance without correction', () => {
    const head = buildCharacterGeometry();
    const eyes = buildEyeGeometry(head.values, head);
    assertPoint(eyes.pairCenter, { x: 240, y: 270 });
    assertPoint(eyes.left.eye1.points[0], { x: 227.2, y: 270 }, 1e-4);
    assertPoint(eyes.right.eye1.points[0], { x: 284.8, y: 270 }, 1e-4);
    closeTo(eyes.fitScale, 1);
    assert.ok(eyes.minClearance >= eyes.guard);
});

test('ray Width scales the complete pair proportionally around its center', () => {
    const fullHead = buildCharacterGeometry({ rayWidth: 80 });
    const halfHead = buildCharacterGeometry({ rayWidth: 40 });
    const full = buildEyeGeometry(fullHead.values, fullHead);
    const half = buildEyeGeometry(halfHead.values, halfHead);
    const fullRadius = distance(full.left.eye1.points[0], full.left.eye1.points[12]);
    const halfRadius = distance(half.left.eye1.points[0], half.left.eye1.points[12]);
    closeTo(halfRadius / fullRadius, 0.5, 1e-4);
    closeTo(
        distance(half.left.eye1.points[0], half.right.eye1.points[0])
            / distance(full.left.eye1.points[0], full.right.eye1.points[0]),
        0.5,
        1e-4
    );
});

test('horizontal focus gives the near eye more area than the far eye', () => {
    const leftHead = buildCharacterGeometry({ focusX: 120 });
    const leftFocus = buildEyeGeometry(leftHead.values, leftHead);
    const leftDiameter = distance(leftFocus.left.eye1.points[0], leftFocus.left.eye1.points[24]);
    const rightDiameter = distance(leftFocus.right.eye1.points[0], leftFocus.right.eye1.points[24]);
    assert.ok(leftDiameter < rightDiameter, 'left eye must be farther when focus moves left');

    const rightHead = buildCharacterGeometry({ focusX: 360 });
    const rightFocus = buildEyeGeometry(rightHead.values, rightHead);
    const mirroredLeft = distance(rightFocus.left.eye1.points[0], rightFocus.left.eye1.points[24]);
    const mirroredRight = distance(rightFocus.right.eye1.points[0], rightFocus.right.eye1.points[24]);
    assert.ok(mirroredRight < mirroredLeft, 'right eye must be farther when focus moves right');
});

test('Eye Perspective increases only the near/far size contrast from its current baseline', () => {
    const head = buildCharacterGeometry({ focusX: 120 });
    const baseline = buildEyeGeometry({ ...head.values, eyePerspective: 0 }, head);
    const maximum = buildEyeGeometry({ ...head.values, eyePerspective: 100 }, head);
    const diameter = (shape) => distance(shape.points[0], shape.points[24]);
    const baselineRatio = diameter(baseline.right.eye1) / diameter(baseline.left.eye1);
    const maximumRatio = diameter(maximum.right.eye1) / diameter(maximum.left.eye1);
    assert.ok(maximumRatio > baselineRatio);
});

test('vertical focus moves the pair and makes up smaller while down makes it larger', () => {
    const upHead = buildCharacterGeometry({ focusY: 230 });
    const defaultHead = buildCharacterGeometry();
    const downHead = buildCharacterGeometry({ focusY: 350 });
    const up = buildEyeGeometry(upHead.values, upHead);
    const neutral = buildEyeGeometry(defaultHead.values, defaultHead);
    const down = buildEyeGeometry(downHead.values, downHead);
    const diameter = (eye) => distance(eye.left.eye1.points[12], eye.left.eye1.points[36]);
    assert.ok(up.pairCenter.y < neutral.pairCenter.y);
    assert.ok(down.pairCenter.y > neutral.pairCenter.y);
    assert.ok(diameter(up) < diameter(neutral));
    assert.ok(diameter(down) > diameter(neutral));
});

test('the same vertical perspective makes the lower lid nearer when looking upward', () => {
    const upHead = buildCharacterGeometry({ focusY: 230 });
    const downHead = buildCharacterGeometry({ focusY: 350 });
    const up = buildEyeGeometry({ ...upHead.values, cute: 100, angry: 100 }, upHead);
    const down = buildEyeGeometry({ ...downHead.values, cute: 100, angry: 100 }, downHead);
    const horizontalDiameter = (shape) => distance(shape.points[0], shape.points[24]);
    ['left', 'right'].forEach((side) => {
        assert.ok(horizontalDiameter(up[side].bottom) > horizontalDiameter(up[side].top));
        assert.ok(horizontalDiameter(down[side].top) > horizontalDiameter(down[side].bottom));
    });
});

test('face placement uses circular Roundness but ignores Corner smoothing', () => {
    const circular = buildCharacterGeometry({ roundness: 80, cornerSmoothing: 0 });
    const smoothed = buildCharacterGeometry({ roundness: 80, cornerSmoothing: 100 });
    const sharp = buildCharacterGeometry({ roundness: 0, cornerSmoothing: 0 });
    const circularField = buildFaceFieldContour(circular);
    const smoothedField = buildFaceFieldContour(smoothed);
    const sharpField = buildFaceFieldContour(sharp);
    assert.equal(circularField.length, smoothedField.length);
    circularField.forEach((value, index) => assertPoint(value, smoothedField[index], 1e-6));
    assert.notDeepEqual(circularField, sharpField);
});

test('review examples define one continuous optical-placement law', () => {
    const examples = [
        { focusX: 120, focusY: 180, rayCount: 11, rayWidth: 80, roundness: 0, eyePerspective: 50, eyeSize: 0, expected: [137.143, 169.853] },
        { focusX: 120, focusY: 242.1, rayCount: 11, rayWidth: 20, roundness: 0, eyePerspective: 100, eyeSize: 0, expected: [117.363, 234.069] },
        { focusX: 360, focusY: 180, rayCount: 5, rayWidth: 80, roundness: 60, eyePerspective: 50, eyeSize: 0, expected: [344.236, 172.582] },
        { focusX: 148.1, focusY: 180, rayCount: 5, rayWidth: 80, roundness: 60, eyePerspective: 50, eyeSize: 0, expected: [157.31, 171.52] },
        { focusX: 120, focusY: 390, rayCount: 5, rayWidth: 80, roundness: 60, eyePerspective: 50, eyeSize: 0, expected: [120, 368] },
        { focusX: 120, focusY: 390, rayCount: 5, rayWidth: 37, roundness: 0, eyePerspective: 50, eyeSize: 0, expected: [120, 368] },
        { focusX: 120, focusY: 367.8, rayCount: 5, rayWidth: 20, roundness: 0, eyePerspective: 50, eyeSize: 0, expected: [115.6, 351.3] },
        { focusX: 122.2, focusY: 369.9, rayCount: 5, rayWidth: 20, roundness: 0, eyePerspective: 50, eyeSize: 0, expected: [124.868, 362.592] },
        { focusX: 120.8, focusY: 180.6, rayCount: 5, rayWidth: 20, roundness: 0, eyePerspective: 50, eyeSize: 0, expected: [125.55, 179.302] },
        { focusX: 120, focusY: 180, rayCount: 5, rayWidth: 20, roundness: 0, eyePerspective: 50, eyeSize: 0, expected: [128.19, 174.4] },
        { focusX: 360, focusY: 180, rayCount: 5, rayWidth: 98, roundness: 100, eyePerspective: 100, eyeSize: 100, expected: [351.6, 171.71] },
        { focusX: 360, focusY: 180, rayCount: 5, rayWidth: 98, roundness: 100, eyePerspective: 64, eyeSize: 100, expected: [351.41, 165.22] },
        { focusX: 360, focusY: 180, rayCount: 5, rayWidth: 98, roundness: 100, eyePerspective: 66, eyeSize: 100, expected: [353.474, 174.796] },
        { focusX: 360, focusY: 180, rayCount: 5, rayWidth: 160, roundness: 93, eyePerspective: 66, eyeSize: 100, expected: [336.7, 184.51] },
        { focusX: 360, focusY: 180, rayCount: 5, rayWidth: 160, roundness: 90, eyePerspective: 66, eyeSize: 100, expected: [343.541, 189.332] }
    ];
    let totalError = 0;
    examples.forEach(({ expected, ...settings }) => {
        const head = buildCharacterGeometry(settings);
        const eyes = buildEyeGeometry({ ...head.values, ...settings }, head);
        const error = distance(eyes.pairCenter, { x: expected[0], y: expected[1] });
        totalError += error;
        assert.ok(error < 14, `review placement drifted by ${error.toFixed(2)}px for ${JSON.stringify(settings)}`);
    });
    assert.ok(totalError / examples.length < 8);
});

test('nearby Focus, Perspective and Roundness settings cannot jump between local basins', () => {
    const placement = (settings) => {
        const head = buildCharacterGeometry(settings);
        return buildEyeGeometry({ ...head.values, ...settings }, head).pairCenter;
    };
    assert.ok(distance(
        placement({ focusX: 120, focusY: 180, rayWidth: 20 }),
        placement({ focusX: 120.8, focusY: 180.6, rayWidth: 20 })
    ) < 8);
    assert.ok(distance(
        placement({ focusX: 360, focusY: 180, rayWidth: 98, roundness: 100, eyePerspective: 64, eyeSize: 100 }),
        placement({ focusX: 360, focusY: 180, rayWidth: 98, roundness: 100, eyePerspective: 66, eyeSize: 100 })
    ) < 8);
    assert.ok(distance(
        placement({ focusX: 360, focusY: 180, rayWidth: 160, roundness: 90, eyePerspective: 66, eyeSize: 100 }),
        placement({ focusX: 360, focusY: 180, rayWidth: 160, roundness: 93, eyePerspective: 66, eyeSize: 100 })
    ) < 8);
});

test('the full supported focus, Width and eye-control grid remains inside the head gap', () => {
    const focusXs = [120, 240, 360];
    const focusYs = [180, 292, 390];
    const widths = [20, 80, 160];
    const eyeControls = [
        { eyeSize: 0, eyeDistance: 0, eyePerspective: 0 },
        { eyeSize: 100, eyeDistance: 0, eyePerspective: 0 },
        { eyeSize: 0, eyeDistance: -90, eyePerspective: 100 },
        { eyeSize: 100, eyeDistance: 100, eyePerspective: 100 }
    ];

    focusXs.forEach((focusX) => focusYs.forEach((focusY) => widths.forEach((rayWidth) => {
        eyeControls.forEach((eyeControl) => {
            const head = buildCharacterGeometry({ focusX, focusY, rayWidth });
            const eyes = buildEyeGeometry({ ...head.values, ...eyeControl, cute: 100, angry: 100 }, head);
            assert.ok(Number.isFinite(eyes.fitScale) && eyes.fitScale > 0);
            assert.ok(eyes.minClearance + 0.025 >= eyes.guard,
                `unsafe at focus ${focusX},${focusY}; width ${rayWidth}; controls ${JSON.stringify(eyeControl)}`);
            [eyes.left, eyes.right].forEach((eye) => {
                [eye.eye1, eye.top, eye.bottom].forEach((shape) => {
                    assert.match(shape.path, /^M .* C .* Z$/);
                    assert.ok(!shape.path.includes('NaN'));
                });
            });
        });
    })));
});
