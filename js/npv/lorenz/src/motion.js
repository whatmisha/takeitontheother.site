export const MOTION_LOOP_SECONDS = 40;
export const MOTION_EXPORT_FPS = 60;
export const MOTION_EXPORT_SIZE = 1080;

const finiteNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const normalizePhase = (value) => ((finiteNumber(value, 0) % 1) + 1) % 1;

export function clampMotionSpeed(value) {
    return Math.max(0.01, Math.min(4, finiteNumber(value, 0.01)));
}

export function motionExportDuration(settings = {}) {
    return Math.max(1, Math.min(30, finiteNumber(settings.motionDuration, 10)));
}

export function motionExportFrameCount(settings = {}, fps = MOTION_EXPORT_FPS) {
    return Math.max(1, Math.round(motionExportDuration(settings) * fps));
}

export function motionPhaseAtTime(elapsedSeconds, speed, startPhase = 0) {
    const elapsed = Math.max(0, finiteNumber(elapsedSeconds, 0));
    return normalizePhase(startPhase + elapsed * clampMotionSpeed(speed) / MOTION_LOOP_SECONDS);
}

export function advanceMotionPhase(phase, elapsedMilliseconds, speed) {
    return motionPhaseAtTime(
        Math.max(0, finiteNumber(elapsedMilliseconds, 0)) / 1000,
        speed,
        phase
    );
}
