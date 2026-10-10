import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Editor } from '../editor.js';
import { ASSETS, installCatalog } from '../assets.js';
import { layerName } from '../variant-picker.js';

installCatalog(JSON.parse(await readFile(new URL('../asset-catalog.json', import.meta.url), 'utf8')));

function editorFor(items) {
    let scene = { width: 1000, height: 800, items: structuredClone(items) };
    const editor = Object.create(Editor.prototype), history = [];
    editor.app = { get settings() { return scene; }, getSnapshot: () => structuredClone(scene), render() {} };
    editor.selected = items[0].id; editor.isBusy = () => false;
    editor.change = next => { history.push(structuredClone(scene)); scene = next; };
    editor.surface = { style: {}, hasPointerCapture: () => false };
    editor.updateCursor = () => {}; editor.coordinates = event => ({ x: event.clientX, y: event.clientY });
    return { editor, history, undo: () => { scene = history.pop(); } };
}
const base = { id: 'a', kind: 'letter', x: .5, y: .5, scale: .5, rotation: 0, pinned: false, visible: true };

test('transforms and nudges auto-pin in one undo step; selection, no-ops and visibility do not', () => {
    for (const kind of ['letter', 'form', 'ground']) for (const patch of [{ x: -.5 }, { y: 4 }, { scale: 1 }, { rotation: 40 }]) {
        const { editor, history, undo } = editorFor([{ ...base, kind }]);
        editor.transform({ x: .5 }); assert.equal(history.length, 0);
        editor.transform(patch); assert.equal(editor.item().pinned, true); assert.equal(history.length, 1);
        undo(); assert.deepEqual(editor.item(), { ...base, kind });
        editor.nudge(1, 0); assert.equal(editor.item().pinned, true); assert.equal(editor.item().x, .501);
        editor.pin(); assert.equal(editor.item().pinned, false);
        editor.visibility(); assert.equal(editor.item().pinned, false);
        editor.showAll(); assert.equal(editor.item().pinned, false);
    }
});

test('move, resize and rotation gestures auto-pin only on a changed commit; cancel restores everything', () => {
    for (const mode of ['move', 'resize', 'rotate']) {
        const { editor, history, undo } = editorFor([base]);
        editor.geometry = { dimensions: () => ({ width: 200, height: 100 }) };
        const start = { x: 600, y: 400 };
        const gesture = () => ({ id: 1, mode, handle: { axisX: 1, axisY: 0 }, start, item: { ...base }, snapshot: editor.app.getSnapshot(),
            items: editor.app.settings.items, moved: false, clientX: start.x, clientY: start.y });
        const move = { pointerId: 1, clientX: 650, clientY: 450 };
        editor.gesture = gesture(); editor.move(move);
        assert.equal(editor.items()[0].pinned, true); assert.equal(editor.item().pinned, false);
        editor.cancel(); assert.deepEqual(editor.item(), base); assert.equal(history.length, 0);
        editor.gesture = gesture(); editor.move(move); editor.up(move);
        assert.equal(editor.item().pinned, true); assert.equal(history.length, 1);
        undo(); assert.deepEqual(editor.item(), base);
        editor.gesture = gesture(); editor.move(move);
        editor.move({ pointerId: 1, clientX: start.x, clientY: start.y }); editor.up(move);
        assert.deepEqual(editor.item(), base); assert.equal(history.length, 0);
    }
});

