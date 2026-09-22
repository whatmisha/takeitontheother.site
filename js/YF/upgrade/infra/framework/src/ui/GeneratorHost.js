import { ToolUiController } from './ToolUiController.js';
import { PanelManager } from './PanelManager.js';
import { UnifiedColorPicker } from './UnifiedColorPicker.js';
import { FileIntakeController } from './FileIntakeController.js';

const owners = new WeakMap();

/** BFCache keeps the document alive. Suspend on exit and rebind on restore;
 * a normal unload removes the lifecycle listeners themselves. */
export function bindPageLifecycle({ suspend, resume }, ownerWindow = window) {
    const leave = event => { suspend(); if (!event.persisted) dispose(); };
    const enter = event => { if (event.persisted) resume(); };
    const dispose = () => {
        ownerWindow.removeEventListener('pagehide', leave);
        ownerWindow.removeEventListener('pageshow', enter);
    };
    ownerWindow.addEventListener('pagehide', leave);
    ownerWindow.addEventListener('pageshow', enter);
    return dispose;
}
const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
};

/** Adapt existing generator controls without taking ownership of their model/canvas.
 * Call once, after private controls have been created. Never clones input nodes or
 * synthesizes their change events: private ranges and undo transactions stay intact.
 */
export function mountGenerator({ id, title, panels, actions, summaries = {}, onError, afterMount }) {
    summaries = { ...Object.fromEntries(panels.flatMap((panel, index) => panel.summary
        ? [[panel.id || `${id}-panel-${index}`, panel.summary]] : [])), ...summaries };
    if (owners.has(document)) {
        const existing = owners.get(document);
        existing.ui.destroy();
        existing.ui = new ToolUiController({ id, title, actions, summaries, onError: existing.reportError }).init();
        return existing;
    }
    document.body.classList.add('generator-tool');
    document.body.dataset.generator = id;
    document.body.dataset.generatorPanels = String(panels.length);
    document.title = title;
    document.querySelectorAll('.migration-notice, .upgrade-migration-preview').forEach(item => item.remove());
    const links = node('nav', 'top-links');
    const back = node('a', 'top-link', '← Upgrade Tools');
    back.href = '../'; links.append(back); document.body.prepend(links);
    back.setAttribute('aria-label', 'Back to Upgrade Tools');

    const dock = node('nav', 'bottom-buttons action-dock');
    dock.setAttribute('aria-label', 'Export actions'); dock.setAttribute('role', 'toolbar');
    const primary = node('div', 'action-dock__slot action-dock__slot--primary');
    const utility = node('div', 'action-dock__slot action-dock__slot--utility');
    dock.append(utility, primary); document.body.append(dock);
    for (const action of actions) {
        const button = document.getElementById(action.button);
        if (!button) throw new Error(`${id}: missing action ${action.button}`);
        button.removeAttribute('style');
        if (action.group === 'primary') button.hidden = false;
        button.className = action.group === 'panel' ? 'panel-action' : 'btn-fixed';
        if (action.group !== 'panel') (action.group === 'extra' ? utility : primary).append(button);
    }

    const manager = new PanelManager();
    const panelElements = [];
    panels.forEach((config, index) => {
        const panel = node('section', 'controls-panel generator-panel');
        panel.id = config.id || `${id}-panel-${index}`;
        const header = node('div', 'panel-header'); header.id = `${panel.id}-header`;
        header.append(node('span', '', config.title));
        const collapse = node('button', 'collapse-icon', '⌄');
        collapse.type = 'button'; collapse.setAttribute('aria-label', 'Collapse panel');
        collapse.setAttribute('aria-expanded', 'true'); header.append(collapse);
        const content = node('div', 'panel-content');
        const section = node('div', 'control-section generator-controls');
        for (const selector of config.selectors) {
            const selected = [...document.querySelectorAll(selector)];
            if (!selected.length) throw new Error(`${id}: missing panel content ${selector}`);
            for (const element of selected) {
                element.classList.remove('controls-panel');
                section.append(element);
            }
        }
        normalizeControls(section);
        content.append(section); panel.append(header, content); document.body.append(panel);
        panel.style.left = index === 0 ? '20px' : 'auto';
        panel.style.right = index === 0 ? 'auto' : '20px';
        const top = index > 1 ? Math.min(panelElements[index - 1].getBoundingClientRect().bottom + 12, window.innerHeight - 154) : 76;
        panel.style.top = `${top}px`;
        panel.style.setProperty('--generator-panel-top', `${top}px`);
        if (index > 1) { panel.classList.add('panel-collapsed'); collapse.classList.add('collapsed'); collapse.setAttribute('aria-expanded', 'false'); collapse.setAttribute('aria-label', 'Expand panel'); }
        collapse.addEventListener('click', () => {
            const collapsed = panel.classList.toggle('panel-collapsed');
            collapse.classList.toggle('collapsed', collapsed);
            collapse.setAttribute('aria-expanded', String(!collapsed));
            collapse.setAttribute('aria-label', collapsed ? 'Expand panel' : 'Collapse panel');
        });
        manager.registerPanel(panel.id, { headerId: header.id });
        panelElements.push(panel);
    });
    // Keep the small Settings panel above Tone. Image previews may grow Tone,
    // so a one-time measurement below it would hide Settings after file intake.
    // Dragged panels have right:auto and are no longer automatically positioned.
    const layoutStack = () => {
        if (panelElements.length !== 3) return;
        const [, tone, settings] = panelElements;
        if (settings.style.right === 'auto' || tone.style.right === 'auto') return;
        settings.style.top = '76px';
        settings.style.setProperty('--generator-panel-top', '76px');
        settings.style.setProperty('--generator-panel-height', `${Math.max(150, (window.innerHeight - 164) * 0.4)}px`);
        const top = settings.getBoundingClientRect().bottom + 12;
        tone.style.top = `${top}px`;
        tone.style.setProperty('--generator-panel-top', `${top}px`);
    };
    layoutStack();
    const stackObserver = panelElements.length === 3 ? new ResizeObserver(layoutStack) : null;
    if (stackObserver) {
        stackObserver.observe(panelElements[2]);
        window.addEventListener('resize', layoutStack);
    }
    const status = node('p', 'generator-status');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    document.body.append(status);
    const reportError = error => { status.textContent = error?.message || String(error); onError?.(error); };
    const ui = new ToolUiController({ id, title, actions, summaries, onError: reportError }).init();
    const api = { ui, manager, panels: panelElements, reportError };
    owners.set(document, api);
    adoptColors(document);
    afterMount?.(api);
    bindPageLifecycle({
        suspend: () => {
            api.ui.destroy();
            stackObserver?.disconnect();
            window.removeEventListener('resize', layoutStack);
        },
        resume: () => {
            api.ui.init();
            if (stackObserver) {
                stackObserver.observe(panelElements[2]);
                window.addEventListener('resize', layoutStack);
                layoutStack();
            }
        }
    });
    return api;
}

