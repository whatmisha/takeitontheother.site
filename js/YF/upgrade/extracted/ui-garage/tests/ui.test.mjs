import assert from 'node:assert/strict';
import test from 'node:test';

import { SVGExporter } from '../src/export/SVGExporter.js';
import { CanvasTarget } from '../src/render/CanvasTarget.js';
import { ColorPicker } from '../src/ui/ColorPicker.js';
import { DialogHost } from '../src/ui/DialogHost.js';
import { OverlayDialogHost } from '../src/ui/OverlayDialogHost.js';
import { PanelManager } from '../src/ui/PanelManager.js';
import { SliderController } from '../src/ui/SliderController.js';
import { TooltipService } from '../src/ui/TooltipService.js';
import { ZoomPanManager } from '../src/ui/ZoomPanManager.js';

function fakeClassList(initial = []) {
    const values = new Set(initial);
    return {
        contains: name => values.has(name),
        toggle(name, force) {
            if (force === undefined ? !values.has(name) : force) values.add(name);
            else values.delete(name);
        }
    };
}

function fakePanel(collapsed = false, isOpen = true) {
    const icon = { classList: fakeClassList(collapsed ? ['collapsed'] : []) };
    return {
        isOpen,
        element: {
            classList: fakeClassList(collapsed ? ['panel-collapsed'] : []),
            querySelector: () => icon
        },
        icon
    };
}

function fakeCollapseDom(collapsed = false) {
    const attributes = new Map([['aria-hidden', 'true']]);
    const listeners = new Map();
    let listenerCount = 0;
    const panel = {
        classList: fakeClassList(collapsed ? ['panel-collapsed'] : []),
        querySelector: () => icon
    };
    const icon = {
        classList: fakeClassList(collapsed ? ['collapsed'] : []),
        dataset: {},
        closest: () => panel,
        addEventListener(type, handler) {
            listenerCount += 1;
            listeners.set(type, handler);
        },
        setAttribute: (name, value) => attributes.set(name, String(value)),
        getAttribute: name => attributes.get(name) ?? null,
        removeAttribute: name => attributes.delete(name)
    };
    return { attributes, icon, listeners, panel, get listenerCount() { return listenerCount; } };
}

test('PanelManager collapse controls synchronize click, keyboard and ARIA idempotently', () => {
    const previousDocument = globalThis.document;
    const dom = fakeCollapseDom(true);
    globalThis.document = { querySelectorAll: () => [dom.icon] };
    try {
        const manager = new PanelManager();
        manager.initCollapse();
        manager.initCollapse();

        assert.equal(dom.listenerCount, 2, 'click and keydown listeners must bind once');
        assert.equal(dom.icon.getAttribute('aria-hidden'), null);
        assert.equal(dom.icon.getAttribute('role'), 'button');
        assert.equal(dom.icon.getAttribute('tabindex'), '0');
        assert.equal(dom.icon.getAttribute('aria-expanded'), 'false');
        assert.equal(dom.icon.getAttribute('aria-label'), 'Expand panel');

        const event = (key) => ({
            key,
            repeat: false,
            prevented: false,
            stopped: false,
            preventDefault() { this.prevented = true; },
            stopPropagation() { this.stopped = true; }
        });
        const space = event(' ');
        dom.listeners.get('keydown')(space);
        assert.equal(space.prevented, true);
        assert.equal(space.stopped, true);
        assert.equal(dom.panel.classList.contains('panel-collapsed'), false);
        assert.equal(dom.icon.classList.contains('collapsed'), false);
        assert.equal(dom.icon.getAttribute('aria-expanded'), 'true');
        assert.equal(dom.icon.getAttribute('aria-label'), 'Collapse panel');

        const enter = event('Enter');
        dom.listeners.get('keydown')(enter);
        assert.equal(dom.panel.classList.contains('panel-collapsed'), true);
        assert.equal(dom.icon.getAttribute('aria-expanded'), 'false');

        const click = event();
        dom.listeners.get('click')(click);
        assert.equal(dom.panel.classList.contains('panel-collapsed'), false);
        assert.equal(dom.icon.getAttribute('aria-expanded'), 'true');

        manager.panels.set('panel', { element: dom.panel, isOpen: true });
        manager.setCollapsed('panel', true);
        assert.equal(dom.panel.classList.contains('panel-collapsed'), true);
        assert.equal(dom.icon.getAttribute('aria-expanded'), 'false');
        assert.equal(dom.icon.getAttribute('aria-label'), 'Expand panel');
    } finally {
        globalThis.document = previousDocument;
    }
});

