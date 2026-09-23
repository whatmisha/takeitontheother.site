import assert from 'node:assert/strict';
import test from 'node:test';

import {
    OBSOLETE_SPARKY_SEED_NAMES,
    migrateSparkyPresetLibrary
} from '../src/state/presetMigration.js';

test('Sparky migration removes only obsolete shipped presets', () => {
    let persisted = {
        Basic: { seeded: true, rayCount: 20 },
        'Needle Crown': { seeded: true },
        'Wide Crown': { seeded: true },
        'My Basic': { seeded: false, rayCount: 31 }
    };
    const store = {
        loadAll: () => JSON.parse(JSON.stringify(persisted)),
        saveAll: next => { persisted = next; return true; }
    };

    const result = migrateSparkyPresetLibrary(store);

    assert.deepEqual(result, {
        ok: true,
        changed: true,
        removed: [...OBSOLETE_SPARKY_SEED_NAMES]
    });
    assert.deepEqual(persisted, {
        'My Basic': { seeded: false, rayCount: 31 }
    });
});

test('Sparky migration preserves user presets even when names collide', () => {
    const persisted = {
        Basic: { rayCount: 44 },
        'Needle Crown': { seeded: false, rayCount: 45 },
        'Wide Crown': { seeded: 'legacy', rayCount: 46 }
    };
    let saveCount = 0;

    const result = migrateSparkyPresetLibrary({
        loadAll: () => JSON.parse(JSON.stringify(persisted)),
        saveAll: () => { saveCount += 1; return true; }
    });

    assert.deepEqual(result, { ok: true, changed: false, removed: [] });
    assert.equal(saveCount, 0);
});

test('Sparky migration has an atomic rollback when persistence fails', () => {
    const persisted = {
        Basic: { seeded: true, rayCount: 20 },
        Personal: { rayCount: 63 }
    };
    const before = JSON.parse(JSON.stringify(persisted));
    let candidate = null;

    const result = migrateSparkyPresetLibrary({
        loadAll: () => JSON.parse(JSON.stringify(persisted)),
        saveAll: next => { candidate = next; return false; }
    });

    assert.deepEqual(result, { ok: false, changed: false, removed: [] });
    assert.deepEqual(persisted, before);
    assert.deepEqual(candidate, { Personal: { rayCount: 63 } });
});
