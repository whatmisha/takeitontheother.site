import { buildCharacterGeometry } from '../geometry/characterGeometry.js?v=20260828-2';
import {
    buildEyeGeometry,
    buildEyeLidGeometry,
    stabilizeEyeGeometry
} from '../geometry/eyeGeometry.js?v=20260828-1';
import { constrainFocusPoint } from '../geometry/focusBounds.js?v=20260828-2';
import { settingsAtBolidTime } from '../animation/bolid.js?v=20260828-3';
import {
    buildBolidColorTrailLayers,
    buildBolidEyeColorTrailLayers
} from '../animation/bolidColorTrail.js?v=20260828-5';
import { createBolidEyeScaffold } from '../animation/bolidEyeScaffold.js?v=20260828-2';

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
        ? settingsAtBolidTime(settings, timeMs, durationMs)
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
    const colorTrailLayers = buildBolidColorTrailLayers(settings, effectiveFocus, {
        timeMs: Number.isFinite(timeMs) ? timeMs : 0,
        durationMs
    });
    addDuration(metrics, 'colorTrailMs', startedAt);
    startedAt = now();
    const eyes = settings.focusMode === 'bolid'
        ? stabilizeEyeGeometry(
            frameSettings,
            character,
            createBolidEyeScaffold(settings, effectiveFocus).eyes
        )
        : buildEyeGeometry(frameSettings, character, {
            placementMode: 'global'
        });
    addDuration(metrics, 'eyesMs', startedAt);
    return { settings: frameSettings, character, eyes, colorTrailLayers };
}

function fillPath(context, path, color) {
    context.fillStyle = color;
    context.fill(createPath(path));
}

function drawEyes(
    context,
    scene,
    knockoutEyes,
    eyeState,
    eyeOffset,
    colorTrailLayers,
    metrics
) {
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
    const offsetX = Number(eyeOffset?.x) || 0;
    const offsetY = Number(eyeOffset?.y) || 0;
    const scaleRatio = Math.max(0.05, Number(eyeOffset?.scaleRatio) || 1);
    if (Math.abs(scaleRatio - 1) > 1e-6) {
        context.translate(eyes.pairCenter.x + offsetX, eyes.pairCenter.y + offsetY);
        context.scale(scaleRatio, scaleRatio);
        context.translate(-eyes.pairCenter.x, -eyes.pairCenter.y);
    } else {
        context.translate(offsetX, offsetY);
    }

    colorTrailLayers.forEach((layer) => {
        context.save();
        context.translate(layer.offsetX, layer.offsetY);
        ['left', 'right'].forEach((side) => {
            const eye = eyes[side];
            const renderedLids = lids?.[side] || eye;
            context.globalAlpha = layer.opacity;
            fillPath(context, eye.eye1.path, layer.color);
            context.globalAlpha = 1;
            fillPath(context, renderedLids.top.path, settings.headColor);
            fillPath(context, renderedLids.bottom.path, settings.headColor);
        });
        context.restore();
    });

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
    const eyeColorTrailLayers = buildBolidEyeColorTrailLayers(
        scene.settings,
        scene.colorTrailLayers,
        eyeOffset
    );
    const drawStartedAt = now();

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    if (!transparentBackground) {
        context.fillStyle = scene.settings.backgroundColor;
        context.fillRect(0, 0, ANIMATION_ARTBOARD_SIZE, ANIMATION_ARTBOARD_SIZE);
    }
    (scene.colorTrailLayers || []).forEach((layer) => {
        context.save();
        context.globalAlpha = layer.opacity;
        context.translate(layer.offsetX, layer.offsetY);
        fillPath(context, layer.path, layer.color);
        context.restore();
    });
    fillPath(context, scene.character.rounded.path, scene.settings.headColor);
    drawEyes(
        context,
        scene,
        Boolean(transparentBackground && knockoutEyes),
        eyeState,
        eyeOffset,
        eyeColorTrailLayers,
        metrics
    );
    context.restore();
    addDuration(metrics, 'canvasDrawMs', drawStartedAt);
    return scene;
}
