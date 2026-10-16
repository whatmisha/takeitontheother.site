import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize, framePlan, layoutText, hasContent, DEFAULTS, migrateDraft } from '../model.js';
import { ENDING_DEFAULTS, endingAt, hasEnding, lottieFrame, validateLottieJSON, validateDotLottie } from '../ending-model.js';
import { presetDocument, parsePreset, styleOf } from '../document.js';
const layout = s => layoutText(s, (text, size) => text.length * size / 2);
const source = readFileSync(new URL('./fixtures/ending.json', import.meta.url), 'utf8');
test('disabled ending preserves crawl duration; enabled ending follows the full crawl and a speed-based gap', () => {
    const s = normalize(), base = framePlan(s, layout(s));
    assert.equal(base.ending, null);
    const withEnd = { ...s, endingType: 'text', endingGap: 450 };
    const plan = framePlan(withEnd, layout(withEnd));
    assert.equal(plan.ending.startFrame, base.frames + Math.ceil(450 / 120 * 30));
    assert.equal(plan.frames, plan.ending.startFrame + 90);
    assert.equal(endingAt(withEnd, plan.ending, plan.ending.start - 1 / 30).visible, false);
    assert.equal(endingAt(withEnd, plan.ending, plan.lastTime).alpha, 1);
    const slow = { ...withEnd, speed: 60 }, slowPlan = framePlan(slow, layout(slow));
    assert.equal(slowPlan.ending.startFrame - slowPlan.crawlFrames, 225);
});
test('ending-only compositions have no phantom crawl; optional fades have exact transparent boundaries', () => {
    const s = normalize({ title: '', body: '', endingType: 'text', endingFadeIn: true, endingFadeOut: true, endingGap: 450 });
    const plan = framePlan(s, layout(s));
    assert.ok(hasContent(s)); assert.equal(plan.frames, 90); assert.equal(plan.ending.startFrame, 0);
    assert.equal(endingAt(s, plan.ending, 0).alpha, 0);
    assert.equal(endingAt(s, plan.ending, .5).alpha, 1);
    assert.equal(endingAt(s, plan.ending, plan.lastTime).alpha, 0);
    assert.equal(endingAt(s, plan.ending, .25).alpha, .5);
    assert.equal(hasEnding(normalize({ endingType: 'svg' })), false);
    assert.equal(hasEnding(normalize({ endingType: 'text', endingText: '  ' })), false);
});
test('v5 preset round trips content and embedded assets; v3 imports default to no ending', () => {
    const s = normalize({ endingType: 'lottie', endingAsset: { kind: 'lottie-json', name: 'mark.json', data: source }, endingGap: 720, endingFadeIn: true, endingFadeOut: true });
    assert.deepEqual(parsePreset(JSON.stringify(presetDocument(s))).settings, s);
    assert.equal(styleOf(s).endingAsset, undefined);
    const legacy = presetDocument(DEFAULTS); legacy.schemaVersion = 3;
    for (const key of Object.keys(ENDING_DEFAULTS)) delete legacy.settings[key];
    assert.equal(parsePreset(legacy).settings.endingType, 'none');
    for (const [key, value] of [['endingType', 'video'], ['endingGap', -2401], ['endingDuration', 0], ['endingFadeIn', 'yes'], ['endingFadeOut', 'yes'], ['endingAsset', { kind: 'svg', data: 'x', name: 5 }]]) {
        const doc = presetDocument(s); doc.settings[key] = value; assert.throws(() => parsePreset(doc));
    }
});
test('Lottie import rejects malformed, external and oversized archive inputs; playback holds its final source frame', () => {
    assert.equal(validateLottieJSON(source).op, 60);
    assert.throws(() => validateLottieJSON('{}'));
    const external = JSON.parse(source); external.assets = [{ p: 'https://example.com/image.png' }];
    assert.throws(() => validateLottieJSON(JSON.stringify(external)), /Embed/);
    validateDotLottie(new Uint8Array(readFileSync(new URL('./fixtures/ending.lottie', import.meta.url))));
    assert.throws(() => validateDotLottie(new Uint8Array([1, 2, 3])));
    assert.equal(lottieFrame(1, 2, 60), 30); assert.equal(lottieFrame(10, 2, 60), 59); assert.equal(lottieFrame(0, 2, 60), 0);
});

