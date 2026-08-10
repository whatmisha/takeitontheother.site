const FEATURE_KEYS = Object.freeze([
    ['featureSalt', 'salt'],
    ['featureAalt', 'aalt'],
    ['featureSs01', 'ss01'],
    ['featureSs02', 'ss02'],
    ['featureTnum', 'tnum'],
    ['featureDlig', 'dlig']
]);

const EMPTY_FEATURES = Object.freeze({
    salt: false,
    aalt: false,
    ss01: false,
    ss02: false,
    tnum: false,
    dlig: false
});

/** Owns variable weight and OpenType feature controls for Lunnen Display. */
export class LunnenDisplayEditorController {
    constructor(host, { documentRef = globalThis.document } = {}) {
        this.host = host;
        this.document = documentRef;
    }

    init() {
        this.bindWeight();
        this.bindFeatures();
    }

    begin(label) {
        if (!this.host.currentEditingBlock) return;
        this.host.historyManager.beginAction(label, this.host.getStateSnapshot());
    }

    commit() {
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
    }

    update(callback) {
        const block = this.host.currentEditingBlock;
        if (!block) return false;
        callback(block);
        this.host.markAsChanged();
        this.host.updateGrid();
        return true;
    }

    mutate(label, callback) {
        if (!this.host.currentEditingBlock) return false;
        this.begin(label);
        this.update(callback);
        this.commit();
        return true;
    }

    bindWeight() {
        const slider = this.document?.getElementById('lunnenDisplayWeightSlider');
        const input = this.document?.getElementById('lunnenDisplayWeightValue');
        if (!slider || !input) return;

        slider.addEventListener('focus', () => this.begin('change Lunnen Display weight'));
        slider.addEventListener('input', () => {
            this.update(block => {
                const weight = this.normalizeWeight(slider.value, block.fontWeight);
                slider.value = weight;
                input.value = weight;
                block.fontWeight = weight;
            });
        });
        slider.addEventListener('blur', () => this.commit());

        input.addEventListener('focus', () => this.begin('change Lunnen Display weight'));
        input.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            input.blur();
        });
        input.addEventListener('blur', () => {
            this.update(block => {
                const weight = this.normalizeWeight(input.value, block.fontWeight);
                input.value = weight;
                slider.value = weight;
                block.fontWeight = weight;
            });
            this.commit();
        });
    }

    normalizeWeight(value, fallback = 400) {
        const parsed = Number.parseInt(value, 10);
        const weight = Number.isFinite(parsed) ? parsed : fallback ?? 400;
        return Math.max(100, Math.min(400, weight));
    }

    bindFeatures() {
        for (const [id, key] of FEATURE_KEYS) {
            const checkbox = this.document?.getElementById(id);
            checkbox?.addEventListener('change', () => {
                this.mutate(`toggle Lunnen Display ${key}`, block => {
                    block.fontFeatures ||= { ...EMPTY_FEATURES };
                    block.fontFeatures[key] = checkbox.checked;
                });
            });
        }
    }
}
