/** Keeps floating editor panels inside the viewport and close to their object. */
export class PanelPositioner {
    constructor(documentRef = globalThis.document, windowRef = globalThis.window) {
        this.document = documentRef;
        this.window = windowRef;
    }

    center(panel) {
        if (!panel) return;
        const padding = 16;
        const { width, height } = this.getPanelSize(panel);
        const left = Math.max(padding, Math.min(
            (this.window.innerWidth - width) / 2,
            this.window.innerWidth - width - padding
        ));
        const top = Math.max(padding, Math.min(
            (this.window.innerHeight - height) / 2,
            this.window.innerHeight - height - padding
        ));
        this.setPanelPosition(panel, left, top);
    }

    positionNextToBlock(panel, blockId, type = 'graphics') {
        if (!panel) return;
        const target = this.getBlockViewportRect(blockId, type);
        if (!target) return this.center(panel);
        const padding = 16;
        const offset = 24;
        const bottomMargin = 80;
        const { width, height } = this.getPanelSize(panel);
        const maxLeft = this.window.innerWidth - width - padding;
        const maxTop = this.window.innerHeight - height - padding;
        let left = target.right + offset;
        if (left > maxLeft) left = target.left - width - offset;
        left = Math.max(padding, Math.min(left, maxLeft));
        let top = Math.max(padding, Math.min(target.top, maxTop));
        top = Math.min(top, Math.max(padding, this.window.innerHeight - height - bottomMargin));
        this.setPanelPosition(panel, left, top);
    }

    getPanelSize(panel) {
        const rect = panel.getBoundingClientRect();
        return {
            width: rect.width || panel.offsetWidth || 0,
            height: rect.height || panel.offsetHeight || 0
        };
    }

    getBlockViewportRect(blockId, type = 'graphics') {
        if (!blockId) return null;
        if (type === 'text') {
            return this.document.getElementById(`bounds-${blockId}`)?.getBoundingClientRect()
                || this.document.getElementById(`hover-area-${blockId}`)?.getBoundingClientRect()
                || null;
        }
        const specialId = { icons: 'icons-group', claim: 'claim-group' }[blockId];
        const group = specialId
            ? this.document.getElementById(specialId)
            : this.document.getElementById(`graphics-group-${blockId}`);
        if (group?.boundsElement) return group.boundsElement.getBoundingClientRect();
        if (group) return group.getBoundingClientRect();
        return this.document.querySelector(`[data-block-id="${blockId}"]`)?.getBoundingClientRect() || null;
    }

    setPanelPosition(panel, left, top) {
        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        panel.style.transform = 'none';
    }
}
