import assert from 'node:assert/strict';
import test from 'node:test';

import {
    confirmPathRegeneration,
    REGENERATE_IMPORTED_PATH_CONFIRMATION,
    REGENERATE_PATH_CONFIRMATION
} from '../src/animation/pathRegenerateConfirmation.js';

test('generated paths regenerate immediately without opening a confirmation', async () => {
    let calls = 0;
    const confirmed = await confirmPathRegeneration({
        manuallyEdited: false,
        dialog: { confirm: async () => { calls += 1; return false; } }
    });
    assert.equal(confirmed, true);
    assert.equal(calls, 0);
});

test('manually edited paths use the destructive regeneration confirmation', async () => {
    let received = null;
    const confirmed = await confirmPathRegeneration({
        manuallyEdited: true,
        dialog: {
            confirm: async (options) => {
                received = options;
                return false;
            }
        }
    });
    assert.equal(confirmed, false);
    assert.deepEqual(received, REGENERATE_PATH_CONFIRMATION);
});

test('imported paths explain that regeneration replaces the SVG', async () => {
    let received = null;
    const confirmed = await confirmPathRegeneration({
        manuallyEdited: true,
        imported: true,
        dialog: {
            confirm: async (options) => {
                received = options;
                return true;
            }
        }
    });
    assert.equal(confirmed, true);
    assert.deepEqual(received, REGENERATE_IMPORTED_PATH_CONFIRMATION);
});
