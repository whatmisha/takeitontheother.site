import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildAnimationFrameScene,
    drawAnimationFrame
} from '../src/render/animationFrameRenderer.js';
import { rebuildFocusPath } from '../src/animation/focusPath.js';
import { createFocusTimeline, sampleFocusTimeline } from '../src/animation/focusTimeline.js';
import { constrainFocusPoint } from '../src/geometry/focusBounds.js';
import { buildBolidEyeColorTrailLayers } from '../src/animation/bolidColorTrail.js';

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
    const effectiveFocus = constrainFocusPoint(focus, settings);
    const scene = buildAnimationFrameScene(settings, focus);
    assert.deepEqual(scene.character.focus, effectiveFocus);
    assert.equal(scene.settings.focusMode, 'manual');
    assert.equal(scene.settings.showMotionPath, false);
    assert.match(scene.character.rounded.path, /^M /);
    assert.match(scene.eyes.left.eye1.path, /^M /);
    assert.match(scene.eyes.right.eye1.path, /^M /);
});

test('animation frames smoothly scale the full Focus disk and clamp only beyond the Sphere', () => {
    const edgeFocus = { x: 480, y: 240 };
    const farFocus = { x: 4000, y: 240 };
    const effectiveFocus = constrainFocusPoint(edgeFocus, settings);
    const edgeScene = buildAnimationFrameScene(settings, edgeFocus);
    const farScene = buildAnimationFrameScene(settings, farFocus);

    assert.deepEqual(edgeScene.character.focus, effectiveFocus);
    assert.equal(edgeScene.settings.focusX, effectiveFocus.x);
    assert.equal(edgeScene.settings.focusY, effectiveFocus.y);
    assert.equal(edgeScene.eyes.values.focusX, effectiveFocus.x);
    assert.equal(edgeScene.eyes.values.focusY, effectiveFocus.y);
    assert.deepEqual(farScene.character.focus, effectiveFocus);
    assert.equal(farScene.character.rounded.path, edgeScene.character.rounded.path);
    assert.equal(farScene.eyes.left.eye1.path, edgeScene.eyes.left.eye1.path);
    assert.equal(farScene.eyes.right.eye1.path, edgeScene.eyes.right.eye1.path);
});

test('Bolid deformation changes over time and returns exactly at the loop boundary', () => {
    const animatedSettings = {
        ...settings,
        focusMode: 'bolid',
        motionDuration: 4,
        bolidTargetAngle: 180,
        bolidTargetDistance: 0
    };
    const focus = { x: 240, y: 240 };
    const start = buildAnimationFrameScene(animatedSettings, focus, {
        timeMs: 0,
        durationMs: 4000
    });
    const moving = buildAnimationFrameScene(animatedSettings, focus, {
        timeMs: 375,
        durationMs: 4000
    });
    const loop = buildAnimationFrameScene(animatedSettings, focus, {
        timeMs: 4000,
        durationMs: 4000
    });

    assert.notEqual(moving.character.rounded.path, start.character.rounded.path);
    assert.equal(loop.character.rounded.path, start.character.rounded.path);
    assert.equal(loop.eyes.left.eye1.path, start.eyes.left.eye1.path);
    assert.equal(loop.eyes.right.eye1.path, start.eyes.right.eye1.path);
});

test('Bolid frame scenes carry the same six spectral layers used by SVG preview', () => {
    const animatedSettings = {
        ...settings,
        focusMode: 'bolid',
        motionDuration: 4,
        bolidTargetAngle: 180,
        bolidTargetDistance: 0,
        bolidIntensity: 100,
        bolidColorTrail: 100,
        bolidHueSpread: 32,
        eyeColor: '#00ff00'
    };
    const focus = { x: 240, y: 240 };
    const colored = buildAnimationFrameScene(animatedSettings, focus, {
        timeMs: 250,
        durationMs: 4000
    });
    const monochrome = buildAnimationFrameScene({
        ...animatedSettings,
        bolidColorTrail: 0
    }, focus, {
        timeMs: 250,
        durationMs: 4000
    });

    assert.equal(colored.colorTrailLayers.length, 6);
    assert.ok(colored.colorTrailLayers.every((layer) => /^#[0-9a-f]{6}$/.test(layer.color)));
    assert.deepEqual(monochrome.colorTrailLayers, []);
});

test('Canvas animation export paints every Bolid spectral band behind the head', () => {
    const previousPath2D = globalThis.Path2D;
    globalThis.Path2D = class MockPath2D {
        constructor(path) {
            this.path = path;
        }
    };
    const animatedSettings = {
        ...settings,
        focusMode: 'bolid',
        motionDuration: 4,
        bolidTargetAngle: 180,
        bolidTargetDistance: 0,
        bolidIntensity: 100,
        bolidColorTrail: 100,
        bolidHueSpread: 32,
        eyeColor: '#00ff00'
    };
    const focus = { x: 240, y: 240 };
    const scene = buildAnimationFrameScene(animatedSettings, focus, {
        timeMs: 250,
        durationMs: 4000
    });
    const fills = [];
    const context = {
        save() {},
        restore() {},
        setTransform() {},
        clearRect() {},
        fillRect() {},
        clip() {},
        translate() {},
        fill() {
            fills.push(this.fillStyle);
        }
    };

    try {
        drawAnimationFrame(context, 1080, 1080, animatedSettings, focus, { scene });
        assert.deepEqual(
            fills.slice(0, 6),
            scene.colorTrailLayers.map((layer) => layer.color)
        );
        assert.equal(fills[6], animatedSettings.headColor);
        const eyeTrail = buildBolidEyeColorTrailLayers(
            scene.settings,
            scene.colorTrailLayers
        );
        assert.deepEqual(
            eyeTrail.map((_, index) => [fills[7 + index * 6], fills[10 + index * 6]]),
            eyeTrail.map((layer) => [layer.color, layer.color])
        );
    } finally {
        if (previousPath2D === undefined) delete globalThis.Path2D;
        else globalThis.Path2D = previousPath2D;
    }
});

test('extreme Bézier handles cannot push an animation frame outside the renderable Focus region', () => {
    const path = rebuildFocusPath({
        center: { x: 240, y: 240 },
        radius: 240,
        seed: 1,
        complexity: 100,
        smoothness: 100
    }, [
        {
            start: { x: 240, y: 0 },
            control1: { x: 2200, y: -1800 },
            control2: { x: 2200, y: 2200 },
            end: { x: 480, y: 240 }
        },
        {
            start: { x: 480, y: 240 },
            control1: { x: -1800, y: 2200 },
            control2: { x: -1800, y: -1800 },
            end: { x: 240, y: 0 }
        }
    ]);
    const timeline = createFocusTimeline(path, {
        duration: 1,
        pause: 0,
        stopCount: 1,
        easing: 'ease-in-out',
        seed: 1
    });
    let sawRawOvershoot = false;

    for (let frame = 0; frame < 24; frame += 1) {
        const rawFocus = sampleFocusTimeline(timeline, frame * 1000 / 24).point;
        sawRawOvershoot ||= Math.hypot(rawFocus.x - 240, rawFocus.y - 240) > 240;
        const scene = buildAnimationFrameScene(settings, rawFocus);
        const expected = constrainFocusPoint(rawFocus, settings);
        assert.deepEqual(scene.character.focus, expected);
        assert.equal(scene.eyes.values.focusX, expected.x);
        assert.equal(scene.eyes.values.focusY, expected.y);
        assert.match(scene.character.rounded.path, /^M .* Z$/);
    }

    assert.equal(sawRawOvershoot, true);
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
