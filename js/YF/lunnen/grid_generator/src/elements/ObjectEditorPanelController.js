/**
 * Owns the shared lifecycle of the text and graphics editor panels.
 *
 * Object data remains on GridGenerator while the migration is in progress;
 * this controller keeps DOM cleanup and outside-click behavior in one place.
 */
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
            this.host.centerPanel(dom.graphicsPanel);
        }
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
}
