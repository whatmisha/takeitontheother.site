const pad = (value) => String(value).padStart(2, '0');

export function createSparkyExportBaseName(date = new Date()) {
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
        + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    return `sparky_${stamp}`;
}

export function createSparkySettingsDocument(settings, baseName, date = new Date()) {
    return {
        format: 'sparky-settings',
        version: 1,
        exportedAt: date.toISOString(),
        asset: `${baseName}.svg`,
        artboard: {
            width: settings.width,
            height: settings.height
        },
        settings
    };
}

