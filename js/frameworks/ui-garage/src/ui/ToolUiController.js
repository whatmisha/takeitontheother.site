import { UnifiedUiController } from './UnifiedUiController.js';
import { ActionDockController } from './ActionDockController.js';
import { ExportFeedbackController } from './ExportFeedbackController.js';
import { parseCommandShortcut, shortcutIdentity, shortcutLabel, commandKey, matchesCommand, editableTarget, visibleDialog } from './CommandPolicy.js';

const ownerKey = Symbol.for('ui-garage.explicitToolUi');
const managedAttributes = ['data-tool-action', 'data-action-dock-extra', 'data-action-dock-primary-export', 'data-action-dock-json-export', 'data-action-dock-json-import', 'data-export-feedback', 'data-export-feedback-state', 'data-export-feedback-message', 'aria-busy'];

/** Opt-in UI for new tools. No renderer, file decoder, storage or generator ownership. */
export class ToolUiController {
    constructor({ id, title, actions = [], summaries = {}, onError = error => console.error(error), ownerDocument = globalThis.document, ownerWindow = globalThis.window } = {}) {
        if (!id || !title) throw new TypeError('Tool UI requires id and title.');
        this.document = ownerDocument;
        this.window = ownerWindow;
        this.onError = onError;
        const ids = new Set(), shortcuts = new Set(), buttons = new Set();
        this.actions = actions.map(action => {
            const keyboardOnly = action.group === 'keyboard';
            if (!action.id || ids.has(action.id) || (!keyboardOnly && (!action.button || buttons.has(action.button))) || !action.label || typeof action.run !== 'function') throw new TypeError('Each action requires a unique id/button, label and run callback.');
            if (keyboardOnly && (action.button || action.kind !== 'command' || !action.shortcut)) throw new TypeError('Keyboard-only actions require a command and shortcut, without a button.');
            if (!['command', 'import', 'export'].includes(action.kind)) throw new TypeError(`${action.id}: explicit kind is required.`);
            if (!['panel', 'primary', 'extra', 'keyboard'].includes(action.group)) throw new TypeError(`${action.id}: explicit group is required.`);
            if (action.enabled != null && typeof action.enabled !== 'function') throw new TypeError(`${action.id}: enabled must be a callback.`);
            if (action.group === 'primary' && action.kind !== 'export') throw new TypeError('Primary dock actions must be exports.');
            const spec = action.shortcut ? parseCommandShortcut(action.shortcut) : null;
            if (spec) {
                const identity = shortcutIdentity(spec);
                if (shortcuts.has(identity)) throw new TypeError('Duplicate shortcut.');
                if (['j', 'escape', '?'].includes(spec.key) && !spec.mod || spec.mod && ['0', '1', '\\'].includes(spec.key)) throw new TypeError('Reserved UI/browser shortcut.');
                if (spec.key === 'e' && spec.mod && (action.kind !== 'export' || action.group !== 'primary' || spec.shift || spec.alt)) throw new TypeError('mod+e belongs to the primary export.');
                if (spec.key === 'j' && spec.mod && (action.group !== 'extra' || spec.alt || (spec.shift ? action.kind !== 'import' : action.kind !== 'export'))) throw new TypeError('mod+j / mod+shift+j belong to JSON extras.');
                shortcuts.add(identity);
            }
            ids.add(action.id); if (action.button) buttons.add(action.button);
            return { ...action, spec };
        });
        this.bindings = [];
        this.bound = false;
        this.revision = 0;
        this.dock = new ActionDockController({ ownerDocument }); // sync only; this controller owns keyboard routing.
        this.ui = new UnifiedUiController({
            ownerDocument,
            ownerWindow,
            toolName: title,
            summaryProviders: summaries,
            shortcutRows: this.shortcutRows()
        });
        this.handleKeydown = this.handleKeydown.bind(this);
    }

    shortcutRows() {
        const rows = this.actions.filter(action => action.spec).map(action => [action.helpLabel || action.label, shortcutLabel(action.spec)]);
        if (this.actions.some(action => action.group === 'extra')) rows.push(['JSON actions', 'J']);
        return rows;
    }

