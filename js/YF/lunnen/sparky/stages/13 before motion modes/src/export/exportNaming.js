const pad = (value) => String(value).padStart(2, '0');

export function createSparkyExportBaseName(date = new Date()) {
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
        + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    return `sparky_${stamp}`;
}
