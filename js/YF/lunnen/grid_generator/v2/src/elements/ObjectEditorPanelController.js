import { ListenerScope } from '../core/ListenerScope.js';
import { ObjectEditorPanelView } from './ObjectEditorPanelView.js';
import { PanelPositioner } from './PanelPositioner.js';

/** Coordinates editor panel lifecycle while view and positioning stay isolated. */
export class ObjectEditorPanelController {
    constructor(host, view = null, positioner = null) {
        this.host = host;
        this.view = view || new ObjectEditorPanelView(host);
        this.positioner = positioner || new PanelPositioner();
        this.listeners = new ListenerScope();
        this.outsideClickBound = false;
        this.handleOutsideClick = event => {
            const target = event.target;
            const { paragraphPanel, graphicsPanel } = this.host.dom;
            if (
                paragraphPanel?.classList.contains('active')
                && !paragraphPanel.contains(target)
                && !target.closest('[data-block-id], .element-item, .element-button')
            ) {
                this.closeTextPanel();
            }
            if (
                graphicsPanel?.classList.contains('active')
                && !graphicsPanel.contains(target)
                && !target.closest('[data-block-id], .element-item, #addGraphicsBtn, .element-button')
            ) {
                this.closeGraphicsPanel();
            }
        };
    }

    saveInitialTextState(block) {
        this.host.initialBlockState = {
            x: block.x,
            row: block.row,
            baselineOffset: block.baselineOffset,
            width: block.width,
            content: block.content,
            alignmentMode: block.alignmentMode || 'baseline'
        };
    }

    openTextPanel(blockId) {
        const block = this.host.objectDocument.getTextBlock(blockId);
        if (!block) return false;
        this.host.currentEditingBlock = block;
        this.saveInitialTextState(block);
        this.view.populateText(block);
        this.view.show(this.host.dom.paragraphPanel);
        this.positionNextToBlock(this.host.dom.paragraphPanel, blockId, 'text');
        return true;
    }

    cancelTextChanges() {
        const { currentEditingBlock, initialBlockState } = this.host;
        if (currentEditingBlock && initialBlockState) {
            Object.assign(currentEditingBlock, initialBlockState);
            this.host.updateGrid();
        }
        this.closeTextPanel();
    }

    closeTextPanel() {
        this.host.currentEditingBlock = null;
        this.host.initialBlockState = null;
        this.view.hide(this.host.dom.paragraphPanel);
    }

    openNewGraphicsPanel() {
        this.view.prepareNewGraphics();
        this.view.show(this.host.dom.graphicsPanel);
        this.center(this.host.dom.graphicsPanel);
    }

    openGraphicsPanel(blockId) {
        const block = this.host.objectDocument.getGraphicsBlock(blockId);
        if (!block) return false;
        block.sizeMode ||= 'height';
        if (block.widthInColumns == null) {
            this.host.objectPlacementController.recalculateGraphicsWidthFromHeight(block);
        }
        this.view.populateGraphics(block);
        this.view.show(this.host.dom.graphicsPanel);
        this.positionNextToBlock(this.host.dom.graphicsPanel, blockId, 'graphics');
        this.host.currentEditingGraphicsId = blockId;
        this.host.graphicsEditorInputController.initGraphicsInputs();
        return true;
    }

    closeGraphicsPanel() {
        this.view.hide(this.host.dom.graphicsPanel);
        this.view.resetGraphics();
        this.host.uploadedSvgData = null;
        this.host.currentEditingGraphicsId = null;
    }

    initOutsideClickHandler() {
        if (this.outsideClickBound) return false;
        this.outsideClickBound = true;
        this.listeners.listen(this.view.document, 'click', this.handleOutsideClick);
        return true;
    }

    syncTextStyleSections(block) {
        return this.view.syncTextStyleSections(block);
    }

    updateCharacterCount() {
        return this.view.updateCharacterCount();
    }

    syncVisibilityButton(button, visible) {
        return this.view.syncVisibilityButton(button, visible);
    }

    center(panel) {
        return this.positioner.center(panel);
    }

    positionNextToBlock(panel, blockId, type = 'graphics') {
        return this.positioner.positionNextToBlock(panel, blockId, type);
    }

    getBlockViewportRect(blockId, type = 'graphics') {
        return this.positioner.getBlockViewportRect(blockId, type);
    }

    setPanelPosition(panel, left, top) {
        return this.positioner.setPanelPosition(panel, left, top);
    }

    setValue(control, value) {
        return this.view.setValue(control, value);
    }

    setChecked(control, checked) {
        return this.view.setChecked(control, checked);
    }

    dispose() {
        return this.listeners.dispose();
    }
}
