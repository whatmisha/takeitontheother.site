import { GRAPHICS_TYPES } from './ObjectDocumentController.js';
import { ObjectNavigatorView } from './ObjectNavigatorView.js';

/** Owns Objects-panel commands while ObjectNavigatorView owns DOM rendering. */
export class ObjectNavigatorController {
    constructor(host, view = null) {
        this.host = host;
        this.view = view || new ObjectNavigatorView(host, {
            restorePendingDelete: (...args) => this.restorePendingDelete(...args),
            select: (...args) => this.select(...args),
            showBounds: (...args) => this.showBounds(...args),
            hideBounds: (...args) => this.hideBounds(...args),
            toggleVisibility: (...args) => this.toggleVisibility(...args),
            duplicate: (...args) => this.duplicate(...args),
            startDelete: (...args) => this.startDelete(...args)
        });
    }

    init() {
        this.render();
        this.host.dom.addTextBtn?.addEventListener('click', () => this.addText());
        this.host.dom.addGraphicsBtn?.addEventListener('click', () => this.host.objectEditorPanelController.openNewGraphicsPanel());
    }

    addText(overrides = {}) {
        this.host.historyManager.beginAction('add text block', this.host.getStateSnapshot());
        const block = this.host.objectDocument.addTextBlock(overrides);
        this.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        setTimeout(() => this.select('text', block.id), 100);
        return block;
    }

    addGraphics(asset = {}) {
        this.host.historyManager.beginAction('add graphics block', this.host.getStateSnapshot());
        const block = this.host.objectDocument.addGraphicsBlock(asset);
        this.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        return block;
    }

    render() {
        const textItems = this.host.objectDocument.textBlocks.map(block => ({
            name: this.getTextName(block), type: 'text', blockId: block.id,
            visible: block.visible !== false, deleting: block.deleting === true
        }));
        const graphicsItems = this.host.objectDocument.graphicsBlocks.map(block => ({
            name: block.name || 'Graphic', type: this.getGraphicsType(block), blockId: block.id,
            visible: block.visible !== false, deleting: block.deleting === true
        }));
        if (this.view.render([...textItems, ...graphicsItems])) this.host.panelUiController.updatePanelParams();
    }

    getTextName(block) {
        const content = block.content.trim();
        if (content) return content;
        const weight = this.host.getStyleFontWeight(block.styleRef);
        const number = this.host.objectDocument.getBlockNumber(block.id).toString().padStart(2, '0');
        return `${weight} ${number}`;
    }

    getGraphicsType(block) {
        if (!block.isBuiltIn) return 'graphics';
        if (block.id === 'icons') return 'icons';
        if (block.id === 'claim') return 'claim';
        return 'graphics';
    }

    getBlock(type, blockId) { return this.host.objectDocument.getBlock(type, blockId); }

    toggleVisibility(type, blockId) {
        const block = this.getBlock(type, blockId);
        if (!block) return;
        this.host.historyManager.beginAction(`toggle visibility ${type}`, this.host.getStateSnapshot());
        block.visible = block.visible === false;
        this.syncVisibilityItem(blockId, block.visible);
        this.syncOpenGraphicsPanel(blockId, block.visible);
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
    }

    duplicate(type, blockId, skipSelection = false) {
        this.host.historyManager.beginAction(`duplicate ${type}`, this.host.getStateSnapshot());
        const isText = type === 'text';
        const duplicate = this.host.objectDocument.duplicate(type, blockId, block => {
            this.host.objectPlacementController.constrain(block, isText ? 'text' : 'graphics');
        });
        if (!duplicate) {
            this.host.historyManager.cancelAction?.();
            return null;
        }
        this.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        if (!skipSelection && !this.host.textDragState.isDragging) {
            setTimeout(() => this.select(isText ? 'text' : 'graphics', duplicate.id), 100);
        }
        return duplicate;
    }

    startDelete(_button, type, blockId) {
        const block = this.getBlock(type, blockId);
        if (!block) return;
        this.host.historyManager.beginAction(`delete ${type}`, this.host.getStateSnapshot());
        const timerKey = `${type}-${blockId}`;
        if (this.host.deletionTimers[timerKey]) clearTimeout(this.host.deletionTimers[timerKey]);
        block.deleting = true;
        if (type === 'text' && this.host.currentEditingBlock?.id === blockId) {
            this.host.objectEditorPanelController.closeTextPanel();
        } else if (GRAPHICS_TYPES.has(type) && this.host.currentEditingGraphicsId === blockId) {
            this.host.objectEditorPanelController.closeGraphicsPanel();
        }
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        this.host.deletionTimers[timerKey] = setTimeout(() => {
            if (this.getBlock(type, blockId)?.deleting === true) this.delete(type, blockId);
            delete this.host.deletionTimers[timerKey];
        }, 3000);
    }

    restorePendingDelete(type, blockId) {
        const timerKey = `${type}-${blockId}`;
        if (this.host.deletionTimers[timerKey]) {
            clearTimeout(this.host.deletionTimers[timerKey]);
            delete this.host.deletionTimers[timerKey];
        }
        const block = this.getBlock(type, blockId);
        if (block) delete block.deleting;
        this.host.updateGrid();
    }

    delete(type, blockId) {
        if (!this.host.objectDocument.remove(type, blockId)) return false;
        this.render();
        this.host.updateGrid();
        return true;
    }

    select(type, blockId = null) {
        this.view.clearSelection();
        this.highlight(type, blockId);
        if (type === 'text' && blockId) this.host.objectEditorPanelController.openTextPanel(blockId);
        else if (type === 'graphics') this.host.objectEditorPanelController.openGraphicsPanel(blockId || type);
        else if (type === 'icons' || type === 'claim') this.host.objectEditorPanelController.openGraphicsPanel(type);
        this.view.selectItem(type, blockId);
    }

    bindCanvasHover() { return this.view.bindCanvasHover(); }
    getItem(blockId) { return this.view.getItem(blockId); }
    syncVisibilityItem(blockId, visible) { return this.view.syncVisibilityItem(blockId, visible); }
    syncOpenGraphicsPanel(blockId, visible) {
        if (this.host.currentEditingGraphicsId === blockId) this.view.syncOpenGraphicsPanel(visible);
    }
    highlight(type, blockId = null) { return this.view.highlight(type, blockId); }
    showBounds(type, blockId = null) {
        if (!this.host.textDragState.isDragging) return this.view.showBounds(type, blockId);
    }
    hideBounds(type, blockId = null) {
        if (!this.host.textDragState.isDragging) return this.view.hideBounds(type, blockId);
    }
    getBounds(type, blockId) { return this.view.getBounds(type, blockId); }
    setBoundsOpacity(bounds, stroke, fill) { return this.view.setBoundsOpacity(bounds, stroke, fill); }
    createItem(options) { return this.view.createItem(options); }
    createActions(options) { return this.view.createActions(options); }
    createActionButton(title, content) { return this.view.createActionButton(title, content); }
}
