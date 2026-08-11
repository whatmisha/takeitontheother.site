import { ListenerScope } from '../core/ListenerScope.js';

export class SliderHistoryController {
    constructor({
        sliderController,
        documentRef = document,
        beginAction,
        commitAction
    }) {
        this.sliderController = sliderController;
        this.document = documentRef;
        this.beginAction = beginAction;
        this.commitAction = commitAction;
        this.activeSliders = new Set();
        this.activeInputs = new Set();
        this.listeners = new ListenerScope();
        this.bound = false;
        this.handleDocumentMouseUp = () => this.commitAllSliders();
    }

    bind() {
        if (this.bound) return false;
        this.bound = true;
        this.sliderController.sliders.forEach((sliderData, sliderId) => {
            const slider = sliderData.element;
            const input = sliderData.valueInput;

            this.listeners.listen(slider, 'mousedown', event => {
                if (event.button !== 0) return;
                this.beginSlider(sliderId);
            });
            this.listeners.listen(slider, 'mouseup', event => {
                if (event.button !== 0) return;
                this.commitSlider(sliderId);
            });

            this.listeners.listen(input, 'focus', () => this.beginInput(sliderId));
            this.listeners.listen(input, 'blur', () => this.commitInput(sliderId));
        });

        this.listeners.listen(this.document, 'mouseup', this.handleDocumentMouseUp);
        return true;
    }

    beginSlider(sliderId) {
        if (this.activeSliders.has(sliderId)) return;
        this.beginAction(`adjust ${sliderId}`);
        this.activeSliders.add(sliderId);
    }

    commitSlider(sliderId) {
        if (!this.activeSliders.has(sliderId)) return;
        this.commitAction();
        this.activeSliders.delete(sliderId);
    }

    beginInput(sliderId) {
        if (this.activeInputs.has(sliderId)) return;
        this.beginAction(`type ${sliderId}`);
        this.activeInputs.add(sliderId);
    }

    commitInput(sliderId) {
        if (!this.activeInputs.has(sliderId)) return;
        this.commitAction();
        this.activeInputs.delete(sliderId);
    }

    commitAllSliders() {
        for (const sliderId of [...this.activeSliders]) {
            this.commitSlider(sliderId);
        }
    }

    dispose() {
        this.commitAllSliders();
        this.activeInputs.clear();
        return this.listeners.dispose();
    }
}
