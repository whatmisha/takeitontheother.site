// Phone sizes are physical wallpaper pixels, not logical UI-frame points.
export const FORMATS = {
    fhd: { label: 'Desktop Full HD', group: 'Desktop', width: 1920, height: 1080 },
    qhd: { label: 'Desktop QHD', group: 'Desktop', width: 2560, height: 1440 },
    desktop: { label: 'Desktop 4K', group: 'Desktop', width: 3840, height: 2160 },
    desktop5k: { label: 'Desktop 5K', group: 'Desktop', width: 5120, height: 2880 },
    ultrawide: { label: 'Ultrawide QHD', group: 'Desktop', width: 3440, height: 1440 },
    laptop: { label: 'Laptop 16:10', group: 'Desktop', width: 2560, height: 1600 },
    iphone17: { label: 'iPhone 17', group: 'iPhone', width: 1206, height: 2622 },
    iphone17pro: { label: 'iPhone 17 Pro', group: 'iPhone', width: 1206, height: 2622 },
    iphone17max: { label: 'iPhone 17 Pro Max', group: 'iPhone', width: 1320, height: 2868 },
    iphoneair: { label: 'iPhone Air', group: 'iPhone', width: 1260, height: 2736 },
    iphone16: { label: 'iPhone 16', group: 'iPhone', width: 1179, height: 2556 },
    phone: { label: 'iPhone 16 Plus', group: 'iPhone', width: 1290, height: 2796 }
};

export function resolutionError(width, height) {
    if (![width, height].every(value => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 16384)) return 'Width and height must be whole pixels from 1 to 16384.';
    if (width * height > 33554432) return 'Canvas size must not exceed 32 megapixels.';
    return '';
}

export function stepResolution(value, direction, shift = false) {
    if (String(value).trim() === '' || !Number.isFinite(Number(value))) return null;
    const current = Math.round(Number(value));
    const next = shift ? (direction > 0 ? Math.floor(current / 10) + 1 : Math.ceil(current / 10) - 1) * 10 : current + direction;
    return Math.max(1, Math.min(16384, next));
}

export function normalizeResolution(input) {
    const preset = Object.hasOwn(FORMATS, input.format) ? FORMATS[input.format] : null;
    if (preset) return { format: input.format, width: preset.width, height: preset.height };
    if (!resolutionError(input.width, input.height)) return { format: 'custom', width: Number(input.width), height: Number(input.height) };
    return { format: 'desktop', width: FORMATS.desktop.width, height: FORMATS.desktop.height };
}
