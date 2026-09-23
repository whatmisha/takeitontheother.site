const EYE_VISIBLE_PATHS = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
const EYE_HIDDEN_PATHS = `${EYE_VISIBLE_PATHS}<line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;
const EYE_VISIBLE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">${EYE_VISIBLE_PATHS}</svg>`;
const EYE_HIDDEN = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">${EYE_HIDDEN_PATHS}</svg>`;
const DUPLICATE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="5" y="5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
const FORWARD_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10L8 6L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BACKWARD_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** DOM-only view for the Objects panel and canvas bounds feedback. */
export class ObjectNavigatorView {
    constructor(host, actions, documentRef = globalThis.document) {
        this.host = host;
        this.actions = actions;
        this.document = documentRef;
        this.highlightTimers = new Set();
        this.draggedItem = null;
    }

    render(items) {
        const list = this.host.dom.elementsList;
        if (!list) return false;
        list.innerHTML = '';
        items.forEach(item => this.createItem(item));
        return true;
    }

    createItem({
        name,
        type,
        blockId,
        visible,
        deleting = false,
        canBringForward = true,
        canSendBackward = true
    }) {
        const wrapper = this.document.createElement('div');
        wrapper.className = 'element-item-wrapper';
        if (deleting) wrapper.classList.add('deleting');
        else this.bindLayerDrag(wrapper, type, blockId);

        const button = this.document.createElement('button');
        button.type = 'button';
        button.className = 'element-item';
        button.dataset.elementType = type;
        if (blockId) button.dataset.elementId = blockId;
        if (!deleting && !visible) button.classList.add('hidden');

        const label = this.document.createElement('span');
        label.className = 'element-item-text';
        label.textContent = deleting ? 'Undo' : name;
        button.appendChild(label);

        if (deleting) {
            button.addEventListener('click', event => {
                event.stopPropagation();
                this.actions.restorePendingDelete(type, blockId);
            });
        } else {
            button.appendChild(this.createActions({
                name,
                type,
                blockId,
                visible,
                canBringForward,
                canSendBackward
            }));
            button.addEventListener('click', event => {
                if (!event.target.closest('.element-action-btn')) this.actions.select(type, blockId);
            });
            button.addEventListener('mouseenter', () => this.actions.showBounds(type, blockId));
            button.addEventListener('mouseleave', () => this.actions.hideBounds(type, blockId));
        }

        wrapper.appendChild(button);
        this.host.dom.elementsList.appendChild(wrapper);
        return wrapper;
    }

    createActions({ name, type, blockId, visible, canBringForward, canSendBackward }) {
        const actions = this.document.createElement('div');
        actions.className = 'element-actions';
        const visibility = this.createActionButton(visible ? 'Hide' : 'Show', visible ? EYE_VISIBLE : EYE_HIDDEN);
        visibility.addEventListener('click', event => {
            event.stopPropagation();
            this.actions.toggleVisibility(type, blockId);
        });

        const duplicate = this.createActionButton('Duplicate', DUPLICATE_ICON);
        const forward = this.createActionButton('Bring Forward', FORWARD_ICON);
        const backward = this.createActionButton('Send Backward', BACKWARD_ICON);
        forward.disabled = !canBringForward;
        backward.disabled = !canSendBackward;
        const remove = this.createActionButton('Delete', '×');
        [forward, backward, duplicate, remove].forEach(button => {
            button.dataset.elementType = type;
            if (blockId) button.dataset.elementId = blockId;
        });
        duplicate.addEventListener('click', event => {
            event.stopPropagation();
            this.actions.duplicate(type, blockId);
        });
        forward.addEventListener('click', event => {
            event.stopPropagation();
            this.actions.bringForward(type, blockId);
        });
        backward.addEventListener('click', event => {
            event.stopPropagation();
            this.actions.sendBackward(type, blockId);
        });
        remove.addEventListener('click', event => {
            event.stopPropagation();
            this.actions.startDelete(remove, type, blockId, name);
        });
        actions.append(visibility, forward, backward, duplicate, remove);
        return actions;
    }

