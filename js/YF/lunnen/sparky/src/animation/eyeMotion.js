const SETTLE_DISTANCE = 0.15;
const SETTLE_SCALE = 0.001;
const MAX_FRAME_DURATION = 32;
export const EYE_MOTION_TIME_CONSTANT = 16;
export const BOLID_EYE_MOTION_TIME_CONSTANT = 112;

const copyPoint = (value) => ({ x: value.x, y: value.y });
const normalizedScale = (value) => Math.max(0.05, Number(value) || 1);

export function createEyeMotionState(timeConstant = EYE_MOTION_TIME_CONSTANT) {
    return {
        displayedCenter: null,
        targetCenter: null,
        displayedScale: null,
        targetScale: null,
        lastTime: null,
        timeConstant
    };
}

export function advanceEyeMotionToTarget(state, target, elapsedMs, targetScale = 1) {
    const nextTarget = copyPoint(target);
    const nextScale = normalizedScale(targetScale);
    if (!state.displayedCenter) {
        state.displayedCenter = copyPoint(nextTarget);
        state.targetCenter = nextTarget;
        state.displayedScale = nextScale;
        state.targetScale = nextScale;
        state.lastTime = null;
        return { x: 0, y: 0, settled: true };
    }

    state.targetCenter = nextTarget;
    state.targetScale = nextScale;
    const elapsed = Math.max(0, Math.min(MAX_FRAME_DURATION, Number(elapsedMs) || 0));
    const alpha = 1 - Math.exp(-elapsed / state.timeConstant);
    state.displayedCenter.x += (nextTarget.x - state.displayedCenter.x) * alpha;
    state.displayedCenter.y += (nextTarget.y - state.displayedCenter.y) * alpha;
    state.displayedScale += (nextScale - state.displayedScale) * alpha;
    const x = state.displayedCenter.x - nextTarget.x;
    const y = state.displayedCenter.y - nextTarget.y;
    const scaleDelta = state.displayedScale - nextScale;
    const settled = Math.hypot(x, y) <= SETTLE_DISTANCE
        && Math.abs(scaleDelta) <= SETTLE_SCALE;
    if (settled) {
        state.displayedCenter = copyPoint(nextTarget);
        state.displayedScale = nextScale;
    }
    return {
        x: state.displayedCenter.x - nextTarget.x,
        y: state.displayedCenter.y - nextTarget.y,
        settled
    };
}

export function advanceEyeMotion(state, now) {
    if (!state.displayedCenter || !state.targetCenter) {
        return { x: 0, y: 0, settled: true };
    }

    const elapsed = state.lastTime == null
        ? 0
        : Math.max(0, Math.min(MAX_FRAME_DURATION, now - state.lastTime));
    const alpha = 1 - Math.exp(-elapsed / state.timeConstant);
    state.displayedCenter.x += (state.targetCenter.x - state.displayedCenter.x) * alpha;
    state.displayedCenter.y += (state.targetCenter.y - state.displayedCenter.y) * alpha;
    state.displayedScale += (state.targetScale - state.displayedScale) * alpha;
    state.lastTime = now;

    const dx = state.displayedCenter.x - state.targetCenter.x;
    const dy = state.displayedCenter.y - state.targetCenter.y;
    const scaleDelta = state.displayedScale - state.targetScale;
    const settled = Math.hypot(dx, dy) <= SETTLE_DISTANCE
        && Math.abs(scaleDelta) <= SETTLE_SCALE;
    if (settled) {
        state.displayedCenter = copyPoint(state.targetCenter);
        state.displayedScale = state.targetScale;
    }
    return {
        x: state.displayedCenter.x - state.targetCenter.x,
        y: state.displayedCenter.y - state.targetCenter.y,
        settled
    };
}

export function retargetEyeMotion(state, target, now, targetScale = 1) {
    const nextScale = normalizedScale(targetScale);
    if (!state.displayedCenter) {
        state.displayedCenter = copyPoint(target);
        state.targetCenter = copyPoint(target);
        state.displayedScale = nextScale;
        state.targetScale = nextScale;
        state.lastTime = now;
        return { x: 0, y: 0, settled: true };
    }

    advanceEyeMotion(state, now);
    state.targetCenter = copyPoint(target);
    state.targetScale = nextScale;
    state.lastTime = now;
    const x = state.displayedCenter.x - target.x;
    const y = state.displayedCenter.y - target.y;
    return {
        x,
        y,
        settled: Math.hypot(x, y) <= SETTLE_DISTANCE
            && Math.abs(state.displayedScale - nextScale) <= SETTLE_SCALE
    };
}

export function snapEyeMotion(state) {
    if (state.targetCenter) state.displayedCenter = copyPoint(state.targetCenter);
    if (state.targetScale != null) state.displayedScale = state.targetScale;
    state.lastTime = null;
    return { x: 0, y: 0, settled: true };
}

export function currentEyeMotionTransform(state) {
    const targetCenter = state.targetCenter || state.displayedCenter || { x: 0, y: 0 };
    const displayedCenter = state.displayedCenter || targetCenter;
    const targetScale = state.targetScale || state.displayedScale || 1;
    const displayedScale = state.displayedScale || targetScale;
    return {
        x: displayedCenter.x - targetCenter.x,
        y: displayedCenter.y - targetCenter.y,
        scaleRatio: displayedScale / targetScale,
        displayedScale,
        targetScale
    };
}
