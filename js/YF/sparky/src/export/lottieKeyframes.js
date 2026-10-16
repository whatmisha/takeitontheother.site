// Maximum error per coordinate, in the 480-unit artboard. Relative handles
// and vertices each get this bound; their sum bounds absolute control points.
export const LOTTIE_SHAPE_TOLERANCE = 0.015;
const round = (value) => {
    if (!Number.isFinite(value)) throw new Error('Lottie animation contains an invalid coordinate.');
    return Math.round(value * 1000) / 1000;
};

export function simplifyKeyframes(samples, tolerance = LOTTIE_SHAPE_TOLERANCE) {
    if (!samples.length) throw new Error('Lottie animation has no frames.');
    const dimensions = samples[0].length;
    if (samples.some((sample) => sample.length !== dimensions)) {
        throw new Error('Lottie contour topology changed during the animation.');
    }
    const keep = new Set([0, samples.length - 1]);
    const pending = [[0, samples.length - 1]];
    while (pending.length) {
        const [first, last] = pending.pop();
        let worst = tolerance;
        let split = -1;
        for (let frame = first + 1; frame < last; frame += 1) {
            const t = (frame - first) / (last - first);
            for (let component = 0; component < dimensions; component += 1) {
                const expected = samples[first][component] + (samples[last][component] - samples[first][component]) * t;
                const error = Math.abs(samples[frame][component] - expected);
                if (error > worst) { worst = error; split = frame; }
            }
        }
        if (split >= 0) {
            keep.add(split);
            pending.push([first, split], [split, last]);
        }
    }
    return [...keep].sort((a, b) => a - b);
}

export function createLottieProperty(samples, { shape = false, decode = (value) => value, tolerance = LOTTIE_SHAPE_TOLERANCE } = {}) {
    const rounded = samples.map((sample) => sample.map(round));
    // The endpoint is outside the playback range; it closes interpolation
    // into frame zero without adding a duplicated frame to the visible loop.
    rounded.push(rounded[0]);
    const indices = simplifyKeyframes(rounded, tolerance);
    if (indices.length === 2) {
        const value = decode(rounded[0]);
        return { a: 0, k: value };
    }
    const valueAt = (index) => shape ? [decode(rounded[index])] : rounded[index];
    // Each segment ends at the next keyframe’s s value; omitting the legacy
    // duplicate e value nearly halves the serialized contour data.
    return {
        a: 1,
        k: indices.map((index, position) => {
            const next = indices[position + 1];
            return next == null ? { t: index, s: valueAt(index) } : {
                t: index, s: valueAt(index),
                o: { x: 0, y: 0 }, i: { x: 1, y: 1 }
            };
        })
    };
}
