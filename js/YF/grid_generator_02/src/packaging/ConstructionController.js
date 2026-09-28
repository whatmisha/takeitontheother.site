import { isTube, TUBE_FIELDS, tubeParameters, constructionPatch } from './TubeModel.js';
import { CONSTRUCTION_TYPES, constructionType, effectiveFlapDepth, panelNames } from './PackagingModel.js';

/** Construction changes participate in the same undo, draft and preset document. */
export class ConstructionController {
    constructor({ settings, begin, commit, changed, render, fit }) {
        Object.assign(this, { settings, begin, commit, changed, render, fit });
        this.select = document.getElementById('constructionTypeSelect');
        this.flap = document.getElementById('flapDepthInput');
        this.abort = new AbortController();
        this.select.addEventListener('change', () => this.apply({ constructionType: this.select.value }), { signal: this.abort.signal });
        this.flap.addEventListener('change', () => this.apply({ flapDepth: this.flap.valueAsNumber }), { signal: this.abort.signal });
        this.tubeInputs = new Map(TUBE_FIELDS.map(key => [key, document.getElementById(`${key}Input`)]));
        for (const [key, input] of this.tubeInputs) input.addEventListener('change', () => {
            if (!Number.isFinite(input.valueAsNumber)) { this.sync(); return; }
            this.apply({ [key]: input.valueAsNumber });
        }, { signal: this.abort.signal });
        this.sync();
    }
    apply(patch) {
        if (patch.constructionType && !CONSTRUCTION_TYPES.includes(patch.constructionType)) { this.sync(); return; }
        if ('flapDepth' in patch) {
            if (!Number.isFinite(patch.flapDepth) || patch.flapDepth <= 0) { this.sync(); return; }
            patch.flapDepth = Math.min(this.settings.get('thickness'), Math.max(1, patch.flapDepth));
        }
        if (Object.entries(patch).every(([key, value]) => this.settings.get(key) === value)) { this.sync(); return; }
        this.begin('change construction');
        this.settings.setMultiple(constructionPatch(this.settings.getAll(), patch), true);
        this.render();
        this.commit();
        this.changed();
        this.sync();
        this.fit();
    }
    sync() {
        const settings = this.settings.getAll(), type = constructionType(settings);
        this.select.value = type;
        this.flap.value = effectiveFlapDepth(settings);
        this.flap.max = settings.thickness;
        document.getElementById('flapDepthControl').hidden = type !== 'tuck-box';
        const tube = isTube(settings), paired = type === 'telescopic-tube', p = tubeParameters(settings);
        document.getElementById('boxDimensionsControls').hidden = tube;
        document.getElementById('tubeDimensionsControls').hidden = !tube;
        document.querySelectorAll('[data-tube-pair]').forEach(control => { control.hidden = !paired; });
        for (const [key, input] of this.tubeInputs) input.value = settings[key];
        this.tubeInputs.get('tubeOverlap').max = p.maxOverlap;
        this.tubeInputs.get('tubeWall').max = Math.min(10, p.diameter / 4, p.bodyHeight / 4, p.capHeight / 4);
        const fmt = value => Number(value.toFixed(2));
        document.getElementById('tubeDimensionsHint').textContent = paired
            ? `Body wrap ${fmt(p.bodyWidth)} mm wide. Cap Ø ${fmt(p.capDiameter)} mm, wrap ${fmt(p.capWidth)} mm. Closed height ${fmt(p.assembledHeight)} mm. Round ends are preview-only.`
            : `Wrap ${fmt(p.bodyWidth)} × ${fmt(p.bodyHeight)} mm. Round ends are preview-only.`;
        const names = panelNames(settings);
        for (const id of ['paragraphSurfaceSelect', 'graphicsSurfaceSelect']) {
            document.getElementById(id)?.querySelectorAll('option').forEach(option => { option.textContent = names[option.value] || option.textContent; });
        }
        document.querySelectorAll('[data-camera-view]').forEach(button => {
            if (names[button.dataset.cameraView]) button.textContent = names[button.dataset.cameraView];
        });

    }
    dispose() { this.abort.abort(); }
}
