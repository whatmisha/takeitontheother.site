import { buildCharacterGeometry } from '../geometry/characterGeometry.js';
import { buildEyeGeometry, buildEyeLidGeometry } from '../geometry/eyeGeometry.js';

export const ANIMATION_ARTBOARD_SIZE = 480;

const createPath = (path) => new Path2D(path);

export function buildAnimationFrameScene(settings, focus) {
    const frameSettings = {
        ...settings,
        focusX: focus.x,
        focusY: focus.y,
        focusMode: 'manual',
        showSphere: false,
        showRayGuides: false,
        showBisectors: false,
        showPoint: false,
        showMotionPath: false
    };
    const character = buildCharacterGeometry(frameSettings);
    const eyes = buildEyeGeometry(frameSettings, character, {
        placementMode: 'global'
    });
    return { settings: frameSettings, character, eyes };
}

function fillPath(context, path, color) {
    context.fillStyle = color;
    context.fill(createPath(path));
}

function drawEyes(context, scene, knockoutEyes, eyeState) {
    const { settings, character, eyes } = scene;
    const blinkAmount = Math.max(0, Math.min(1, Number(eyeState?.blinkAmount) || 0));
    const animatedCute = Number.isFinite(Number(eyeState?.cute))
        ? Number(eyeState.cute)
        : settings.cute;
    const animatedAngry = Number.isFinite(Number(eyeState?.angry))
        ? Number(eyeState.angry)
        : settings.angry;
    const lids = eyeState
        ? buildEyeLidGeometry({
            cute: animatedCute + (100 - animatedCute) * blinkAmount,
            angry: animatedAngry + (100 - animatedAngry) * blinkAmount,
            lidClosure: blinkAmount
        }, eyes)
        : null;
    context.save();
    context.clip(createPath(character.rounded.path));

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
    eyeState = null
} = {}) {
    const scene = buildAnimationFrameScene(settings, focus);
    const scaleX = width / ANIMATION_ARTBOARD_SIZE;
    const scaleY = height / ANIMATION_ARTBOARD_SIZE;

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
        eyeState
    );
    context.restore();
    return scene;
}
