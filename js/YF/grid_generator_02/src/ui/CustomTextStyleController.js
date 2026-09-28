import { ListenerScope } from '../core/ListenerScope.js';
import { SliderController } from './SliderController.js';
import { MathUtils } from '../utils/MathUtils.js';
import { allTextStyles, uniqueStyleName, MAX_CUSTOM_TEXT_STYLES } from '../elements/CustomTextStyles.js';

/** Document styles reuse the existing typography sections and numeric controls. */
export class CustomTextStyleController {
    constructor(host, documentRef = document) {
        this.host = host;
        this.document = documentRef;
        this.listeners = new ListenerScope();
        this.entries = new Map();
        this.copyFrom = documentRef.getElementById('newStyleSource');
        this.addButton = documentRef.getElementById('addTextStyle');
        this.anchor = documentRef.getElementById('addTextStyleSection');
        this.listeners.listen(this.addButton, 'click', () => this.add(this.copyFrom.value));
        this.sync();
    }

    get styles() { return this.host.settingsModule.get('customTextStyles') || []; }
    begin(label) { this.host.historyManager.beginAction(label, this.host.getStateSnapshot()); }
    commit() { this.host.historyManager.commitAction(this.host.getStateSnapshot()); }
    refresh() {
        this.host.markAsChanged();
        this.sync();
        this.host.updateGrid();
        this.host.panelUiController.updatePanelParams();
    }
    mutate(label, change) {
        this.begin(label);
        change();
        this.refresh();
        this.commit();
    }
    setStyles(styles) { this.host.settingsModule.set('customTextStyles', styles); }

    add(sourceId = 'text') {
        if (this.styles.length >= MAX_CUSTOM_TEXT_STYLES) return;
        const source = allTextStyles(this.host.settingsModule).find(style => style.id === sourceId);
        if (!source) return;
        const { id: ignoredId, name: ignoredName, ...definition } = this.host.textStyleResolver.getDefinition(sourceId);
        const id = `custom-${globalThis.crypto.randomUUID()}`;
        this.mutate('add text style', () => this.setStyles([...this.styles, {
            ...definition, id, name: uniqueStyleName(`${source.name} copy`, allTextStyles(this.host.settingsModule))
        }]));
        const entry = this.entries.get(id);
        this.setExpanded(entry, true);
        entry.fields.name.focus();
        entry.fields.name.select();
        entry.section.scrollIntoView({ block: 'start' });
        return id;
    }

    update(id, patch, grouped = false) {
        const current = this.styles.find(style => style.id === id);
        if (!current || Object.entries(patch).every(([key, value]) => current[key] === value)) return;
        const change = () => this.setStyles(this.styles.map(style => style.id === id ? { ...style, ...patch } : style));
        if (grouped) { change(); this.refresh(); }
        else this.mutate('edit text style', change);
    }

    remove(id, replacement) {
        if (replacement === id || !allTextStyles(this.host.settingsModule).some(style => style.id === replacement)) return;
        this.mutate('delete text style and replace references', () => {
            for (const block of this.host.objectDocument.textBlocks) {
                if (block.styleRef === id) block.styleRef = replacement;
            }
            this.setStyles(this.styles.filter(style => style.id !== id));
        });
        const block = this.host.currentEditingBlock;
        if (block) this.host.objectEditorPanelController.openTextPanel(block.id);
        this.addButton.focus();
    }

    syncOptions(select, styles, fallback = 'text') {
        if (!select) return;
        const signature = JSON.stringify(styles.map(({ id, name }) => [id, name]));
        if (select.dataset.styles !== signature) {
            const value = select.value;
            select.replaceChildren(...styles.map(style => {
                const option = this.document.createElement('option');
                option.value = style.id; option.textContent = style.name;
                return option;
            }));
            select.value = styles.some(style => style.id === value) ? value : fallback;
            select.dataset.styles = signature;
        }
    }

