// Interactive hover response: fast engagement followed by a soft exponential tail.
export const PERSON_RESPONSE_MS = 95;

export function personTransition(progress, durationMs = PERSON_RESPONSE_MS * 5) {
    const t = Math.min(1, Math.max(0, progress));
    const rate = Math.max(0.001, durationMs / PERSON_RESPONSE_MS);
    // Normalize the tail so deterministic exports reach the exact resting shape.
    return -Math.expm1(-rate * t) / -Math.expm1(-rate);
}
