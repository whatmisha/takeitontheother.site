/**
 * Sticky Fingers boundary with the shared Upgrade framework.
 *
 * The legacy GridGenerator remains application-owned. Shared capabilities are
 * exposed here incrementally so the 10k-line application is never rewritten in
 * one migration step.
 */
import { ColorUtils, DialogHost } from '../../../framework/src/index.js?v=g5-feedback-2';

export const STICKY_FINGERS_FRAMEWORK_ADAPTER = Object.freeze({
    appId: 'sticky-fingers',
    mode: 'legacy-grid-facade',
    sharedCapabilities: Object.freeze(['ColorUtils', 'DialogHost'])
});

export { ColorUtils, DialogHost };