test('PanelManager global toggle restores only panels that were expanded', () => {
    const manager = new PanelManager();
    const general = fakePanel();
    const focus = fakePanel(true);
    const hidden = fakePanel(false, false);
    manager.panels.set('general', general);
    manager.panels.set('focus', focus);
    manager.panels.set('hidden', hidden);

    assert.deepEqual(manager.toggleAllCollapsed(), { collapsed: true, panelIds: ['general'] });
    assert.equal(general.element.classList.contains('panel-collapsed'), true);
    assert.equal(focus.element.classList.contains('panel-collapsed'), true);
    assert.deepEqual(manager.toggleAllCollapsed(), { collapsed: false, panelIds: ['general'] });
    assert.equal(general.element.classList.contains('panel-collapsed'), false);
    assert.equal(focus.element.classList.contains('panel-collapsed'), true);
});

test('PanelManager renders application-provided collapsed summaries without owning their meaning', () => {
    const manager = new PanelManager();
    const transformSummary = { textContent: '' };
    const settingsSummary = { textContent: '' };
    let scale = 100;
    manager.panels.set('transform', {
        summaryElement: transformSummary,
        config: { summaryProvider: () => `0, 0 • ${scale}% • 0°` }
    });
    manager.panels.set('settings', {
        summaryElement: settingsSummary,
        config: { summaryProvider: () => 'FS • Px 1 • T 128' }
    });

    assert.equal(manager.refreshSummaries(), 2);
    assert.equal(transformSummary.textContent, '0, 0 • 100% • 0°');
    assert.equal(settingsSummary.textContent, 'FS • Px 1 • T 128');

    scale = 125;
    assert.equal(manager.refreshSummary('transform'), true);
    assert.equal(transformSummary.textContent, '0, 0 • 125% • 0°');
    assert.equal(manager.setSummary('settings', null), true);
    assert.equal(settingsSummary.textContent, '');
    assert.equal(manager.setSummary('missing', 'ignored'), false);
});

test('SliderController can show a transient value without changing settings', () => {
    const writes = [];
    const controller = new SliderController({ set: (...args) => writes.push(args) });
    const element = { value: '20' };
    const valueInput = { value: '20' };
    controller.sliders.set('motion', {
        element, valueInput,
        config: { min: 0, max: 100, decimals: 0, suffix: '%' }
    });
    controller.setDisplayValue('motion', 140);
    assert.equal(element.value, 100);
    assert.equal(valueInput.value, '100%');
    assert.deepEqual(writes, []);
});