    init() {
        if (this.bound) return this;
        const resolved = this.actions.map(action => {
            if (action.group === 'keyboard') return { action, button: null };
            const button = typeof action.button === 'string' ? this.document.getElementById(action.button) : action.button;
            if (!button) throw new Error(`${action.id}: action button not found.`);
            if (action.group !== 'panel' && !button.closest('.action-dock')) throw new Error(`${action.id}: export/extra must be in ActionDock.`);
            if (action.group === 'panel' && button.closest('.action-dock')) throw new Error(`${action.id}: source/generation actions belong in panels.`);
            return { action, button };
        });
        const physicalButtons = resolved.map(item => item.button).filter(Boolean);
        if (new Set(physicalButtons).size !== physicalButtons.length) throw new TypeError('Each action must resolve to a different button.');
        this.document[ownerKey]?.destroy();
        this.document[ownerKey] = this;
        this.abort = new AbortController();
        this.revision++;
        this.bound = true;
        this.bindings = resolved.map(({ action, button }) => {
            if (!button) return { action, button: null, feedback: null, pending: null };
            const snapshot = { text: button.textContent, hidden: button.hidden, disabled: button.disabled,
                attributes: new Map(managedAttributes.map(name => [name, button.getAttribute(name)])) };
            button.dataset.toolAction = action.id;
            if (action.group === 'extra') button.dataset.actionDockExtra = 'true';
            if (action.spec?.mod && action.spec.key === 'e') button.dataset.actionDockPrimaryExport = 'true';
            if (action.spec?.mod && action.spec.key === 'j') button.dataset[action.kind === 'import' ? 'actionDockJsonImport' : 'actionDockJsonExport'] = 'true';
            const feedback = action.kind === 'export' ? new ExportFeedbackController({ button, ownerWindow: this.window }) : null;
            const binding = { action, button, snapshot, feedback, pending: null };
            binding.listener = () => this.execute(binding);
            button.addEventListener('click', binding.listener);
            return binding;
        });
        this.document.addEventListener('keydown', this.handleKeydown, true);
        this.refresh();
        this.dock.sync();
        this.ui.init();
        return this;
    }

    refresh() {
        for (const { action, button } of this.bindings) {
            if (!button) continue;
            const primaryExport = action.kind === 'export' && action.group === 'primary' && action.spec?.mod && action.spec.key === 'e';
            const label = primaryExport ? `${action.label} ${shortcutLabel(action.spec)}` : action.label;
            if (button.textContent !== label) button.textContent = label;
            if (action.enabled) button.disabled = !action.enabled();
        }
        this.ui.refreshSummaries();
    }

    execute(binding) {
        const { action, button, feedback } = binding;
        if (!this.bound || button?.disabled || action.enabled && !action.enabled()) return Promise.resolve({ status: 'unavailable' });
        if (binding.pending) return binding.pending;
        const revision = this.revision, signal = this.abort.signal;
        const operation = async () => {
            if (signal.aborted) throw new Error('Action cancelled.');
            const result = await action.run({ signal });
            if (result?.ok === false) throw new Error(result.error || 'Action failed.');
            return result;
        };
        const pending = feedback ? feedback.run(operation) : operation().then(value => ({ status: 'success', value }), error => ({ status: 'error', error }));
        binding.pending = pending.then(result => {
            if (this.bound && revision === this.revision && result.status === 'error') this.onError(result.error, action);
            return result;
        }).finally(() => { binding.pending = null; });
        return binding.pending;
    }

    handleKeydown(event) {
        if (!this.bound || event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 || editableTarget(event.target) || visibleDialog(this.document)) return;
        let handled = false;
        const key = commandKey(event), mod = event.metaKey || event.ctrlKey;
        if (!mod && !event.shiftKey && !event.altKey && ['j', 'escape'].includes(key)) {
            handled = this.dock.toggleExtras({ forceCollapsed: key === 'escape' });
        } else {
            const binding = this.bindings.find(item => item.action.spec && matchesCommand(event, item.action.spec));
            if (binding && !binding.button?.disabled && (!binding.action.enabled || binding.action.enabled())) {
                void this.execute(binding);
                handled = true;
            }
        }
        if (handled) { event.preventDefault(); event.stopImmediatePropagation(); }
    }

    destroy() {
        if (!this.bound) return;
        this.bound = false;
        this.revision++;
        this.abort.abort();
        this.document.removeEventListener('keydown', this.handleKeydown, true);
        this.ui.destroy();
        for (const { button, listener, feedback, snapshot } of this.bindings) {
            if (!button) continue;
            button.removeEventListener('click', listener);
            feedback?.destroy();
            button.textContent = snapshot.text;
            button.hidden = snapshot.hidden;
            button.disabled = snapshot.disabled;
            for (const [name, value] of snapshot.attributes) {
                if (value == null) button.removeAttribute(name); else button.setAttribute(name, value);
            }
        }
        this.bindings = [];
        if (this.document[ownerKey] === this) delete this.document[ownerKey];
    }
}
