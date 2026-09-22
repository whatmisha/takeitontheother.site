import { ShortcutRouter } from '../core/ShortcutRouter.js';

export function parseCommandShortcut(combo) {
    const parts = String(combo).toLowerCase().split('+').map(part => part.trim());
    const keys = parts.filter(part => !['mod', 'cmd', 'ctrl', 'meta', 'shift', 'alt', 'option'].includes(part));
    if (keys.length !== 1 || !keys[0]) throw new TypeError('Shortcut requires exactly one key.');
    const spec = ShortcutRouter.parse(combo);
    if (spec.key === 'esc') spec.key = 'escape';
    return spec;
}
export const shortcutIdentity = spec => `${+spec.mod}${+spec.shift}${+spec.alt}:${spec.key}`;
export const shortcutLabel = spec => `${spec.shift ? '⇧' : ''}${spec.alt ? '⌥' : ''}${spec.mod ? '⌘' : ''}${spec.key === 'space' ? 'Space' : spec.key.toUpperCase()}`;

export function commandKey(event) {
    // Letter shortcuts follow physical keys in Russian layout as well as English.
    if (/^Key[A-Z]$/.test(event.code || '')) return event.code.slice(3).toLowerCase();
    if (event.code === 'Backslash') return '\\';
    return event.key === ' ' ? 'space' : String(event.key || '').toLowerCase();
}

export function matchesCommand(event, spec) {
    return commandKey(event) === spec.key && Boolean(event.metaKey || event.ctrlKey) === spec.mod
        && Boolean(event.shiftKey) === spec.shift && Boolean(event.altKey) === spec.alt;
}

export function editableTarget(target) {
    return Boolean(target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)
        || target?.closest?.('[contenteditable="true"], [contenteditable=""]'));
}

export function visibleDialog(documentRef) {
    return [...documentRef.querySelectorAll('dialog[open], [role="dialog"], .modal-overlay')].find(node => {
        if (node.hidden || node.closest?.('[hidden], [inert], [aria-hidden="true"]')) return false;
        return typeof node.getClientRects !== 'function' || node.getClientRects().length > 0;
    }) || null;
}
