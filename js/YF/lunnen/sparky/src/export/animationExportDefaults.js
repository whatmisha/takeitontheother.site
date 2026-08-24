export const ANIMATION_EXPORT_FPS = 60;
export const ANIMATION_EXPORT_SIZE = 1080;

const normalizedColor = (value) => String(value || '').trim().toLowerCase();

export function shouldKnockoutPngEyes(settings = {}) {
    return normalizedColor(settings.eyeColor) === normalizedColor(settings.backgroundColor);
}
