/**
 * PanelManager - Panel management (open, close, drag, z-index)
 */
export class PanelManager {
    constructor() {
        this.panels = new Map();
        this.highestZIndex = 1000;
        this.expandedPanelSnapshot = null;
        this.dragState = {
            isDragging: false,
            panel: null,
            startX: 0,
            startY: 0,
            initialX: 0,
            initialY: 0
        };
    }

    /**
     * Register panel
     */
    registerPanel(panelId, config = {}) {
        const panel = document.getElementById(panelId);
        const header = document.getElementById(config.headerId);
        
        if (!panel) {
            console.warn(`Panel not found: ${panelId}`);
            return;
        }

        const panelData = {
            element: panel,
            header: header,
            config: {
                draggable: config.draggable !== false,
                initialPosition: config.initialPosition || null,
                onOpen: config.onOpen || null,
                onClose: config.onClose || null,
                persistent: config.persistent || false // Doesn't close on outside click
            },
            isOpen: !panel.style.display || panel.style.display !== 'none',
            position: { x: 0, y: 0 }
        };

        this.panels.set(panelId, panelData);

        // Initialize drag & drop if enabled
        if (panelData.config.draggable && header) {
            this.initDragging(panelId);
        }

        // Set initial position if specified
        if (panelData.config.initialPosition) {
            this.setPosition(panelId, 
                panelData.config.initialPosition.x, 
                panelData.config.initialPosition.y
            );
        }

        // Click on panel brings it to front
        panel.addEventListener('mousedown', () => this.bringToFront(panelId));
    }

    /**
     * Initialize panel dragging
     */
    initDragging(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData || !panelData.header) return;

        const header = panelData.header;
        
        header.style.cursor = 'grab';
        
