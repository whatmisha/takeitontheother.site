import {
    ColorUtils,
    FileIntakeController,
    OverlayDialogHost,
    PanelManager
} from '../../../framework/src/index.js?v=g6-file-intake-1';

export { ColorUtils, FileIntakeController, OverlayDialogHost, PanelManager };

export const DITHER_FRAMEWORK_ADAPTER = Object.freeze({
    app: 'dither',
    sharedCapabilities: Object.freeze([
        'ColorUtils',
        'FileIntakeController',
        'OverlayDialogHost',
        'PanelManager'
    ]),
    privateCapabilities: Object.freeze([
        'CanvasOverlayInteraction',
        'DitherAlgorithms',
        'ImageExport'
    ])
});
