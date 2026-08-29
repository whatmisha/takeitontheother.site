import test from 'node:test';
import assert from 'node:assert/strict';

import { ObjectEditorPanelController } from '../src/elements/ObjectEditorPanelController.js';

function createPanel() {
    const classes = new Set(['active']);
    return {
        style: { display: 'flex' },
        offsetWidth: 320,
        offsetHeight: 240,
        getBoundingClientRect: () => ({ width: 320, height: 240 }),
        classList: {
            add: value => classes.add(value),
            remove: value => classes.delete(value),
            contains: value => classes.has(value)
        },
        contains: () => false
    };
}

test('opening a text editor populates controls and positions the panel', () => {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const paragraphPanel = createPanel();
    const hideIcon = { innerHTML: '' };
    const hideButton = { querySelector: () => hideIcon };
    const controls = {
        paragraphPanelTitle: {},
        paragraphStyleSelect: {},
        paragraphSurfaceSelect: {},
        paragraphXInput: {},
        paragraphRowInput: {},
        paragraphBaselineInput: {},
        paragraphWidthInput: {},
        paragraphTextArea: { value: '' },
        paragraphLockPositionToggle: {},
        paragraphAlignRightToggle: {},
        textAlignmentLeft: {},
        textAlignmentCenter: {},
        textAlignmentRight: {},
        charCounter: {},
        paragraphPanel
    };
    const extraControls = {
        paragraphHideBtn: hideButton,
        lunnenDisplayFeaturesSection: { style: {} },
        lunnenDisplayWeightSlider: {},
        lunnenDisplayWeightValue: {},
        featureSalt: {},
        featureAalt: {},
        featureSs01: {},
        featureSs02: {},
        featureTnum: {},
        featureDlig: {}
    };
    const block = {
        id: 'text-1',
        x: 3,
        row: 2,
        baselineOffset: 1,
        width: 4.5,
        content: 'Compact editor',
        styleRef: 'lunnenDisplay',
        surface: 'left',
        lockPosition: true,
        alignment: 'right',
        textAlign: 'center',
        visible: true,
        fontWeight: 300,
        fontFeatures: { salt: true }
    };
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.document = {
        getElementById: id => extraControls[id] || null,
        querySelector: () => null
    };

    try {
        const host = {
            dom: controls,
            objectDocument: {
                getTextBlock: id => id === block.id ? block : null,
                getBlockNumber: () => 1
            },
            getStyleDisplayName: () => 'Display',
            surfaceCoordinates: { rowBaselineToY: () => 8 }
        };
        const controller = new ObjectEditorPanelController(host);

        assert.equal(controller.openTextPanel(block.id), true);
        assert.equal(host.currentEditingBlock, block);
        assert.equal(controls.paragraphPanelTitle.textContent, 'Compact editor');
        assert.equal(controls.paragraphSurfaceSelect.value, 'left');
        assert.equal(controls.paragraphBaselineInput.value, 9);
        assert.equal(controls.paragraphWidthInput.value, '4.50');
        assert.equal(controls.paragraphLockPositionToggle.checked, true);
        assert.equal(controls.textAlignmentCenter.checked, true);
        assert.equal(controls.charCounter.textContent, '14 characters');
        assert.equal(extraControls.featureSalt.checked, true);
        assert.equal(extraControls.featureAalt.checked, false);
        assert.equal(paragraphPanel.style.left, '440px');
        assert.equal(paragraphPanel.classList.contains('active'), true);
        assert.match(hideIcon.innerHTML, /<line/);
    } finally {
        globalThis.document = previousDocument;
        globalThis.window = previousWindow;
    }
});

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
    const previousWindow = globalThis.window;
    globalThis.document = {
        getElementById: id => ({ graphicsHideBtn, graphicsDeleteBtn })[id] || null
    };
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };

    try {
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
            currentEditingGraphicsId: 'graphic-1'
        };
        const controller = new ObjectEditorPanelController(host);

        controller.openNewGraphicsPanel();
        assert.equal(host.dom.graphicsWidthInput.value, '4.00');
        assert.equal(host.dom.graphicsHeightInput.value, '3.00');
        assert.equal(host.dom.graphicsLockPositionToggle.checked, false);
        assert.equal(graphicsPanel.classList.contains('active'), true);
        assert.equal(graphicsPanel.style.left, '440px');
        assert.equal(graphicsPanel.style.top, '280px');
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
        globalThis.window = previousWindow;
    }
});

test('Objects clicks do not immediately close built-in graphics editors', () => {
    const paragraphPanel = createPanel();
    paragraphPanel.classList.remove('active');
    const graphicsPanel = createPanel();
    const host = { dom: { paragraphPanel, graphicsPanel } };
    const controller = new ObjectEditorPanelController(host, {
        document: {},
        hide() {},
        resetGraphics() {}
    });
    let closes = 0;
    controller.closeGraphicsPanel = () => { closes += 1; };

    controller.handleOutsideClick({
        target: {
            closest: selector => selector.includes('.element-item') ? {} : null
        }
    });

    assert.equal(closes, 0);
});
