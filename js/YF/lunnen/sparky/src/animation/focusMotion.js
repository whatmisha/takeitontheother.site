const DEFAULT_OPTIONS = Object.freeze({
    slowTimeConstant: 28,
    fastTimeConstant: 4,
    slowSpeed: 0.04,
    fastSpeed: 0.9,
    maxLag: 8,
    settleDistance: 0.05,
    maxFrameDuration: 32
});

const copyPoint = ({ x, y }) => ({ x, y });
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smoothstep = (value) => value * value * (3 - 2 * value);

function capLag(state) {
    const dx = state.displayed.x - state.target.x;
    const dy = state.displayed.y - state.target.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= state.options.maxLag || distance === 0) return;
    const scale = state.options.maxLag / distance;
    state.displayed.x = state.target.x + dx * scale;
    state.displayed.y = state.target.y + dy * scale;
}

export function createAdaptiveFocusMotion(options = {}) {
    const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
    return {
        options: resolvedOptions,
        displayed: null,
        target: null,
        lastFrameTime: null,
        lastTargetTime: null,
        timeConstant: resolvedOptions.slowTimeConstant,
        speed: 0
    };
}

export function resetAdaptiveFocusMotion(state, point) {
    state.displayed = copyPoint(point);
    state.target = copyPoint(point);
    state.lastFrameTime = null;
    state.lastTargetTime = null;
    state.timeConstant = state.options.slowTimeConstant;
    state.speed = 0;
    return { point: copyPoint(point), settled: true, lag: 0 };
}

export function advanceAdaptiveFocusMotion(state, now) {
    if (!state.displayed || !state.target) {
        return { point: null, settled: true, lag: 0 };
    }

    const elapsed = state.lastFrameTime == null
        ? 0
        : Math.max(0, Math.min(state.options.maxFrameDuration, now - state.lastFrameTime));
    const alpha = elapsed === 0
        ? 0
        : 1 - Math.exp(-elapsed / Math.max(0.001, state.timeConstant));
    state.displayed.x += (state.target.x - state.displayed.x) * alpha;
    state.displayed.y += (state.target.y - state.displayed.y) * alpha;
    capLag(state);
    state.lastFrameTime = now;

    const lag = Math.hypot(
        state.displayed.x - state.target.x,
        state.displayed.y - state.target.y
    );
    const settled = lag <= state.options.settleDistance;
    if (settled) state.displayed = copyPoint(state.target);
    return { point: copyPoint(state.displayed), settled, lag: settled ? 0 : lag };
}

export function retargetAdaptiveFocusMotion(state, target, now) {
    if (!state.displayed || !state.target) {
        return resetAdaptiveFocusMotion(state, target);
    }

    advanceAdaptiveFocusMotion(state, now);
    const elapsed = state.lastTargetTime == null
        ? state.options.maxFrameDuration
        : Math.max(1, Math.min(100, now - state.lastTargetTime));
    const distance = Math.hypot(target.x - state.target.x, target.y - state.target.y);
    state.speed = distance / elapsed;
    const speedRange = Math.max(0.001, state.options.fastSpeed - state.options.slowSpeed);
    const speedAmount = smoothstep(clamp01((state.speed - state.options.slowSpeed) / speedRange));
    state.timeConstant = state.options.slowTimeConstant
        + (state.options.fastTimeConstant - state.options.slowTimeConstant) * speedAmount;
    state.target = copyPoint(target);
    state.lastTargetTime = now;
    state.lastFrameTime = now;
    capLag(state);

    const lag = Math.hypot(
        state.displayed.x - state.target.x,
        state.displayed.y - state.target.y
    );
    const settled = lag <= state.options.settleDistance;
    if (settled) state.displayed = copyPoint(state.target);
    return { point: copyPoint(state.displayed), settled, lag: settled ? 0 : lag };
}

export function settleAdaptiveFocusMotion(state) {
    if (!state.target) return { point: null, settled: true, lag: 0 };
    state.displayed = copyPoint(state.target);
    state.lastFrameTime = null;
    return { point: copyPoint(state.displayed), settled: true, lag: 0 };
}
