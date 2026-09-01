/**
 * Pulsar Coder's only dependency boundary to the shared Upgrade framework.
 *
 * ZoomPanManager intentionally remains application-owned for parity: Pulsar's
 * coordinate/fit rules differ from the current shared implementation.
 */
export {
    DialogHost,
    OverlayDialogHost,
    PanelManager,
    SliderController
} from '../../../framework/src/index.js?v=g5-feedback-2';

export const PULSAR_CODER_FRAMEWORK_ADAPTER = Object.freeze({
    app: 'pulsar_coder',
    sharedCapabilities: Object.freeze([
        'DialogHost',
        'OverlayDialogHost',
        'PanelManager',
        'SliderController'
    ]),
    privateCapabilities: Object.freeze([
        'PulsarCodec',
        'PulsarSvgRenderer',
        'ZoomPanManager'
    ])
});