    bindLayerDrag(wrapper, type, blockId) {
        wrapper.draggable = true;
        wrapper.addEventListener('dragstart', event => {
            this.draggedItem = { type, blockId };
            wrapper.classList.add('dragging');
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', `${type}:${blockId}`);
            }
        });
        wrapper.addEventListener('dragover', event => {
            if (!this.draggedItem || this.draggedItem.blockId === blockId) return;
            event.preventDefault();
            this.clearDropIndicators();
            const midpoint = wrapper.getBoundingClientRect().top + wrapper.offsetHeight / 2;
            wrapper.classList.add(event.clientY < midpoint ? 'drop-before' : 'drop-after');
        });
        wrapper.addEventListener('drop', event => {
            if (!this.draggedItem || this.draggedItem.blockId === blockId) return;
            event.preventDefault();
            const midpoint = wrapper.getBoundingClientRect().top + wrapper.offsetHeight / 2;
            const placement = event.clientY < midpoint ? 'before' : 'after';
            const source = this.draggedItem;
            this.clearLayerDrag();
            this.actions.reorder(source.type, source.blockId, type, blockId, placement);
        });
        wrapper.addEventListener('dragend', () => this.clearLayerDrag());
    }

    clearDropIndicators() {
        this.host.dom.elementsList?.querySelectorAll('.drop-before, .drop-after').forEach(item => {
            item.classList.remove('drop-before', 'drop-after');
        });
    }

    clearLayerDrag() {
        this.host.dom.elementsList?.querySelectorAll('.dragging').forEach(item => {
            item.classList.remove('dragging');
        });
        this.clearDropIndicators();
        this.draggedItem = null;
    }

    createActionButton(title, content) {
        const button = this.document.createElement('button');
        button.type = 'button';
        button.className = 'element-action-btn';
        button.title = title;
        const icon = this.document.createElement('span');
        icon.className = 'element-action-icon';
        icon.innerHTML = content;
        button.appendChild(icon);
        return button;
    }

    bindCanvasHover() {
        this.host.dom.svg?.querySelectorAll('[data-block-id]').forEach(element => {
            const blockId = element.getAttribute('data-block-id');
            element.addEventListener('mouseenter', () => this.getItem(blockId)?.classList.add('hover-from-canvas'));
            element.addEventListener('mouseleave', () => this.getItem(blockId)?.classList.remove('hover-from-canvas'));
        });
    }

    getItem(blockId) {
        return this.host.dom.elementsList?.querySelector(`[data-element-id="${blockId}"]`) || null;
    }

    syncVisibilityItem(blockId, visible) {
        const item = this.getItem(blockId);
        if (!item) return;
        item.classList.toggle('hidden', !visible);
        const button = item.querySelector('.element-action-btn');
        const icon = button?.querySelector('.element-action-icon');
        if (icon) icon.innerHTML = visible ? EYE_VISIBLE : EYE_HIDDEN;
        if (button) button.title = visible ? 'Hide' : 'Show';
    }

    syncOpenGraphicsPanel(visible) {
        const svg = this.document.querySelector('#graphicsHideBtn svg');
        if (svg) svg.innerHTML = visible ? EYE_HIDDEN_PATHS : EYE_VISIBLE_PATHS;
    }

    clearSelection() {
        this.host.dom.elementsList?.querySelectorAll('.element-item').forEach(item => item.classList.remove('active'));
    }

    selectItem(type, blockId = null) {
        const selector = blockId ? `[data-element-id="${blockId}"]` : `[data-element-type="${type}"]`;
        this.host.dom.elementsList?.querySelector(selector)?.classList.add('active');
    }

    highlight(type, blockId = null) {
        this.document.querySelectorAll('[id^="bounds-"]').forEach(bounds => this.setBoundsOpacity(bounds, 0, 0));
        this.document.querySelectorAll('[id^="graphics-group-"]').forEach(group => {
            if (group.boundsElement) this.setBoundsOpacity(group.boundsElement, 0, 0);
        });
        const bounds = this.getBounds(type, blockId);
        if (!bounds) return;
        this.setBoundsOpacity(bounds, 0.8, 0.1);
        const timer = setTimeout(() => {
            this.highlightTimers.delete(timer);
            if (bounds.isConnected !== false) this.setBoundsOpacity(bounds, 0, 0);
        }, 2000);
        this.highlightTimers.add(timer);
    }

    showBounds(type, blockId = null) {
        const bounds = this.getBounds(type, blockId);
        if (bounds) this.setBoundsOpacity(bounds, 0.5, 0.05);
    }

    hideBounds(type, blockId = null) {
        const bounds = this.getBounds(type, blockId);
        if (bounds) this.setBoundsOpacity(bounds, 0, 0);
    }

    getBounds(type, blockId) {
        if (type === 'text' && blockId) return this.document.getElementById(`bounds-${blockId}`);
        if (type === 'graphics' && blockId) return this.document.getElementById(`graphics-group-${blockId}`)?.boundsElement || null;
        if (type === 'icons') return this.document.getElementById('icons-group')?.boundsElement || null;
        if (type === 'claim') return this.document.getElementById('claim-group')?.boundsElement || null;
        return null;
    }

    setBoundsOpacity(bounds, stroke, fill) {
        bounds.setAttribute('stroke-opacity', String(stroke));
        bounds.setAttribute('fill-opacity', String(fill));
    }

    dispose() {
        this.clearLayerDrag();
        this.highlightTimers.forEach(timer => clearTimeout(timer));
        this.highlightTimers.clear();
        return true;
    }
}
