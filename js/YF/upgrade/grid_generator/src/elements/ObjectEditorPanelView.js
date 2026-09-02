const EYE_PATHS = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
const EYE_SLASH = '<line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
const FEATURE_KEYS = ['salt', 'aalt', 'ss01', 'ss02', 'tnum', 'dlig'];

/** Reads and writes editor-panel controls without owning document mutations. */
export class ObjectEditorPanelView {
    constructor(host, documentRef = globalThis.document) {
        this.host = host;
        this.document = documentRef;
    }

    populateText(block) {
        const { dom } = this.host;
        const content = String(block.content || '');
        if (dom.paragraphPanelTitle) dom.paragraphPanelTitle.textContent = this.getTextTitle(block, content);
        this.setValue(dom.paragraphStyleSelect, block.styleRef || 'text');
        this.setValue(dom.paragraphSurfaceSelect, block.surface || 'front');
        this.setValue(dom.paragraphXInput, Math.round(block.x));
        this.setValue(dom.paragraphRowInput, block.row + 1);
        this.setValue(dom.paragraphBaselineInput, this.host.surfaceCoordinates.rowBaselineToY(
            block.row,
            block.baselineOffset,
            block.surface || 'front'
        ) + 1);
        this.setValue(dom.paragraphWidthInput, typeof block.width === 'number' ? block.width.toFixed(2) : block.width);
        this.setValue(dom.paragraphTextArea, content);
        this.syncTextStyleSections(block);
        this.setChecked(dom.paragraphLockPositionToggle, block.lockPosition === true);
        this.setChecked(dom.paragraphAlignRightToggle, block.alignment === 'right');
        this.setChecked(dom.textAlignmentLeft, (block.textAlign || 'left') === 'left');
        this.setChecked(dom.textAlignmentCenter, block.textAlign === 'center');
        this.setChecked(dom.textAlignmentRight, block.textAlign === 'right');
        this.updateCharacterCount();
        this.syncVisibilityButton(this.document.getElementById('paragraphHideBtn'), block.visible !== false);
    }

    getTextTitle(block, content) {
        let title = content.trim().slice(0, 24);
        if (content.trim().length > 24) title += '...';
        if (title) return title;
        const style = this.host.getStyleDisplayName(block.styleRef);
        const number = this.host.objectDocument.getBlockNumber(block.id).toString().padStart(2, '0');
        return `${style} ${number}`;
    }

    prepareNewGraphics() {
        const { dom } = this.host;
        Object.entries({
            graphicsXInput: 1,
            graphicsRowInput: 1,
            graphicsBaselineInput: 1,
            graphicsWidthInput: '4.00',
            graphicsHeightInput: '3.00'
        }).forEach(([key, value]) => this.setValue(dom[key], value));
        this.setChecked(dom.graphicsLockPositionToggle, false);
        const placeholder = dom.fileUploadArea?.querySelector('.upload-placeholder p');
        if (placeholder) placeholder.textContent = 'Click or drag & drop SVG file here';
        this.host.syncGraphicsFileIntake?.('empty', {
            text: 'Click or drag & drop SVG file here'
        });
        this.document.getElementById('graphicsHideBtn')?.style.setProperty('display', 'none');
        this.document.getElementById('graphicsDeleteBtn')?.style.setProperty('display', 'none');
    }

