export const BLINK_TIMING = Object.freeze({
    close: 90,
    hold: 45,
    open: 140
});

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smoothstep = (value) => {
    const amount = clamp01(value);
    return amount * amount * (3 - 2 * amount);
};

export function createBlinkState() {
    return {
        phase: 'idle',
        amount: 0,
        fromAmount: 0,
        phaseStart: 0,
        phaseDuration: 0
    };
}

export function advanceBlink(state, now) {
    for (let transition = 0; transition < 3; transition += 1) {
        if (state.phase === 'idle') return { amount: 0, active: false };

        if (state.phase === 'closing') {
            const progress = (now - state.phaseStart) / state.phaseDuration;
            if (progress < 1) {
                const eased = smoothstep(progress);
                state.amount = state.fromAmount + (1 - state.fromAmount) * eased;
                return { amount: state.amount, active: true };
            }
            state.amount = 1;
            state.phaseStart += state.phaseDuration;
            state.phaseDuration = BLINK_TIMING.hold;
            state.phase = 'hold';
            continue;
        }

        if (state.phase === 'hold') {
            if (now - state.phaseStart < state.phaseDuration) {
                state.amount = 1;
                return { amount: 1, active: true };
            }
            state.phaseStart += state.phaseDuration;
            state.phaseDuration = BLINK_TIMING.open;
            state.phase = 'opening';
            continue;
        }

        const progress = (now - state.phaseStart) / state.phaseDuration;
        if (progress < 1) {
            state.amount = 1 - smoothstep(progress);
            return { amount: state.amount, active: true };
        }
        state.phase = 'idle';
        state.amount = 0;
        return { amount: 0, active: false };
    }

    return { amount: state.amount, active: state.phase !== 'idle' };
}

export function triggerBlink(state, now) {
    advanceBlink(state, now);
    state.fromAmount = state.amount;
    state.phaseStart = now;
    state.phaseDuration = Math.max(16, BLINK_TIMING.close * (1 - state.amount));
    state.phase = 'closing';
    return { amount: state.amount, active: true };
}

export function resetBlink(state) {
    state.phase = 'idle';
    state.amount = 0;
    state.fromAmount = 0;
    state.phaseStart = 0;
    state.phaseDuration = 0;
    return { amount: 0, active: false };
}