    sync() {
        const all = allTextStyles(this.host.settingsModule);
        this.syncOptions(this.copyFrom, all);
        this.syncOptions(this.host.dom.paragraphStyleSelect, all);
        if (this.host.currentEditingBlock) this.host.dom.paragraphStyleSelect.value = this.host.currentEditingBlock.styleRef;
        this.addButton.disabled = this.styles.length >= MAX_CUSTOM_TEXT_STYLES;
        for (const [id, entry] of this.entries) {
            if (!this.styles.some(style => style.id === id)) {
                entry.listeners.dispose(); entry.sliders.dispose(); entry.section.remove();
                this.entries.delete(id);
            }
        }
        for (const style of this.styles) {
            const entry = this.entries.get(style.id) || this.createSection(style.id);
            this.syncSection(entry, style, all);
        }
        let next = this.anchor;
        for (const style of [...this.styles].reverse()) {
            const section = this.entries.get(style.id).section;
            if (section.nextElementSibling !== next) next.before(section);
            next = section;
        }
    }

    createSection(id) {
        const section = this.document.getElementById('customTextStyleTemplate').content.firstElementChild.cloneNode(true);
        section.dataset.customStyle = id;
        const fields = Object.fromEntries([...section.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
        const entry = { section, fields, listeners: new ListenerScope(), sliders: new SliderController(this.host.settingsModule), editing: false };
        this.entries.set(id, entry);
        this.anchor.before(section);
        const listen = (el, type, fn, options) => entry.listeners.listen(el, type, fn, options);
        const start = () => { if (!entry.editing) { this.begin('adjust text style'); entry.editing = true; } };
        const finish = () => { if (entry.editing) { entry.editing = false; entry.inputKey = null; this.commit(); } };
        const toggle = () => this.setExpanded(entry, fields.toggle.getAttribute('aria-expanded') !== 'true');
        listen(fields.header, 'click', toggle);
        listen(fields.header, 'mousedown', event => event.stopPropagation());
        listen(fields.name, 'input', () => fields.name.setCustomValidity(''));
        listen(fields.name, 'blur', () => {
            const name = fields.name.value.trim();
            const duplicate = allTextStyles(this.host.settingsModule).some(style => style.id !== id && style.name.toLocaleLowerCase() === name.toLocaleLowerCase());
            if (!name || duplicate) {
                fields.name.setCustomValidity(duplicate ? 'Choose a unique style name.' : 'Enter a style name.');
                fields.name.reportValidity();
                fields.name.value = this.styles.find(style => style.id === id).name;
                return;
            }
            if (name !== this.styles.find(style => style.id === id).name) this.update(id, { name });
        });
        listen(fields.name, 'keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); fields.name.blur(); }
        });
        for (const key of ['fontFamily', 'fontWeight', 'useXHeight']) {
            listen(fields[key], 'change', () => this.update(id, {
                [key]: key === 'useXHeight' ? fields[key].checked : key === 'fontWeight' ? Number(fields[key].value) : fields[key].value,
                ...(key === 'fontFamily' ? { fontWeight: 400 } : {})
            }));
        }
        for (const [key, max, step] of [['size', 25, 0.01], ['lineHeight', 50, 0.01], ['tracking', 0.1, 0.001]]) {
            const slider = fields[`${key}Slider`], input = fields[key];
            slider.id = `${id}-${key}-slider`; input.id = `${id}-${key}-value`;
            input.closest('label').htmlFor = slider.id;
            for (const unit of ['mod', 'pt']) fields[`${key}-${unit}`]?.setAttribute('aria-label', `${key === 'size' ? 'Style size' : 'Style line height'} in ${unit}`);
            entry.sliders.initSlider(slider.id, {
                valueId: input.id, min: key === 'tracking' ? -10 : 0.000001, max,
                decimals: 3, baseStep: step, shiftStep: key === 'tracking' ? 0.01 : 1,
                onUpdate: value => {
                    const unit = this.host.settingsModule.get(key === 'size' ? 'fontSizeUnit' : 'lineHeightUnit');
                    const modules = entry.inputKey === key && value === entry.inputValue ? entry.originalValue : key === 'tracking' || unit !== 'pt' ? value : key === 'size'
                        ? this.host.textStyleResolver.fontSizeMmToModules(MathUtils.ptToMm(value), id)
                        : MathUtils.ptToMm(value) / this.host.settingsModule.get('gridModule');
                    this.update(id, { [key]: key === 'tracking' ? modules : Math.min(10000, Math.max(0.000001, modules)) }, entry.editing);
                }
            });
            listen(slider, 'pointerdown', start);
            listen(slider, 'keydown', event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) start(); });
            listen(slider, 'change', finish);
            listen(slider, 'blur', finish);
            listen(input, 'focus', () => {
                entry.inputKey = key; entry.inputValue = Number(input.value);
                entry.originalValue = this.styles.find(style => style.id === id)[key];
                start();
            });
            listen(input, 'blur', finish);
        }
        for (const key of ['size', 'lineHeight']) {
            for (const unit of ['mod', 'pt']) listen(fields[`${key}-${unit}`], 'click', () => {
                this.host.typographyUnitController.switchUnit('text', key, unit);
                this.sync();
            });
        }
        listen(fields.duplicate, 'click', () => this.add(id));
        listen(fields.delete, 'click', () => {
            const count = this.host.objectDocument.textBlocks.filter(block => block.styleRef === id).length;
            if (!count) { this.remove(id, 'text'); return; }
            fields.deleteMessage.textContent = `Used by ${count} text object${count === 1 ? '' : 's'}. Replace with:`;
            fields.deleteOptions.hidden = false;
            fields.replacement.focus();
        });
        listen(fields.cancelDelete, 'click', () => { fields.deleteOptions.hidden = true; });
        listen(fields.confirmDelete, 'click', () => this.remove(id, fields.replacement.value));
        return entry;
    }

    setExpanded(entry, expanded) {
        entry.fields.toggle.setAttribute('aria-expanded', String(expanded));
        entry.fields.content.classList.toggle('collapsed', !expanded);
    }

    syncSection(entry, style, all) {
        const { fields } = entry, settings = this.host.settingsModule;
        fields.title.textContent = style.name;
        fields.toggle.setAttribute('aria-label', `Toggle ${style.name} settings`);
        const pt = value => Math.round(MathUtils.mmToPt(value) * 10) / 10;
        fields.summary.textContent = `${pt(this.host.textStyleResolver.calculateFontSize(style.id))}/${pt(style.lineHeight * settings.get('gridModule'))} pt`;
        const weights = style.fontFamily === 'Lunnen Display'
            ? [100, 200, 300, 400] : [400, 500];
        if (!weights.includes(style.fontWeight)) weights.push(style.fontWeight);
        this.syncOptions(fields.fontWeight, weights.map(weight => ({ id: String(weight), name: weight === 400 ? 'Regular' : weight === 500 ? 'Medium' : String(weight) })), String(style.fontWeight));
        for (const key of ['name', 'fontFamily', 'fontWeight']) {
            if (this.document.activeElement !== fields[key]) fields[key].value = style[key];
        }
        fields.useXHeight.checked = style.useXHeight;
        for (const key of ['size', 'lineHeight', 'tracking']) {
            const unit = key === 'tracking' ? 'em' : settings.get(key === 'size' ? 'fontSizeUnit' : 'lineHeightUnit');
            const value = unit !== 'pt' ? style[key] : MathUtils.mmToPt(key === 'size'
                ? this.host.textStyleResolver.calculateFontSize(style.id)
                : style.lineHeight * settings.get('gridModule'));
            const data = entry.sliders.sliders.get(fields[`${key}Slider`].id);
            // Updating limits here must never write rounded display values back into the document.
            data.config.max = Math.max(unit === 'pt' ? 500 : key === 'tracking' ? 0.1 : key === 'size' ? 25 : 50, value);
            data.element.max = data.config.max;
            if (key === 'tracking') { data.config.min = Math.min(-0.1, value); data.element.min = data.config.min; }
            if (this.document.activeElement !== fields[key] && this.document.activeElement !== data.element) {
                entry.sliders.setValue(data.element.id, value, false);
            }
            if (key !== 'tracking') for (const candidate of ['mod', 'pt']) {
                fields[`${key}-${candidate}`].classList.toggle('active', unit === candidate);
            }
        }
        this.syncOptions(fields.replacement, all.filter(other => other.id !== style.id));
    }

    dispose() {
        this.listeners.dispose();
        for (const entry of this.entries.values()) {
            entry.listeners.dispose(); entry.sliders.dispose(); entry.section.remove();
        }
        this.entries.clear();
    }
}
