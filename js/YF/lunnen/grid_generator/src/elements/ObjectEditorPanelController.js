const EYE_PATHS = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
const EYE_SLASH = '<line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
const FEATURE_KEYS = ['salt', 'aalt', 'ss01', 'ss02', 'tnum', 'dlig'];

/** Owns editor panel population, positioning and lifecycle. */
export class ObjectEditorPanelController {
    constructor(host) {
        this.host = host;
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
        const { dom } = this.host;
        const content = String(block.content || '');

        this.host.currentEditingBlock = block;
        this.saveInitialTextState(block);

        if (dom.paragraphPanelTitle) {
            let title = content.trim().slice(0, 24);
            if (content.trim().length > 24) title += '...';
            if (!title) {
                const style = this.host.getStyleDisplayName(block.styleRef);
                const number = this.host.objectDocument.getBlockNumber(blockId)
                    .toString()
                    .padStart(2, '0');
                title = `${style} ${number}`;
            }
            dom.paragraphPanelTitle.textContent = title;
        }

        this.setValue(dom.paragraphStyleSelect, block.styleRef || 'text');
        this.setValue(dom.paragraphSurfaceSelect, block.surface || 'front');
        this.setValue(dom.paragraphXInput, Math.round(block.x));
        this.setValue(dom.paragraphRowInput, block.row + 1);
        this.setValue(
            dom.paragraphBaselineInput,
            this.host.surfaceCoordinates.rowBaselineToY(
                block.row,
                block.baselineOffset,
                block.surface || 'front'
            ) + 1
        );
        this.setValue(
            dom.paragraphWidthInput,
            typeof block.width === 'number' ? block.width.toFixed(2) : block.width
        );
        this.setValue(dom.paragraphTextArea, content);

        this.syncTextStyleSections(block);
        this.setChecked(dom.paragraphLockPositionToggle, block.lockPosition === true);
        this.setChecked(dom.paragraphAlignRightToggle, block.alignment === 'right');
        this.setChecked(dom.textAlignmentLeft, (block.textAlign || 'left') === 'left');
        this.setChecked(dom.textAlignmentCenter, block.textAlign === 'center');
        this.setChecked(dom.textAlignmentRight, block.textAlign === 'right');
        this.updateCharacterCount();
        this.syncVisibilityButton(document.getElementById('paragraphHideBtn'), block.visible !== false);

        if (dom.paragraphPanel) {
            dom.paragraphPanel.style.display = 'flex';
            dom.paragraphPanel.classList.add('active');
            this.positionNextToBlock(dom.paragraphPanel, blockId, 'text');
        }
        return true;
    }

    cancelTextChanges() {
        const { currentEditingBlock, initialBlockState } = this.host;
        if (currentEditingBlock && initialBlockState) {
            currentEditingBlock.x = initialBlockState.x;
            currentEditingBlock.row = initialBlockState.row;
            currentEditingBlock.baselineOffset = initialBlockState.baselineOffset;
            currentEditingBlock.width = initialBlockState.width;
            currentEditingBlock.content = initialBlockState.content;
            currentEditingBlock.alignmentMode = initialBlockState.alignmentMode;
            this.host.updateGrid();
        }

        this.closeTextPanel();
    }

    closeTextPanel() {
        this.host.currentEditingBlock = null;
        this.host.initialBlockState = null;

        const panel = this.host.dom.paragraphPanel;
        if (panel) {
            panel.classList.remove('active');
            panel.style.display = 'none';
        }
    }

    openNewGraphicsPanel() {
        const { dom } = this.host;
        const values = {
            graphicsXInput: 1,
            graphicsRowInput: 1,
            graphicsBaselineInput: 1,
            graphicsWidthInput: '4.00',
            graphicsHeightInput: '3.00'
        };

        Object.entries(values).forEach(([key, value]) => {
            if (dom[key]) dom[key].value = value;
        });

        if (dom.graphicsLockPositionToggle) {
            dom.graphicsLockPositionToggle.checked = false;
        }

        document.getElementById('graphicsHideBtn')?.style.setProperty('display', 'none');
        document.getElementById('graphicsDeleteBtn')?.style.setProperty('display', 'none');

        if (dom.graphicsPanel) {
            dom.graphicsPanel.style.display = 'flex';
            dom.graphicsPanel.classList.add('active');
            this.center(dom.graphicsPanel);
        }
    }

