import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalize, migrateDraft, parseBody, creditsToText, parseCredits, normalizeCredits, layoutText, layoutKey, hasText, hasContent, planLogoFade, sceneAt, parseTimecode } from '../model.js';
import { presetDocument, parsePreset, styleOf, applyStyle } from '../document.js';
const measure = (text, size) => [...text].length * size / 2;
test('preset JSON round trip preserves mixed notation, typography, camera and Unicode', () => {
    const settings = normalize({ title: 'Луннен\nAiris', body: '-Команда-\nАрт-директор | @enhanser 🪐\nKeep free text', roleAlignment: 'center', nameAlignment: 'right', creditGap: 90 });
    const document = presetDocument(settings, 'Мой проект');
    assert.deepEqual(parsePreset(JSON.stringify(document)), document);
    assert.equal(parsePreset(document).settings.body, settings.body);
});
test('invalid or future presets fail before normalization can replace live content', () => {
    for (const mutate of [doc => doc.toolId = 'sparky', doc => doc.schemaVersion = 99, doc => doc.animation = 'future', doc => doc.settings.speed = '120', doc => doc.settings.tilt = 0, doc => doc.settings.credits = {}, doc => doc.settings.textColor = 'red', doc => doc.settings.width = 10, doc => doc.settings.nameAlignment = 'justify', doc => doc.name = '', doc => doc.settings.credits = [{ role: 'x'.repeat(251), name: 'n' }]]) {
        const doc = presetDocument(DEFAULTS); mutate(doc); assert.throws(() => parsePreset(doc));
    }
    assert.throws(() => parsePreset('{broken'));
});
test('legacy style migration merges settings without losing the content snapshot', () => {
    const source = normalize({ title: 'Keep logo', body: 'Keep body', contentMode: 'credits', credits: [{ role: 'Role', name: 'Name' }] });
    const style = { ...styleOf(normalize({ speed: 10, textColor: '#ffffff' })), title: 'Bad', body: 'Bad', credits: [], contentMode: 'text' };
    const result = applyStyle(source, style);
    for (const key of ['title', 'body', 'credits', 'contentMode']) assert.deepEqual(result[key], source[key]);
    assert.equal(result.speed, 10); assert.equal(result.textColor, '#ffffff');
});
test('role/name layout wraps within columns and starts the next pair below both cells', () => {
    const settings = normalize({ contentMode: 'credits', columnWidth: 600, fontSize: 60, creditGap: 100, credits: [{ role: 'Director', name: 'A very long name with multiple words' }, { role: 'Next', name: 'Last' }] });
    const layout = layoutText(settings, measure), firstName = layout.lines.filter(line => line.x > 0 && line.y < layout.lines.find(line => line.text === 'Next').y);
    assert.ok(firstName.length > 1);
    assert.ok(layout.lines.every(line => measure(line.text, line.size) <= line.width));
    const next = layout.lines.find(line => line.text === 'Next');
    assert.ok(next.y > Math.max(...firstName.map(line => line.y)));
    assert.equal(layout.lines[0].alignment, 'right'); assert.equal(firstName[0].alignment, 'left');
    assert.notEqual(layoutKey(settings), layoutKey({ ...settings, roleAlignment: 'left' }));
});
test('credit parsing, migration and limits keep authored free text available', () => {
    assert.deepEqual(parseCredits('art director @a\nDesigner\tJane Doe\nNo handle'), [{ role: 'art director', name: '@a' }, { role: 'Designer', name: 'Jane Doe' }, { role: 'No handle', name: '' }]);
    const migrated = migrateDraft({ version: 4, settings: { body: 'Producer @name' } });
    assert.equal(migrated.body, 'Producer @name'); assert.ok(!('contentMode' in migrated) && !('credits' in migrated));
    const structured = migrateDraft({ version: 6, settings: { contentMode: 'credits', body: 'Inactive text', credits: [{ kind: 'heading', role: 'Team', name: '' }, { role: 'Role', name: 'Name' }] } });
    assert.equal(structured.body, '-Team-\nRole | Name');
    const rows = normalizeCredits(Array(110).fill({ role: 'a'.repeat(300), name: 'b'.repeat(300) }));
    assert.equal(rows.length, 100); assert.equal(rows.reduce((sum, row) => sum + row.role.length + row.name.length, 0), 5000);
});
test('active credits govern duration/content and automatic logo fading independently of free text', () => {
    const s = normalize({ contentMode: 'credits', body: '', credits: [{ role: 'Director', name: 'Name' }], logoGap: 240, tilt: 62 });
    assert.ok(hasText(s)); assert.ok(layoutText(s, measure).lines.length);
    const fade = planLogoFade(s, { logoBottom: 550, textTop: 8 });
    assert.equal(sceneAt(s, 178 / 30, fade).logoAlpha, 0);
    assert.equal(hasContent({ ...s, title: '', body: ' | \n- -' }), false);
});
test('editable timecode accepts frames and rejects invalid values', () => {
    assert.equal(parseTimecode('00:05:28'), 178); assert.equal(parseTimecode('01:00:00'), 1800);
    for (const value of ['00:00:30', '00:60:00', '-1:00:00', 'hello']) assert.equal(parseTimecode(value), null);
});

test('one body mixes normal paragraphs, column pairs and centered headings without visible markers', () => {
    const body = '-Lunnen team-\r\nart director | @enhanser\nNormal text\n\nname only | \n | @name\nordinary-hyphen';
    const rows = parseBody(body);
    assert.deepEqual(rows.map(row => row.kind), ['heading', 'pair', 'text', 'text', 'pair', 'pair', 'text']);
    assert.deepEqual(rows[1], { kind: 'pair', role: 'art director', name: '@enhanser' });
    assert.equal(parseBody('role | a | b')[0].name, 'a | b');
    const lines = layoutText(normalize({ body }), measure).lines;
    assert.equal(lines[0].text, 'Lunnen team'); assert.equal(lines[0].alignment, 'center');
    assert.ok(lines.some(line => line.text === 'Normal text'));
    assert.ok(lines.some(line => line.text === '@enhanser' && line.x > 0));
    assert.ok(lines.every(line => !line.text.includes('|')));
    assert.ok(creditsToText(normalizeCredits(Array(100).fill({ role: 'a'.repeat(100), name: 'b'.repeat(100) }))).length <= 6000);
});