function adoptColors(root) {
    const swatches = [], inputs = new Map(), subscribers = new Map();
    for (const input of root.querySelectorAll('.generator-panel input[type="color"]')) {
        const group = input.closest('.color-input-group, .color-picker-container');
        const hex = group?.querySelector('input[type="text"]');
        if (!group || !hex) continue;
        const caption = group.parentElement.querySelector('label, .control-label');
        const name = caption?.textContent.replace(/:\s*$/, '') || input.id;
        const type = input.id;
        const row = node('div', 'color-swatch-row');
        const compact = node('div', 'color-swatch-compact'); compact.id = `${type}-swatch`;
        const dot = node('button', 'color-dot color-dot--expandable'); dot.id = `${type}-dot`; dot.type = 'button'; dot.setAttribute('aria-label', name);
        const slot = node('div', 'color-hsb-slot'); slot.id = `${type}-hsb`;
        hex.className = 'color-swatch-hex'; hex.setAttribute('aria-label', `${name} HEX`);
        input.hidden = true; caption?.remove(); group.before(row);
        compact.append(dot, node('span', 'color-label', name), hex); row.append(compact, slot, input); group.remove();
        swatches.push({ type, setting: type, itemId: compact.id, dotId: dot.id, hexId: hex.id, hsbSlotId: slot.id, label: name });
        inputs.set(type, input);
        const notify = () => subscribers.get(type)?.forEach(callback => callback(input.value));
        input.addEventListener('input', notify); hex.addEventListener('input', notify); hex.addEventListener('blur', notify);
    }
    if (!swatches.length) return;
    const container = node('div'); container.id = 'generatorColorPicker';
    document.getElementById(swatches[0].hsbSlotId).append(container);
    const settings = {
        get: name => inputs.get(name).value,
        set: (name, value) => { const input = inputs.get(name); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); },
        subscribe: (name, callback) => { if (!subscribers.has(name)) subscribers.set(name, []); subscribers.get(name).push(callback); }
    };
    new UnifiedColorPicker({ settings, containerId: container.id, swatches }).init();
}

