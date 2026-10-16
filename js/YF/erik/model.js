import { ENDING_DEFAULTS, ENDING_RANGES, normalizeEnding, hasEnding, endingPlan } from './ending-model.js';
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;
export const TEXT_LIMIT = 6000;
export const OUTRO_SECONDS = 5;
// Same value as Pizza Boxer's Lunnen Blue mini-preset.
export const LUNNEN_BLUE = '#2353DB';
// Logo fade thresholds are world distances, so changing Speed retimes its whole flight.
export const INTRO = Object.freeze({ logoNearRatio: .2, logoFadeStart: 660, logoFadeEnd: 1020 });
export const CREDITS = `art director @enhanser
graphic designers @whatmisha @galizdra
creative producer @natahandreeva
content production head @zatais
assistant producer @kvolozina
photographer @rosstovtseva
retouch @berezhneva.production
set designer @sakhar_d
assistant set designer @nedoabortesh 
muah @soya.mua
stylist @svetamiha
assistant stylist @bazaarovvv
dop backstage @yasha__yakovlev
models @motionmngt`;
export const DEFAULTS = Object.freeze({
    ...ENDING_DEFAULTS, width: WIDTH, height: HEIGHT,
    title: 'Lunnen\nAiris', body: CREDITS,
    roleAlignment: 'right', nameAlignment: 'left', creditGap: 48,
    fontSize: 42, weight: 400, lineHeight: 1.5, tracking: 0,
    columnWidth: 1120, alignment: 'justify-all', tilt: 70, perspective: 100, speed: 120, logoGap: 450,
    textColor: LUNNEN_BLUE, backgroundColor: '#000000'
});
const LEGACY_DEFAULTS = {
    title: 'A NEW PERSPECTIVE',
    body: 'Somewhere between a word and a world, a story begins.\n\nLetters become landscapes. Lines stretch into the distance. A familiar thought takes on an unfamiliar shape.\n\nWrite something worth sending into the unknown.',
    fontSize: 70, alignment: 'justify', textColor: '#ffe168', backgroundColor: '#08090b'
};
export function migrateDraft(draft) {
    const settings = { ...(draft?.settings || DEFAULTS) };
    // Upgrade untouched demo fields; keep authored text and custom colors/settings.
    if (draft?.version === 1) for (const [key, value] of Object.entries(LEGACY_DEFAULTS)) {
        if (settings[key] === value) settings[key] = DEFAULTS[key];
    }
    if ([1, 2].includes(draft?.version) && settings.body === CREDITS.replace('graphic designers', 'graphical designers')) settings.body = CREDITS;
    return normalize(settings);
}
export const contentText = s => parseBody(s.body).map(row => row.kind === 'pair' ? `${row.role} ${row.name}` : row.text).join('\n');
export const hasText = settings => Boolean(contentText(settings).trim());
export const hasContent = settings => Boolean(settings.title.trim() || hasText(settings) || hasEnding(settings));
export const crawlStart = settings => settings.title.trim() ? settings.logoGap / settings.speed : 0;
export function sceneAt(settings, time, logoFade = { start: INTRO.logoFadeStart, end: INTRO.logoFadeEnd }, textFade = null) {
    const t = Math.max(0, time), hasLogo = Boolean(settings.title.trim());
    const c = camera(settings), startTime = crawlStart(settings), textPresent = hasText(settings);
    // Gap is a fixed offset along the shared motion path, independent of speed.
    // Camera placement keeps the upright logo closer for its initial Fill framing.
    const travel = t * settings.speed;
    const logoDistance = c.logoStartDistance + travel;
    const gap = hasLogo ? settings.logoGap : 0;
    const crawlDistance = travel - gap, crawlVisible = crawlDistance >= 0;
    const crawlTime = Math.max(0, t - startTime);
    const fade = logoFade.end <= logoFade.start ? Number(travel >= logoFade.end)
        : Math.min(1, Math.max(0, (travel - logoFade.start) / (logoFade.end - logoFade.start)));
    const logoAlpha = hasLogo ? 1 - fade * fade * (3 - 2 * fade) : 0;
    const textProgress = textFade ? Math.min(1, Math.max(0, (t - textFade.start) / (textFade.end - textFade.start))) : 0;
    const textAlpha = 1 - textProgress * textProgress * (3 - 2 * textProgress);
    return {
        textAlpha, crawlTime, crawlDistance, crawlVisible,
        logoTravel: travel, logoDistance,
        logoScale: 1.06 * INTRO.logoNearRatio * c.focal / (c.focal + logoDistance * c.sin),
        logoAlpha,
        phase: logoAlpha > 0 ? textPresent && crawlVisible ? 'Logo → Crawl' : 'Logo' : textPresent && textAlpha > 0 ? crawlVisible ? textProgress > 0 ? 'Fade out' : 'Crawl' : 'Gap' : 'End'
    };
}
export const RANGES = Object.freeze({
    ...ENDING_RANGES,
    fontSize: [32, 120, 1], weight: [100, 400, 1], lineHeight: [.8, 3, .05],
    tracking: [-2, 8, .1], columnWidth: [600, 1500, 10], tilt: [30, 80, 1],
    perspective: [60, 180, 1], speed: [10, 400, 1], logoGap: [-2400, 2400, 10], creditGap: [0, 160, 1]
});
export function normalize(input = {}) {
    const result = { ...DEFAULTS, ...normalizeEnding(input) };
    for (const [key, [min, max]] of Object.entries(RANGES)) {
        const value = Number(input[key] ?? DEFAULTS[key]);
        result[key] = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : DEFAULTS[key];
    }
    for (const [key, limit] of [['title', 200], ['body', TEXT_LIMIT]]) {
        result[key] = typeof input[key] === 'string' ? input[key].replace(/\r\n?/g, '\n').slice(0, limit) : DEFAULTS[key];
    }
    for (const key of ['textColor', 'backgroundColor']) if (/^#[a-f\d]{6}$/i.test(input[key])) result[key] = input[key];
    if (['left', 'center', 'justify', 'justify-all'].includes(input.alignment)) result.alignment = input.alignment;
    // v1/v2 used two independent editors. Preserve the active structured content as notation.
    if (input.contentMode === 'credits' && Array.isArray(input.credits)) result.body = creditsToText(input.credits);
    for (const key of ['roleAlignment', 'nameAlignment']) if (['left', 'center', 'right'].includes(input[key])) result[key] = input[key];
    return result;
}
// Plain text, role | name and -heading- can coexist in the same editable body.
export function parseBody(text = '') {
    return String(text).replace(/\r\n?/g, '\n').split('\n').map(line => {
        const text = line.trim();
        if (text.length > 2 && text.startsWith('-') && text.endsWith('-') && !text.includes('|')) return { kind: 'heading', text: text.slice(1, -1).trim() };
        const divider = text.indexOf('|');
        if (divider >= 0) return { kind: 'pair', role: text.slice(0, divider).trim(), name: text.slice(divider + 1).trim() };
        return { kind: 'text', text };
    });
}
export function creditsToText(rows) {
    return normalizeCredits(rows).map(row => row.kind === 'heading' ? `-${row.role}-`
        : row.role || row.name ? `${row.role} | ${row.name}` : '').join('\n');
}
// Legacy parsing is retained only for v1/v2 imports and migration tests.
export function parseCredits(text) {
    return text.split('\n').filter(line => line.trim()).map(line => {
        const tab = line.indexOf('\t'), at = line.indexOf('@'), split = tab >= 0 ? tab : at;
        return split < 0 ? { role: line.trim(), name: '' } : { role: line.slice(0, split).trim(), name: line.slice(split + (tab >= 0 ? 1 : 0)).trim() };
    });
}
export function normalizeCredits(rows) {
    if (!Array.isArray(rows)) return [];
    let budget = 5000;
    return rows.slice(0, 100).map(row => {
        const result = {};
        for (const key of ['role', 'name']) {
            result[key] = typeof row?.[key] === 'string' ? row[key].replace(/[\r\n\t]+/g, ' ').slice(0, Math.min(250, budget)) : '';
            budget -= result[key].length;
        }
        if (row?.kind === 'heading') { result.kind = 'heading'; result.name = ''; }
        return result;
    });
}
export function parseTimecode(value) {
    const match = /^(\d{1,3}):([0-5]\d):([0-2]\d)$/.exec(value.trim());
    return match ? (Number(match[1]) * 60 + Number(match[2])) * FPS + Number(match[3]) : null;
}
export function camera(settings) {
    const angle = settings.tilt * Math.PI / 180;
    const focal = HEIGHT * .65 * 100 / settings.perspective;
    const depth = focal / Math.sin(angle);
    return {
        focal, sin: Math.sin(angle), cos: Math.cos(angle), planeScale: WIDTH / settings.columnWidth,
        logoStartDistance: -depth * (1 - INTRO.logoNearRatio), fadeStart: depth * 2, fadeEnd: depth * 4.5
    };
}
export function project(x, distance, settings) {
    const c = camera(settings), denominator = c.focal + distance * c.sin;
    const scale = c.focal / denominator;
    return { x: WIDTH / 2 + x * c.planeScale * scale, y: HEIGHT / 2 + (HEIGHT / 2 - distance * c.cos * c.planeScale) * scale, scale };
}
// Logical output pixels. Includes room for antialiasing and scaled preview sampling.
export const LOGO_CLEARANCE = 24;
export function planLogoFade(settings, { logoBottom, textTop } = {}) {
    const normal = { start: INTRO.logoFadeStart, end: INTRO.logoFadeEnd };
    if (!settings.title.trim() || !hasText(settings) || !Number.isFinite(logoBottom) || !Number.isFinite(textTop)) return normal;
    const c = camera(settings), q = settings.logoGap + Math.max(0, textTop);
    if (q >= normal.end) return normal;
    // First ink reaches the bottom edge at travel q. Beyond that point both bounds
    // are rational perspective curves with positive denominators. Their clearance
    // numerator is a concave quadratic: if initially positive it has one positive
    // root. Solve it directly so no between-frame contact can escape sampling.
    const p = c.focal * INTRO.logoNearRatio / c.sin;
    const b = p + q, k = c.cos * c.planeScale;
    const a = 1.06 * Math.max(0, logoBottom) * p, margin = LOGO_CLEARANCE;
    const quadratic = -c.focal * k - margin * c.sin;
    const linear = c.focal * HEIGHT / 2 - c.focal * k * b - a * c.sin - margin * (c.focal + c.sin * b);
    const constant = c.focal * HEIGHT / 2 * b - a * c.focal - margin * c.focal * b;
    // With a negative gap, the crawl is already inside the frame at t=0.
    // Solve from that visible interval, where both perspective denominators are positive.
    const offset = Math.max(0, -q), shiftedLinear = linear + 2 * quadratic * offset;
    const shiftedConstant = constant + linear * offset + quadratic * offset * offset;
    let contact = Math.max(0, q);
    if (shiftedConstant > 0) {
        const root = Math.sqrt(shiftedLinear * shiftedLinear - 4 * quadratic * shiftedConstant);
        // Use the numerically stable form for either sign of the linear term.
        const advance = shiftedLinear >= 0 ? (-shiftedLinear - root) / (2 * quadratic) : 2 * shiftedConstant / (-shiftedLinear + root);
        contact += advance;
    }
    const end = Math.min(normal.end, Math.max(0, contact));
    return { start: Math.max(0, end - (normal.end - normal.start)), end };
}
export function planTextFade(settings, layout) {
    if (!layout.lines.length) return null;
    // At distance zero, a glyph is exactly on the bottom canvas edge for every camera.
    // Use the raster's last ink, not paragraph whitespace or the texture tile extent.
    const bottom = Number.isFinite(layout.inkBottom) ? layout.inkBottom
        : Math.max(...layout.lines.map(line => line.y + line.size));
    const start = crawlStart(settings) + Math.max(0, bottom) / settings.speed;
    // Keep a natural 5–6 second fade and finish on a whole-second duration.
    const frames = Math.ceil(start + OUTRO_SECONDS) * FPS;
    // The fade may have elapsed before frame zero for a strongly negative logo gap.
    return { start, end: (frames - 1) / FPS, frames: Math.max(1, frames) };
}
export function framePlan(settings, layout) {
    if (!hasContent(settings)) return { frames: 1, duration: 1 / FPS, lastTime: 0, textFade: null };
    const textFade = planTextFade(settings, layout);
    const logoEnd = settings.title.trim() ? (layout.logoFade?.end ?? INTRO.logoFadeEnd) / settings.speed : 0;
    const crawlFrames = settings.title.trim() || hasText(settings) ? Math.max(textFade?.frames || 1, Math.ceil((logoEnd + (settings.title.trim() ? .5 : 0)) * FPS)) : 0;
    const ending = endingPlan(settings, crawlFrames);
    // An overlapping ending must never truncate the remaining crawl.
    const frames = Math.max(1, crawlFrames, ending ? ending.startFrame + ending.frames : 0);
    return { frames, duration: frames / FPS, lastTime: (frames - 1) / FPS, textFade, ending, crawlFrames };
}
export function timecode(frame) {
    const n = Math.max(0, Math.round(frame));
    return [Math.floor(n / FPS / 60), Math.floor(n / FPS) % 60, n % FPS].map(v => String(v).padStart(2, '0')).join(':');
}
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
export const graphemes = text => Array.from(segmenter.segment(text), item => item.segment);

// Measure complete runs so kerning, ligatures and Cyrillic use the browser's font shaping.
export function wrapText(text, width, measure) {
    const lines = [];
    for (const paragraph of text.split('\n')) {
        if (!paragraph.trim()) { lines.push({ text: '', last: true }); continue; }
        const words = paragraph.trim().split(/\s+/u);
        let line = '';
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (measure(candidate) <= width) { line = candidate; continue; }
            if (line) { lines.push({ text: line, last: false }); line = ''; }
            if (measure(word) <= width) { line = word; continue; }
            for (const glyph of graphemes(word)) {
                if (line && measure(line + glyph) > width) { lines.push({ text: line, last: false }); line = ''; }
                line += glyph;
            }
        }
        if (line) lines.push({ text: line, last: true });
    }
    return lines;
}
export function layoutText(settings, measure) {
    const lines = []; let y = 0;
    function append(text, size, alignment) {
        if (!text.trim()) return;
        const wrapped = wrapText(text, settings.columnWidth, value => measure(value, size));
        for (const line of wrapped) {
            if (line.text) lines.push({ ...line, size, alignment, y });
            y += size * settings.lineHeight;
        }
    }
    const size = settings.fontSize, step = size * settings.lineHeight;
    const width = (settings.columnWidth - settings.creditGap) / 2;
    for (const row of parseBody(settings.body)) {
        if (row.kind === 'heading') {
            if (!row.text) continue;
            if (lines.length) y += step;
            append(row.text, size, 'center'); y += step;
        } else if (row.kind === 'pair') {
            const role = row.role ? wrapText(row.role, width, text => measure(text, size)) : [];
            const name = row.name ? wrapText(row.name, width, text => measure(text, size)) : [];
            for (const [column, wrapped] of [role, name].entries()) wrapped.forEach((line, i) => {
                if (line.text) lines.push({ ...line, size, y: y + i * step, width,
                    x: column * (width + settings.creditGap), alignment: column ? settings.nameAlignment : settings.roleAlignment });
            });
            y += Math.max(1, role.length, name.length) * step;
        } else if (row.text) append(row.text, size, settings.alignment);
        else y += step;
    }
    return { lines, height: lines.length ? y + settings.fontSize * .5 : 0 };
}
export function layoutKey(s) {
    return JSON.stringify([s.body, s.fontSize, s.weight, s.lineHeight, s.tracking, s.columnWidth, s.alignment, s.creditGap, s.roleAlignment, s.nameAlignment]);
}
