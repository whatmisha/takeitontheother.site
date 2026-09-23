// One-time, additive import. Existing new-version data wins; the old keys are
// read-only and are never cleared. Keep internal keys stable across URL moves.
(() => {
    const tool = document.currentScript?.dataset.tool;
    const presets = {
        sparky: ['upgrade:sparky:presets:v1', ['lunnenSparkyGeneratorV2', 'lunnenSparkyGeneratorV1']],
        wordplayer: ['upgrade:wordplayer:presets:v1', ['wordplayerPresetsV18']],
        keyboarder: ['upgrade:keyboarder:presets:v1', ['keyboarder']]
    };
    const preferences = {
        keyboarder: [['keyboarder.svgExportTextMode', 'upgrade:keyboarder:svg-export-mode:v1'], ['keyboarder.uiMode', 'upgrade:keyboarder:ui-mode:v1']],
        random_lines_generator: [['randomLinesSettings', 'upgrade:random-lines:settings:v1']]
    };
    if (!presets[tool] && !preferences[tool]) return;
    try {
        const storage = window.localStorage;
        const marker = `yf:legacy-storage:v1:${tool}`;
        if (storage.getItem(marker) === '1') return;
        const record = text => {
            if (!text) return {};
            const value = JSON.parse(text);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid preset library');
            return value;
        };
        if (presets[tool]) {
            const [target, sources] = presets[tool];
            const next = record(storage.getItem(target));
            // Sparky V2 supersedes V1; import V1 only if there is no V2 library.
            const source = sources.map(key => storage.getItem(key)).find(Boolean);
            const previous = record(source);
            for (const [name, preset] of Object.entries(previous)) {
                if (!preset || typeof preset !== 'object' || Array.isArray(preset) || preset.seeded === true || ['__proto__', 'prototype', 'constructor'].includes(name)) continue;
                let candidate = name, suffix = 1;
                while (Object.hasOwn(next, candidate) && JSON.stringify(next[candidate]) !== JSON.stringify(preset)) {
                    candidate = `${name} (previous${suffix > 1 ? ` ${suffix}` : ''})`; suffix++;
                }
                next[candidate] = preset;
            }
            if (source) storage.setItem(target, JSON.stringify(next));
        }
        for (const [source, target] of preferences[tool] || []) {
            const previous = storage.getItem(source);
            if (previous !== null && storage.getItem(target) === null) storage.setItem(target, previous);
        }
        storage.setItem(marker, '1');
    } catch (error) {
        // Private mode, malformed data and quota failures must never block the UI.
        // No completion marker is written, so a later visit can retry safely.
        console.warn('Previous settings could not be imported:', error);
    }
})();
