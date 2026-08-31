/**
 * Pulsar Coder's only dependency boundary to the shared Upgrade framework.
 *
 * ZoomPanManager intentionally remains application-owned for parity: Pulsar's
 * coordinate/fit rules differ from the current shared implementation.
 */
export {
    PanelManager,
    SliderController
} from '../../../framework/src/index.js';

export const PULSAR_CODER_FRAMEWORK_ADAPTER = Object.freeze({
    app: 'pulsar_coder',
    sharedCapabilities: Object.freeze([
        'PanelManager',
        'SliderController'
    ]),
    privateCapabilities: Object.freeze([
        'PulsarCodec',
        'PulsarSvgRenderer',
        'ZoomPanManager'
    ])
});