test('ColorPicker keeps HSB values, gradients and HEX callbacks synchronized', () => {
    const changes = [];
    const control = () => ({ value: '', style: {} });
    const picker = new ColorPicker({ onChange: hex => changes.push(hex) });
    picker.elements = {
        hexInput: control(),
        preview: control(),
        hueSlider: control(),
        saturationSlider: control(),
        brightnessSlider: control(),
        hueValue: control(),
        saturationValue: control(),
        brightnessValue: control()
    };

    picker.setColorFromHex('#336699', { silent: true });
    assert.equal(picker.getColor(), '#326699', 'integer HSB conversion contract changed');
    assert.deepEqual(changes, []);
    assert.equal(picker.elements.hueValue.value, '210°');
    assert.equal(picker.elements.saturationValue.value, '67%');
    assert.equal(picker.elements.brightnessValue.value, '60%');
    assert.match(picker.elements.hueSlider.style.background, /#ff0000, #ffff00, #00ff00/u);
    assert.match(picker.elements.saturationSlider.style.background, /^linear-gradient\(to right, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/u);
    assert.match(picker.elements.brightnessSlider.style.background, /^linear-gradient\(to right, #000000, #[0-9a-f]{6}\)$/u);

    picker.hsb = { h: 0, s: 100, b: 100 };
    picker.updateFromHSB();
    assert.equal(picker.elements.hexInput.value, '#ff0000');
    assert.equal(picker.elements.preview.style.backgroundColor, '#ff0000');
    assert.equal(picker.elements.brightnessSlider.style.background, 'linear-gradient(to right, #000000, #ff0000)');
    assert.deepEqual(changes, ['#ff0000']);
});

test('ZoomPanManager can fit to stable artboard bounds', () => {
    const manager = Object.create(ZoomPanManager.prototype);
    manager.originalWidth = 640;
    manager.originalHeight = 480;
    manager.svg = {
        dataset: { fitArtboard: 'true' },
        getBBox() { throw new Error('getBBox should not be used'); }
    };
    assert.deepEqual(manager.getContentBounds(), { x: 0, y: 0, width: 640, height: 480 });
});

test('SVGExporter removes explicit export-only exclusions', () => {
    let removed = 0;
    const excluded = { remove: () => { removed += 1; } };
    const svg = {
        querySelectorAll(selector) {
            if (selector === '[data-export-exclude="true"]') return [excluded];
            return [];
        }
    };
    new SVGExporter().removeInteractiveElements(svg);
    assert.equal(removed, 1);
});

function fakeEventTarget(extra = {}) {
    const listeners = new Map();
    return {
        ...extra,
        addEventListener(type, handler) { listeners.set(type, handler); },
        removeEventListener(type, handler) {
            if (listeners.get(type) === handler) listeners.delete(type);
        },
        listeners
    };
}

test('SVG and Canvas zoom managers dispose every listener they install', () => {
    const previousDocument = globalThis.document;
    const documentTarget = fakeEventTarget();
    globalThis.document = documentTarget;
    try {
        const svgContainer = fakeEventTarget({
            style: {},
            getBoundingClientRect: () => ({ width: 800, height: 600 })
        });
        const attributes = new Map([['width', '640'], ['height', '480']]);
        const svg = {
            style: {}, dataset: {},
            getAttribute: name => attributes.get(name) || null,
            setAttribute: (name, value) => attributes.set(name, String(value)),
            getBBox: () => ({ x: 0, y: 0, width: 640, height: 480 })
        };
        const zoom = new ZoomPanManager(svgContainer, svg);
        assert.ok(svgContainer.listeners.size > 0);
        assert.ok(documentTarget.listeners.size > 0);
        zoom.destroy();
        assert.equal(svgContainer.listeners.size, 0);
        assert.equal(documentTarget.listeners.size, 0);

        const canvasContext = {};
        const canvas = { style: {}, getContext: () => canvasContext };
        const canvasContainer = fakeEventTarget({
            style: {},
            getBoundingClientRect: () => ({ width: 800, height: 600 }),
            querySelector: () => canvas,
            appendChild() {}
        });
        const target = new CanvasTarget(canvasContainer, {
            element: canvas, width: 640, height: 480, requestRender() {}
        });
        target.initZoom();
        assert.ok(canvasContainer.listeners.size > 0);
        assert.ok(documentTarget.listeners.size > 0);
        target.destroy();
        assert.equal(canvasContainer.listeners.size, 0);
        assert.equal(documentTarget.listeners.size, 0);
    } finally {
        globalThis.document = previousDocument;
    }
});

function fakeDialogDocument() {
    const documentRef = {
        activeElement: null,
        body: null,
        elements: new Map(),
        getElementById(id) { return this.elements.get(id) || null; },
        createElement(tagName) { return makeElement('', tagName); }
    };

    function makeElement(id, tagName = 'div') {
        const listeners = new Map();
        const children = [];
        const element = {
            id,
            tagName: tagName.toUpperCase(),
            style: {},
            value: '',
            placeholder: '',
            textContent: '',
            className: '',
            type: '',
            isConnected: true,
            listeners,
            children,
            get firstChild() { return children[0] || null; },
            addEventListener(type, handler) {
                if (!listeners.has(type)) listeners.set(type, new Set());
                listeners.get(type).add(handler);
            },
            removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
            appendChild(child) { children.push(child); child.parentNode = this; },
            focus() { documentRef.activeElement = this; },
            select() { this.selected = true; },
            dispatch(type, init = {}) {
                const event = {
                    target: this,
                    defaultPrevented: false,
                    preventDefault() { this.defaultPrevented = true; },
                    ...init
                };
                for (const handler of listeners.get(type) || []) handler(event);
                return event;
            }
        };
        let html = '';
        Object.defineProperty(element, 'innerHTML', {
            get() { return html; },
            set(value) {
                html = String(value);
                if (value === '') children.length = 0;
            }
        });
        if (id) documentRef.elements.set(id, element);
        return element;
    }

    documentRef.body = makeElement('body', 'body');
    const modal = makeElement('dialog', 'dialog');
    modal.open = false;
    modal.returnValue = '';
    modal.showModal = function showModal() { this.open = true; };
    modal.close = function close(returnValue = '') {
        if (!this.open) return;
        this.open = false;
        this.returnValue = returnValue;
        this.dispatch('close');
    };
    const title = makeElement('dialogTitle', 'h2');
    const text = makeElement('dialogText');
    const input = makeElement('dialogInput', 'input');
    const buttons = makeElement('dialogButtons');
    return { documentRef, modal, title, text, input, buttons, makeElement };
}

test('DialogHost resolves actions once and restores focus for buttons, input and Escape', async () => {
    const dom = fakeDialogDocument();
    const trigger = dom.makeElement('trigger', 'button');
    trigger.focus();
    const host = new DialogHost({}, { ownerDocument: dom.documentRef });

    const confirmed = host.confirm({ title: 'Delete?', text: 'One item', danger: true });
    assert.equal(dom.modal.open, true);
    assert.equal(dom.title.textContent, 'Delete?');
    assert.equal(dom.text.textContent, 'One item');
    assert.equal(dom.buttons.children.length, 2);
    assert.equal(dom.buttons.firstChild.type, 'button');
    assert.equal(dom.buttons.firstChild.className, 'modal-btn modal-btn-danger');
    assert.equal(dom.documentRef.activeElement, dom.buttons.firstChild);
    dom.buttons.firstChild.dispatch('click');
    assert.equal(await confirmed, true);
    assert.equal(dom.modal.open, false);
    assert.equal(dom.documentRef.activeElement, trigger);

    trigger.focus();
    const prompted = host.prompt({ value: '  Garage  ', placeholder: 'Name' });
    assert.equal(dom.input.style.display, 'block');
    assert.equal(dom.input.placeholder, 'Name');
    assert.equal(dom.input.selected, true);
    assert.equal(dom.documentRef.activeElement, dom.input);
    dom.buttons.firstChild.dispatch('click');
    assert.equal(await prompted, 'Garage');
    assert.equal(dom.documentRef.activeElement, trigger);

    trigger.focus();
    const cancelled = host.confirm();
    const escape = dom.modal.dispatch('keydown', { key: 'Escape' });
    assert.equal(escape.defaultPrevented, true);
    assert.equal(await cancelled, false);
    assert.equal(dom.documentRef.activeElement, trigger);
});

test('DialogHost handles native cancellation, replacement, external close and destroy', async () => {
    const dom = fakeDialogDocument();
    const trigger = dom.makeElement('trigger', 'button');
    trigger.focus();
    const host = new DialogHost({}, { ownerDocument: dom.documentRef });

    const cancelled = host.show({ buttons: [{ id: 'ok', text: 'OK' }] });
    const cancelEvent = dom.modal.dispatch('cancel');
    assert.equal(cancelEvent.defaultPrevented, true);
    assert.deepEqual(await cancelled, { action: 'cancel', inputValue: '' });

    trigger.focus();
    const replaced = host.show({ title: 'First' });
    const replacement = host.show({ title: 'Second' });
    assert.deepEqual(await replaced, { action: 'cancel', inputValue: '' });
    dom.modal.close('external');
    assert.deepEqual(await replacement, { action: 'external', inputValue: '' });
    assert.equal(dom.documentRef.activeElement, trigger);

    trigger.focus();
    const pending = host.alert({ title: 'Notice' });
    host.destroy();
    await pending;
    assert.equal(dom.modal.open, false);
    assert.equal(dom.documentRef.activeElement, trigger);
    for (const listeners of dom.modal.listeners.values()) assert.equal(listeners.size, 0);
});

function fakeOverlayDocument() {
    const documentListeners = new Map();
    const elements = new Map();
    const documentRef = {
        activeElement: null,
        elements,
        getElementById: id => elements.get(id) || null,
        addEventListener(type, listener) {
            if (!documentListeners.has(type)) documentListeners.set(type, new Set());
            documentListeners.get(type).add(listener);
        },
        removeEventListener(type, listener) { documentListeners.get(type)?.delete(listener); },
        dispatch(type, init = {}) { return dispatch(documentListeners, type, documentRef, init); }
    };

    function dispatch(listeners, type, target, init) {
        const event = {
            key: '',
            shiftKey: false,
            target,
            defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; },
            ...init
        };
        for (const listener of listeners.get(type) || []) listener(event);
        return event;
    }

    function makeElement(id, initialClasses = []) {
        const listeners = new Map();
        const attributes = new Map();
        const classes = new Set(initialClasses);
        const element = {
            id,
            style: {},
            disabled: false,
            hidden: false,
            isConnected: true,
            listeners,
            classList: {
                add: value => classes.add(value),
                remove: value => classes.delete(value),
                contains: value => classes.has(value)
            },
            addEventListener(type, listener) {
                if (!listeners.has(type)) listeners.set(type, new Set());
                listeners.get(type).add(listener);
            },
            removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
            getAttribute: name => attributes.get(name) ?? null,
            setAttribute: (name, value) => attributes.set(name, String(value)),
            focus() { documentRef.activeElement = this; },
            dispatch(type, init = {}) { return dispatch(listeners, type, element, init); }
        };
        elements.set(id, element);
        return element;
    }

    const body = makeElement('body');
    body.style.overflow = 'scroll';
    documentRef.body = body;
    const overlay = makeElement('modalOverlay');
    overlay.setAttribute('aria-hidden', 'true');
    const content = makeElement('modalContent');
    const close = makeElement('modalClose');
    const secondary = makeElement('modalSecondary');
    const trigger = makeElement('helpButton');
    content.querySelectorAll = () => [close, secondary];
    overlay.querySelector = () => content;
    return { documentRef, documentListeners, overlay, content, close, secondary, trigger };
}

test('OverlayDialogHost preserves overlay presentation state and restores scroll and focus', () => {
    const dom = fakeOverlayDocument();
    dom.trigger.focus();
    const host = new OverlayDialogHost({ ownerDocument: dom.documentRef }).init();
    host.init();

    assert.equal(dom.trigger.listeners.get('click').size, 1, 'init must be idempotent');
    dom.trigger.dispatch('click');
    assert.equal(host.isOpen(), true);
    assert.equal(dom.overlay.getAttribute('aria-hidden'), 'false');
    assert.equal(dom.trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(dom.trigger.getAttribute('aria-controls'), 'modalOverlay');
    assert.equal(dom.content.getAttribute('role'), 'dialog');
    assert.equal(dom.content.getAttribute('aria-modal'), 'true');
    assert.equal(dom.documentRef.body.style.overflow, 'hidden');
    assert.equal(dom.documentRef.activeElement, dom.close);

    dom.close.dispatch('click');
    assert.equal(host.isOpen(), false);
    assert.equal(dom.overlay.getAttribute('aria-hidden'), 'true');
    assert.equal(dom.trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(dom.documentRef.body.style.overflow, 'scroll');
    assert.equal(dom.documentRef.activeElement, dom.trigger);

    dom.trigger.dispatch('click');
    dom.overlay.dispatch('click', { target: dom.overlay });
    assert.equal(host.isOpen(), false, 'backdrop click must close');
    assert.equal(dom.documentRef.activeElement, dom.trigger);
});

test('OverlayDialogHost contains focus, handles Escape and removes every listener', () => {
    const dom = fakeOverlayDocument();
    dom.trigger.focus();
    const host = new OverlayDialogHost({ ownerDocument: dom.documentRef }).init();
    host.open();

    let tab = dom.documentRef.dispatch('keydown', { key: 'Tab' });
    assert.equal(tab.defaultPrevented, false);
    dom.secondary.focus();
    tab = dom.documentRef.dispatch('keydown', { key: 'Tab' });
    assert.equal(tab.defaultPrevented, true);
    assert.equal(dom.documentRef.activeElement, dom.close);
    tab = dom.documentRef.dispatch('keydown', { key: 'Tab', shiftKey: true });
    assert.equal(tab.defaultPrevented, true);
    assert.equal(dom.documentRef.activeElement, dom.secondary);

    const escape = dom.documentRef.dispatch('keydown', { key: 'Escape' });
    assert.equal(escape.defaultPrevented, true);
    assert.equal(host.isOpen(), false);
    assert.equal(dom.documentRef.activeElement, dom.trigger);

    host.open();
    host.destroy();
    assert.equal(host.isOpen(), false);
    assert.equal(dom.documentRef.body.style.overflow, 'scroll');
    assert.equal(dom.trigger.listeners.get('click').size, 0);
    assert.equal(dom.close.listeners.get('click').size, 0);
    assert.equal(dom.overlay.listeners.get('click').size, 0);
    assert.equal(dom.documentListeners.get('keydown').size, 0);
});

test('OverlayDialogHost can expose trigger semantics without owning its domain action', () => {
    const dom = fakeOverlayDocument();
    const host = new OverlayDialogHost({
        ownerDocument: dom.documentRef,
        bindTrigger: false
    }).init();

    assert.equal(dom.trigger.listeners.has('click'), false);
    assert.equal(dom.trigger.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(dom.trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(dom.overlay.getAttribute('aria-hidden'), 'true');
    host.open();
    assert.equal(host.isOpen(), true);
    host.destroy();
});

function fakeTooltipDocument() {
    const listeners = new Map();
    const bodyChildren = [];
    const documentRef = {
        defaultView: { innerWidth: 100, innerHeight: 100 },
        addEventListener(type, handler) { listeners.set(type, handler); },
        removeEventListener(type, handler) {
            if (listeners.get(type) === handler) listeners.delete(type);
        },
        createElement() {
            const attributes = new Map();
            const classes = new Set();
            return {
                attributes,
                className: '',
                id: '',
                style: {},
                textContent: '',
                classList: {
                    add: value => classes.add(value),
                    remove: value => classes.delete(value),
                    contains: value => classes.has(value)
                },
                getAttribute: name => attributes.get(name) ?? null,
                setAttribute: (name, value) => attributes.set(name, String(value)),
                removeAttribute: name => attributes.delete(name),
                getBoundingClientRect: () => ({ width: 30, height: 20 })
            };
        },
        body: {
            appendChild(element) {
                bodyChildren.push(element);
                element.parentNode = this;
            },
            removeChild(element) {
                const index = bodyChildren.indexOf(element);
                if (index >= 0) bodyChildren.splice(index, 1);
                element.parentNode = null;
            }
        }
    };

    const host = ({ text = 'Help', disabledText = '', inactive = false } = {}) => {
        const attributes = new Map([['data-tooltip', text], ['aria-describedby', 'existing']]);
        if (disabledText) attributes.set('data-tooltip-disabled', disabledText);
        const element = {
            classList: { contains: value => inactive && value === 'inactive' },
            querySelector: () => null,
            closest: () => element,
            getAttribute: name => attributes.get(name) ?? null,
            hasAttribute: name => attributes.has(name),
            setAttribute: (name, value) => attributes.set(name, String(value)),
            removeAttribute: name => attributes.delete(name),
            getBoundingClientRect: () => ({ left: 80, width: 20, bottom: 95 })
        };
        return element;
    };

    return {
        documentRef,
        listeners,
        bodyChildren,
        host,
        dispatch(type, init) { return listeners.get(type)?.(init); }
    };
}

test('TooltipService preserves pointer geometry and adds reversible keyboard descriptions', () => {
    const dom = fakeTooltipDocument();
    const service = new TooltipService({ ownerDocument: dom.documentRef });
    service.init();
    const tooltip = service.tooltipElement;
    const pointerHost = dom.host({ text: 'Pointer help' });

    assert.equal(tooltip.getAttribute('role'), 'tooltip');
    assert.equal(tooltip.getAttribute('aria-hidden'), 'true');
    dom.dispatch('mousemove', { clientX: 10, clientY: 20 });
    dom.dispatch('mouseover', { target: pointerHost });
    assert.equal(tooltip.textContent, 'Pointer help');
    assert.equal(tooltip.style.left, '22px');
    assert.equal(tooltip.style.top, '32px');
    assert.equal(tooltip.classList.contains('visible'), true);
    assert.equal(tooltip.getAttribute('aria-hidden'), 'false');
    dom.dispatch('mouseout', { target: pointerHost, relatedTarget: null });
    assert.equal(tooltip.classList.contains('visible'), false);

    const focusHost = dom.host({ text: 'Keyboard help' });
    dom.dispatch('focusin', { target: focusHost });
    assert.equal(tooltip.textContent, 'Keyboard help');
    assert.equal(focusHost.getAttribute('aria-describedby'), 'existing cursorTooltip');
    assert.equal(tooltip.style.left, '48px', 'focus tooltip must flip before viewport overflow');
    assert.equal(tooltip.style.top, '63px');

    dom.dispatch('keydown', { key: 'Escape' });
    assert.equal(tooltip.classList.contains('visible'), false);
    assert.equal(focusHost.getAttribute('aria-describedby'), 'existing');

    focusHost.setAttribute('data-tooltip', 'Updated help');
    dom.dispatch('focusout', { target: focusHost, relatedTarget: null });
    dom.dispatch('focusin', { target: focusHost });
    assert.equal(tooltip.textContent, 'Updated help');

    const disabledHost = dom.host({ text: 'Available', disabledText: 'Unavailable', inactive: true });
    dom.dispatch('focusout', { target: focusHost, relatedTarget: disabledHost });
    dom.dispatch('focusin', { target: disabledHost });
    assert.equal(tooltip.textContent, 'Unavailable');

    service.destroy();
    assert.equal(disabledHost.getAttribute('aria-describedby'), 'existing');
    assert.equal(dom.bodyChildren.length, 0);
    assert.equal(dom.listeners.size, 0);
});
