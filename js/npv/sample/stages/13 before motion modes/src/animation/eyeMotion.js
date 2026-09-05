const SETTLE_DISTANCE = 0.15;
const MAX_FRAME_DURATION = 32;

const copyPoint = (value) => ({ x: value.x, y: value.y });

export function createEyeMotionState(timeConstant = 16) {
    return {
        displayedCenter: null,
        targetCenter: null,
        lastTime: null,
        timeConstant
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
    state.lastTime = now;

    const dx = state.displayedCenter.x - state.targetCenter.x;
    const dy = state.displayedCenter.y - state.targetCenter.y;
    const settled = Math.hypot(dx, dy) <= SETTLE_DISTANCE;
    if (settled) state.displayedCenter = copyPoint(state.targetCenter);
    return {
        x: state.displayedCenter.x - state.targetCenter.x,
        y: state.displayedCenter.y - state.targetCenter.y,
        settled
    };
}

export function retargetEyeMotion(state, target, now) {
    if (!state.displayedCenter) {
        state.displayedCenter = copyPoint(target);
        state.targetCenter = copyPoint(target);
        state.lastTime = now;
        return { x: 0, y: 0, settled: true };
    }

    advanceEyeMotion(state, now);
    state.targetCenter = copyPoint(target);
    state.lastTime = now;
    const x = state.displayedCenter.x - target.x;
    const y = state.displayedCenter.y - target.y;
    return { x, y, settled: Math.hypot(x, y) <= SETTLE_DISTANCE };
}

export function snapEyeMotion(state) {
    if (state.targetCenter) state.displayedCenter = copyPoint(state.targetCenter);
    state.lastTime = null;
    return { x: 0, y: 0, settled: true };
}
