/**
 * Toast.js — non-blocking feedback notifications.
 *
 * Replaces native `alert()` so import failures and export results don't
 * interrupt the user's flow. Styles ship inline (no new CSS file) so the
 * component is self-contained.
 *
 * Usage:
 *   import { showToast } from './ui/Toast.js';
 *   showToast('Saved', 'success');
 *   showToast('Import failed: …', 'error');
 *
 * Variants: 'success' | 'error' | 'info'. Auto-dismisses after `ttl` ms
 * (default 3500 for success/info, 6500 for errors — they deserve longer).
 *
 * Safety note: the text content is always inserted via textContent, never
 * innerHTML, so messages containing HTML / <script> are harmless.
 */

const STACK_ID   = 'yfToastStack';
const BASE_STYLE = `
    position: fixed;
    right: 18px;
    bottom: 80px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 10000;
    pointer-events: none;
`;
const TOAST_STYLE = `
    min-width: 220px;
    max-width: 360px;
    padding: 10px 14px;
    border-radius: 8px;
    background: #1e1e1e;
    color: #e6e7e8;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    border-left: 3px solid #4ea1ff;
    pointer-events: auto;
    cursor: pointer;
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 160ms ease, transform 160ms ease;
`;
const VARIANT_COLORS = {
    success: '#3ccf6f',
    error:   '#ff6b6b',
    info:    '#4ea1ff'
};
const DEFAULT_TTL = { success: 3500, info: 3500, error: 6500 };

let stack = null;

function ensureStack() {
    if (stack && document.body.contains(stack)) return stack;
    stack = document.getElementById(STACK_ID);
    if (!stack) {
        stack = document.createElement('div');
        stack.id = STACK_ID;
        stack.setAttribute('role', 'status');
        stack.setAttribute('aria-live', 'polite');
        stack.style.cssText = BASE_STYLE;
        document.body.appendChild(stack);
    }
    return stack;
}

/**
 * Show a toast notification.
 *
 * @param {string} message  Plain text message.
 * @param {'success'|'error'|'info'} [variant='info']
 * @param {{ttl?: number}} [opts]
 * @returns {() => void} dismiss function (removes the toast early)
 */
export function showToast(message, variant = 'info', opts = {}) {
    if (typeof document === 'undefined') return () => {};
    const container = ensureStack();

    const toast = document.createElement('div');
    toast.style.cssText    = TOAST_STYLE;
    toast.style.borderLeftColor = VARIANT_COLORS[variant] ?? VARIANT_COLORS.info;
    toast.textContent      = String(message);
    toast.setAttribute('data-variant', variant);

    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        toast.style.opacity   = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 180);
    };

    toast.addEventListener('click', dismiss);
    container.appendChild(toast);

    // Entrance animation on next frame.
    requestAnimationFrame(() => {
        toast.style.opacity   = '1';
        toast.style.transform = 'translateY(0)';
    });

    const ttl = opts.ttl ?? DEFAULT_TTL[variant] ?? 3500;
    if (ttl > 0) setTimeout(dismiss, ttl);

    return dismiss;
}
