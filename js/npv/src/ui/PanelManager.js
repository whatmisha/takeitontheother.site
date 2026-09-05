export class PanelManager {
    constructor(panelIds = []) {
        this.panels = panelIds
            .map((id) => document.getElementById(id))
            .filter(Boolean);
        this.expandedSnapshot = null;
        this.highestZ = 1000;
        this.suppressClick = new WeakSet();
        this.bind();
    }

    bind() {
        this.panels.forEach((panel) => {
            const header = panel.querySelector('.panel-header');
            if (!header) return;
            let drag = null;
            header.addEventListener('click', (event) => {
                if (this.suppressClick.has(header)) {
                    this.suppressClick.delete(header);
                    return;
                }
                const collapsed = panel.classList.toggle('is-collapsed');
                header.setAttribute('aria-expanded', String(!collapsed));
            });
            header.addEventListener('pointerdown', (event) => {
                if (event.button !== 0) return;
                const rect = panel.getBoundingClientRect();
                drag = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    left: rect.left,
                    top: rect.top,
                    moved: false
                };
                panel.style.zIndex = String(++this.highestZ);
                header.setPointerCapture(event.pointerId);
            });
            header.addEventListener('pointermove', (event) => {
                if (!drag || event.pointerId !== drag.pointerId) return;
                const dx = event.clientX - drag.startX;
                const dy = event.clientY - drag.startY;
                if (Math.hypot(dx, dy) < 3) return;
                drag.moved = true;
                const left = Math.min(window.innerWidth - panel.offsetWidth - 8, Math.max(8, drag.left + dx));
                const top = Math.min(window.innerHeight - 52, Math.max(8, drag.top + dy));
                panel.style.left = `${left}px`;
                panel.style.top = `${top}px`;
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
            });
            const finish = (event) => {
                if (!drag || event.pointerId !== drag.pointerId) return;
                header.releasePointerCapture?.(event.pointerId);
                const moved = drag.moved;
                drag = null;
                if (moved) {
                    this.suppressClick.add(header);
                }
            };
            header.addEventListener('pointerup', finish);
            header.addEventListener('pointercancel', finish);
        });
    }

    setCollapsed(panel, collapsed) {
        panel.classList.toggle('is-collapsed', collapsed);
        panel.querySelector('.panel-header')?.setAttribute('aria-expanded', String(!collapsed));
    }

    toggleAllCollapsed() {
        if (this.expandedSnapshot) {
            const restore = this.expandedSnapshot;
            this.expandedSnapshot = null;
            restore.forEach((panel) => this.setCollapsed(panel, false));
            return false;
        }
        this.expandedSnapshot = this.panels.filter((panel) => !panel.classList.contains('is-collapsed'));
        this.expandedSnapshot.forEach((panel) => this.setCollapsed(panel, true));
        return true;
    }
}
