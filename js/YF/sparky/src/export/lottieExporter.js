import { createMotion, createLoopingEyeMotion } from './animationExportMotion.js';
import { ANIMATION_EXPORT_FPS, ANIMATION_EXPORT_SIZE } from './animationExportDefaults.js';
import { createAnimationFrameSamples, sampleAnimationFrame } from './animationFrameSamples.js';
import { buildAnimationFrameScene, ANIMATION_ARTBOARD_SIZE } from '../render/animationFrameRenderer.js?v=lottie-1';
import { advanceEyeMotionToTarget, currentEyeMotionTransform } from '../animation/eyeMotion.js?v=20260828-1';
import { buildEyeLidGeometry } from '../geometry/eyeGeometry.js?v=20260828-1';
import { buildBolidEyeColorTrailLayers } from '../animation/bolidColorTrail.js?v=lottie-1';
import { roundedPolygonToLottie, eyeCurveToLottie, packLottieShape, unpackLottieShape } from './lottieGeometry.js';
import { createLottieProperty } from './lottieKeyframes.js';

const fixed = (k) => ({ a: 0, k });
const color = (hex) => {
    const raw = hex.replace('#', '');
    const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw;
    return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255).concat(1);
};
const transform = () => ({ ty: 'tr', p: fixed([0, 0]), a: fixed([0, 0]), s: fixed([100, 100]), r: fixed(0), o: fixed(100), sk: fixed(0), sa: fixed(0) });
const group = (nm, paintOrder, tr = transform()) => ({ ty: 'gr', nm, it: [...paintOrder].reverse().concat(tr) });
const filledPath = (nm, ks, fill, opacity = fixed(100)) => ({
    ty: 'gr', nm, it: [
        { ty: 'sh', nm, ks },
        { ty: 'fl', c: fixed(color(fill)), o: opacity, r: 1 },
        transform()
    ]
});

// This sampler is also used by the visual acceptance fixture to compare the
// exported player against the existing Canvas renderer at identical times.
export function* sampleLottieFrames({ settings, startFocus, motionPath = null }) {
    const fps = ANIMATION_EXPORT_FPS;
    const frameCount = Math.round(settings.motionDuration * fps);
    const { timeline, eyeTimeline } = createMotion(settings, startFocus, motionPath);
    const samples = createAnimationFrameSamples(timeline, eyeTimeline, settings, frameCount, fps);
    const motion = createLoopingEyeMotion(settings, timeline, frameCount, fps);
    for (let index = 0; index < frameCount; index += 1) {
        const sample = sampleAnimationFrame(samples, index);
        const scene = buildAnimationFrameScene(settings, sample.focus, {
            timeMs: index * 1000 / fps,
            durationMs: timeline.durationMs,
            includeTrailGeometry: true
        });
        advanceEyeMotionToTarget(motion, scene.eyes.pairCenter, 1000 / fps, scene.eyes.fitScale);
        const eyeOffset = currentEyeMotionTransform(motion);
        const blink = sample.eyes.blinkAmount;
        const lids = buildEyeLidGeometry({
            cute: sample.eyes.cute + (100 - sample.eyes.cute) * blink,
            angry: sample.eyes.angry + (100 - sample.eyes.angry) * blink,
            lidClosure: blink
        }, scene.eyes);
        const eyes = Object.fromEntries(['left', 'right'].map((side) => [side, {
            eye: eyeCurveToLottie(scene.eyes[side].eye1.points),
            top: eyeCurveToLottie(lids[side].top.points),
            bottom: eyeCurveToLottie(lids[side].bottom.points)
        }]));
        yield {
            ...sample, scene, eyeOffset, eyes, eyeState: sample.eyes,
            head: roundedPolygonToLottie(scene.character.rounded),
            trails: scene.colorTrailLayers.map((layer) => ({ ...layer, shape: roundedPolygonToLottie(layer.rounded) })),
            eyeTrails: buildBolidEyeColorTrailLayers(scene.settings, scene.colorTrailLayers, eyeOffset)
        };
    }
}

