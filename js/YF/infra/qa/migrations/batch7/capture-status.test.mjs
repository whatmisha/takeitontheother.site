import assert from 'node:assert/strict';
import test from 'node:test';
import { CaptureSession } from '../../../../chladni-sound-pattern/capture-session.js';

test('capture reports audio activation separately from microphone permission and running', async () => {
    const phases = []; let unlock, grant, starts = 0;
    const session = new CaptureSession({
        mic: { start(ok) { starts++; grant = ok; }, stop() {}, amp() {} },
        unlock: () => new Promise(resolve => { unlock = resolve; }),
        onReady() {}, onStop() {}, onStateChange: phase => phases.push(phase)
    });
    const pending = session.start();
    assert.equal(session.phase, 'activating-audio'); assert.equal(starts, 0);
    unlock(); await Promise.resolve(); assert.equal(session.phase, 'requesting-microphone');
    assert.equal(session.running, false); grant(); await pending;
    assert.deepEqual(phases, ['activating-audio','requesting-microphone','running']);
    session.stop(); assert.equal(session.phase,'stopped'); assert.equal(session.running,false);
});

test('Stop while permission is unresolved reports stopped and closes a late granted stream', async () => {
    let grant, tracks = 0, ready = 0; const phases = [];
    const session = new CaptureSession({
        mic: { start(ok) { grant = () => { tracks++; ok(); }; }, stop() { tracks = 0; }, amp() {} },
        unlock: async () => {}, onReady() { ready++; }, onStop() {}, onStateChange: phase => phases.push(phase)
    });
    const pending = session.start(); await Promise.resolve(); session.stop();
    assert.equal(session.phase,'stopped'); assert.equal(session.running,false);
    assert.equal(session.start(),pending, 'Never overlap two pending permission requests on the same AudioIn');
    grant(); await pending;
    assert.equal(tracks,0); assert.equal(ready,0); assert.equal(session.phase,'stopped');
    assert.ok(!phases.includes('running'));
});

test('Stop before audio activation prevents any later microphone request', async () => {
    let unlock, starts = 0;
    const session = new CaptureSession({ mic: { start() { starts++; }, stop() {} },
        unlock: () => new Promise(resolve => { unlock = resolve; }), onReady() {}, onStop() {} });
    const pending = session.start(); session.stop(); unlock(); await pending;
    assert.equal(starts,0); assert.equal(session.pending,null); assert.equal(session.phase,'stopped');
});

test('denied permission reports error and a successful retry clears it', async () => {
    let grant, deny;
    const session = new CaptureSession({ mic: { start(ok,fail) { grant=ok;deny=fail; }, stop() {}, amp() {} },
        unlock: async () => {}, onReady() {}, onStop() {} });
    let pending = session.start(); await Promise.resolve(); deny(new Error('Permission denied'));
    await assert.rejects(pending,/denied/); assert.equal(session.phase,'error'); assert.equal(session.pending,null);
    pending = session.start(); await Promise.resolve(); grant(); await pending;
    assert.equal(session.phase,'running'); session.stop();
});
