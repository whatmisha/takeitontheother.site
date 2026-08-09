const GRAPHICS_TYPES = new Set(['graphics', 'icons', 'claim']);

const EYE_VISIBLE_PATHS = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
const EYE_HIDDEN_PATHS = `${EYE_VISIBLE_PATHS}<line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;
const EYE_VISIBLE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">${EYE_VISIBLE_PATHS}</svg>`;
const EYE_HIDDEN = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">${EYE_HIDDEN_PATHS}</svg>`;

/**
 * Renders the Objects panel and owns its item actions.
 * Object arrays and surface constraints stay on GridGenerator during migration.
 */
export class ObjectNavigatorController {
    constructor(host) {
        this.host = host;
    }

    init() {
        this.render();
        this.host.dom.addTextBtn?.addEventListener('click', () => this.host.addTextBlock());
        this.host.dom.addGraphicsBtn?.addEventListener('click', () => this.host.showGraphicsPanel());
    }

    render() {
        const list = this.host.dom.elementsList;
        if (!list) return;
        list.innerHTML = '';

        this.host.textBlocks.forEach(block => {
            this.createItem({
                name: this.getTextName(block),
                type: 'text',
                blockId: block.id,
                visible: block.visible !== false,
                deleting: block.deleting === true
            });
        });

        (this.host.graphicsBlocks || []).forEach(block => {
            this.createItem({
                name: block.name || 'Graphic',
                type: this.getGraphicsType(block),
                blockId: block.id,
                visible: block.visible !== false,
                deleting: block.deleting === true
            });
        });

        this.host.updatePanelParams();
    }

    getTextName(block) {
        const content = block.content.trim();
        if (content) return content;
        const weight = this.host.getStyleFontWeight(block.styleRef);
        const number = this.host.getBlockNumber(block.id).toString().padStart(2, '0');
        return `${weight} ${number}`;
    }

    getGraphicsType(block) {
        if (!block.isBuiltIn) return 'graphics';
        if (block.id === 'icons') return 'icons';
        if (block.id === 'claim') return 'claim';
        return 'graphics';
    }

    createItem({ name, type, blockId, visible, deleting = false }) {
        const wrapper = document.createElement('div');
        wrapper.className = 'element-item-wrapper';
        if (deleting) wrapper.classList.add('deleting');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'element-item';
        button.dataset.elementType = type;
        if (blockId) button.dataset.elementId = blockId;
        if (!deleting && !visible) button.classList.add('hidden');

        const label = document.createElement('span');
        label.className = 'element-item-text';
        label.textContent = deleting ? 'Undo' : name;
        button.appendChild(label);

        if (deleting) {
            button.addEventListener('click', event => {
                event.stopPropagation();
                this.restorePendingDelete(type, blockId);
            });
        } else {
            button.appendChild(this.createActions({ name, type, blockId, visible }));
            button.addEventListener('click', event => {
                if (!event.target.closest('.element-action-btn')) {
                    this.select(type, blockId);
                }
            });
            button.addEventListener('mouseenter', () => this.showBounds(type, blockId));
            button.addEventListener('mouseleave', () => this.hideBounds(type, blockId));
        }

        wrapper.appendChild(button);
        this.host.dom.elementsList.appendChild(wrapper);
        return wrapper;
    }

    createActions({ name, type, blockId, visible }) {
        const actions = document.createElement('div');
        actions.className = 'element-actions';

        const visibility = this.createActionButton('Hide', visible ? EYE_VISIBLE : EYE_HIDDEN);
        visibility.title = visible ? 'Hide' : 'Show';
        visibility.addEventListener('click', event => {
            event.stopPropagation();
            this.toggleVisibility(type, blockId);
        });

        const duplicate = this.createActionButton(
            'Duplicate',
            '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="5" y="5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
        );
        duplicate.dataset.elementType = type;
        if (blockId) duplicate.dataset.elementId = blockId;
        duplicate.addEventListener('click', event => {
            event.stopPropagation();
            this.duplicate(type, blockId);
        });

        const remove = this.createActionButton('Delete', '×');
        remove.dataset.elementType = type;
        if (blockId) remove.dataset.elementId = blockId;
        remove.addEventListener('click', event => {
            event.stopPropagation();
            this.startDelete(remove, type, blockId, name);
        });

        actions.append(visibility, duplicate, remove);
        return actions;
    }

    createActionButton(title, content) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'element-action-btn';
        button.title = title;

