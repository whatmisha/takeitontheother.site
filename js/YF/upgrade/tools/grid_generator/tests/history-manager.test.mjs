import assert from 'node:assert/strict';
import test from 'node:test';

import { HistoryManager } from '../src/history/HistoryManager.js';

test('history transactions ignore no-op changes and store one changed state', () => {
    const history = new HistoryManager({ now: () => 10 });
    history.saveSnapshot({ value: 1 }, 'initial');
    history.beginAction('no-op', { value: 1 });
    assert.equal(history.commitAction({ value: 1 }), false);
    history.beginAction('change', { value: 1 });
    assert.equal(history.commitAction({ value: 2 }), true);

    assert.equal(history.history.length, 2);
    assert.equal(history.history[1].label, 'change');
    assert.equal(history.history[1].timestamp, 10);
});

test('new history after undo truncates the abandoned redo branch', () => {
    const history = new HistoryManager();
    history.saveSnapshot({ value: 1 });
    history.saveSnapshot({ value: 2 });
    history.saveSnapshot({ value: 3 });

    assert.deepEqual(history.undo(), { value: 2 });
    assert.equal(history.canRedo(), true);
    history.saveSnapshot({ value: 4 }, 'branch');

    assert.equal(history.canRedo(), false);
    assert.deepEqual(history.history.map(entry => entry.state.value), [1, 2, 4]);
});

test('history size and restoration guard are owned independently', () => {
    const history = new HistoryManager({ maxSize: 2 });
    history.saveSnapshot({ value: 1 });
    history.saveSnapshot({ value: 2 });
    history.saveSnapshot({ value: 3 });
    assert.deepEqual(history.history.map(entry => entry.state.value), [2, 3]);
    assert.equal(history.historyIndex, 1);

    history.setRestoring(true);
    assert.equal(history.saveSnapshot({ value: 4 }), false);
    assert.equal(history.beginAction('blocked', { value: 3 }), false);
    history.setRestoring(false);
    assert.equal(history.isRestoring, false);
});