        header.addEventListener('mousedown', (e) => {
            // Check that click is not on close button
            if (e.target.closest('.collapse-toggle, .modal-close')) {
                return;
            }
            
            this.startDragging(panelId, e);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.dragState.isDragging && this.dragState.panel === panelId) {
                this.onDragging(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.dragState.isDragging && this.dragState.panel === panelId) {
                this.stopDragging();
            }
        });
    }

    /**
     * Start dragging
     */
    startDragging(panelId, event) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        event.preventDefault();

        const panel = panelData.element;
        const rect = panel.getBoundingClientRect();

        this.dragState = {
            isDragging: true,
            panel: panelId,
            startX: event.clientX,
            startY: event.clientY,
            initialX: rect.left,
            initialY: rect.top
        };

        if (panelData.header) {
            panelData.header.style.cursor = 'grabbing';
        }
        
        panel.style.transition = 'none';
        this.bringToFront(panelId);
    }

    /**
     * Dragging process
     */
    onDragging(event) {
        if (!this.dragState.isDragging) return;

        const panelData = this.panels.get(this.dragState.panel);
        if (!panelData) return;

        const deltaX = event.clientX - this.dragState.startX;
        const deltaY = event.clientY - this.dragState.startY;

        const newX = this.dragState.initialX + deltaX;
        const newY = this.dragState.initialY + deltaY;

        // Constrain to window boundaries
        const panel = panelData.element;
        const rect = panel.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));

        this.setPosition(this.dragState.panel, constrainedX, constrainedY);
    }

    /**
     * Stop dragging
     */
    stopDragging() {
        if (!this.dragState.isDragging) return;

        const panelData = this.panels.get(this.dragState.panel);
        if (panelData && panelData.header) {
            panelData.header.style.cursor = 'grab';
        }

        const panel = panelData?.element;
        if (panel) {
            panel.style.transition = '';
        }

        this.dragState = {
            isDragging: false,
            panel: null,
            startX: 0,
            startY: 0,
            initialX: 0,
            initialY: 0
        };
    }

    /**
     * Set panel position
     */
    setPosition(panelId, x, y) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        const panel = panelData.element;
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';

        panelData.position = { x, y };
    }

    /**
     * Open panel
     */
    open(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        panelData.element.style.display = 'block';
        panelData.isOpen = true;
        
        this.bringToFront(panelId);

        if (panelData.config.onOpen) {
            panelData.config.onOpen();
        }
    }

    /**
     * Close panel
     */
    close(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        panelData.element.style.display = 'none';
        panelData.isOpen = false;

        if (panelData.config.onClose) {
            panelData.config.onClose();
        }
    }

    /**
     * Toggle panel visibility
     */
    toggle(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        if (panelData.isOpen) {
            this.close(panelId);
        } else {
            this.open(panelId);
        }
    }

    /**
     * Bring panel to front
     */
    bringToFront(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        this.highestZIndex++;
        panelData.element.style.zIndex = this.highestZIndex;
    }

    /**
     * Check if panel is open
     */
    isOpen(panelId) {
        const panelData = this.panels.get(panelId);
        return panelData ? panelData.isOpen : false;
    }

    /**
     * Close all non-persistent panels
     */
    closeAll(except = []) {
        this.panels.forEach((panelData, panelId) => {
            if (!except.includes(panelId) && !panelData.config.persistent && panelData.isOpen) {
                this.close(panelId);
            }
        });
    }

    /**
     * Reset panel position to initial
     */
    resetPosition(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        const panel = panelData.element;
        panel.style.left = '';
        panel.style.top = '';
        panel.style.right = '';
        panel.style.bottom = '';

        if (panelData.config.initialPosition) {
            this.setPosition(panelId, 
                panelData.config.initialPosition.x, 
                panelData.config.initialPosition.y
            );
        }
    }

    /**
     * Get current panel position
     */
    getPosition(panelId) {
        const panelData = this.panels.get(panelId);
        return panelData ? { ...panelData.position } : null;
    }

    /**
     * Center panel on screen
     */
    center(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        const panel = panelData.element;
        const rect = panel.getBoundingClientRect();
        
        const x = (window.innerWidth - rect.width) / 2;
        const y = (window.innerHeight - rect.height) / 2;

        this.setPosition(panelId, x, y);
    }

    /**
     * Wire collapse toggles for every panel. Clicking a `.collapse-icon` inside a
     * `.controls-panel` toggles the `.panel-collapsed` class (CSS animates the body).
     * Idempotent and selector-driven so new panels work without registration.
     * @param {Object} [opts]
     * @param {string} [opts.iconSelector='.collapse-icon']
     * @param {string} [opts.panelSelector='.controls-panel']
     */
    initCollapse({ iconSelector = '.collapse-icon', panelSelector = '.controls-panel' } = {}) {
        document.querySelectorAll(iconSelector).forEach((icon) => {
            if (icon.dataset.collapseBound === '1') return;
            icon.dataset.collapseBound = '1';
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                const panel = icon.closest(panelSelector);
                if (!panel) return;
                panel.classList.toggle('panel-collapsed');
                icon.classList.toggle('collapsed');
            });
        });
    }

    /** Programmatically collapse/expand a registered panel. */
    setCollapsed(panelId, collapsed) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;
        panelData.element.classList.toggle('panel-collapsed', !!collapsed);
        const icon = panelData.element.querySelector('.collapse-icon');
        if (icon) icon.classList.toggle('collapsed', !!collapsed);
    }

    /**
     * Collapse every currently expanded panel, then restore exactly that set on
     * the next call. Panels that were already collapsed stay collapsed.
     */
    toggleAllCollapsed() {
        if (this.expandedPanelSnapshot !== null) {
            const panelIds = this.expandedPanelSnapshot;
            this.expandedPanelSnapshot = null;
            panelIds.forEach((panelId) => this.setCollapsed(panelId, false));
            return { collapsed: false, panelIds: [...panelIds] };
        }

        const panelIds = [...this.panels.entries()]
            .filter(([, panelData]) => (
                panelData.isOpen
                && !panelData.element.classList.contains('panel-collapsed')
            ))
            .map(([panelId]) => panelId);
        this.expandedPanelSnapshot = panelIds;
        panelIds.forEach((panelId) => this.setCollapsed(panelId, true));
        return { collapsed: true, panelIds: [...panelIds] };
    }
}
