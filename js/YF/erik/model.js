export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;
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
    width: WIDTH, height: HEIGHT,
    title: 'Lunnen\nAiris', body: CREDITS,
    fontSize: 36, weight: 400, lineHeight: 1.4, tracking: 0,
    columnWidth: 1120, alignment: 'justify-all', tilt: 62, perspective: 100, speed: 120, logoGap: 360,
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
export const hasContent = settings => Boolean(settings.title.trim() || settings.body.trim());
export const crawlStart = settings => settings.title.trim() ? settings.logoGap / settings.speed : 0;
export function sceneAt(settings, time, logoFade = { start: INTRO.logoFadeStart, end: INTRO.logoFadeEnd }) {
    const t = Math.max(0, time), hasLogo = Boolean(settings.title.trim());
    const c = camera(settings), startTime = crawlStart(settings), hasText = Boolean(settings.body.trim());
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
    return {
        crawlTime, crawlDistance, crawlVisible,
        logoTravel: travel, logoDistance,
        logoScale: 1.06 * INTRO.logoNearRatio * c.focal / (c.focal + logoDistance * c.sin),
        logoAlpha,
        phase: logoAlpha > 0 ? hasText && crawlVisible ? 'Logo → Crawl' : 'Logo' : hasText ? crawlVisible ? 'Crawl' : 'Gap' : 'End'
    };
}
export const RANGES = Object.freeze({
    fontSize: [32, 120, 1], weight: [100, 400, 1], lineHeight: [.8, 3, .05],
    tracking: [-2, 8, .1], columnWidth: [600, 1500, 10], tilt: [30, 80, 1],
    perspective: [60, 180, 1], speed: [10, 400, 1], logoGap: [0, 2400, 10]
});
export function normalize(input = {}) {
    const result = { ...DEFAULTS };
    for (const [key, [min, max]] of Object.entries(RANGES)) {
        const value = Number(input[key] ?? DEFAULTS[key]);
        result[key] = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : DEFAULTS[key];
    }
    for (const [key, limit] of [['title', 200], ['body', 5000]]) {
        result[key] = typeof input[key] === 'string' ? input[key].replace(/\r\n?/g, '\n').slice(0, limit) : DEFAULTS[key];
    }
    for (const key of ['textColor', 'backgroundColor']) if (/^#[a-f\d]{6}$/i.test(input[key])) result[key] = input[key];
    if (['left', 'center', 'justify', 'justify-all'].includes(input.alignment)) result.alignment = input.alignment;
    return result;
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
    if (!settings.title.trim() || !settings.body.trim() || !Number.isFinite(logoBottom) || !Number.isFinite(textTop)) return normal;
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
    let contact = q;
    if (constant > 0) {
        const root = Math.sqrt(linear * linear - 4 * quadratic * constant);
        // Use the numerically stable form for either sign of the linear term.
        const advance = linear >= 0 ? (-linear - root) / (2 * quadratic) : 2 * constant / (-linear + root);
        contact += advance;
    }
    const end = Math.min(normal.end, Math.max(0, contact));
    return { start: Math.max(0, end - (normal.end - normal.start)), end };
}
export function framePlan(settings, layout) {
    if (!hasContent(settings)) return { frames: 1, duration: 1 / FPS, lastTime: 0 };
    const hasLogo = Boolean(settings.title.trim()), c = camera(settings);
    const logoEnd = hasLogo ? (layout.logoFade?.end ?? INTRO.logoFadeEnd) / settings.speed : 0;
    const crawlEnd = layout.lines.length
        ? ((hasLogo ? settings.logoGap : 0) + layout.height + c.fadeEnd) / settings.speed : 0;
    const seconds = Math.max(logoEnd, crawlEnd) + .5;
    const frames = Math.ceil(seconds * FPS);
    return { frames, duration: frames / FPS, lastTime: (frames - 1) / FPS };
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
    append(settings.body, settings.fontSize, settings.alignment);
    return { lines, height: lines.length ? y + settings.fontSize * .5 : 0 };
}
export function layoutKey(s) {
    return JSON.stringify([s.body, s.fontSize, s.weight, s.lineHeight, s.tracking, s.columnWidth, s.alignment]);
}