function listFor(t, editor) {
    const globals = ['document', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
    t.after(() => { for (const [key, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
    const classes = () => ({ add() {}, remove() {} });
    const rows = [...editor.app.settings.items].reverse().map((item, index) => ({ dataset: { item: item.id }, offsetHeight: 42,
        classList: classes(), getBoundingClientRect: () => ({ top: index * 42, bottom: (index + 1) * 42 }) }));
    let captured;
    const list = { children: rows, classList: classes(), scrollTop: 0, getBoundingClientRect: () => ({ top: 0, bottom: 126, left: 0, right: 300 }),
        setPointerCapture: id => { captured = id; }, hasPointerCapture: id => captured === id, releasePointerCapture: () => { captured = null; } };
    globalThis.document = { getElementById: () => list };
    globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
    return { list, rows };
}

test('row dragging starts on thumbnails, names, space and action buttons without consuming clicks', async t => {
    for (const origin of ['thumbnail', 'name', 'space', 'edit', 'pin', 'visibility']) {
        await t.test(origin, t => {
            const { editor, history, undo } = editorFor([base, { ...base, id: 'b' }, { ...base, id: 'c' }]);
            const { list, rows } = listFor(t, editor);
            let prevented = false;
            const event = { pointerId: 1, button: 0, clientX: 120, clientY: 20, target: { origin, closest: selector => selector === '[data-item]' ? rows[0] : null },
                preventDefault: () => { prevented = true; } };
            editor.startReorder(event);
            assert.equal(prevented, false); assert.equal(list.hasPointerCapture(1), false);
            editor.moveReorder({ ...event, clientY: 22 }); assert.equal(editor.reorderGesture.moved, false);
            editor.finishReorder(true); assert.equal(history.length, 0);
            editor.startReorder(event); editor.moveReorder({ ...event, clientY: 81 });
            assert.equal(list.hasPointerCapture(1), true);
            editor.finishReorder(true);
            assert.deepEqual(editor.app.settings.items.map(item => item.id), ['a', 'c', 'b']);
            assert.equal(editor.item().id, 'c'); assert.equal(editor.item().pinned, true); assert.equal(history.length, 1);
            assert.equal(list.hasPointerCapture(1), false);
            undo(); assert.ok(editor.app.settings.items.every(item => !item.pinned));
        });
    }
});

test('cancelled, outside and unchanged row drops do not reorder or pin', t => {
    const { editor, history } = editorFor([base, { ...base, id: 'b' }, { ...base, id: 'c' }]);
    const { rows } = listFor(t, editor);
    for (const [y, commit] of [[81, false], [200, true], [45, true]]) {
        const event = { pointerId: 1, button: 0, clientX: 120, clientY: 20, target: { closest: selector => selector === '[data-item]' ? rows[0] : null }, preventDefault() {} };
        editor.startReorder(event); editor.moveReorder({ ...event, clientY: y }); editor.finishReorder(commit);
        assert.equal(history.length, 0); assert.ok(editor.app.settings.items.every(item => !item.pinned));
    }
});

test('layer names use single letters and singular object types without indexes', () => {
    assert.equal(layerName({ ...base, letter: 'W', index: 8 }), 'W');
    assert.equal(layerName({ kind: 'ground', index: 0 }), 'Surface');
    for (const [category, label] of Object.entries({ blobs: 'Blob', crystals: 'Crystal', spheres: 'Sphere', sticks: 'Stick', prism: 'Prism', sparky: 'Sparky' })) {
        const asset = Object.values(ASSETS).find(asset => asset.category === category);
        assert.equal(layerName({ kind: 'form', asset: asset.id, index: 17 }), label);
    }
});

test('Edit opens letter, object and Surface alternatives without changing or pinning the layer', () => {
    for (const kind of ['letter', 'form', 'ground']) {
        const { editor, history } = editorFor([{ ...base, kind }]);
        const opened = [], before = editor.app.getSnapshot();
        editor.sync = () => {}; editor.variants = { open: item => opened.push(item) };
        editor.selected = null;
        editor.edit(base.id);
        assert.equal(editor.selected, base.id);
        assert.deepEqual(opened, [before.items[0]]);
        assert.deepEqual(editor.app.getSnapshot(), before);
        assert.equal(history.length, 0);
        editor.isBusy = () => true;
        editor.edit(base.id);
        assert.equal(opened.length, 1);
    }
});
