import assert from 'node:assert/strict';
import test from 'node:test';

import { SVGExporter } from '../src/export/SVGExporter.js';
import { CanvasTarget } from '../src/render/CanvasTarget.js';
import { PanelManager } from '../src/ui/PanelManager.js';
import { SliderController } from '../src/ui/SliderController.js';
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
