import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, CREDITS, LUNNEN_BLUE, INTRO, crawlStart, normalize, migrateDraft, hasContent, sceneAt, framePlan, project, camera, wrapText, layoutText, FPS, timecode, HEIGHT, planLogoFade, LOGO_CLEARANCE } from '../model.js';
const measure = (text, size = 10) => [...text].length * size * .5;
const layout = settings => layoutText(settings, measure);
test('Lunnen intro, supplied credits and brand color are the defaults', () => {
    assert.equal(DEFAULTS.title, 'Lunnen\nAiris');
    assert.equal(DEFAULTS.body, CREDITS);
    assert.equal(CREDITS.split('\n').length, 14);
    assert.equal(CREDITS.split('\n')[1], 'graphic designers @whatmisha @galizdra');
    assert.equal(DEFAULTS.textColor, LUNNEN_BLUE);
    assert.equal(LUNNEN_BLUE, '#2353DB');
    assert.equal(DEFAULTS.alignment, 'justify-all');
});
test('duration follows text, gap and shared speed; output remains 1080p / 30 fps', () => {
    const s = normalize(), a = framePlan(s, layout(s));
    const faster = { ...s, speed: s.speed * 2 }, b = framePlan(faster, layout(faster));
    assert.ok(Math.abs((a.duration - .5) / 2 - (b.duration - .5)) < 1 / FPS);
    const longer = { ...s, body: s.body.repeat(3) };
    assert.ok(framePlan(longer, layout(longer)).duration > a.duration);
    assert.deepEqual([normalize({ width: 42, height: 33 }).width, normalize().height], [1920, 1080]);
    assert.equal(normalize({ speed: NaN }).speed, DEFAULTS.speed);
    assert.equal(normalize({ weight: 900 }).weight, 400);
});
test('ribbon bottom corners stay pinned to frame corners across all camera settings', () => {
    for (const tilt of [30, 62, 80]) for (const perspective of [60, 100, 180]) for (const columnWidth of [600, 1120, 1500]) {
        const s = normalize({ tilt, perspective, columnWidth }), l = layout(s), p = framePlan(s, l);
        assert.deepEqual(project(-columnWidth / 2, 0, s), { x: 0, y: 1080, scale: 1 });
        assert.deepEqual(project(columnWidth / 2, 0, s), { x: 1920, y: 1080, scale: 1 });
        assert.ok(sceneAt(s, p.lastTime).crawlTime * s.speed - l.height > camera(s).fadeEnd);
        assert.equal(p.duration, p.frames / FPS);
    }
});
test('logo recedes and fades while the crawl enters, then disappears', () => {
    const start = sceneAt(DEFAULTS, 0), middle = sceneAt(DEFAULTS, 1), overlap = sceneAt(DEFAULTS, 4), end = sceneAt(DEFAULTS, INTRO.logoFadeEnd / DEFAULTS.speed + 1 / FPS);
    assert.equal(sceneAt(DEFAULTS, 89 / FPS).crawlVisible, false);
    assert.equal(sceneAt(DEFAULTS, 90 / FPS).crawlVisible, true);
    assert.equal(sceneAt(DEFAULTS, 90 / FPS).crawlTime, 0);
    assert.equal(start.phase, 'Logo'); assert.equal(start.logoAlpha, 1); assert.equal(start.crawlVisible, false);
    assert.ok(start.logoScale > middle.logoScale && middle.logoScale > overlap.logoScale);
    assert.equal(overlap.phase, 'Logo → Crawl'); assert.equal(overlap.crawlTime, 1);
    assert.ok(overlap.logoAlpha === 1 && overlap.crawlVisible);
    assert.equal(end.logoAlpha, 0); assert.equal(end.phase, 'Crawl');
});
test('logo and ribbon advance at the same constant speed and use the same perspective', () => {
    for (const speed of [10, 120, 400]) for (const tilt of [30, 62, 80]) for (const perspective of [60, 100, 180]) {
        const s = normalize({ speed, tilt, perspective }), c = camera(s);
        for (const t of [2, 3, 10]) {
            const a = sceneAt(s, t), b = sceneAt(s, t + 1 / FPS);
            assert.ok(Math.abs((b.logoDistance - a.logoDistance) - speed / FPS) < 1e-8);
            assert.ok(Math.abs((b.crawlDistance - a.crawlDistance) - speed / FPS) < 1e-8);
            assert.ok(Math.abs(a.logoScale / (1.06 * INTRO.logoNearRatio) - project(0, a.logoDistance, s).scale) < 1e-10);
        }
        const slow = { ...s, speed: speed / 2 };
        assert.equal(sceneAt(s, 3).logoScale, sceneAt(slow, 6).logoScale);
        assert.equal(sceneAt(s, 3).logoAlpha, sceneAt(slow, 6).logoAlpha);
        assert.equal(sceneAt(s, 5).crawlDistance, sceneAt(slow, 10).crawlDistance);
        assert.equal(sceneAt(s, 0).logoScale.toFixed(6), '1.060000');
        assert.equal(sceneAt(s, crawlStart(s)).crawlDistance, 0);
        const logo = { ...s, body: '' }, plan = framePlan(logo, layout(logo));
        assert.equal(sceneAt(logo, plan.lastTime).logoAlpha, 0);
    }
});
test('perspective shrinks distant lines and slows their apparent motion', () => {
    const s = normalize(), near = project(500, 300, s), far = project(500, 1800, s);
    assert.ok(near.scale > far.scale && near.x > far.x && near.y > far.y);
    assert.ok(near.y - project(500, 301, s).y > far.y - project(500, 1801, s).y);
});
test('wrapping preserves paragraphs and handles long words and Unicode graphemes', () => {
    const lines = wrapText('one two three\n\nчетыре\nfive', 50, text => measure(text));
    assert.deepEqual(lines.map(l => l.text), ['one two', 'three', '', 'четыре', 'five']);
    assert.equal(lines[0].last, false); assert.equal(lines[1].last, true);
    const complex = '👩‍🚀'.repeat(5), split = wrapText(complex, 2, text => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length);
    assert.equal(split.map(l => l.text).join(''), complex); assert.equal(split.length, 3);
});
test('logo is separate from the ribbon; optional or empty content has no dead lead-in', () => {
    const empty = { ...DEFAULTS, title: ' ', body: '\n ' }, body = { ...DEFAULTS, title: '', body: 'Body only' }, logo = { ...DEFAULTS, body: '' };
    assert.equal(hasContent(empty), false); assert.equal(framePlan(empty, layout(empty)).frames, 1);
    assert.equal(layout(body).lines[0].y, 0); assert.equal(sceneAt(body, 0).crawlVisible, true);
    assert.equal(sceneAt(body, 2).crawlTime, 2); assert.equal(sceneAt(body, 2).logoAlpha, 0);
    assert.equal(layout(logo).lines.length, 0); assert.ok(Math.abs(framePlan(logo, layout(logo)).duration - (INTRO.logoFadeEnd / logo.speed + .5)) < 1 / FPS);
    assert.equal(sceneAt(logo, framePlan(logo, layout(logo)).lastTime).logoAlpha, 0);
    assert.equal(layout(DEFAULTS).lines[0].text, 'art director @enhanser');
});
test('draft migration upgrades demo fields and preserves authored fields', () => {
    const s = migrateDraft({ version: 1, settings: { title: 'A NEW PERSPECTIVE', textColor: '#ffe168', fontSize: 70, body: 'My credits', speed: 90 } });
    assert.equal(s.title, DEFAULTS.title); assert.equal(s.textColor, LUNNEN_BLUE); assert.equal(s.fontSize, 36);
    assert.equal(s.body, 'My credits'); assert.equal(s.speed, 90);
    const oldCredits = CREDITS.replace('graphic designers', 'graphical designers');
    assert.equal(migrateDraft({ version: 2, settings: { body: oldCredits } }).body, CREDITS);
    assert.equal(migrateDraft({ version: 2, settings: { body: oldCredits + '\nCustom credit' } }).body, oldCredits + '\nCustom credit');
    assert.equal(migrateDraft({ version: 2, settings: { title: 'A NEW PERSPECTIVE', textColor: '#ffe168' } }).textColor, '#ffe168');
});
test('speed 10 remains valid in persisted settings and produces the complete slow crawl', () => {
    const slow = normalize({ speed: 10 }), regular = normalize();
    assert.equal(slow.speed, 10); assert.equal(normalize({ speed: 0 }).speed, 10);
    const slowPlan = framePlan(slow, layout(slow)), regularPlan = framePlan(regular, layout(regular));
    assert.ok(Math.abs((slowPlan.duration - .5) / 12 - (regularPlan.duration - .5)) < 1 / FPS);
    assert.ok(sceneAt(slow, slowPlan.lastTime).crawlTime * slow.speed - layout(slow).height > camera(slow).fadeEnd);
});
test('gap is a spatial offset: speed preserves separation and controls entry time', () => {
    for (const logoGap of [0, 240, 360, 1200, 2400]) for (const speed of [10, 120, 400]) {
        const s = normalize({ logoGap, speed });
        assert.equal(crawlStart(s), logoGap / speed);
        for (const t of [0, 1, 5, 30]) {
            const scene = sceneAt(s, t);
            assert.equal(scene.logoTravel - scene.crawlDistance, logoGap);
        }
        assert.equal(sceneAt(s, crawlStart(s)).crawlVisible, true);
        if (logoGap) assert.equal(sceneAt(s, crawlStart(s) - 1 / FPS).crawlVisible, false);
        assert.equal(crawlStart({ ...s, title: '' }), 0);
        assert.equal(sceneAt({ ...s, title: '' }, 0).crawlVisible, true);
    }
    const close = normalize({ logoGap: 240 }), far = normalize({ logoGap: 720 });
    assert.equal(crawlStart(close), 2); assert.equal(crawlStart(far), 6);
    assert.equal(sceneAt(close, 3).logoScale, sceneAt(far, 3).logoScale);
    assert.ok(Math.abs(framePlan(far, layout(far)).duration - framePlan(close, layout(close)).duration - 4) < 1 / FPS);
    assert.equal(sceneAt(normalize({ logoGap: 2400 }), 10).phase, 'Gap');
    assert.equal(migrateDraft({ version: 3, settings: { speed: 90, body: 'My text', lineHeight: 1.8 } }).logoGap, DEFAULTS.logoGap);
    assert.equal(normalize({ logoGap: -20 }).logoGap, 0);
});
test('line spacing changes baseline distances and duration without changing the shared motion', () => {
    const tight = normalize({ lineHeight: .8 }), loose = normalize({ lineHeight: 3 });
    const a = layout(tight), b = layout(loose);
    assert.equal(a.lines[1].y - a.lines[0].y, tight.fontSize * tight.lineHeight);
    assert.equal(b.lines[1].y - b.lines[0].y, loose.fontSize * loose.lineHeight);
    assert.deepEqual(a.lines.map(l => l.text), b.lines.map(l => l.text));
    assert.ok(framePlan(loose, b).duration > framePlan(tight, a).duration);
    assert.deepEqual(sceneAt(tight, 4), sceneAt(loose, 4));
});
test('timecode carries frames into seconds and minutes', () => {
    assert.equal(timecode(29), '00:00:29'); assert.equal(timecode(30), '00:01:00'); assert.equal(timecode(1800), '01:00:00');
});