export function createLottieAnimation({ settings, startFocus, motionPath = null, onProgress = () => {} }) {
    if (!['animate', 'bolid'].includes(settings.focusMode)) throw new Error('Choose Path or Bolid to export Lottie.');
    if (!Number.isFinite(settings.motionDuration) || settings.motionDuration < 1 || settings.motionDuration > 10) {
        throw new Error('Lottie duration must be between 1 and 10 seconds.');
    }
    const fps = ANIMATION_EXPORT_FPS;
    const frameCount = Math.round(settings.motionDuration * fps);
    const frames = sampleLottieFrames({ settings, startFocus, motionPath });
    onProgress(0, frameCount);
    const first = frames.next().value;
    const tracks = [];
    const animate = (read, options = {}) => {
        const property = {};
        tracks.push({ read, options, property, samples: [] });
        return property;
    };
    const shape = (read) => animate((frame) => packLottieShape(read(frame)), { shape: true, decode: unpackLottieShape });
    const scalar = (read) => animate((frame) => [read(frame)], { decode: (value) => value[0] });
    const head = shape((frame) => frame.head);
    const eyePaths = Object.fromEntries(['left', 'right'].map((side) => [side,
        Object.fromEntries(['eye', 'top', 'bottom'].map((part) => [part, shape((frame) => frame.eyes[side][part])]))
    ]));
    const scale = ANIMATION_EXPORT_SIZE / ANIMATION_ARTBOARD_SIZE * 100;
    let layerIndex = 0;
    const layer = (nm, shapes) => ({
        ddd: 0, ind: ++layerIndex, ty: 4, nm, sr: 1,
        ks: { p: fixed([0, 0, 0]), a: fixed([0, 0, 0]), s: fixed([scale, scale, 100]), r: fixed(0), o: fixed(100) },
        ao: 0, shapes, ip: 0, op: frameCount, st: 0, bm: 0
    });
    const trails = first.trails.map((trail, index) => {
        const tr = transform();
        tr.p = animate((frame) => [frame.trails[index].offsetX, frame.trails[index].offsetY]);
        const path = filledPath(`Trail ${trail.band}`, shape((frame) => frame.trails[index].shape), trail.color,
            scalar((frame) => frame.trails[index].opacity * 100));
        return layer(`Head trail ${index + 1}`, [group('Trail', [path], tr)]);
    });
    const body = layer('Head', [filledPath('Head', head, settings.headColor)]);
    const eyeSets = first.eyeTrails.map((trail, index) => ({
        color: trail.color,
        opacity: scalar((frame) => frame.eyeTrails[index].opacity * 100),
        position: animate((frame) => [frame.eyeTrails[index].offsetX, frame.eyeTrails[index].offsetY])
    }));
    eyeSets.push({ color: settings.eyeColor, opacity: fixed(100), position: fixed([0, 0]) });
    const paintedEyes = eyeSets.map((set, index) => {
        const paths = ['left', 'right'].flatMap((side) => [
            filledPath(`${side} eye`, eyePaths[side].eye, set.color, set.opacity),
            filledPath(`${side} upper lid`, eyePaths[side].top, settings.headColor),
            filledPath(`${side} lower lid`, eyePaths[side].bottom, settings.headColor)
        ]);
        const tr = transform();
        tr.p = set.position;
        return group(`Eye pass ${index + 1}`, paths, tr);
    });
    const rig = transform();
    rig.a = animate((frame) => [frame.scene.eyes.pairCenter.x, frame.scene.eyes.pairCenter.y]);
    rig.p = animate((frame) => [frame.scene.eyes.pairCenter.x + frame.eyeOffset.x, frame.scene.eyes.pairCenter.y + frame.eyeOffset.y]);
    rig.s = animate((frame) => [frame.eyeOffset.scaleRatio * 100, frame.eyeOffset.scaleRatio * 100]);
    const eyes = layer('Eyes and eyelids', [group('Eye rig', paintedEyes, rig)]);
    eyes.hasMask = true;
    eyes.masksProperties = [{ nm: 'Head boundary', inv: false, mode: 'a', pt: head, o: fixed(100), x: fixed(0) }];
    const record = (frame) => tracks.forEach((track) => track.samples.push(track.read(frame)));
    record(first);
    let count = 1;
    for (const frame of frames) {
        record(frame);
        count += 1;
        if (count % 15 === 0 || count === frameCount) onProgress(count, frameCount);
    }
    for (const track of tracks) Object.assign(track.property, createLottieProperty(track.samples, track.options));
    return {
        v: '5.12.2', fr: fps, ip: 0, op: frameCount,
        w: ANIMATION_EXPORT_SIZE, h: ANIMATION_EXPORT_SIZE,
        nm: `Sparky ${settings.focusMode === 'bolid' ? 'Bolid' : 'Path'}`,
        ddd: 0, assets: [], layers: [eyes, body, ...trails.reverse()], markers: [],
        meta: { g: 'Sparky', d: 'Vector animation; transparent background; motion blur omitted.' }
    };
}