        const icon = document.createElement('span');
        icon.className = 'element-action-icon';
        icon.innerHTML = content;
        button.appendChild(icon);
        return button;
    }

    bindCanvasHover() {
        const svg = this.host.dom.svg;
        if (!svg) return;

        svg.querySelectorAll('[data-block-id]').forEach(element => {
            const blockId = element.getAttribute('data-block-id');
            element.addEventListener('mouseenter', () => {
                this.getItem(blockId)?.classList.add('hover-from-canvas');
            });
            element.addEventListener('mouseleave', () => {
                this.getItem(blockId)?.classList.remove('hover-from-canvas');
            });
        });
    }

    getItem(blockId) {
        return this.host.dom.elementsList?.querySelector(`[data-element-id="${blockId}"]`) || null;
    }

    getBlock(type, blockId) {
        if (type === 'text') {
            return this.host.textBlocks.find(block => block.id === blockId) || null;
        }
        if (GRAPHICS_TYPES.has(type)) {
            return this.host.getGraphicsBlock(blockId) || null;
        }
        return null;
    }

    toggleVisibility(type, blockId) {
        const block = this.getBlock(type, blockId);
        if (!block) return;

        this.host.historyManager.beginAction(
            `toggle visibility ${type}`,
            this.host.getStateSnapshot()
        );
        block.visible = block.visible === false;
        this.syncVisibilityItem(blockId, block.visible);
        this.syncOpenGraphicsPanel(blockId, block.visible);
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
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

    syncOpenGraphicsPanel(blockId, visible) {
        if (this.host.currentEditingGraphicsId !== blockId) return;
        const svg = document.querySelector('#graphicsHideBtn svg');
        if (svg) svg.innerHTML = visible ? EYE_HIDDEN_PATHS : EYE_VISIBLE_PATHS;
    }

    duplicate(type, blockId, skipSelection = false) {
        const original = this.getBlock(type, blockId);
        if (!original) return null;

        this.host.historyManager.beginAction(`duplicate ${type}`, this.host.getStateSnapshot());
        const isText = type === 'text';
        const id = `${isText ? 'text' : 'graphics'}-${Date.now()}`;
        const duplicate = {
            ...original,
            id,
            x: original.x + 1,
            visible: true,
            ...(isText ? {} : { isBuiltIn: false })
        };

        this.host.constrainBlockToSurface(duplicate, isText ? 'text' : 'graphics');
        (isText ? this.host.textBlocks : this.host.graphicsBlocks).push(duplicate);
        this.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());

        if (!skipSelection && !this.host.textDragState.isDragging) {
            setTimeout(() => this.select(isText ? 'text' : 'graphics', id), 100);
        }
        return duplicate;
    }

    startDelete(button, type, blockId) {
        const block = this.getBlock(type, blockId);
        if (!block) return;

        this.host.historyManager.beginAction(`delete ${type}`, this.host.getStateSnapshot());
        const timerKey = `${type}-${blockId}`;
        if (this.host.deletionTimers[timerKey]) {
            clearTimeout(this.host.deletionTimers[timerKey]);
        }

        block.deleting = true;
        if (type === 'text' && this.host.currentEditingBlock?.id === blockId) {
            this.host.closeParagraphPanel();
        } else if (GRAPHICS_TYPES.has(type) && this.host.currentEditingGraphicsId === blockId) {
            this.host.closeGraphicsPanel();
        }

        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());

        this.host.deletionTimers[timerKey] = setTimeout(() => {
            const current = this.getBlock(type, blockId);
            if (current?.deleting === true) {
                this.delete(type, blockId);
            }
            delete this.host.deletionTimers[timerKey];
        }, 3000);
    }

    restorePendingDelete(type, blockId) {
        const timerKey = `${type}-${blockId}`;
        if (this.host.deletionTimers[timerKey]) {
            clearTimeout(this.host.deletionTimers[timerKey]);
            delete this.host.deletionTimers[timerKey];
        }
        const block = this.getBlock(type, blockId);
        if (block) delete block.deleting;
        this.host.updateGrid();
    }

    delete(type, blockId) {
        const blocks = type === 'text'
            ? this.host.textBlocks
            : (GRAPHICS_TYPES.has(type) ? this.host.graphicsBlocks : null);
        if (!blocks) return false;
        const index = blocks.findIndex(block => block.id === blockId);
        if (index < 0) return false;
        blocks.splice(index, 1);
        this.render();
        this.host.updateGrid();
        return true;
    }

    select(type, blockId = null) {
        this.host.dom.elementsList?.querySelectorAll('.element-item').forEach(item => {
            item.classList.remove('active');
        });
        this.highlight(type, blockId);

        if (type === 'text' && blockId) {
            this.host.showParagraphPanel(blockId);
        } else if (type === 'graphics') {
            this.host.showGraphicsEditPanel(blockId || type);
        } else if (type === 'icons' || type === 'claim') {
            this.host.showGraphicsEditPanel(type);
        }

        const selector = blockId
            ? `[data-element-id="${blockId}"]`
            : `[data-element-type="${type}"]`;
        this.host.dom.elementsList?.querySelector(selector)?.classList.add('active');
    }

    highlight(type, blockId = null) {
        document.querySelectorAll('[id^="bounds-"]').forEach(bounds => {
            this.setBoundsOpacity(bounds, 0, 0);
        });
        document.querySelectorAll('[id^="graphics-group-"]').forEach(group => {
            if (group.boundsElement) this.setBoundsOpacity(group.boundsElement, 0, 0);
        });

        const bounds = this.getBounds(type, blockId);
        if (!bounds) return;
        this.setBoundsOpacity(bounds, 0.8, 0.1);
        setTimeout(() => this.setBoundsOpacity(bounds, 0, 0), 2000);
    }

    showBounds(type, blockId = null) {
        if (this.host.textDragState.isDragging) return;
        const bounds = this.getBounds(type, blockId);
        if (bounds) this.setBoundsOpacity(bounds, 0.5, 0.05);
    }

    hideBounds(type, blockId = null) {
        if (this.host.textDragState.isDragging) return;
        const bounds = this.getBounds(type, blockId);
        if (bounds) this.setBoundsOpacity(bounds, 0, 0);
    }

    getBounds(type, blockId) {
        if (type === 'text' && blockId) {
            return document.getElementById(`bounds-${blockId}`);
        }
        if (type === 'graphics' && blockId) {
            return document.getElementById(`graphics-group-${blockId}`)?.boundsElement || null;
        }
        if (type === 'icons') {
            return document.getElementById('icons-group')?.boundsElement || null;
        }
        if (type === 'claim') {
            return document.getElementById('claim-group')?.boundsElement || null;
        }
        return null;
    }

    setBoundsOpacity(bounds, stroke, fill) {
        bounds.setAttribute('stroke-opacity', String(stroke));
        bounds.setAttribute('fill-opacity', String(fill));
    }
}
