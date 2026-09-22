import {
    ColorUtils,
    ExportFeedbackController,
    FileIntakeController,
    OverlayDialogHost,
    PanelManager
} from '../../../framework/src/index.js?v=uiq-2';

export { ColorUtils, ExportFeedbackController, FileIntakeController, OverlayDialogHost, PanelManager };

export const DITHER_FRAMEWORK_ADAPTER = Object.freeze({
    app: 'dither',
    sharedCapabilities: Object.freeze([
        'ColorUtils',
        'ExportFeedbackController',
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
