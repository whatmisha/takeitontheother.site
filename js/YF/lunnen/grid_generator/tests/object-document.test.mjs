import test from 'node:test';
import assert from 'node:assert/strict';

import { ObjectDocumentController } from '../src/elements/ObjectDocumentController.js';

test('document starts with independent built-in graphics objects', () => {
    const first = new ObjectDocumentController();
    const second = new ObjectDocumentController();

    assert.deepEqual(first.graphicsBlocks.map(block => block.id), ['icons', 'claim']);
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