test('automatic logo fade stays ahead of contact across camera, gap, glyph bounds and speeds', () => {
    let cases = 0;
    for (const tilt of [30, 62, 80]) for (const perspective of [60, 100, 180])
    for (const columnWidth of [600, 1120, 1500]) for (const logoGap of [0, 10, 240, 360, 2400])
    for (const logoBottom of [150, 550, 2000, 50000]) for (const textTop of [0, 10, 100, 5000]) {
        const base = normalize({ tilt, perspective, columnWidth, logoGap });
        const fade = planLogoFade(base, { logoBottom, textTop });
        assert.ok(fade.start >= 0 && fade.end >= fade.start && fade.end <= INTRO.logoFadeEnd);
        for (const speed of [10, 120, 400]) {
            const s = { ...base, speed };
            assert.deepEqual(planLogoFade(s, { logoBottom, textTop }), fade);
            // Include fractional-frame times and the instant just before the deadline.
            for (const fraction of [0, .01, .1, .25, .5, .75, .9, .99, 1 - 1e-8]) {
                const travel = fade.end * fraction, scene = sceneAt(s, travel / speed, fade);
                if (scene.logoAlpha <= 0 || travel < logoGap + textTop) continue;
                const clearance = project(0, travel - logoGap - textTop, s).y - (HEIGHT / 2 + logoBottom * scene.logoScale);
                assert.ok(clearance >= LOGO_CLEARANCE - 1e-6, `Unsafe gap ${clearance} in ${JSON.stringify({ ...s, body: '', title: '', logoBottom, textTop, travel })}`);
            }
            assert.equal(sceneAt(s, fade.end / speed, fade).logoAlpha, 0);
            assert.equal(sceneAt(s, (fade.end + 1000) / speed, fade).logoAlpha, 0);
        }
        cases++;
    }
    assert.equal(cases, 2160);
});
test('collision fade covers screenshot timing, zero lead-in and missing content', () => {
    const s = normalize({ logoGap: 240 }), bounds = { logoBottom: 550, textTop: 8 };
    const fade = planLogoFade(s, bounds);
    assert.ok(fade.end < 178 / FPS * s.speed);
    assert.equal(sceneAt(s, 178 / FPS, fade).logoAlpha, 0);
    assert.ok(sceneAt(s, fade.start / s.speed, fade).logoAlpha > sceneAt(s, (fade.start + fade.end) / 2 / s.speed, fade).logoAlpha);
    const noRoom = planLogoFade({ ...s, logoGap: 0 }, { logoBottom: 2000, textTop: 0 });
    assert.deepEqual(noRoom, { start: 0, end: 0 });
    assert.equal(sceneAt(s, 0, noRoom).logoAlpha, 0);
    const natural = { start: INTRO.logoFadeStart, end: INTRO.logoFadeEnd };
    assert.deepEqual(planLogoFade({ ...s, body: '' }, bounds), natural);
    assert.deepEqual(planLogoFade({ ...s, title: '' }, bounds), natural);
    assert.deepEqual(planLogoFade({ ...s, logoGap: 2400 }, bounds), natural);
    assert.deepEqual(planLogoFade(s, { logoBottom: 550, textTop: null }), natural);
});
