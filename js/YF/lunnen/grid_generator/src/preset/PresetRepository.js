const clone = value => JSON.parse(JSON.stringify(value));

/** Owns preset transport and the in-memory imported-preset registry. */
export class PresetRepository {
    constructor({
        fetchImpl,
        now = () => Date.now(),
        random = () => Math.random()
    } = {}) {
        this.fetch = fetchImpl || ((...args) => globalThis.fetch(...args));
        this.now = now;
        this.random = random;
        this.availablePresets = [];
        this.importedPresets = [];
    }

    async loadManifest() {
        const response = await this.fetch(`presets/manifest.json?ts=${this.now()}`, {
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('No presets manifest found');
        const manifest = await response.json();
        this.availablePresets = Array.isArray(manifest.presets) ? manifest.presets : [];
        return this.availablePresets;
    }

    async loadBuiltIn(filename) {
        const response = await this.fetch(`presets/${encodeURIComponent(filename)}`);
        if (!response.ok) {
            throw new Error(`Failed to load preset: ${response.statusText}`);
        }
        return response.json();
    }

    addImported(data, displayName) {
        const id = `imported-${this.now()}-${this.random().toString(36).slice(2, 9)}`;
        const preset = { id, displayName, data: clone(data) };
        this.importedPresets.push(preset);
        return preset;
    }

    getImported(id) {
        return this.importedPresets.find(preset => preset.id === id) || null;
    }
}
