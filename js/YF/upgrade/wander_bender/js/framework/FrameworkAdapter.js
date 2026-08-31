import {
    PanelManager,
    SliderController
} from '../../../framework/src/index.js';

/**
 * Shared PanelManager with Wander's original drag-position write preserved.
 * The legacy manager did not reset `transform` while moving its fixed panel.
 */
export class WanderPanelManager extends PanelManager {
    setPosition(panelId, x, y) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        const panel = panelData.element;
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panelData.position = { x, y };
    }
}

export { SliderController };

export const WANDER_FRAMEWORK_ADAPTER = Object.freeze({
    app: 'wander_bender',
    sharedCapabilities: Object.freeze([
        'PanelManager',
        'SliderController'
    ]),
    privateCapabilities: Object.freeze([
        'PaperGeometry',
        'RadialMode',
        'RandomMode',
        'FlowFieldMode',
        'WanderPanelManager',
        'ZoomPanManager'
    ])
});
