const waitForAnimationFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

/** Owns the asynchronous application startup sequence. */
export class ApplicationStartupController {
    constructor({
        loadPresets,
        loadBuiltInGraphics,
        finalize,
        recover = () => false,
        fit,
        nextFrame = waitForAnimationFrame
    }) {
        this.loadPresets = loadPresets;
        this.loadBuiltInGraphics = loadBuiltInGraphics;
        this.finalize = finalize;
        this.recover = recover;
        this.fit = fit;
        this.nextFrame = nextFrame;
        this.initialization = null;
    }

    initialize() {
        if (!this.initialization) this.initialization = this.run();
        return this.initialization;
    }

    async run() {
        await this.loadPresets();
        await this.loadBuiltInGraphics();
        await this.finalize();
        await this.recover();
        await this.nextFrame();
        this.fit();
        return true;
    }
}
