import { GRAPHICS_TYPES } from './ObjectDocumentController.js';
import { ObjectNavigatorView } from './ObjectNavigatorView.js';
import { ListenerScope } from '../core/ListenerScope.js';
import { cloneJson as clone } from '../utils/cloneJson.js';

/** Owns Objects-panel commands while ObjectNavigatorView owns DOM rendering. */
export class ObjectNavigatorController {
    constructor(host, view = null) {
        this.host = host;
        this.listeners = new ListenerScope();
        this.selectionTimers = new Set();
        this.initialized = false;
        this.clipboardEntry = null;
        this.view = view || new ObjectNavigatorView(host, {
            restorePendingDelete: (...args) => this.restorePendingDelete(...args),
            select: (...args) => this.select(...args),
            showBounds: (...args) => this.showBounds(...args),
            hideBounds: (...args) => this.hideBounds(...args),
            toggleVisibility: (...args) => this.toggleVisibility(...args),
            bringForward: (...args) => this.moveLayer(...args, 'forward'),
            sendBackward: (...args) => this.moveLayer(...args, 'backward'),
            reorder: (...args) => this.reorderLayer(...args),
            duplicate: (...args) => this.duplicate(...args),
            startDelete: (...args) => this.startDelete(...args)
        });
    }

    init() {
        if (this.initialized) return false;
        this.render();
        this.listeners.listen(this.host.dom.addTextBtn, 'click', () => this.addText());
        this.listeners.listen(
            this.host.dom.addGraphicsBtn,
            'click',
            () => this.host.objectEditorPanelController.openNewGraphicsPanel()
        );
        this.initialized = true;
        return true;
    }

    addText(overrides = {}) {
        this.host.historyManager.beginAction('add text block', this.host.getStateSnapshot());
        const block = this.host.objectDocument.addTextBlock(overrides);
        this.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        this.host.markAsChanged?.();
        this.scheduleSelection(() => this.select('text', block.id));
        return block;
    }

    addGraphics(asset = {}) {
        this.host.historyManager.beginAction('add graphics block', this.host.getStateSnapshot());
        const block = this.host.objectDocument.addGraphicsBlock(asset);
        this.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        this.host.markAsChanged?.();
        return block;
    }

    render() {
        const entries = this.host.objectDocument.getLayerEntries({ frontToBack: true });
        const items = entries.map(({ type, block }, index) => ({
            name: type === 'text' ? this.getTextName(block) : (block.name || 'Graphic'),
            type: type === 'text' ? 'text' : this.getGraphicsType(block),
            blockId: block.id,
            visible: block.visible !== false,
            deleting: block.deleting === true,
            canBringForward: index > 0,
            canSendBackward: index < entries.length - 1
        }));
        if (this.view.render(items)) this.host.panelUiController.updatePanelParams();
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
        this.host.markAsChanged?.();
    }

    moveLayer(type, blockId, direction) {
        this.host.historyManager.beginAction(
            direction === 'forward' ? 'bring object forward' : 'send object backward',
            this.host.getStateSnapshot()
        );
        if (!this.host.objectDocument.moveLayer(type, blockId, direction)) {
            this.host.historyManager.cancelAction?.();
            return false;
        }
        this.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        this.host.markAsChanged?.();
        return true;
    }

    reorderLayer(sourceType, sourceId, targetType, targetId, placement) {
        this.host.historyManager.beginAction('reorder objects', this.host.getStateSnapshot());
        const changed = this.host.objectDocument.reorderLayer(
            { type: sourceType, id: sourceId },
            { type: targetType, id: targetId },
            placement
        );
        if (!changed) {
            this.host.historyManager.cancelAction?.();
            return false;
        }
        this.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        this.host.markAsChanged?.();
        return true;
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
        this.host.markAsChanged?.();
        if (!skipSelection && !this.host.textDragState.isDragging) {
            this.scheduleSelection(() => this.select(isText ? 'text' : 'graphics', duplicate.id));
        }
        return duplicate;
    }

    getSelectedObject() {
        const selectedItem = this.host.dom.elementsList?.querySelector('.element-item.active');
        const selectedType = selectedItem?.dataset.elementType;
        const selectedId = selectedItem?.dataset.elementId;
        const selectedBlock = selectedId ? this.getBlock(selectedType, selectedId) : null;
        if (selectedBlock) {
            return {
                type: selectedType === 'text' ? 'text' : 'graphics',
                block: selectedBlock
            };
        }

        const textBlock = this.host.currentEditingBlock;
        if (textBlock && this.host.objectDocument.getTextBlock(textBlock.id)) {
            return { type: 'text', block: textBlock };
        }
        const graphicsBlock = this.host.objectDocument.getGraphicsBlock(
            this.host.currentEditingGraphicsId
        );
        return graphicsBlock ? { type: 'graphics', block: graphicsBlock } : null;
    }

    copySelected() {
        const selected = this.getSelectedObject();
        if (!selected || selected.block.deleting === true) return false;
        this.clipboardEntry = {
            type: selected.type,
            block: clone(selected.block)
        };
        delete this.clipboardEntry.block.deleting;
        return true;
    }

    pasteCopied() {
        if (!this.clipboardEntry) return null;
        const { type, block: source } = clone(this.clipboardEntry);
        this.host.historyManager.beginAction(`paste ${type}`, this.host.getStateSnapshot());
        const pasted = this.host.objectDocument.insertCopy(type, source, block => {
            this.host.objectPlacementController.constrain(block, type);
        });
        if (!pasted) {
            this.host.historyManager.cancelAction?.();
            return null;
        }
        this.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        this.host.markAsChanged?.();
        if (!this.host.textDragState.isDragging) {
            this.scheduleSelection(() => this.select(type, pasted.id));
        }
        return pasted;
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
        this.host.markAsChanged?.();
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
        this.host.markAsChanged?.();
    }

    delete(type, blockId) {
        if (!this.host.objectDocument.remove(type, blockId)) return false;
        this.render();
        this.host.updateGrid();
        this.host.markAsChanged?.();
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

    scheduleSelection(callback) {
        let timer;
        let completedSynchronously = false;
        timer = setTimeout(() => {
            completedSynchronously = true;
            this.selectionTimers.delete(timer);
            callback();
        }, 100);
        if (!completedSynchronously) this.selectionTimers.add(timer);
    }

    dispose() {
        this.selectionTimers.forEach(timer => clearTimeout(timer));
        this.selectionTimers.clear();
        this.view.dispose?.();
        return this.listeners.dispose();
    }
}
