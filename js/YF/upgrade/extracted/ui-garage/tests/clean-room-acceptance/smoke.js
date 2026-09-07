import { DraftStore } from '../../src/index.js?clean-room-acceptance=1';

const frame = document.querySelector('#tool');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
    localStorage.removeItem('ui-garage:ribbon-field:presets:v1');
    localStorage.removeItem('ui-garage:ribbon-field:presets:v1__seeded');
    frame.src = frame.dataset.src;
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Ribbon Field load timed out.')), 5000);
        frame.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, { once: true });
    });
    await wait(100);
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    const app = win.__uiGarageCleanRoomTool;
    assert(app && doc.documentElement.dataset.starterReady === 'true', 'Tool did not initialize.');
    assert(doc.querySelectorAll('#mainSvg polyline').length === 14, 'Initial render differs.');

    app.settingsStore.set('ribbons', 18);
    app.renderNow();
    app.history.notifyChange('clean-room');
    app.history.flush();
    assert(doc.querySelectorAll('#mainSvg polyline').length === 18, 'Setting did not render.');
    app.undo();
    assert(doc.querySelectorAll('#mainSvg polyline').length === 14, 'Undo did not restore.');
    app.redo();
    assert(doc.querySelectorAll('#mainSvg polyline').length === 18, 'Redo did not restore.');

    const presetName = 'Acceptance proof';
    assert(app.presetStore.create(presetName, app.getSnapshot(), { overwrite: true }).ok, 'Preset save failed.');
    assert(app.presetStore.has(presetName), 'Preset did not persist.');
    const shared = await app.share.encode(app.getSnapshot());
    const decoded = await app.share.decode(shared);
    assert(shared.startsWith('v1.') && decoded.full.ribbons === 18, 'Share round trip failed.');

    const drafts = new DraftStore({ namespace: 'clean-room-ribbon-field-acceptance' });
    await drafts.clear();
    await drafts.save({ settings: app.getSnapshot() });
    const recoveredDraft = await drafts.load();
    assert(recoveredDraft.value.settings.ribbons === 18, 'IndexedDB draft recovery failed.');
    await drafts.clear();
    drafts.destroy();

    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: '\\', code: 'Backslash', metaKey: true, bubbles: true }));
    assert([...doc.querySelectorAll('.collapse-icon')].every(button => button.getAttribute('aria-expanded') === 'false'), 'Collapse shortcut failed.');
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: '\\', code: 'Backslash', metaKey: true, bubbles: true }));
    assert([...doc.querySelectorAll('.collapse-icon')].every(button => button.getAttribute('aria-expanded') === 'true'), 'Restore shortcut failed.');

    const dialogPromise = app.dialog.alert({ title: 'Lifecycle check', text: 'Dialog opened.' });
    await wait(10);
    doc.querySelector('#dialogButtons button')?.click();
    await dialogPromise;
    assert(!doc.querySelector('#dialog').open, 'Dialog did not close cleanly.');
    assert(doc.querySelector('#jsonFileInput') && doc.querySelector('#jsonDropzone'), 'File intake is absent.');

    let exportCalls = 0;
    app.exporter.exportToFile = async () => { exportCalls += 1; await wait(25); };
    await Promise.all([app.exportSVG('proof.svg'), app.exportSVG('proof.svg')]);
    await app.exportSVG('proof.svg');
    assert(exportCalls === 2, 'Duplicate and repeated export lifecycle differs.');

    app.destroy();
    assert(!doc.documentElement.dataset.starterReady, 'Destroy did not release helper controllers.');
    await app.init();
    assert(doc.documentElement.dataset.starterReady === 'true', 'Clean re-init failed.');
    assert(app.presetStore.has(presetName), 'Preset did not survive re-init.');

    const remoteRequests = win.performance.getEntriesByType('resource')
        .map(entry => entry.name)
        .filter(url => !url.startsWith(win.location.origin));
    assert(remoteRequests.length === 0, `Remote requests found: ${remoteRequests.join(', ')}`);

    const report = {
        status: 'passed',
        tool: 'Ribbon Field',
        history: 'undo-redo',
        persistence: 'survived-reinit',
        drafts: 'indexeddb-round-trip',
        share: 'v1-round-trip',
        shortcuts: 'collapse-restore',
        dialogAndFileIntake: 'present-and-clean',
        exports: 'joined-and-repeatable',
        lifecycle: 'destroy-reinit',
        remoteRequests
    };
    status.textContent = 'Clean-room acceptance passed';
    result.textContent = JSON.stringify(report, null, 2);
    document.documentElement.dataset.cleanRoomStatus = 'passed';
} catch (error) {
    status.textContent = 'Clean-room acceptance failed';
    result.textContent = error.stack || error.message;
    document.documentElement.dataset.cleanRoomStatus = 'failed';
    throw error;
}
