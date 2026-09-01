import { buildCharacterGeometry } from '../geometry/characterGeometry.js?v=20260828-2';
import { buildEyeGeometry } from '../geometry/eyeGeometry.js?v=20260828-1';
import {
    bolidEyeScaffoldSettings,
    settingsAtBolidTime
} from './bolid.js?v=20260828-2';

const cache = new WeakMap();

function scaffoldKey(settings, focus) {
    return JSON.stringify({
        ...settings,
        focusX: focus.x,
        focusY: focus.y,
        // Playback-only values do not change the stationary scaffold.
        motionDuration: undefined,
        motionBlinkCount: undefined,
        motionBlur: undefined
    });
}

/**
 * Builds one time-independent Bolid head solely as an optical placement field
 * for the eyes. The result is cached against the mutable settings object and is
 * rebuilt when Focus, Target or any relevant character/eye value changes.
 */
export function createBolidEyeScaffold(settings, focus) {
    const key = scaffoldKey(settings, focus);
    const cached = cache.get(settings);
    if (cached?.key === key) return cached.value;

    const durationMs = Math.max(1, Number(settings.motionDuration) * 1000 || 5000);
    const timed = settingsAtBolidTime(settings, 0, durationMs);
    const scaffoldSettings = {
        ...bolidEyeScaffoldSettings(timed),
        focusX: focus.x,
        focusY: focus.y,
        focusMode: 'manual'
    };
    const character = buildCharacterGeometry(scaffoldSettings);
    const eyes = buildEyeGeometry(scaffoldSettings, character, {
        placementMode: 'global'
    });
    const value = { settings: scaffoldSettings, character, eyes };
    cache.set(settings, { key, value });
    return value;
}
