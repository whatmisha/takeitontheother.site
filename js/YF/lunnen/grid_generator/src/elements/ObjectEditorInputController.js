const TEXT_PRESETS = [
    { label: 'Brand', text: 'Lunnen — бренд компьютерной техники и аксессуаров, придуманный в Яндекс Фабрике. Сопровождает в исследованиях, работе и развлечениях.' },
    { label: 'Outer', text: 'Продвинутая линейка Lunnen Outer для исследований неизведанного. Эффективные технологии для работы с графикой или развлечений разного уровня сложностей.' },
    { label: 'Ground', text: 'Базовая линейка Lunnen Ground для решения земных задач. Всё необходимое для повседневной работы: от прочного корпуса до современных технологий.' },
    { label: 'Airis', text: 'Lunnen Airis — лёгкая линейка с мощными возможностями. Справляется с тяжёлыми задачами и расширяет границы невесомости.' },
    { label: 'Work', text: 'Серия аксессуаров для компьютерной техники Lunnen Work — подходит для работы и повседневных задач.' },
    { label: 'Изготовитель', text: 'Изготовитель: Винд Мобилити Текнолоджи (Пекин) Лимитед. Адрес: офис 11605, 13 этаж, корпус 1, дом 2, переулок Наньчжугань, район Дунчэн, Пекин, Китай. Сделано в Китае.' },
    { label: 'Маркет.Трейд', text: 'Импортёр/Организация, принимающая претензии на территории РФ: ООО «Маркет. Трейд». Адрес: 121099, Россия, г. Москва, Новинский б-р, д. 8. Info@lunnen.pro' },
    { label: 'Сайберстор', text: 'Импортёр/Организация, принимающая претензии на территории РФ: ООО «САЙБЕРСТОР». Адрес импортёра: 123112, Россия, г. Москва, вн.тер.г. Муниципальный Округ Пресненский, 1-й Красногвардейский, д. 21, стр. 1. Info@lunnen.pro' }
].map(preset => ({ ...preset, text: preset.text.replace(/ {2,}/g, ' ') }));

/** Owns text content, style selection, presets and object-level actions. */
export class ObjectEditorInputController {
    constructor(host, { documentRef = globalThis.document } = {}) {
        this.host = host;
        this.document = documentRef;
    }

    initTextEditor() {
        this.bindTextArea();
        this.initTextPresetChips();
        this.bindStyleSelect();
        this.bindObjectActions();
    }

    mutate(label, callback, { renderNavigator = false } = {}) {
        const block = this.host.currentEditingBlock;
        if (!block) return false;
        this.host.historyManager.beginAction(label, this.host.getStateSnapshot());
        callback(block);
        this.host.markAsChanged();
        if (renderNavigator) this.host.objectNavigatorController.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        return true;
    }

    bindTextArea() {
        const textarea = this.host.dom.paragraphTextArea;
        if (!textarea) return;

        textarea.addEventListener('focus', () => {
            this.host.historyManager.beginAction(
                'edit text content',
                this.host.getStateSnapshot()
            );
        });
        textarea.addEventListener('keydown', event => {
            if ((event.key === 'Enter' || event.key === ' ') && event.shiftKey) {
                event.preventDefault();
                this.insertAtSelection(textarea, '\n');
            } else if (event.key === ' ' && (event.altKey || event.metaKey)) {
                event.preventDefault();
                this.insertAtSelection(textarea, '\u00A0');
            } else if (event.key === 'Enter') {
                event.preventDefault();
                textarea.blur();
            }
        });
        textarea.addEventListener('blur', () => {
            const block = this.host.currentEditingBlock;
            if (block) {
                block.content = textarea.value;
                this.host.markAsChanged();
                this.host.objectEditorPanelController.updateCharacterCount();
                this.host.objectNavigatorController.render();
                this.host.updateGrid();
            }
            this.host.historyManager.commitAction(this.host.getStateSnapshot());
        });
    }

    insertAtSelection(textarea, text) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start)
            + text
            + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        this.host.objectEditorPanelController.updateCharacterCount();
    }

    bindStyleSelect() {
        const select = this.host.dom.paragraphStyleSelect;
        select?.addEventListener('change', () => {
            this.mutate('change text style', block => {
                block.styleRef = select.value;
                this.syncStyleSections(select.value);
            }, { renderNavigator: true });
        });
    }

    syncStyleSections(styleRef) {
        const isDisplay = styleRef === 'lunnenDisplay';
        const features = this.document?.getElementById('lunnenDisplayFeaturesSection');
        if (features) features.style.display = isDisplay ? 'block' : 'none';
        const alignment = this.document?.querySelector(
            '#paragraphPanel .control-group:has([name="alignmentMode"])'
        );
        if (alignment) alignment.style.display = isDisplay ? 'none' : 'block';
    }

    bindObjectActions() {
        const hideButton = this.document?.getElementById('paragraphHideBtn');
        hideButton?.addEventListener('click', () => {
            const block = this.host.currentEditingBlock;
            if (!block) return;
            this.host.objectNavigatorController.toggleVisibility('text', block.id);
            this.host.objectEditorPanelController.syncVisibilityButton(
                hideButton,
                block.visible !== false
            );
        });

        this.document?.getElementById('paragraphDuplicateBtn')?.addEventListener(
            'click',
            () => {
                const block = this.host.currentEditingBlock;
                if (block) this.host.objectNavigatorController.duplicate('text', block.id);
            }
        );

        this.document?.getElementById('paragraphDeleteBtn')?.addEventListener(
            'click',
            () => this.deleteCurrentBlock()
        );
    }

    deleteCurrentBlock() {
        const block = this.host.currentEditingBlock;
        if (!block) return;
        const name = block.content.substring(0, 30)
            + (block.content.length > 30 ? '...' : '');
        const item = this.host.dom.elementsList?.querySelector(
            `[data-element-id="${block.id}"]`
        );
        const deleteButton = item?.parentElement?.querySelector(
            '.element-action-btn:last-child'
        );
        this.host.objectEditorPanelController.closeTextPanel();
        if (deleteButton) {
            this.host.objectNavigatorController.startDelete(
                deleteButton,
                'text',
                block.id,
                name
            );
        }
    }

    initTextPresetChips() {
        const container = this.document?.getElementById('textPresetChips');
        if (!container) return;
        const plusSvg = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

        TEXT_PRESETS.forEach(preset => {
            const button = this.document.createElement('button');
            button.className = 'text-preset-chip';
            button.type = 'button';
            button.setAttribute('aria-label', `Insert text: ${preset.label}`);
            button.innerHTML = `${plusSvg}<span>${preset.label}</span>`;
            button.addEventListener('click', () => {
                if (!this.host.dom.paragraphTextArea) return;
                this.mutate(`insert text preset: ${preset.label}`, block => {
                    this.host.dom.paragraphTextArea.value = preset.text;
                    block.content = preset.text;
                    this.host.objectEditorPanelController.updateCharacterCount();
                }, { renderNavigator: true });
            });
            container.appendChild(button);
        });
    }
}
