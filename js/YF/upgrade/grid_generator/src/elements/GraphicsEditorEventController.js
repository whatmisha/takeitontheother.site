import { ListenerScope } from '../core/ListenerScope.js';
import { FileIntakeController } from '../framework/FrameworkAdapter.js';

/** Owns graphics-panel events that mutate the editable graphics document. */
export class GraphicsEditorEventController {
    constructor(host, { documentRef = globalThis.document } = {}) {
        this.host = host;
        this.document = documentRef;
        this.listeners = new ListenerScope();
        this.fileIntake = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return false;
        this.initialized = true;
        this.bindSurfaceSelection();
        this.bindConstraintControls();
        this.bindFileUpload();
        this.bindObjectActions();
        this.bindSizeMode();
        return true;
    }

    getEditingBlock() {
        return this.host.objectDocument.getGraphicsBlock(
            this.host.currentEditingGraphicsId
        );
    }

    mutate(label, callback, { renderNavigator = false } = {}) {
        const block = this.getEditingBlock();
        if (!block) return false;

        this.host.historyManager.beginAction(label, this.host.getStateSnapshot());
        callback(block);
        this.host.markAsChanged();
        if (renderNavigator) this.host.objectNavigatorController.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        return true;
    }

    bindSurfaceSelection() {
        const select = this.host.dom.graphicsSurfaceSelect;
        if (!select) return;

        this.listeners.listen(select, 'change', () => {
            const moved = this.mutate('move graphics to surface', block => {
                this.host.moveBlockToSurface(block, select.value);
                this.host.graphicsEditorInputController.initGraphicsInputs();
            }, { renderNavigator: true });
            return moved;
        });
    }

    bindConstraintControls() {
        const lockToggle = this.host.dom.graphicsLockPositionToggle;
        this.listeners.listen(lockToggle, 'change', () => {
            this.mutate('toggle graphics constraint', block => {
                block.lockPosition = lockToggle.checked;
            });
        });

        const alignRightToggle = this.host.dom.graphicsAlignRightToggle;
        this.listeners.listen(alignRightToggle, 'change', () => {
            this.mutate('change graphics alignment', block => {
                block.alignment = alignRightToggle.checked ? 'right' : 'left';
            });
        });
    }

    bindFileUpload() {
        const { fileUploadArea, svgFileInput, svgFileStatus } = this.host.dom;
        if (!fileUploadArea || !svgFileInput) return;
        this.fileIntake = new FileIntakeController({
            ownerDocument: this.document,
            root: fileUploadArea,
            input: svgFileInput,
            trigger: fileUploadArea,
            dropzone: fileUploadArea,
            status: svgFileStatus,
            accept: '.svg,image/svg+xml',
            initialState: 'empty',
            initialStatus: 'Click or drag & drop SVG file here',
            typeErrorText: 'Choose an SVG file.',
            loadingText: file => `Loading ${file.name || 'SVG'}…`,
            errorText: error => error?.message || 'Could not load this SVG file.',
            onSelect: async file => {
                const block = await this.host.graphicsAssetController.handleFile(file);
                if (!block) throw new Error('This file does not contain a valid SVG.');
                const text = svgFileStatus?.textContent || `✓ ${file.name}`;
                return { block, statusText: text };
            }
        }).init();
    }

    syncFileIntakeState(state, { text = null, preserveText = false } = {}) {
        this.fileIntake?.setState(state, { text, preserveText });
    }

    bindObjectActions() {
        this.listeners.listen(this.document?.getElementById('graphicsHideBtn'), 'click', () => {
            if (!this.host.currentEditingGraphicsId) return;
            this.host.objectNavigatorController.toggleVisibility(
                'graphics',
                this.host.currentEditingGraphicsId
            );
        });

        this.listeners.listen(this.document?.getElementById('graphicsDuplicateBtn'), 'click', () => {
            const block = this.getEditingBlock();
            if (!block) return;
            const type = block.isBuiltIn && (block.id === 'icons' || block.id === 'claim')
                ? block.id
                : 'graphics';
            this.host.objectNavigatorController.duplicate(type, block.id);
        });

        this.listeners.listen(this.document?.getElementById('graphicsDeleteBtn'), 'click', () => {
            const block = this.getEditingBlock();
            if (!block) return;

            const blockId = block.id;
            const name = block.name || 'Graphic';
            this.host.objectEditorPanelController.closeGraphicsPanel();
            const item = this.host.dom.elementsList?.querySelector(
                `[data-element-id="${blockId}"]`
            );
            const deleteButton = item?.parentElement?.querySelector(
                '.element-action-btn:last-child'
            );
            if (deleteButton) {
                this.host.objectNavigatorController.startDelete(
                    deleteButton,
                    'graphics',
                    blockId,
                    name
                );
            }
        });
    }

    bindSizeMode() {
        const { graphicsSizeModeWidth, graphicsSizeModeHeight } = this.host.dom;
        if (!graphicsSizeModeWidth || !graphicsSizeModeHeight) return;

        const handleChange = () => {
            this.mutate('change graphics size mode', block => {
                block.sizeMode = graphicsSizeModeWidth.checked ? 'width' : 'height';
                this.syncSizeModeGroups(block.sizeMode);
                this.recalculateSizeMode(block);
            });
        };
        this.listeners.listen(graphicsSizeModeWidth, 'change', handleChange);
        this.listeners.listen(graphicsSizeModeHeight, 'change', handleChange);
    }

    syncSizeModeGroups(sizeMode) {
        if (this.host.dom.graphicsWidthGroup) {
            this.host.dom.graphicsWidthGroup.style.display =
                sizeMode === 'width' ? 'flex' : 'none';
        }
        if (this.host.dom.graphicsHeightGroup) {
            this.host.dom.graphicsHeightGroup.style.display =
                sizeMode === 'height' ? 'flex' : 'none';
        }
    }

    recalculateSizeMode(block) {
        const surface = block.surface || 'front';
        const context = this.host.getSurfaceGridContext(surface);
        const aspectRatio = block.originalWidth / block.originalHeight;
        if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return;

        if (block.sizeMode === 'width') {
            const heightInMm = context.gridModule * block.heightInModules;
            const widthInMm = heightInMm * aspectRatio;
            block.widthInColumns = Number.parseFloat(
                this.host.mmToColumns(widthInMm, surface).toFixed(2)
            );
            if (this.host.dom.graphicsWidthInput) {
                this.host.dom.graphicsWidthInput.value = block.widthInColumns.toFixed(2);
            }
            return;
        }

        const widthInMm = this.host.columnsToMm(block.widthInColumns, surface);
        const heightInMm = widthInMm / aspectRatio;
        block.heightInModules = Number.parseFloat(
            (heightInMm / context.gridModule).toFixed(2)
        );
        if (this.host.dom.graphicsHeightInput) {
            this.host.dom.graphicsHeightInput.value = block.heightInModules.toFixed(2);
        }
    }

    dispose() {
        this.fileIntake?.destroy();
        this.fileIntake = null;
        return this.listeners.dispose();
    }
}
