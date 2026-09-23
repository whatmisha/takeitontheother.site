import { ToolUiController } from './ToolUiController.js';
import { PanelManager } from './PanelManager.js';
import { UnifiedColorPicker } from './UnifiedColorPicker.js';
import { FileIntakeController } from './FileIntakeController.js';

const owners = new WeakMap();

/** Suspend bindings for BFCache and remove page lifecycle handlers on unload. */
export function bindPageLifecycle({ suspend, resume }, ownerWindow = globalThis.window) {
    if (!ownerWindow?.addEventListener) return () => {};
    const leave = event => {
        suspend?.();
        if (!event.persisted) dispose();
    };
    const enter = event => { if (event.persisted) resume?.(); };
    const dispose = () => {
        ownerWindow.removeEventListener('pagehide', leave);
        ownerWindow.removeEventListener('pageshow', enter);
    };
    ownerWindow.addEventListener('pagehide', leave);
    ownerWindow.addEventListener('pageshow', enter);
    return dispose;
}

const node = (documentRef, tag, className, text) => {
    const element = documentRef.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
};

/** Canonical, font-independent panel chevron. */
export function createCollapseButton(ownerDocument = globalThis.document) {
    const button = ownerDocument.createElement('button');
    button.className = 'collapse-icon';
    button.type = 'button';
    button.setAttribute('aria-label', 'Collapse panel');
    button.setAttribute('aria-expanded', 'true');
    const svg = ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, value] of Object.entries({ width: '10', height: '6', viewBox: '0 0 12 8', fill: 'none', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(name, value);
    const path = ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
    for (const [name, value] of Object.entries({ d: 'M1 1L6 6L11 1', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) path.setAttribute(name, value);
    svg.append(path);
    button.append(svg);
    return button;
}

/**
 * Adapt an existing generator page to the shared shell without owning its model
 * or renderer. New applications should prefer defineTool(); this adapter is for
 * incremental adoption of private controls.
 */
export function mountGenerator({
    id,
    title,
    panels = [],
    actions = [],
    summaries = {},
    navigation = { href: '../', label: 'All tools' },
    artworkSelectors = ['.container', '.svg-container', '.app-container', 'main'],
    onError,
    afterMount,
    ownerDocument = globalThis.document,
    ownerWindow = globalThis.window
} = {}) {
    if (!id || !title) throw new TypeError('Generator host requires id and title.');
    if (!ownerDocument?.body) throw new Error('Generator host requires a ready document body.');
    if (!Array.isArray(panels) || !Array.isArray(actions)) throw new TypeError('Panels and actions must be arrays.');

    owners.get(ownerDocument)?.destroy?.();
    const created = [];
    const remember = element => { created.push(element); return element; };
    const body = ownerDocument.body;
    const previousTitle = ownerDocument.title;
    const previousGenerator = body.dataset.generator;
    const previousPanelCount = body.dataset.generatorPanels;
    body.classList.add('generator-tool');
    body.dataset.generator = id;
    body.dataset.generatorPanels = String(panels.length);
    ownerDocument.title = title;

    for (const selector of artworkSelectors) {
        ownerDocument.querySelectorAll(selector).forEach(element => element.classList.add('generator-artboard'));
    }

    if (navigation !== false) {
        const links = remember(node(ownerDocument, 'nav', 'top-links'));
        const back = node(ownerDocument, 'a', 'top-link', navigation.label || 'All tools');
        back.href = navigation.href || '../';
        back.setAttribute('aria-label', navigation.ariaLabel || `Back to ${navigation.label || 'all tools'}`);
        links.append(back);
        body.prepend(links);
    }

    const dock = remember(node(ownerDocument, 'nav', 'bottom-buttons action-dock'));
    dock.setAttribute('aria-label', 'Export actions');
    dock.setAttribute('role', 'toolbar');
    const primary = node(ownerDocument, 'div', 'action-dock__slot action-dock__slot--primary');
    const utility = node(ownerDocument, 'div', 'action-dock__slot action-dock__slot--utility');
    dock.append(utility, primary);
    body.append(dock);

    for (const action of actions) {
        if (action.group === 'keyboard') continue;
        const button = typeof action.button === 'string' ? ownerDocument.getElementById(action.button) : action.button;
        if (!button) throw new Error(`${id}: missing action ${action.button}`);
        button.removeAttribute('style');
        if (action.group === 'primary') button.hidden = false;
        button.className = action.group === 'panel' ? 'panel-action' : 'btn-fixed';
        if (action.group !== 'panel') (action.group === 'extra' ? utility : primary).append(button);
    }

    const manager = new PanelManager();
    const panelElements = [];
    const summaryProviders = { ...summaries };
    panels.forEach((config, index) => {
        if (!config?.title || !Array.isArray(config.selectors)) throw new TypeError(`Panel ${index + 1} requires title and selectors.`);
        const panel = remember(node(ownerDocument, 'section', 'controls-panel generator-panel'));
        panel.id = config.id || `${id}-panel-${index}`;
        const header = node(ownerDocument, 'div', 'panel-header');
        header.id = `${panel.id}-header`;
        header.append(node(ownerDocument, 'span', '', config.title), createCollapseButton(ownerDocument));
        const content = node(ownerDocument, 'div', 'panel-content');
        const section = node(ownerDocument, 'div', 'control-section generator-controls');
        for (const selector of config.selectors) {
            const selected = [...ownerDocument.querySelectorAll(selector)];
            if (!selected.length) throw new Error(`${id}: missing panel content ${selector}`);
            selected.forEach(element => {
                element.classList.remove('controls-panel');
                section.append(element);
            });
        }
        normalizeControls(section, ownerDocument);
        content.append(section);
        panel.append(header, content);
        body.append(panel);
        panel.style.left = index === 0 ? '20px' : 'auto';
        panel.style.right = index === 0 ? 'auto' : '20px';
        panel.style.top = '76px';
        panel.style.setProperty('--generator-panel-top', '76px');
        if (config.collapsed) {
            panel.classList.add('panel-collapsed');
            const collapse = header.querySelector('.collapse-icon');
            collapse.classList.add('collapsed');
            collapse.setAttribute('aria-expanded', 'false');
            collapse.setAttribute('aria-label', 'Expand panel');
        }
        manager.registerPanel(panel.id, { headerId: header.id, draggable: config.draggable !== false });
        if (typeof config.summary === 'function') summaryProviders[panel.id] = config.summary;
        panelElements.push(panel);
    });
    manager.initCollapse();

    const layoutStack = () => {
        let top = 76;
        for (const panel of panelElements.slice(1)) {
            if (panel.style.right === 'auto') continue;
            panel.style.top = `${top}px`;
            panel.style.setProperty('--generator-panel-top', `${top}px`);
            top += panel.getBoundingClientRect().height + 12;
        }
    };
    layoutStack();
    const ResizeObserverClass = ownerWindow?.ResizeObserver;
    const stackObserver = typeof ResizeObserverClass === 'function' ? new ResizeObserverClass(layoutStack) : null;
    panelElements.slice(1).forEach(panel => stackObserver?.observe(panel));
    ownerWindow?.addEventListener?.('resize', layoutStack);

    const status = remember(node(ownerDocument, 'p', 'generator-status'));
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    body.append(status);
    const reportError = error => {
        status.textContent = error?.message || String(error);
        onError?.(error);
    };
    const ui = new ToolUiController({
        id,
        title,
        actions,
        summaries: summaryProviders,
        onError: reportError,
        ownerDocument,
        ownerWindow
    }).init();

    adoptColors(ownerDocument);
    let disposed = false;
    let disposeLifecycle = () => {};
    const api = {
        ui,
        manager,
        panels: panelElements,
        reportError,
        destroy() {
            if (disposed) return false;
            disposed = true;
            disposeLifecycle();
            ui.destroy();
            manager.destroy();
            stackObserver?.disconnect();
            ownerWindow?.removeEventListener?.('resize', layoutStack);
            created.forEach(element => element.remove());
            body.classList.remove('generator-tool');
            if (previousGenerator == null) delete body.dataset.generator; else body.dataset.generator = previousGenerator;
            if (previousPanelCount == null) delete body.dataset.generatorPanels; else body.dataset.generatorPanels = previousPanelCount;
            ownerDocument.title = previousTitle;
            if (owners.get(ownerDocument) === api) owners.delete(ownerDocument);
            return true;
        }
    };
    owners.set(ownerDocument, api);
    disposeLifecycle = bindPageLifecycle({
        suspend: () => {
            ui.destroy();
            stackObserver?.disconnect();
            ownerWindow?.removeEventListener?.('resize', layoutStack);
        },
        resume: () => {
            ui.init();
            panelElements.slice(1).forEach(panel => stackObserver?.observe(panel));
            ownerWindow?.addEventListener?.('resize', layoutStack);
            layoutStack();
        }
    }, ownerWindow);
    afterMount?.(api);
    return api;
}

function adoptColors(root) {
    const swatches = [];
    const inputs = new Map();
    const subscribers = new Map();
    for (const input of root.querySelectorAll('.generator-panel input[type="color"]')) {
        const group = input.closest('.color-input-group, .color-picker-container');
        const hex = group?.querySelector('input[type="text"]');
        if (!group || !hex) continue;
        const caption = group.parentElement.querySelector('label, .control-label');
        const name = caption?.textContent.replace(/:\s*$/u, '') || input.id;
        const type = input.id;
        const row = node(root, 'div', 'color-swatch-row');
        const compact = node(root, 'div', 'color-swatch-compact');
        compact.id = `${type}-swatch`;
        const dot = node(root, 'button', 'color-dot color-dot--expandable');
        dot.id = `${type}-dot`;
        dot.type = 'button';
        dot.setAttribute('aria-label', name);
        const slot = node(root, 'div', 'color-hsb-slot');
        slot.id = `${type}-hsb`;
        hex.className = 'color-swatch-hex';
        hex.setAttribute('aria-label', `${name} HEX`);
        input.hidden = true;
        caption?.remove();
        group.before(row);
        compact.append(dot, node(root, 'span', 'color-label', name), hex);
        row.append(compact, slot, input);
        group.remove();
        swatches.push({ type, setting: type, itemId: compact.id, dotId: dot.id, hexId: hex.id, hsbSlotId: slot.id, label: name });
        inputs.set(type, input);
        const notify = () => subscribers.get(type)?.forEach(callback => callback(input.value));
        input.addEventListener('input', notify);
        hex.addEventListener('input', notify);
        hex.addEventListener('blur', notify);
    }
    if (!swatches.length) return null;
    const container = node(root, 'div');
    container.id = 'generatorColorPicker';
    root.getElementById(swatches[0].hsbSlotId).append(container);
    const settings = {
        get: name => inputs.get(name).value,
        set: (name, value) => {
            const input = inputs.get(name);
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        },
        subscribe: (name, callback) => {
            if (!subscribers.has(name)) subscribers.set(name, []);
            subscribers.get(name).push(callback);
            return () => subscribers.set(name, (subscribers.get(name) || []).filter(item => item !== callback));
        }
    };
    return new UnifiedColorPicker({ settings, containerId: container.id, swatches }).init();
}

export function normalizeControls(root, ownerDocument = root?.ownerDocument || globalThis.document) {
    root.querySelectorAll('.control-group > .control-label').forEach(caption => {
        if (caption.tagName === 'LABEL') return;
        const control = caption.parentElement.querySelector('input, select, textarea');
        const label = node(ownerDocument, 'label', 'control-label', caption.textContent);
        if (control?.id) label.htmlFor = control.id;
        caption.replaceWith(label);
    });
    root.querySelectorAll('h2, h3').forEach(heading => {
        heading.className = 'control-field-heading';
        heading.removeAttribute('style');
    });
    root.querySelectorAll('input[type="range"]').forEach(range => {
        range.className = '';
        range.removeAttribute('style');
        let group = range.closest('.control-group, .slider-group');
        const label = (range.id && root.querySelector(`label[for="${CSS.escape(range.id)}"]`)) || group?.querySelector('label, .control-label');
        if (!group) {
            group = node(ownerDocument, 'div', 'control-group');
            range.before(group);
            if (label) group.append(label);
            group.append(range);
        }
        group.classList.add('control-group', 'generator-range');
        if (label) {
            const output = group.querySelector('[id$="Value"], [id$="-value"], .slider-value, .value-display') || label.querySelector('span[id]');
            if (output) {
                output.classList.add('value-display');
                label.append(output);
            }
            label.removeAttribute('style');
        }
    });
    root.querySelectorAll('input[type="checkbox"]').forEach(input => {
        let label = input.closest('label') || (input.id && root.querySelector(`label[for="${CSS.escape(input.id)}"]`));
        if (!label) {
            label = node(ownerDocument, 'label');
            input.before(label);
        }
        const text = [...label.childNodes].filter(item => item !== input).map(item => item.textContent).join('').trim();
        const caption = node(ownerDocument, 'span', '', text || input.getAttribute('aria-label') || 'Enabled');
        label.replaceChildren(input, caption);
        label.className = 'pill-toggle';
        label.removeAttribute('style');
        input.className = 'sr-only';
        const group = label.closest('.control-group, .checkbox-group, .checkbox-container');
        if (group && group !== label) group.classList.add('pill-toggle-row');
    });
    root.querySelectorAll('select').forEach(select => {
        select.className = 'select-input';
        select.removeAttribute('style');
    });
    root.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
        input.className = 'text-input';
        input.removeAttribute('style');
    });
    root.querySelectorAll('button').forEach(button => {
        button.classList.add('panel-action');
        button.removeAttribute('style');
    });
}

/** Resolve only after PNG encoding and download dispatch complete. */
export function downloadCanvas(canvas, filename) {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error('PNG encoding failed.'));
                    return;
                }
                try {
                    downloadBlob(blob, filename);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }, 'image/png');
        } catch (error) {
            reject(error);
        }
    });
}