    openGraphicsPanel(blockId) {
        const block = this.host.objectDocument.getGraphicsBlock(blockId);
        if (!block) return false;
        const { dom } = this.host;
        block.sizeMode ||= 'height';
        if (block.widthInColumns == null) {
            this.host.objectPlacementController.recalculateGraphicsWidthFromHeight(block);
        }

        if (dom.graphicsPanelTitle) {
            const name = block.name || 'Graphic';
            dom.graphicsPanelTitle.textContent = name.length > 24
                ? `${name.slice(0, 24)}...`
                : name;
        }

        this.setValue(dom.graphicsSurfaceSelect, block.surface || 'front');
        this.setValue(dom.graphicsXInput, block.x);
        this.setValue(dom.graphicsRowInput, block.row + 1);
        this.setValue(
            dom.graphicsBaselineInput,
            this.host.surfaceCoordinates.rowBaselineToY(
                block.row,
                block.baselineOffset,
                block.surface || 'front'
            ) + 1
        );
        this.setChecked(dom.graphicsSizeModeWidth, block.sizeMode === 'width');
        this.setChecked(dom.graphicsSizeModeHeight, block.sizeMode !== 'width');
        if (dom.graphicsWidthGroup) {
            dom.graphicsWidthGroup.style.display = block.sizeMode === 'width' ? 'flex' : 'none';
        }
        if (dom.graphicsHeightGroup) {
            dom.graphicsHeightGroup.style.display = block.sizeMode === 'height' ? 'flex' : 'none';
        }
        this.setValue(dom.graphicsWidthInput, (block.widthInColumns || 4).toFixed(2));
        this.setValue(dom.graphicsHeightInput, (block.heightInModules || 3).toFixed(2));
        this.setChecked(dom.graphicsLockPositionToggle, block.lockPosition === true);
        this.setChecked(dom.graphicsAlignRightToggle, block.alignment === 'right');

        if (dom.fileUploadArea) {
            dom.fileUploadArea.style.display = 'block';
            const placeholder = dom.fileUploadArea.querySelector('.upload-placeholder p');
            if (placeholder) {
                placeholder.textContent = `Current: ${block.name || 'Graphic'} — Upload new SVG to replace`;
            }
        }

        const hideButton = document.getElementById('graphicsHideBtn');
        const deleteButton = document.getElementById('graphicsDeleteBtn');
        this.syncVisibilityButton(hideButton, block.visible !== false);
        if (hideButton) hideButton.style.display = 'flex';
        if (deleteButton) deleteButton.style.display = 'flex';

        if (dom.graphicsPanel) {
            dom.graphicsPanel.style.display = 'flex';
            dom.graphicsPanel.classList.add('active');
            this.positionNextToBlock(dom.graphicsPanel, blockId, 'graphics');
        }
        this.host.currentEditingGraphicsId = blockId;
        this.host.objectEditorInputController.initGraphicsInputs();
        return true;
    }

    closeGraphicsPanel() {
        const { dom } = this.host;
        if (dom.graphicsPanel) {
            dom.graphicsPanel.classList.remove('active');
            dom.graphicsPanel.style.display = 'none';
        }

        if (dom.svgFileInput) dom.svgFileInput.value = '';

        this.host.uploadedSvgData = null;
        this.host.currentEditingGraphicsId = null;

        if (dom.fileUploadArea) {
            dom.fileUploadArea.style.display = 'block';
            const placeholder = dom.fileUploadArea.querySelector('.upload-placeholder p');
            if (placeholder) {
                placeholder.textContent = 'Click or drag & drop SVG file here';
            }
        }

        if (dom.graphicsPanelTitle) {
            dom.graphicsPanelTitle.textContent = 'Add Graphics';
        }
    }

    initOutsideClickHandler() {
        document.addEventListener('click', event => {
            const target = event.target;
            const { paragraphPanel, graphicsPanel } = this.host.dom;

            if (
                paragraphPanel?.classList.contains('active') &&
                !paragraphPanel.contains(target) &&
                !target.closest('[data-block-id], [data-element-type="text"], .element-button')
            ) {
                this.closeTextPanel();
            }

            if (
                graphicsPanel?.classList.contains('active') &&
                !graphicsPanel.contains(target) &&
                !target.closest('[data-block-id], [data-element-type="graphics"], #addGraphicsBtn, .element-button')
            ) {
                this.closeGraphicsPanel();
            }
        });
    }