    populateGraphics(block) {
        const { dom } = this.host;
        if (dom.graphicsPanelTitle) {
            const name = block.name || 'Graphic';
            dom.graphicsPanelTitle.textContent = name.length > 24 ? `${name.slice(0, 24)}...` : name;
        }
        this.setValue(dom.graphicsSurfaceSelect, block.surface || 'front');
        this.setValue(dom.graphicsXInput, block.x);
        this.setValue(dom.graphicsRowInput, block.row + 1);
        this.setValue(dom.graphicsBaselineInput, this.host.surfaceCoordinates.rowBaselineToY(
            block.row,
            block.baselineOffset,
            block.surface || 'front'
        ) + 1);
        this.setChecked(dom.graphicsSizeModeWidth, block.sizeMode === 'width');
        this.setChecked(dom.graphicsSizeModeHeight, block.sizeMode !== 'width');
        if (dom.graphicsWidthGroup) dom.graphicsWidthGroup.style.display = block.sizeMode === 'width' ? 'flex' : 'none';
        if (dom.graphicsHeightGroup) dom.graphicsHeightGroup.style.display = block.sizeMode === 'height' ? 'flex' : 'none';
        this.setValue(dom.graphicsWidthInput, (block.widthInColumns || 4).toFixed(2));
        this.setValue(dom.graphicsHeightInput, (block.heightInModules || 3).toFixed(2));
        this.setChecked(dom.graphicsLockPositionToggle, block.lockPosition === true);
        this.setChecked(dom.graphicsAlignRightToggle, block.alignment === 'right');
        if (dom.fileUploadArea) {
            dom.fileUploadArea.style.display = 'block';
            const placeholder = dom.fileUploadArea.querySelector('.upload-placeholder p');
            const text = `Current: ${block.name || 'Graphic'} — Upload new SVG to replace`;
            if (placeholder) placeholder.textContent = text;
            this.host.syncGraphicsFileIntake?.('ready', { text });
        }
        const hideButton = this.document.getElementById('graphicsHideBtn');
        const deleteButton = this.document.getElementById('graphicsDeleteBtn');
        this.syncVisibilityButton(hideButton, block.visible !== false);
        if (hideButton) hideButton.style.display = 'flex';
        if (deleteButton) deleteButton.style.display = 'flex';
    }

    resetGraphics() {
        const { dom } = this.host;
        if (dom.svgFileInput) dom.svgFileInput.value = '';
        if (dom.fileUploadArea) {
            dom.fileUploadArea.style.display = 'block';
            const placeholder = dom.fileUploadArea.querySelector('.upload-placeholder p');
            const text = 'Click or drag & drop SVG file here';
            if (placeholder) placeholder.textContent = text;
            this.host.syncGraphicsFileIntake?.('empty', { text });
        }
        if (dom.graphicsPanelTitle) dom.graphicsPanelTitle.textContent = 'Add Graphics';
    }

    show(panel) {
        if (!panel) return;
        panel.style.display = 'flex';
        panel.classList.add('active');
    }

    hide(panel) {
        if (!panel) return;
        panel.classList.remove('active');
        panel.style.display = 'none';
    }

    syncTextStyleSections(block) {
        const { dom } = this.host;
        const isDisplay = block.styleRef === 'lunnenDisplay';
        const alignmentSection = this.document.querySelector('#paragraphPanel .control-group:has([name="alignmentMode"])');
        if (alignmentSection) alignmentSection.style.display = isDisplay ? 'none' : 'block';
        if (!isDisplay) {
            const mode = block.alignmentMode || 'baseline';
            this.setChecked(dom.alignmentModeBaseline, mode === 'baseline');
            this.setChecked(dom.alignmentModeXHeight, mode === 'x-height');
            this.setChecked(dom.alignmentModeCapHeight, mode === 'cap-height');
        }
        const featuresSection = this.document.getElementById('lunnenDisplayFeaturesSection');
        if (featuresSection) featuresSection.style.display = isDisplay ? 'block' : 'none';
        if (!isDisplay) return;
        this.setValue(this.document.getElementById('lunnenDisplayWeightSlider'), block.fontWeight || 400);
        this.setValue(this.document.getElementById('lunnenDisplayWeightValue'), block.fontWeight || 400);
        const features = block.fontFeatures || {};
        FEATURE_KEYS.forEach(key => {
            const suffix = key.charAt(0).toUpperCase() + key.slice(1);
            this.setChecked(this.document.getElementById(`feature${suffix}`), features[key] === true);
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

    setValue(control, value) {
        if (control) control.value = value;
    }

    setChecked(control, checked) {
        if (control) control.checked = checked;
    }
}
