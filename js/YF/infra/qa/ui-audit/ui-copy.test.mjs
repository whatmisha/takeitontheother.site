import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const tools = ['sparky', 'grid_generator', 'label_generator', 'keyboarder', 'wordplayer', 'dither', 'wander_bender', 'pulsar_coder',
    'hyperspace', 'pattern_generator', 'pattern_generator_02', 'random_lines_generator', 'rays_pattern_generator', 'asterisk_pattern_generator', 'calendar-randomizer', 'chladni-sound-pattern'];
const read = file => readFile(new URL(file, root), 'utf8');

test('all sixteen interfaces declare English and retain only primary-export shortcut labels', async () => {
    const files = tools.map(id => `${id}/index.html`);
    files.push(...(await readdir(new URL('grid_generator/src/ui/fragments/', root))).filter(name => name.endsWith('.html')).map(name => `grid_generator/src/ui/fragments/${name}`));
    for (const file of files) {
        const source = await read(file);
        if (file.endsWith('/index.html')) assert.match(source, /<html\s+lang="en"/u, file);
        // Only Wordplayer's editable artwork copy is intentionally Cyrillic.
        const ui = source.replace(/<!--[\s\S]*?-->/gu, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gu, '')
            .replace(/(<textarea\b[^>]*\bid="patternTextInput"[^>]*>)[\s\S]*?(<\/textarea>)/gu, '$1$2');
        assert.doesNotMatch(ui, /[А-Яа-яЁё]/u, `${file}: UI copy must be English`);
        for (const match of ui.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gu)) {
            const text = match[1].replace(/<[^>]*>/gu, '');
            for (const shortcut of text.match(/(?:⇧)?⌘[A-Z\\]|Ctrl\+[A-Z]/gu) || []) {
                assert.ok(shortcut === '⌘E' || shortcut === 'Ctrl+E', `${file}: shortcut belongs in help, not on button: ${text}`);
            }
        }
    }
});

test('Pulsar keeps its accessible input without redundant headings; Pattern 02 keeps keyboard-only history', async () => {
    const pulsar = await read('pulsar_coder/index.html');
    assert.doesNotMatch(pulsar, /<h[1-6][^>]*>\s*(?:Payload|Ray Parameters)\s*<\//u);
    assert.match(pulsar, /id="payloadInput"[^>]*aria-label="Message"/u);
    const pattern = await read('pattern_generator_02/index.html');
    assert.doesNotMatch(pattern, /id="(?:undoButton|redoButton)"/u);
    const actions = await read('pattern_generator_02/script.js');
    for (const action of ['undo', 'redo']) assert.match(actions, new RegExp(`id: '${action}'[^\\n]*group: 'keyboard'`, 'u'));
});