    syncTextStyleSections(block) {
        const { dom } = this.host;
        const isDisplay = block.styleRef === 'lunnenDisplay';
        const alignmentSection = document.querySelector(
            '#paragraphPanel .control-group:has([name="alignmentMode"])'
        );
        if (alignmentSection) alignmentSection.style.display = isDisplay ? 'none' : 'block';

        if (!isDisplay) {
            const mode = block.alignmentMode || 'baseline';
            this.setChecked(dom.alignmentModeBaseline, mode === 'baseline');
            this.setChecked(dom.alignmentModeXHeight, mode === 'x-height');
            this.setChecked(dom.alignmentModeCapHeight, mode === 'cap-height');
        }

        const featuresSection = document.getElementById('lunnenDisplayFeaturesSection');
        if (featuresSection) featuresSection.style.display = isDisplay ? 'block' : 'none';
        if (!isDisplay) return;

        this.setValue(document.getElementById('lunnenDisplayWeightSlider'), block.fontWeight || 400);
        this.setValue(document.getElementById('lunnenDisplayWeightValue'), block.fontWeight || 400);
        const features = block.fontFeatures || {};
        FEATURE_KEYS.forEach(key => {
            const suffix = key.charAt(0).toUpperCase() + key.slice(1);
            this.setChecked(document.getElementById(`feature${suffix}`), features[key] === true);
        });
    }

    updateCharacterCount() {
        const { charCounter, paragraphTextArea } = this.host.dom;
        if (!charCounter || !paragraphTextArea) return;
        const count = paragraphTextArea.value.length;
        charCounter.textContent = `${count} ${count === 1 ? 'character' : 'characters'}`;
    }

    syncVisibilityButton(button, visible) {
        const svg = button?.querySelector('svg');
        if (svg) svg.innerHTML = visible ? EYE_PATHS + EYE_SLASH : EYE_PATHS;
    }

    center(panel) {
        if (!panel) return;
        const padding = 16;
        const rect = panel.getBoundingClientRect();
        const width = rect.width || panel.offsetWidth || 0;
        const height = rect.height || panel.offsetHeight || 0;
        const left = Math.max(
            padding,
            Math.min((window.innerWidth - width) / 2, window.innerWidth - width - padding)
        );
        const top = Math.max(
            padding,
            Math.min((window.innerHeight - height) / 2, window.innerHeight - height - padding)
        );
        this.setPanelPosition(panel, left, top);
    }

    positionNextToBlock(panel, blockId, type = 'graphics') {
        if (!panel) return;
        const target = this.getBlockViewportRect(blockId, type);
        if (!target) {
            this.center(panel);
            return;
        }

        const padding = 16;
        const offset = 24;
        const bottomMargin = 80;
        const rect = panel.getBoundingClientRect();
        const width = rect.width || panel.offsetWidth || 0;
        const height = rect.height || panel.offsetHeight || 0;
        const maxLeft = window.innerWidth - width - padding;
        const maxTop = window.innerHeight - height - padding;
        let left = target.right + offset;
        if (left > maxLeft) left = target.left - width - offset;
        left = Math.max(padding, Math.min(left, maxLeft));
        let top = Math.max(padding, Math.min(target.top, maxTop));
        top = Math.min(top, Math.max(padding, window.innerHeight - height - bottomMargin));
        this.setPanelPosition(panel, left, top);
    }

    getBlockViewportRect(blockId, type = 'graphics') {
        if (!blockId) return null;
        if (type === 'text') {
            return document.getElementById(`bounds-${blockId}`)?.getBoundingClientRect() ||
                document.getElementById(`hover-area-${blockId}`)?.getBoundingClientRect() ||
                null;
        }

        const specialId = { icons: 'icons-group', claim: 'claim-group' }[blockId];
        const group = specialId
            ? document.getElementById(specialId)
            : document.getElementById(`graphics-group-${blockId}`);
        if (group?.boundsElement) return group.boundsElement.getBoundingClientRect();
        if (group) return group.getBoundingClientRect();
        return document.querySelector(`[data-block-id="${blockId}"]`)?.getBoundingClientRect() || null;
    }

    setPanelPosition(panel, left, top) {
        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        panel.style.transform = 'none';
    }

    setValue(control, value) {
        if (control) control.value = value;
    }

    setChecked(control, checked) {
        if (control) control.checked = checked;
    }
}
