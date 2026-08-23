/** @typedef {'visible' | 'above' | 'below'} PanelStackVisibility */

/**
 * Returns where a panel sits relative to the stack scroll viewport.
 * Partial visibility counts as visible.
 */
export function classifyPanelVisibility(panelRect, scrollRect) {
    if (panelRect.bottom <= scrollRect.top) return 'above';
    if (panelRect.top >= scrollRect.bottom) return 'below';
    return 'visible';
}

export function getPanelHeaderLabel(header) {
    const title = header?.querySelector('span:first-child');
    return title?.innerHTML?.trim() || '';
}

export function getScrollTopForTarget(scrollBody, targetElement) {
    const bodyRect = scrollBody.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    return scrollBody.scrollTop + (targetRect.top - bodyRect.top);
}

export function clampScrollTop(scrollBody, targetScrollTop) {
    const maxScroll = Math.max(0, scrollBody.scrollHeight - scrollBody.clientHeight);
    return Math.max(0, Math.min(maxScroll, targetScrollTop));
}
