import {
    ColorUtils,
    OverlayDialogHost,
    PanelManager
} from '../../../framework/src/index.js?v=g5-overlay-1';

/**
 * Shared PanelManager with Dither's legacy unbounded desktop drag preserved.
 * Mobile behavior is intentionally outside Dither's migration contract.
 */
export class DitherPanelManager extends PanelManager {
    bringToFront(panelId) {
        // Legacy Dither changes stacking only while a header drag is active.
        // Content clicks (for example a pattern radio) must remain paint-neutral.
        if (!this.dragState.isDragging) return;

        this.panels.forEach((panelData, registeredId) => {
            panelData.element.style.zIndex = registeredId === panelId
                ? '1000'
                : '999';
        });
    }

    onDragging(event) {
        if (!this.dragState.isDragging) return;

        const deltaX = event.clientX - this.dragState.startX;
        const deltaY = event.clientY - this.dragState.startY;

        this.setPosition(
            this.dragState.panel,
            this.dragState.initialX + deltaX,
            this.dragState.initialY + deltaY
        );
    }
}

export { ColorUtils, OverlayDialogHost };

export const DITHER_FRAMEWORK_ADAPTER = Object.freeze({
    app: 'dither',
    sharedCapabilities: Object.freeze([
        'ColorUtils',
        'OverlayDialogHost',
        'PanelManager'
    ]),
    privateCapabilities: Object.freeze([
        'CanvasOverlayInteraction',
        'DitherAlgorithms',
        'DitherPanelManager',
        'ImageExport'
    ])
});
