import test from 'node:test';
import assert from 'node:assert/strict';

import { ObjectEditorPanelController } from '../src/elements/ObjectEditorPanelController.js';

function createPanel() {
    const classes = new Set(['active']);
    return {
        style: { display: 'flex' },
        classList: {
            add: value => classes.add(value),
            remove: value => classes.delete(value),
            contains: value => classes.has(value)
        },
        contains: () => false
    };
}

test('text editor cancellation restores the saved object state', () => {
    const paragraphPanel = createPanel();
    const block = {
        x: 2,
        row: 3,
        baselineOffset: 4,
        width: 5,
        content: 'Original',
        alignmentMode: 'x-height'
    };
    let renders = 0;
    const host = {
        dom: { paragraphPanel },
        currentEditingBlock: block,
        initialBlockState: null,
        updateGrid: () => { renders += 1; }
    };
    const controller = new ObjectEditorPanelController(host);

    controller.saveInitialTextState(block);
    Object.assign(block, {
        x: 7,
        row: 8,
        baselineOffset: 9,
        width: 2,
        content: 'Changed',
        alignmentMode: 'cap-height'
    });
    controller.cancelTextChanges();

    assert.deepEqual(block, {
        x: 2,
        row: 3,
        baselineOffset: 4,
        width: 5,
        content: 'Original',
        alignmentMode: 'x-height'
    });
    assert.equal(renders, 1);
    assert.equal(host.currentEditingBlock, null);
    assert.equal(host.initialBlockState, null);
    assert.equal(paragraphPanel.style.display, 'none');
    assert.equal(paragraphPanel.classList.contains('active'), false);
});

test('graphics editor lifecycle resets transient UI and editing state', () => {
    const graphicsPanel = createPanel();
    graphicsPanel.classList.remove('active');
    graphicsPanel.style.display = 'none';
    const placeholder = { textContent: 'Uploaded' };
    const fileUploadArea = {
        style: { display: 'none' },
        querySelector: () => placeholder
    };
    const graphicsHideBtn = { style: { setProperty(name, value) { this[name] = value; } } };
    const graphicsDeleteBtn = { style: { setProperty(name, value) { this[name] = value; } } };
    const previousDocument = globalThis.document;
    globalThis.document = {
        getElementById: id => ({ graphicsHideBtn, graphicsDeleteBtn })[id] || null
    };

    try {
        let centeredPanel = null;
        const host = {
            dom: {
                graphicsPanel,
                graphicsXInput: {},
                graphicsRowInput: {},
                graphicsBaselineInput: {},
                graphicsWidthInput: {},
                graphicsHeightInput: {},
                graphicsLockPositionToggle: { checked: true },
                svgFileInput: { value: 'graphic.svg' },
                fileUploadArea,
                graphicsPanelTitle: { textContent: 'Graphic' }
            },
            uploadedSvgData: { content: '<svg />' },
            currentEditingGraphicsId: 'graphic-1',
            centerPanel: panel => { centeredPanel = panel; }
        };
        const controller = new ObjectEditorPanelController(host);

        controller.openNewGraphicsPanel();
        assert.equal(host.dom.graphicsWidthInput.value, '4.00');
        assert.equal(host.dom.graphicsHeightInput.value, '3.00');
        assert.equal(host.dom.graphicsLockPositionToggle.checked, false);
        assert.equal(graphicsPanel.classList.contains('active'), true);
        assert.equal(centeredPanel, graphicsPanel);
        assert.equal(graphicsHideBtn.style.display, 'none');
        assert.equal(graphicsDeleteBtn.style.display, 'none');

        controller.closeGraphicsPanel();
        assert.equal(graphicsPanel.style.display, 'none');
        assert.equal(graphicsPanel.classList.contains('active'), false);
        assert.equal(host.dom.svgFileInput.value, '');
        assert.equal(host.uploadedSvgData, null);
        assert.equal(host.currentEditingGraphicsId, null);
        assert.equal(fileUploadArea.style.display, 'block');
        assert.equal(placeholder.textContent, 'Click or drag & drop SVG file here');
        assert.equal(host.dom.graphicsPanelTitle.textContent, 'Add Graphics');
    } finally {
        globalThis.document = previousDocument;
    }
});
