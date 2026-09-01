import { buildCharacterGeometry } from '../geometry/characterGeometry.js?v=20260827-2';
import { buildEyeGeometry, buildEyeLidGeometry } from '../geometry/eyeGeometry.js';
import { constrainFocusPoint } from '../geometry/focusBounds.js?v=20260827-1';
import { settingsAtRayMotionTime } from '../geometry/rayModulation.js';

export const ANIMATION_ARTBOARD_SIZE = 480;

const createPath = (path) => new Path2D(path);
const now = () => globalThis.performance?.now?.() ?? Date.now();

function addDuration(metrics, key, startedAt) {
    if (!metrics) return;
    metrics[key] = (metrics[key] || 0) + now() - startedAt;
}

export function buildAnimationFrameScene(settings, focus, {
    metrics = null,
    timeMs = null,
    durationMs = Number(settings.motionDuration) * 1000
} = {}) {
    const effectiveFocus = constrainFocusPoint(focus, settings);
    const timedSettings = Number.isFinite(timeMs)
        ? settingsAtRayMotionTime(settings, timeMs, durationMs)
        : settings;
    const frameSettings = {
        ...timedSettings,
        focusX: effectiveFocus.x,
        focusY: effectiveFocus.y,
        focusMode: 'manual',
        showSphere: false,
        showRayGuides: false,
        showBisectors: false,
        showPoint: false,
        showMotionPath: false
    };
    let startedAt = now();
    const character = buildCharacterGeometry(frameSettings);
    addDuration(metrics, 'characterMs', startedAt);
    startedAt = now();
    const eyes = buildEyeGeometry(frameSettings, character, {
        placementMode: 'global'
    });
    addDuration(metrics, 'eyesMs', startedAt);
    return { settings: frameSettings, character, eyes };
}

function fillPath(context, path, color) {
    context.fillStyle = color;
    context.fill(createPath(path));
}

function drawEyes(context, scene, knockoutEyes, eyeState, eyeOffset, metrics) {
    const { settings, character, eyes } = scene;
    const blinkAmount = Math.max(0, Math.min(1, Number(eyeState?.blinkAmount) || 0));
    const animatedCute = Number.isFinite(Number(eyeState?.cute))
        ? Number(eyeState.cute)
        : settings.cute;
    const animatedAngry = Number.isFinite(Number(eyeState?.angry))
        ? Number(eyeState.angry)
        : settings.angry;
    const lidsStartedAt = now();
    const lids = eyeState
        ? buildEyeLidGeometry({
            cute: animatedCute + (100 - animatedCute) * blinkAmount,
            angry: animatedAngry + (100 - animatedAngry) * blinkAmount,
            lidClosure: blinkAmount
        }, eyes)
        : null;
    addDuration(metrics, 'lidsMs', lidsStartedAt);
    context.save();
    context.clip(createPath(character.rounded.path));
    context.translate(
        Number(eyeOffset?.x) || 0,
        Number(eyeOffset?.y) || 0
    );

    ['left', 'right'].forEach((side) => {
        const eye = eyes[side];
        const renderedLids = lids?.[side] || eye;
        if (knockoutEyes) {
            context.globalCompositeOperation = 'destination-out';
            fillPath(context, eye.eye1.path, '#000000');
            context.globalCompositeOperation = 'source-over';
            fillPath(context, renderedLids.top.path, settings.headColor);
            fillPath(context, renderedLids.bottom.path, settings.headColor);
            return;
        }
        fillPath(context, eye.eye1.path, settings.eyeColor);
        fillPath(context, renderedLids.top.path, settings.headColor);
        fillPath(context, renderedLids.bottom.path, settings.headColor);
    });

    context.restore();
}

export function drawAnimationFrame(context, width, height, settings, focus, {
    transparentBackground = false,
    knockoutEyes = false,
    eyeState = null,
    eyeOffset = null,
    scene: preparedScene = null,
    metrics = null
} = {}) {
    const scene = preparedScene || buildAnimationFrameScene(settings, focus, { metrics });
    const scaleX = width / ANIMATION_ARTBOARD_SIZE;
    const scaleY = height / ANIMATION_ARTBOARD_SIZE;
    const drawStartedAt = now();

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    if (!transparentBackground) {
        context.fillStyle = scene.settings.backgroundColor;
        context.fillRect(0, 0, ANIMATION_ARTBOARD_SIZE, ANIMATION_ARTBOARD_SIZE);
    }
    fillPath(context, scene.character.rounded.path, scene.settings.headColor);
    drawEyes(
        context,
        scene,
        Boolean(transparentBackground && knockoutEyes),
        eyeState,
        eyeOffset,
        metrics
    );
    context.restore();
    addDuration(metrics, 'canvasDrawMs', drawStartedAt);
    return scene;
}
