import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildAnimationFrameScene,
    drawAnimationFrame
} from '../src/render/animationFrameRenderer.js';

const settings = {
    width: 480,
    height: 480,
    boundaryType: 'circle',
    boundaryCenterX: 240,
    boundaryCenterY: 240,
    boundaryRadius: 240,
    boundaryRadiusX: 240,
    boundaryRadiusY: 240,
    boundaryRotation: 0,
    rayCount: 5,
    centerAngle: -90,
    angleStep: 36,
    angleSpan: 144,
    rayLength: 240,
    rayWidth: 80,
    roundness: 60,
    cornerSmoothing: 100,
    rayOverrides: [{}, {}, {}, {}, {}],
    headColor: '#ffffff',
    eyeColor: '#000000',
    backgroundColor: '#000000',
    eyePerspective: 100,
    eyeSize: 50,
    eyeDistance: 0,
    cute: 50,
    angry: 0
};

test('animation frame scene uses the sampled focus and excludes transient guides', () => {
    const focus = { x: 200, y: 170 };
    const scene = buildAnimationFrameScene(settings, focus);
    assert.deepEqual(scene.character.focus, focus);
    assert.equal(scene.settings.focusMode, 'manual');
    assert.equal(scene.settings.showMotionPath, false);
    assert.match(scene.character.rounded.path, /^M /);
    assert.match(scene.eyes.left.eye1.path, /^M /);
    assert.match(scene.eyes.right.eye1.path, /^M /);
});

test('animation frame renderer translates the complete eye rig by the inertial offset', () => {
    const previousPath2D = globalThis.Path2D;
    globalThis.Path2D = class MockPath2D {
        constructor(path) {
            this.path = path;
        }
    };
    const translations = [];
    const context = {
        save() {},
        restore() {},
        setTransform() {},
        clearRect() {},
        fillRect() {},
        fill() {},
        clip() {},
        translate(x, y) {
            translations.push({ x, y });
        }
    };
    const focus = { x: 200, y: 170 };
    const scene = buildAnimationFrameScene(settings, focus);

    try {
        const rendered = drawAnimationFrame(context, 1080, 1080, settings, focus, {
            eyeOffset: { x: 7, y: -3 },
            scene
        });
        assert.equal(rendered, scene);
        assert.deepEqual(translations, [{ x: 7, y: -3 }]);
    } finally {
        if (previousPath2D === undefined) delete globalThis.Path2D;
        else globalThis.Path2D = previousPath2D;
    }
});
