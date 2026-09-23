/**
 * Small deterministic pseudo-random generator for reproducible tool renders.
 * Accepts number or string seeds and exposes an explicit serialisable state.
 */
export class SeededRandom {
    constructor(seed = 0) {
        this.initialSeed = seed;
        this.state = seedToUint32(seed);
    }

    /** Return a deterministic float in [0, 1). */
    next() {
        // Mulberry32: compact, fast and stable across JavaScript engines.
        this.state = (this.state + 0x6D2B79F5) >>> 0;
        let value = this.state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }

    float(min = 0, max = 1) {
        const low = Number(min);
        const high = Number(max);
        if (!Number.isFinite(low) || !Number.isFinite(high)) throw new TypeError('Random bounds must be finite.');
        return low + this.next() * (high - low);
    }

    /** Inclusive integer range. */
    int(min, max) {
        const low = Math.ceil(Number(min));
        const high = Math.floor(Number(max));
        if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) {
            throw new RangeError('Invalid integer random range.');
        }
        return low + Math.floor(this.next() * (high - low + 1));
    }

    bool(probability = 0.5) {
        const threshold = Math.max(0, Math.min(1, Number(probability)));
        return this.next() < threshold;
    }

    pick(values) {
        if (!Array.isArray(values) || values.length === 0) return undefined;
        return values[this.int(0, values.length - 1)];
    }

    /** Create an independent deterministic stream derived from this seed. */
    fork(label = '') {
        return new SeededRandom(`${String(this.initialSeed)}:${String(label)}`);
    }

    getState() { return this.state >>> 0; }

    setState(state) {
        const normalized = Number(state);
        if (!Number.isFinite(normalized)) throw new TypeError('Random state must be finite.');
        this.state = normalized >>> 0;
        return this;
    }

    clone() {
        return new SeededRandom(this.initialSeed).setState(this.state);
    }
}

export function seedToUint32(seed) {
    if (typeof seed === 'number' && Number.isFinite(seed)) {
        const integer = Number.isInteger(seed) ? seed : Math.round(seed * 0xFFFFFFFF);
        return integer >>> 0;
    }
    const text = String(seed ?? '');
    let hash = 0x811C9DC5;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}