export function normalizeControls(root) {
    root.querySelectorAll('.control-group > .control-label').forEach(caption => {
        if (caption.tagName === 'LABEL') return;
        const control = caption.parentElement.querySelector('input, select, textarea');
        const label = node('label', 'control-label', caption.textContent);
        if (control?.id) label.htmlFor = control.id;
        caption.replaceWith(label);
    });
    root.querySelectorAll('h2, h3').forEach(heading => { heading.className = 'control-field-heading'; heading.removeAttribute('style'); });
    root.querySelectorAll('input[type="range"]').forEach(range => {
        range.className = '';
        range.removeAttribute('style');
        let group = range.closest('.control-group, .slider-group');
        const label = (range.id && root.querySelector(`label[for="${CSS.escape(range.id)}"]`))
            || group?.querySelector('label, .control-label');
        if (!group) {
            group = node('div', 'control-group'); range.before(group);
            if (label) group.append(label); group.append(range);
        }
        group.classList.add('control-group', 'generator-range');
        if (label) {
            const value = group.querySelector('[id$="Value"], [id$="-value"], .slider-value, .value-display') || label.querySelector('span[id]');
            if (value) { value.classList.add('value-display'); label.append(value); }
            label.removeAttribute('style');
            if (range.parentElement !== group) {
                const holder = range.parentElement;
                label.after(range);
                if (!holder.children.length) holder.remove();
            }
        }
    });
    root.querySelectorAll('input[type="checkbox"]').forEach(input => {
        let label = input.closest('label') || (input.id && root.querySelector(`label[for="${CSS.escape(input.id)}"]`));
        if (!label) { label = node('label'); input.before(label); }
        const text = [...label.childNodes].filter(item => item !== input).map(item => item.textContent).join('').trim();
        const caption = node('span', '', text || input.getAttribute('aria-label') || 'Enabled');
        label.replaceChildren(input, caption);
        label.className = 'pill-toggle'; label.removeAttribute('style'); input.className = 'sr-only';
        const group = label.closest('.control-group, .checkbox-group, .checkbox-container, .sound-reactive-option');
        if (group && group !== label) group.classList.add('pill-toggle-row');
    });
    root.querySelectorAll('select').forEach(select => { select.className = 'select-input'; select.removeAttribute('style'); });
    root.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
        input.className = 'text-input'; input.removeAttribute('style');
    });
    root.querySelectorAll('button').forEach(button => { button.classList.add('panel-action'); button.removeAttribute('style'); });
    root.querySelectorAll('.colon, .separator').forEach(element => element.remove());
}

/** Resolve only once PNG encoding has completed and a download was dispatched. */
export function downloadCanvas(canvas, filename) {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob(blob => {
                if (!blob) { reject(new Error('PNG encoding failed')); return; }
                try { downloadBlob(blob, filename); resolve(); } catch (error) { reject(error); }
            }, 'image/png');
        } catch (error) { reject(error); }
    });
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename;
    try { document.body.append(link); link.click(); }
    finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

/** Shared loading/error/reselect semantics, while decoding remains app-owned. */
export function connectFileInput({ input, onSelect, onRemove, accept = 'image/*', maxBytes = 30 * 1024 * 1024 }) {
    const root = input.parentElement;
    root.classList.add('file-intake');
    root.querySelector(`label[for="${CSS.escape(input.id)}"]`)?.remove();
    input.hidden = true;
    const trigger = node('button', 'panel-action', 'Open image'); trigger.type = 'button';
    const actions = node('div', 'generator-actions'); actions.append(trigger);
    const removeButton = onRemove ? node('button', 'panel-action', 'Remove image') : null;
    if (removeButton) { removeButton.type = 'button'; removeButton.hidden = true; actions.append(removeButton); }
    const status = node('p', 'file-intake-status'); status.setAttribute('role', 'status');
    root.prepend(actions); root.append(status);
    const intake = new FileIntakeController({ input, trigger, removeButton, root, status, accept, maxBytes, onSelect, onRemove }).init();
    bindPageLifecycle({ suspend: () => intake.destroy(), resume: () => intake.init() });
    return intake;
}
