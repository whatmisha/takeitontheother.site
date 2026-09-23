import test from 'node:test';
import assert from 'node:assert/strict';

import { ObjectDocumentController } from '../src/elements/ObjectDocumentController.js';

test('document starts with independent built-in graphics objects', () => {
    const first = new ObjectDocumentController();
    const second = new ObjectDocumentController();

    assert.deepEqual(first.graphicsBlocks.map(block => block.id), ['icons', 'claim', 'claim2026']);
    first.graphicsBlocks[0].visible = true;
    assert.equal(second.graphicsBlocks[0].visible, false);
});

test('replacing document collections clones source-of-truth data', () => {
    const source = [{ id: 'text-1', content: 'Original' }];
    const document = new ObjectDocumentController({ includeBuiltIns: false });
    document.replaceTextBlocks(source);

    document.textBlocks[0].content = 'Edited';
    assert.equal(source[0].content, 'Original');
});

test('document snapshot round-trip keeps both collections independent', () => {
    const document = new ObjectDocumentController({ includeBuiltIns: false });
    document.replaceDocument({
        textBlocks: [{ id: 'text-1', content: 'Original' }],
        graphicsBlocks: [{ id: 'graphic-1', name: 'Original' }]
    });
    const snapshot = document.createSnapshot();

    document.textBlocks[0].content = 'Changed';
    document.graphicsBlocks[0].name = 'Changed';
    document.restoreSnapshot(snapshot);

    assert.equal(document.textBlocks[0].content, 'Original');
    assert.equal(document.graphicsBlocks[0].name, 'Original');
    assert.notEqual(document.textBlocks, snapshot.textBlocks);
    assert.notEqual(document.graphicsBlocks, snapshot.graphicsBlocks);
});

test('new text blocks are constrained by default', () => {
    const document = new ObjectDocumentController({ includeBuiltIns: false, now: () => 10 });
    const block = document.addTextBlock();

    assert.equal(block.id, 'text-10');
    assert.equal(block.lockPosition, true);
    assert.equal(block.textAlign, 'left');
});

test('duplicate deep-clones data, declassifies built-ins and avoids id collisions', () => {
    const document = new ObjectDocumentController({ includeBuiltIns: false, now: () => 10 });
    document.replaceGraphicsBlocks([{
        id: 'icons',
        isBuiltIn: true,
        x: 1,
        metadata: { source: 'built-in' }
    }]);

    const first = document.duplicate('icons', 'icons');
    const second = document.duplicate('graphics', 'icons');
    first.metadata.source = 'copy';

    assert.equal(first.id, 'graphics-10');
    assert.equal(second.id, 'graphics-10-1');
    assert.equal(first.isBuiltIn, false);
    assert.equal(document.getGraphicsBlock('icons').metadata.source, 'built-in');
});

test('a copied block can be inserted after its source document was replaced', () => {
    const document = new ObjectDocumentController({ includeBuiltIns: false, now: () => 20 });
    const source = {
        id: 'source',
        content: 'Copied between presets',
        styleRef: 'caption',
        x: 3,
        visible: false,
        metadata: { preset: 'A' }
    };
    document.replaceTextBlocks([source]);
    document.replaceTextBlocks([{ id: 'target', content: 'Preset B' }]);

    const pasted = document.insertCopy('text', source);
    pasted.metadata.preset = 'pasted';

    assert.equal(pasted.id, 'text-20');
    assert.equal(pasted.x, 4);
    assert.equal(pasted.visible, true);
    assert.equal(document.textBlocks.length, 2);
    assert.equal(source.metadata.preset, 'A');
    assert.equal(document.getLayerEntries({ frontToBack: true })[0].block.id, pasted.id);
});

test('text and graphics share one deterministic layer stack', () => {
    const document = new ObjectDocumentController({ includeBuiltIns: false });
    document.replaceDocument({
        textBlocks: [
            { id: 'text-back', content: 'Back', layerIndex: 0 },
            { id: 'text-front', content: 'Front', layerIndex: 2 }
        ],
        graphicsBlocks: [{ id: 'graphic-middle', name: 'Middle', layerIndex: 1 }]
    });

    assert.deepEqual(
        document.getLayerEntries().map(entry => entry.block.id),
        ['text-back', 'graphic-middle', 'text-front']
    );
    assert.deepEqual(
        document.getLayerEntries({ frontToBack: true }).map(entry => entry.block.id),
        ['text-front', 'graphic-middle', 'text-back']
    );
});

test('layer commands move and drag objects across text and graphics types', () => {
    const document = new ObjectDocumentController({ includeBuiltIns: false });
    document.replaceDocument({
        textBlocks: [{ id: 'text', layerIndex: 0 }],
        graphicsBlocks: [
            { id: 'logo', layerIndex: 1 },
            { id: 'qr', layerIndex: 2 }
        ]
    });

    assert.equal(document.moveLayer('text', 'text', 'forward'), true);
    assert.deepEqual(
        document.getLayerEntries().map(entry => entry.block.id),
        ['logo', 'text', 'qr']
    );
    assert.equal(document.reorderLayer(
        { type: 'graphics', id: 'logo' },
        { type: 'graphics', id: 'qr' },
        'before'
    ), true);
    assert.deepEqual(
        document.getLayerEntries({ frontToBack: true }).map(entry => entry.block.id),
        ['logo', 'qr', 'text']
    );
});

test('duplicated objects are inserted directly above their source layer', () => {
    const document = new ObjectDocumentController({ includeBuiltIns: false, now: () => 50 });
    document.replaceDocument({
        textBlocks: [{ id: 'text', layerIndex: 0 }],
        graphicsBlocks: [{ id: 'logo', layerIndex: 1 }]
    });

    const copy = document.duplicate('text', 'text');

    assert.deepEqual(
        document.getLayerEntries().map(entry => entry.block.id),
        ['text', copy.id, 'logo']
    );
});