test('fade in and fade out independently control all four boundary combinations', () => {
    for (const endingFadeIn of [false, true]) for (const endingFadeOut of [false, true]) {
        const s = normalize({ title: '', body: '', endingType: 'text', endingFadeIn, endingFadeOut });
        const plan = framePlan(s, layout(s));
        assert.equal(endingAt(s, plan.ending, 0).alpha, endingFadeIn ? 0 : 1);
        assert.equal(endingAt(s, plan.ending, .25).alpha, endingFadeIn ? .5 : 1);
        assert.equal(endingAt(s, plan.ending, 1).alpha, 1);
        assert.ok(Math.abs(endingAt(s, plan.ending, plan.lastTime - .25).alpha - (endingFadeOut ? .5 : 1)) < 1e-12);
        assert.equal(endingAt(s, plan.ending, plan.lastTime).alpha, endingFadeOut ? 0 : 1);
        assert.deepEqual(parsePreset(JSON.stringify(presetDocument(s))).settings, s);
    }
});
test('v4 presets and v8 drafts preserve the old combined fade without overriding new switches', () => {
    for (const endingFade of [false, true]) {
        const doc = presetDocument(normalize({ endingType: 'text' })); doc.schemaVersion = 4;
        delete doc.settings.endingFadeIn; delete doc.settings.endingFadeOut; doc.settings.endingFade = endingFade;
        for (const s of [parsePreset(doc).settings, migrateDraft({ version: 8, settings: doc.settings })]) {
            assert.equal(s.endingFadeIn, endingFade); assert.equal(s.endingFadeOut, endingFade);
            assert.equal('endingFade' in s, false);
        }
    }
    const s = normalize({ endingFade: true, endingFadeIn: false, endingFadeOut: true });
    assert.equal(s.endingFadeIn, false); assert.equal(s.endingFadeOut, true);
});
test('Draft ships the full attached Lottie and independent fades with the supplied composition', () => {
    const doc = parsePreset(readFileSync(new URL('../presets/draft.json', import.meta.url), 'utf8'));
    assert.equal(doc.name, 'Draft'); assert.equal(doc.settings.endingFadeIn, true); assert.equal(doc.settings.endingFadeOut, false);
    assert.equal(doc.settings.endingDuration, 5); assert.equal(doc.settings.endingScale, 36); assert.equal(doc.settings.endingGap, -200);
    assert.equal(doc.settings.speed, 150); assert.equal(doc.settings.endingAsset.name, 'sparky_20261016_10-01-11-lottie.json');
    assert.equal(validateLottieJSON(doc.settings.endingAsset.data).op, 300);
    assert.ok(new TextEncoder().encode(doc.settings.endingAsset.data).length > 4 * 1024 * 1024);
});

test('negative gaps overlap without clipping either animation or producing negative frame counts', () => {
    for (const speed of [10, 120, 400]) for (const logoGap of [-2400, -450, 0, 450]) for (const endingGap of [-2400, -450, -10, 0]) {
        const s = normalize({ speed, logoGap, endingGap, endingType: 'text' });
        const plan = framePlan(s, layout(s));
        assert.equal(plan.ending.startFrame, Math.max(0, plan.crawlFrames + Math.ceil(endingGap / speed * 30)));
        assert.ok(Number.isInteger(plan.frames) && plan.frames > 0);
        assert.ok(plan.frames >= plan.crawlFrames && plan.frames >= plan.ending.startFrame + plan.ending.frames);
        assert.equal(endingAt(s, plan.ending, plan.ending.start).alpha, 1);
        assert.equal(endingAt(s, plan.ending, plan.ending.end).alpha, 1);
        assert.equal(endingAt(s, plan.ending, plan.ending.end + 1 / 30).visible, false);
        assert.deepEqual(parsePreset(JSON.stringify(presetDocument(s))).settings, s);
    }
    const short = normalize({ body: 'A', logoGap: -2400, speed: 10, endingType: 'text', endingGap: -2400 });
    const plan = framePlan(short, layout(short));
    assert.ok(plan.textFade.frames >= 1 && Number.isFinite(plan.textFade.end));
    const onlyEnding = normalize({ title: '', body: '', endingType: 'text', endingGap: -2400 });
    assert.equal(framePlan(onlyEnding, layout(onlyEnding)).ending.startFrame, 0);
});
