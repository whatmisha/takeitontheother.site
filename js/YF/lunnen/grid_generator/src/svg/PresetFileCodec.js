import { PresetFormatAdapter } from '../preset/PresetFormatAdapter.js';

/** Owns the human-editable JSON preset representation and descriptive name. */
export class PresetFileCodec {
    constructor({ adapter = new PresetFormatAdapter(), now = () => new Date() } = {}) {
        this.adapter = adapter;
        this.now = now;
    }

    organize(data) {
        const settings = data.settings || {};
        return this.adapter.organize(data, {
            presetName: this.generateName(settings, data.currentPresetName || 'Custom')
        });
    }

    generateName(settings, currentPresetName = 'Custom') {
        const width = settings.frontWidth ?? 0;
        const height = settings.frontHeight ?? 0;
        const thickness = settings.thickness ?? 0;
        const dimensions = settings.showSidePanels && thickness > 0
            ? `${width}×${height}×${thickness}mm`
            : `${width}×${height}mm`;
        const date = this.now();
        const stamp = [
            String(date.getFullYear()).slice(-2),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('.') + `, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

        if (/^Custom\s+—\s*/i.test(currentPresetName)) {
            return currentPresetName.replace(/^(?:Custom\s+—\s*)+/i, '');
        }
        if (currentPresetName !== 'Custom' && !/^\+\s*New/i.test(currentPresetName)) {
            return `${currentPresetName}, ${dimensions} — ${stamp}`;
        }
        return `${dimensions} — ${stamp}`;
    }

    stringify(data) { return JSON.stringify(data, null, 2); }
    normalize(data) { return this.adapter.normalize(data); }
    fromOrganized(data) { return this.adapter.fromOrganized(data); }
}
