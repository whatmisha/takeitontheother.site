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
    }

    bind() {
        this.sliderController.sliders.forEach((sliderData, sliderId) => {
            const slider = sliderData.element;
            const input = sliderData.valueInput;

            slider.addEventListener('mousedown', event => {
                if (event.button !== 0) return;
                this.beginSlider(sliderId);
            });
            slider.addEventListener('mouseup', event => {
                if (event.button !== 0) return;
                this.commitSlider(sliderId);
            });

            input?.addEventListener('focus', () => this.beginInput(sliderId));
            input?.addEventListener('blur', () => this.commitInput(sliderId));
        });

        this.document.addEventListener('mouseup', () => this.commitAllSliders());
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
}
