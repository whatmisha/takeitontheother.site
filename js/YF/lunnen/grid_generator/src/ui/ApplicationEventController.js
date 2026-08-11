import { ListenerScope } from '../core/ListenerScope.js';

const VISIBILITY_CONTROLS = [
    ['showColumns', 'showColumns', 'toggle columns'],
    ['showRows', 'showRows', 'toggle rows'],
    ['showBaseline', 'showBaseline', 'toggle baseline'],
    ['showObjects', 'showObjects', 'toggle objects']
];

const TYPOGRAPHY_TOGGLES = [
    ['useXHeight', 'useXHeight', 'toggle x-height'],
    ['useXHeight2', 'useXHeight2', 'toggle x-height 2'],
    ['useXHeightCaption', 'useXHeightCaption', 'toggle x-height caption']
];

const FONT_WEIGHT_CONTROLS = [
    ['headlineStyleDropdown', 'headlineFontWeight', 'change headline font weight'],
    ['textStyleDropdown', 'textFontWeight', 'change text font weight'],
    ['captionStyleDropdown', 'captionFontWeight', 'change caption font weight']
];

export class ApplicationEventController {
    constructor(host, documentRef = document) {
        this.host = host;
        this.document = documentRef;
        this.listeners = new ListenerScope();
        this.bound = false;
        this.handleDocumentKeydown = event => this.handleKeyboard(event);
    }

    bind() {
        if (this.bound) return false;
        this.bound = true;
        this.bindSideVisibility();
        this.host.gridSettingsController.bind();

        VISIBILITY_CONTROLS.forEach(([domKey, setting, label]) => {
            this.bindSettingToggle(this.host.dom[domKey], setting, label, true);
        });
        TYPOGRAPHY_TOGGLES.forEach(([domKey, setting, label]) => {
            this.bindSettingToggle(this.host.dom[domKey], setting, label, false);
        });

        this.host.typographyUnitController.bindButtons();
        this.bindFontWeights();
        this.host.colorPanelController.bind();
        this.bindActionButtons();
        this.listeners.listen(this.document, 'keydown', this.handleDocumentKeydown);
        return true;
    }

    bindSideVisibility() {
        this.listeners.listen(this.host.dom.showSidePanels, 'change', event => {
            this.runAction('toggle side panels', () => {
                this.host.markAsChanged();
                this.host.surfaceManager.setAllSideVisibility(event.target.checked);
                this.host.updateEyeIcon(event.target);
                this.host.syncSurfaceControls();
                this.host.updateGrid();
            });
        });
    }

    bindSettingToggle(input, setting, label, updateEyeIcon) {
        this.listeners.listen(input, 'change', event => {
            this.runAction(label, () => {
                this.host.markAsChanged();
                this.host.settingsModule.set(setting, event.target.checked);
                if (updateEyeIcon) this.host.updateEyeIcon(event.target);
                this.host.updateGrid();
            });
        });
    }

    bindFontWeights() {
        FONT_WEIGHT_CONTROLS.forEach(([elementId, setting, label]) => {
            this.listeners.listen(this.document.getElementById(elementId), 'change', event => {
                this.runAction(label, () => {
                    this.host.settingsModule.set(setting, Number.parseInt(event.target.value, 10));
                    this.host.objectNavigatorController.render();
                    this.host.updateGrid();
                });
            });
        });
    }

    bindActionButtons() {
        this.listeners.listen(
            this.host.dom.exportBtn,
            'click',
            () => this.host.exportController.exportSvg()
        );
        this.listeners.listen(
            this.host.dom.exportPDFBtn,
            'click',
            () => this.host.exportController.exportPdf()
        );
        this.listeners.listen(
            this.host.dom.exportSettingsBtn,
            'click',
            () => this.host.exportController.exportSettings()
        );
        this.listeners.listen(
            this.host.dom.importSettingsBtn,
            'click',
            () => this.openImportPicker()
        );
    }

    openImportPicker() {
        const input = this.document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', event => {
            const [file] = event.target.files || [];
            if (file) this.host.importSettings(file);
        });
        input.click();
    }

    handleKeyboard(event) {
        const key = String(event.key || '').toLowerCase();
        const command = event.ctrlKey || event.metaKey;

        if (command && key === 'e') {
            event.preventDefault();
            this.host.exportController.exportSvg();
            return;
        }

        if (command && key === 'z') {
            event.preventDefault();
            const active = this.document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                active.blur();
            }
            if (event.shiftKey) this.host.redo();
            else this.host.undo();
            return;
        }

        if (!command && (key === 'delete' || key === 'backspace')) {
            this.deleteSelected(event);
        }
    }

    deleteSelected(event) {
        const active = this.document.activeElement;
        const isEditing = active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.isContentEditable
        );
        if (isEditing) return;

        if (this.host.currentEditingBlock) {
            const block = this.host.objectDocument.textBlocks.find(
                item => item.id === this.host.currentEditingBlock.id
            );
            if (!block) return;
            event.preventDefault();
            this.host.objectEditorPanelController.closeTextPanel();
            this.startNavigatorDelete(
                'text',
                block.id,
                `${block.content.substring(0, 30)}${block.content.length > 30 ? '...' : ''}`
            );
            return;
        }

        if (!this.host.currentEditingGraphicsId) return;
        const block = this.host.objectDocument.getGraphicsBlock(
            this.host.currentEditingGraphicsId
        );
        if (!block) return;
        event.preventDefault();
        this.host.objectEditorPanelController.closeGraphicsPanel();
        this.startNavigatorDelete('graphics', block.id, block.name || 'Graphic');
    }

    startNavigatorDelete(type, blockId, name) {
        const elementButton = this.host.dom.elementsList?.querySelector(
            `[data-element-id="${blockId}"]`
        );
        const deleteButton = elementButton?.parentElement?.querySelector(
            '.element-action-btn:last-child'
        );
        if (deleteButton) {
            this.host.objectNavigatorController.startDelete(
                deleteButton,
                type,
                blockId,
                name
            );
        }
    }

    runAction(label, mutation) {
        this.host.historyManager.beginAction(label, this.host.getStateSnapshot());
        mutation();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
    }

    dispose() {
        this.bound = false;
        return this.listeners.dispose();
    }
}