export function downloadBlob(blob, filename, ownerDocument = globalThis.document, ownerUrl = globalThis.URL) {
    const url = ownerUrl.createObjectURL(blob);
    const link = ownerDocument.createElement('a');
    link.href = url;
    link.download = filename;
    try {
        ownerDocument.body.append(link);
        link.click();
    } finally {
        link.remove();
        globalThis.setTimeout(() => ownerUrl.revokeObjectURL(url), 1000);
    }
}

/** Shared loading, error and same-file reselect semantics; decoding stays app-owned. */
export function connectFileInput({ input, onSelect, onRemove, accept = 'image/*', maxBytes = 30 * 1024 * 1024 } = {}) {
    if (!input) throw new TypeError('A file input is required.');
    const documentRef = input.ownerDocument || globalThis.document;
    const root = input.parentElement;
    root.classList.add('file-intake', 'file-intake--panel');
    root.querySelector(`label[for="${CSS.escape(input.id)}"]`)?.remove();
    input.hidden = true;
    const trigger = node(documentRef, 'button', 'panel-action file-intake__trigger', 'Open file');
    trigger.type = 'button';
    const actions = node(documentRef, 'div', 'file-intake__actions');
    actions.append(trigger);
    const removeButton = onRemove ? node(documentRef, 'button', 'panel-action file-intake__remove', 'Remove file') : null;
    if (removeButton) {
        removeButton.type = 'button';
        removeButton.hidden = true;
        actions.append(removeButton);
    }
    const status = node(documentRef, 'p', 'file-intake__status');
    status.setAttribute('role', 'status');
    root.prepend(actions);
    root.append(status);
    const intake = new FileIntakeController({ input, trigger, removeButton, root, status, accept, maxBytes, onSelect, onRemove }).init();
    const originalDestroy = intake.destroy.bind(intake);
    const disposeLifecycle = bindPageLifecycle({ suspend: originalDestroy, resume: () => intake.init() }, documentRef.defaultView);
    intake.destroy = () => {
        disposeLifecycle();
        return originalDestroy();
    };
    return intake;
}
