/**
 * Sticky Fingers boundary with the shared Upgrade framework.
 *
 * The legacy GridGenerator remains application-owned. Shared capabilities are
 * exposed here incrementally so the 10k-line application is never rewritten in
 * one migration step.
 */
import {
    ColorUtils,
    DialogHost,
    FileIntakeController
} from '../../../framework/src/index.js?v=g6-file-intake-1';

export const STICKY_FINGERS_FRAMEWORK_ADAPTER = Object.freeze({
    appId: 'sticky-fingers',
    mode: 'legacy-grid-facade',
    sharedCapabilities: Object.freeze(['ColorUtils', 'DialogHost', 'FileIntakeController'])
});

export { ColorUtils, DialogHost, FileIntakeController };
