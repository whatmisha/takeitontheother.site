import { MARKING_CATALOG_V1 } from './MarkingCatalogV1.js';
import { MARKING_SETS, markingRecipe, buildMarkingGroup, markingName } from './MarkingGroup.js';
import { ListenerScope } from '../core/ListenerScope.js';
import { SliderController } from '../ui/SliderController.js';
import { PanelPositioner } from '../elements/PanelPositioner.js';
import { MathUtils } from '../utils/MathUtils.js';

const ARROWS = {
    up: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 10L8 6L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

/** A local draft is previewed in this panel; Add/Apply commits one undoable document action. */
export class MarkingCatalogController {
    constructor(host, documentRef = document) {
        this.host = host;
        this.document = documentRef;
        this.listeners = new ListenerScope();
        this.rowListeners = new ListenerScope();
        this.panel = documentRef.getElementById('markingsPanel');
        this.positioner = new PanelPositioner(documentRef);
        this.sliders = new SliderController(host.settingsModule, { documentRef });
        this.fields = Object.fromEntries([...this.panel.querySelectorAll('[data-marking-field]')].map(node => [node.dataset.markingField, node]));
        for (const set of MARKING_SETS) {
            const option = documentRef.createElement('option'); option.value = set.id; option.textContent = set.name;
            this.fields.set.appendChild(option);
        }
        this.listeners.listen(documentRef.getElementById('addMarkingsBtn'), 'click', () => this.open());
        this.listeners.listen(documentRef.getElementById('editMarkingsBtn'), 'click', () => this.open(host.currentEditingGraphicsId));
        this.listeners.listen(this.fields.close, 'click', () => this.close());
        this.listeners.listen(this.fields.cancel, 'click', () => this.close());
        this.listeners.listen(this.fields.apply, 'click', () => this.apply());
        this.listeners.listen(this.fields.set, 'change', () => {
            if (!this.fields.set.value) return;
            this.recipe = markingRecipe(this.fields.set.value);
            this.completeItems(); this.render();
        });
        for (const key of ['direction', 'align']) this.listeners.listen(this.fields[key], 'change', () => {
            this.recipe[key] = this.fields[key].value; this.renderPreview();
        });
        this.sliders.initSlider('markingHeightSlider', {
            valueId: 'markingHeightValue', min: 0.05, max: 10, baseStep: 0.05, shiftStep: 0.5, decimals: 2,
            onUpdate: value => { this.height = value === this.displayedHeight ? this.originalHeight : value; this.renderPreview(); }
        });
        this.sliders.initSlider('markingGapSlider', {
            valueId: 'markingGapValue', min: 0, max: 3, baseStep: 0.05, shiftStep: 0.25, decimals: 2,
            onUpdate: value => { this.recipe.gap = value === this.displayedGap ? this.originalGap : value; this.renderPreview(); }
        });
        this.listeners.listen(this.panel, 'keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); }
        });
    }

    completeItems() {
        const ids = new Set(this.recipe.items.map(item => item.id));
        this.recipe.items.push(...MARKING_CATALOG_V1.filter(item => !ids.has(item.id)).map(item => ({ id: item.id, enabled: false })));
    }

    open(id = null) {
        const block = id ? this.host.objectDocument.getGraphicsBlock(id) : null;
        if (id && !block) return false;
        this.returnFocus = this.document.activeElement;
        this.editingId = id;
        this.history = this.host.historyManager;
        this.originalBlock = block ? JSON.stringify(block) : null;
        this.recipe = block?.markings ? structuredClone(block.markings) : markingRecipe();
        this.completeItems();
        this.height = 1.5;
        if (block) {
            const context = this.host.getSurfaceGridContext(block.surface || 'front');
            const groupHeightMm = MathUtils.ptToMm(this.host.graphicsRenderer.calculateDimensions(block, context).height);
            const normalizedHeight = block.markings ? buildMarkingGroup(block.markings).originalHeight : 100;
            this.height = groupHeightMm / context.gridModule * 100 / normalizedHeight;
        }
        this.height = Math.max(0.000001, this.height);
        const data = this.sliders.sliders.get('markingHeightSlider');
        data.config.max = Math.max(10, this.height); data.element.max = data.config.max;
        data.config.min = Math.min(0.05, this.height); data.element.min = data.config.min;
        this.host.objectEditorPanelController.closeTextPanel();
        this.host.objectEditorPanelController.closeGraphicsPanel();
        this.fields.apply.textContent = block ? 'Apply changes' : 'Add markings';
        this.fields.title.textContent = block ? 'Edit markings' : 'Markings';
        this.fields.set.value = block?.markings ? '' : 'standard';
        this.panel.style.display = 'flex';
        this.host.panelManager.bringToFront('markingsPanel');
        this.render();
        this.positioner.center(this.panel);
        this.fields.set.focus();
        return true;
    }

    close({ restoreFocus = true } = {}) {
        this.panel.style.display = 'none';
        this.editingId = null;
        if (restoreFocus && this.returnFocus?.isConnected) this.returnFocus.focus();
    }

    render() {
        this.fields.direction.value = this.recipe.direction;
        this.fields.align.value = this.recipe.align;
        this.sliders.setValue('markingHeightSlider', this.height, false);
        this.sliders.setValue('markingGapSlider', this.recipe.gap, false);
        this.originalHeight = this.height; this.originalGap = this.recipe.gap;
        this.displayedHeight = Number(this.document.getElementById('markingHeightValue').value);
        this.displayedGap = Number(this.document.getElementById('markingGapValue').value);
        this.rowListeners.dispose(); this.rowListeners = new ListenerScope();
        this.fields.list.replaceChildren(...this.recipe.items.map((item, index) => this.createRow(item, index)));
        this.renderPreview();
    }

    createRow(item, index) {
        const entry = MARKING_CATALOG_V1.find(mark => mark.id === item.id);
        const row = this.document.createElement('div'); row.className = 'element-item-wrapper marking-row'; row.dataset.markingRow = item.id;
        const label = this.document.createElement('label'); label.className = 'element-item checkbox-label';
        const input = this.document.createElement('input'); input.type = 'checkbox'; input.checked = item.enabled;
        input.setAttribute('aria-label', `Include ${entry.name}`);
        const thumb = this.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        thumb.setAttribute('viewBox', `0 0 ${entry.width} ${entry.height}`);
        thumb.setAttribute('aria-hidden', 'true'); thumb.innerHTML = entry.svgContent;
        const title = this.document.createElement('span'); title.className = 'element-item-text'; title.textContent = entry.name;
        label.append(input, thumb, title); row.appendChild(label);
        this.rowListeners.listen(input, 'change', () => {
            item.enabled = input.checked; row.classList.toggle('marking-off', !item.enabled);
            this.fields.set.value = ''; this.renderPreview();
        });
        const actions = this.document.createElement('span'); actions.className = 'element-actions';
        for (const [name, delta] of [['up', -1], ['down', 1]]) {
            const button = this.document.createElement('button'); button.type = 'button'; button.className = 'element-action-btn';
            button.innerHTML = ARROWS[name]; button.setAttribute('aria-label', `Move ${entry.name} ${name}`);
            button.disabled = index + delta < 0 || index + delta >= this.recipe.items.length;
            this.rowListeners.listen(button, 'click', () => {
                const items = this.recipe.items; [items[index], items[index + delta]] = [items[index + delta], items[index]];
                this.fields.set.value = ''; this.render();
                this.fields.list.querySelector(`[data-marking-row="${item.id}"] button[aria-label="Move ${entry.name} ${name}"]`)?.focus();
            });
            actions.appendChild(button);
        }
        row.appendChild(actions); row.classList.toggle('marking-off', !item.enabled);
        return row;
    }

    renderPreview() {
        if (!this.recipe) return;
        const count = this.recipe.items.filter(item => item.enabled).length;
        this.fields.apply.disabled = !count;
        this.fields.alignGroup.hidden = this.recipe.direction !== 'column';
        this.fields.count.textContent = count ? `${count} selected` : 'Choose at least one marking';
        if (!count) { this.fields.preview.replaceChildren(); return; }
        const artwork = buildMarkingGroup(this.recipe);
        this.fields.preview.setAttribute('viewBox', `-2 -2 ${artwork.originalWidth + 4} ${artwork.originalHeight + 4}`);
        this.fields.preview.innerHTML = artwork.svgContent;
    }

    apply() {
        if (!this.recipe?.items.some(item => item.enabled)) return false;
        const host = this.host;
        const block = this.editingId ? host.objectDocument.getGraphicsBlock(this.editingId) : null;
        if (host.historyManager !== this.history || (this.editingId && (!block || JSON.stringify(block) !== this.originalBlock))) {
            host.errorPresenter.show(new Error('The layout changed. Reopen Markings to apply your selection.'), { title: 'Could not apply markings' });
            return false;
        }
        const artwork = buildMarkingGroup(this.recipe);
        if (this.height * artwork.originalHeight / 100 > 10000) {
            host.errorPresenter.show(new Error('Reduce the icon height to keep this group within the document size limit.'), { title: 'Marking group is too large' });
            return false;
        }
        const markings = structuredClone(this.recipe);
        const fields = { ...artwork, markings, name: `Markings · ${markingName(markings)}`, sizeMode: 'height',
            heightInModules: this.height * artwork.originalHeight / 100, widthInColumns: null, missingAsset: false };
        let result;
        if (block) {
            host.historyManager.beginAction('edit markings', host.getStateSnapshot());
            delete block.raster;
            Object.assign(block, fields);
            host.objectPlacementController.recalculateGraphicsWidthFromHeight(block);
            host.markAsChanged(); host.updateGrid();
            host.historyManager.commitAction(host.getStateSnapshot());
            result = block;
        } else {
            host.historyManager.beginAction('add markings', host.getStateSnapshot());
            result = host.objectDocument.addGraphicsBlock({ ...fields, surface: host.objectNavigatorController.newObjectSurface() });
            host.objectPlacementController.recalculateGraphicsWidthFromHeight(result);
            host.markAsChanged(); host.updateGrid();
            host.historyManager.commitAction(host.getStateSnapshot());
        }
        this.close({ restoreFocus: false });
        host.objectEditorPanelController.openGraphicsPanel(result.id);
        return result;
    }

    dispose() { this.listeners.dispose(); this.rowListeners.dispose(); this.sliders.dispose(); }
}
