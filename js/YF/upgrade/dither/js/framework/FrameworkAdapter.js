import {
    ColorUtils,
    OverlayDialogHost,
    PanelManager
} from '../../../framework/src/index.js?v=g6-panel-2';

export { ColorUtils, OverlayDialogHost, PanelManager };

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
        'ImageExport'
    ])
});
