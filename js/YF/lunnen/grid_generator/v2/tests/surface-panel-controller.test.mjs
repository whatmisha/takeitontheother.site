import assert from 'node:assert/strict';
import test from 'node:test';

import { Settings } from '../src/core/Settings.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';
import { SurfacePanelController } from '../src/surfaces/SurfacePanelController.js';

/** The smallest DOM the panel needs: elements that record what was set. */
function createElement(tag = 'div') {
    const element = {
        tagName: tag.toUpperCase(),
        children: [],
        dataset: {},
        classList: new Set(),
        attributes: {},
        listeners: {},
        value: '',
        checked: false,
        disabled: false,
        hidden: false,
        textContent: '',
        type: '',
        inputMode: '',
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        replaceChildren(...nodes) {
            this.children = nodes;
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        addEventListener(type, handler) {
            (this.listeners[type] ||= []).push(handler);
        },
        removeEventListener(type, handler) {
            this.listeners[type] = (this.listeners[type] || []).filter(entry => entry !== handler);
        },
        dispatch(type, event = {}) {
            (this.listeners[type] || []).forEach(handler => handler({ target: this, ...event }));
        },
        closest() {
            return null;
        }
    };
    element.classList = {
        set: new Set(),
        add(name) { this.set.add(name); },
        remove(name) { this.set.delete(name); },
        toggle(name, on) { if (on) this.set.add(name); else this.set.delete(name); },
        contains(name) { return this.set.has(name); }
    };
    return element;
}

const DOM_IDS = [
    'surfaceSettingsTabs', 'planeAddBtn', 'planeAddEdge', 'planeAddKind',
    'surfaceVisibleToggle', 'surfaceOwnGridToggle', 'surfaceRotationSelect',
    'surfaceOwnGridControls', 'surfaceMarginsUnitMod', 'surfaceMarginsUnitMm',
    'surfaceLockModuleBtn', 'surfaceLockMarginsBtn',
    'planeNameInput', 'planeKindSelect', 'planeWidthInput', 'planeHeightInput',
    'planeAttachToSelect', 'planeAttachEdgeSelect', 'planeAttachAlignSelect',
    'planeAttachOffsetInput', 'planeStackUpBtn', 'planeStackDownBtn',
    'planeVariableList', 'planeVariableNameInput', 'planeVariableValueInput',
    'planeVariableAddBtn', 'showSidePanels', 'paragraphSurfaceSelect'
];

function createPanel({ presetName = '+ New' } = {}) {
    const settings = new Settings({
        showSidePanels: true,
        frontWidth: 500,
        frontHeight: 400,
        thickness: 40,
        gridModule: 5,
        margins: 2,
        columnCount: 12,
        rowCount: 12,
        rowHeight: 7
    });
    const surfaceManager = new SurfaceManager(settings);
    surfaceManager.initialize(presetName);

    const dom = Object.fromEntries(DOM_IDS.map(id => [id, createElement()]));
    const removedPlanes = [];
    const controller = new SurfacePanelController({
        dom,
        surfaceManager,
        sliderController: null,
        documentRef: { createElement },
        onPlanesRemoved: ids => removedPlanes.push(...ids),
        resolvePlaneAtPointer: (x, y) => (x === 1 && y === 1 ? 'bottom' : null)
    });
    controller.init();
    return { controller, surfaceManager, dom, removedPlanes };
}

const rowFor = (dom, planeId) => dom.surfaceSettingsTabs.children
    .find(row => row.children[0].dataset.planeId === planeId);

test('the plane list is built from the document, root included', () => {
    const { surfaceManager, dom } = createPanel();

    assert.deepEqual(
        dom.surfaceSettingsTabs.children.map(row => row.children[0].textContent),
        ['Front', 'Left', 'Right', 'Top', 'Bottom']
    );
    assert.equal(rowFor(dom, 'front').classList.contains('is-root'), true);
    assert.equal(rowFor(dom, 'front').classList.contains('is-active'), true);
    assert.equal(rowFor(dom, 'front').children[1].disabled, true, 'the root cannot be hidden');
    assert.equal(surfaceManager.getRootId(), 'front');
});

test('selecting a plane in the list drives the geometry controls', () => {
    const { controller, dom } = createPanel();
    const select = rowFor(dom, 'left').children[0];
    select.closest = selector => (selector === '[data-plane-action]' ? select : null);

    dom.surfaceSettingsTabs.dispatch('click', { target: select });

    assert.equal(controller.getActivePlaneId(), 'left');
    assert.equal(dom.planeNameInput.value, 'Left');
    assert.equal(dom.planeWidthInput.value, 'D');
    assert.equal(dom.planeHeightInput.value, 'fit');
    assert.equal(dom.planeAttachEdgeSelect.value, 'left');
    assert.equal(dom.planeAttachOffsetInput.disabled, false);
    assert.equal(dom.surfaceRotationSelect.value, '90');
});

test('the root plane hides the controls that cannot apply to it', () => {
    const { dom } = createPanel();

    assert.equal(dom.planeAttachToSelect.disabled, true);
    assert.equal(dom.planeAttachEdgeSelect.disabled, true);
    assert.equal(dom.surfaceVisibleToggle.disabled, true);
    assert.equal(dom.surfaceOwnGridToggle.disabled, true);
    assert.equal(dom.planeStackDownBtn.disabled, true, 'the root already sits at the bottom');
});

test('adding a plane attaches it to the selection and selects the result', () => {
    const { controller, surfaceManager, dom } = createPanel();
    controller.setActivePlane('right');
    dom.planeAddEdge.value = 'right';
    dom.planeAddKind.value = 'glue';

    dom.planeAddBtn.dispatch('click');

    const created = surfaceManager.getPlane(controller.getActivePlaneId());
    assert.equal(created.name, 'Glue');
    assert.equal(created.kind, 'glue');
    assert.deepEqual(created.attach, { to: 'right', edge: 'right', align: 'start', offset: 0 });
    assert.equal(surfaceManager.getPlaneIds().length, 6);
    assert.equal(rowFor(dom, created.id).children[0].textContent, 'Glue');
});

test('removing a plane reports the orphaned planes to the host', () => {
    const { controller, surfaceManager, removedPlanes } = createPanel();
    const flap = surfaceManager.addPlane({ name: 'Flap', parentId: 'top', edge: 'top' });

    controller.removePlane('top');

    assert.deepEqual(removedPlanes, ['top', flap.id]);
    assert.deepEqual(surfaceManager.getPlaneIds(), ['front', 'left', 'right', 'bottom']);
    assert.equal(controller.getActivePlaneId(), 'front');
});

test('size fields accept millimetres, variable names and fit', () => {
    const { controller, surfaceManager, dom } = createPanel();
    controller.setActivePlane('left');

    dom.planeWidthInput.value = '25.5';
    dom.planeHeightInput.value = 'FIT';
    dom.planeWidthInput.dispatch('change');
    assert.deepEqual(surfaceManager.getPlane('left').size, { width: 25.5, height: 'fit' });

    surfaceManager.setVariable('flapDepth', 12);
    dom.planeWidthInput.value = 'flapDepth';
    dom.planeWidthInput.dispatch('change');
    assert.equal(surfaceManager.getPlane('left').size.width, 'flapDepth');

    // An unknown name is not a dimension, so the current value survives.
    dom.planeWidthInput.value = 'nope';
    dom.planeWidthInput.dispatch('change');
    assert.equal(surfaceManager.getPlane('left').size.width, 'flapDepth');

    // An empty field means "leave as is" rather than "reset".
    dom.planeWidthInput.value = '';
    dom.planeWidthInput.dispatch('change');
    assert.equal(surfaceManager.getPlane('left').size.width, 'flapDepth');
});

test('reattaching a plane cannot fold it onto its own subtree', () => {
    const { controller, surfaceManager, dom } = createPanel();
    const flap = surfaceManager.addPlane({ name: 'Flap', parentId: 'left', edge: 'top' });
    controller.setActivePlane('left');

    assert.deepEqual(
        dom.planeAttachToSelect.children.map(option => option.value),
        ['front', 'right', 'top', 'bottom']
    );
    assert.ok(!dom.planeAttachToSelect.children.some(option => option.value === flap.id));

    dom.planeAttachToSelect.value = 'top';
    dom.planeAttachEdgeSelect.value = 'bottom';
    dom.planeAttachAlignSelect.value = 'center';
    dom.planeAttachOffsetInput.value = '7.5';
    dom.planeAttachToSelect.dispatch('change');

    assert.deepEqual(surfaceManager.getPlane('left').attach, {
        to: 'top', edge: 'bottom', align: 'center', offset: 7.5
    });
});

test('stack buttons move the plane through the paint order', () => {
    const { controller, surfaceManager, dom } = createPanel();
    controller.setActivePlane('bottom');

    dom.planeStackDownBtn.dispatch('click');

    assert.deepEqual(surfaceManager.getPlaneIds(), ['front', 'left', 'right', 'bottom', 'top']);
    assert.equal(surfaceManager.getPlane('bottom').attach.to, 'front');
});

test('the variable list keeps W, H and D read-only and owns the rest', () => {
    const { surfaceManager, dom } = createPanel();
    const names = () => dom.planeVariableList.children.map(row => row.children[0].textContent);

    assert.deepEqual(names(), ['W', 'H', 'D']);
    assert.deepEqual(
        dom.planeVariableList.children.map(row => row.children[1].disabled),
        [true, true, true]
    );
    assert.deepEqual(
        dom.planeVariableList.children.map(row => row.children[1].value),
        ['500', '400', '40']
    );

    dom.planeVariableNameInput.value = 'flapDepth';
    dom.planeVariableValueInput.value = '12';
    dom.planeVariableAddBtn.dispatch('click');

    assert.deepEqual(names(), ['W', 'H', 'D', 'flapDepth']);
    assert.equal(surfaceManager.getVariables().flapDepth, 12);
    assert.equal(dom.planeVariableNameInput.value, '');

    const row = dom.planeVariableList.children.at(-1);
    const remove = row.children[2];
    remove.closest = selector => (selector === '[data-variable-remove]' ? remove : null);
    dom.planeVariableList.dispatch('click', { target: remove });

    assert.deepEqual(names(), ['W', 'H', 'D']);
    assert.equal(surfaceManager.getVariables().flapDepth, undefined);
});

test('a variable name that could not be referenced is refused', () => {
    const { surfaceManager, dom } = createPanel();
    dom.planeVariableNameInput.value = '2 walls';
    dom.planeVariableValueInput.value = '12';
    dom.planeVariableAddBtn.dispatch('click');

    assert.deepEqual(Object.keys(surfaceManager.getDocument().variables), []);
    assert.equal(dom.planeVariableNameInput.value, '2 walls', 'the rejected input is kept');
});

test('object plane pickers follow the document and disable hidden planes', () => {
    const { controller, surfaceManager, dom } = createPanel();
    surfaceManager.update('top', { name: 'Lid', visible: false });
    controller.sync();

    assert.deepEqual(
        dom.paragraphSurfaceSelect.children.map(option => [option.value, option.textContent]),
        [['front', 'Front'], ['left', 'Left'], ['right', 'Right'], ['top', 'Lid'], ['bottom', 'Bottom']]
    );
    assert.deepEqual(
        dom.paragraphSurfaceSelect.children.map(option => option.disabled),
        [false, false, false, true, false]
    );
});
