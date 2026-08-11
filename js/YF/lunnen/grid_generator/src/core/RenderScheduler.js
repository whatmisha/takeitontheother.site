import { MathUtils } from '../utils/MathUtils.js';

/** Owns immediate, debounced and throttled canvas rendering. */
export class RenderScheduler {
    constructor({ render, canRender = () => true, frameMs = 16 }) {
        this.renderNow = render;
        this.canRender = canRender;
        this.debounced = MathUtils.debounce(render, frameMs);
        this.throttled = MathUtils.throttle(render, frameMs);
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
}
