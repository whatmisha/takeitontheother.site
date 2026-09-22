import assert from 'node:assert/strict';
import test from 'node:test';

import { BrowserFileTransfer } from '../src/svg/BrowserFileTransfer.js';

test('delayed Blob URL cleanup keeps the timer invocation context-free', () => {
    const calls = [];
    const link = {
        click: () => calls.push('click'),
        remove: () => calls.push('remove')
    };
    const timerHost = {
        schedule(callback, delay) {
            assert.equal(this, timerHost);
            calls.push(['schedule', delay]);
            callback();
        }
    };
    const transfer = new BrowserFileTransfer({
        documentRef: {
            createElement: () => link,
            body: { appendChild: () => calls.push('append') }
        },
        urlApi: {
            createObjectURL: () => 'blob:test',
            revokeObjectURL: url => calls.push(['revoke', url])
        },
        BlobClass: class {},
        schedule: (...args) => timerHost.schedule(...args)
    });

    transfer.download('<svg/>', 'test.svg', 'image/svg+xml', 100);

    assert.deepEqual(calls, [
        'append',
        'click',
        'remove',
        ['schedule', 100],
        ['revoke', 'blob:test']
    ]);
});
