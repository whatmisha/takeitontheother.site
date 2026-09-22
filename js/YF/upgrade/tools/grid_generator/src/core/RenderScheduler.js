import { MathUtils } from '../utils/MathUtils.js';

/** Owns immediate, debounced and throttled canvas rendering. */
export class RenderScheduler {
    constructor({
        render,
        canRender = () => true,
        frameMs = 16,
        now = () => globalThis.performance?.now?.() ?? Date.now()
    }) {
        this.render = render;
        this.now = now;
        this.metrics = { count: 0, totalMs: 0, lastMs: 0, maxMs: 0 };
        this.renderNow = () => this.measure();
        this.canRender = canRender;
        this.debounced = MathUtils.debounce(this.renderNow, frameMs);
        this.throttled = MathUtils.throttle(this.renderNow, frameMs);
    }

    immediate() {
        if (this.canRender()) this.renderNow();
    }

    deferred() {
        if (this.canRender()) this.debounced();
    }

    duringGesture() {
        if (this.canRender()) this.throttled();
    }

    measure() {
        const startedAt = this.now();
        try {
            return this.render();
        } finally {
            const duration = Math.max(0, this.now() - startedAt);
            this.metrics.count += 1;
            this.metrics.totalMs += duration;
            this.metrics.lastMs = duration;
            this.metrics.maxMs = Math.max(this.metrics.maxMs, duration);
        }
    }

    getMetrics() {
        const { count, totalMs, lastMs, maxMs } = this.metrics;
        return Object.freeze({
            count,
            totalMs,
            lastMs,
            maxMs,
            averageMs: count ? totalMs / count : 0
        });
    }

    dispose() {
        this.debounced.cancel?.();
        this.throttled.cancel?.();
    }
}
