// Final cards use the same world-distance clock as the opening gap.
export const ENDING_DEFAULTS = Object.freeze({ endingType: 'none', endingText: 'Lunnen\nAiris', endingAsset: null, endingDuration: 3, endingGap: 0, endingScale: 60, endingFadeIn: false, endingFadeOut: false });
export const ENDING_RANGES = Object.freeze({ endingDuration: [1, 30, .5], endingGap: [-2400, 2400, 10], endingScale: [10, 100, 1] });
export const ASSET_MAX_BYTES = 5 * 1024 * 1024;
// Allow JSON escaping and base64 overhead for an embedded asset at the upload limit.
export const PRESET_MAX_BYTES = 12 * 1024 * 1024;
export const ENDING_TYPES = ['none', 'text', 'svg', 'lottie'];
export function normalizeEnding(input) {
    const result = { ...ENDING_DEFAULTS };
    if (ENDING_TYPES.includes(input.endingType)) result.endingType = input.endingType;
    if (typeof input.endingText === 'string') result.endingText = input.endingText.replace(/\r\n?/g, '\n').slice(0, 500);
    // Old presets and drafts had one switch for both boundaries.
    for (const key of ['endingFadeIn', 'endingFadeOut']) result[key] = typeof input[key] === 'boolean' ? input[key] : input.endingFade === true;
    const a = input.endingAsset;
    if (a && ['svg', 'lottie-json', 'dotlottie'].includes(a.kind) && typeof a.data === 'string' && a.data.length <= ASSET_MAX_BYTES * 1.4) {
        result.endingAsset = { kind: a.kind, data: a.data, name: typeof a.name === 'string' ? a.name.slice(0, 200) : 'Ending' };
    }
    return result;
}
export function hasEnding(s) {
    return s.endingType === 'text' ? Boolean(s.endingText?.trim()) : s.endingType === 'svg' ? s.endingAsset?.kind === 'svg'
        : s.endingType === 'lottie' && ['lottie-json', 'dotlottie'].includes(s.endingAsset?.kind);
}
export function endingPlan(s, crawlFrames, fps = 30) {
    if (!hasEnding(s)) return null;
    // Negative gaps overlap the preceding animation; never start before frame zero.
    const startFrame = crawlFrames ? Math.max(0, crawlFrames + Math.ceil(s.endingGap / s.speed * fps)) : 0;
    const frames = Math.max(1, Math.round(s.endingDuration * fps));
    return { startFrame, start: startFrame / fps, frames, end: (startFrame + frames - 1) / fps };
}
export function endingAt(s, plan, time) {
    if (!plan || time < plan.start || time > plan.end + 1e-6) return { visible: false, alpha: 0, time: 0 };
    const localTime = time - plan.start, fade = Math.min(.5, (plan.end - plan.start) / 2);
    const smooth = t => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
    const alpha = (s.endingFadeIn ? smooth(localTime / fade) : 1) * (s.endingFadeOut ? smooth((plan.end - time) / fade) : 1);
    return { visible: true, alpha, time: localTime };
}
export function lottieFrame(localTime, duration, totalFrames) {
    // Play once at the source rate, then hold; never restart on a random seek.
    return Math.min(Math.max(0, totalFrames - 1), Math.max(0, localTime) / duration * totalFrames);
}
export function validateLottieJSON(source) {
    if (new TextEncoder().encode(source).length > ASSET_MAX_BYTES) throw new Error('Use a Lottie file up to 5 MB.');
    const data = JSON.parse(source);
    if (!data || !Array.isArray(data.layers) || !Number.isFinite(data.fr) || data.fr <= 0 || data.fr > 240 || !Number.isFinite(data.ip) || !Number.isFinite(data.op) || data.op <= data.ip || !Number.isFinite(data.w) || !Number.isFinite(data.h) || data.w <= 0 || data.h <= 0 || data.w > 16384 || data.h > 16384) throw new Error('This JSON is not a valid Lottie animation.');
    if (data.assets?.some(a => typeof a.p === 'string' && !/^data:image\/(png|jpeg|webp);base64,/i.test(a.p))) throw new Error('Embed image assets in the Lottie file before importing.');
    if (data.fonts?.list?.some(f => f.fPath)) throw new Error('Convert Lottie text to shapes before importing external fonts.');
    return data;
}
export function validateDotLottie(bytes) {
    if (bytes.length > ASSET_MAX_BYTES) throw new Error('Use a Lottie file up to 5 MB.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = bytes.length - 22;
    for (; end >= Math.max(0, bytes.length - 65557); end--) if (view.getUint32(end, true) === 0x06054b50) break;
    if (end < 0 || bytes.length < 22 || view.getUint32(end, true) !== 0x06054b50) throw new Error('This is not a valid .lottie archive.');
    const count = view.getUint16(end + 10, true); let offset = view.getUint32(end + 16, true), size = 0;
    if (count > 128) throw new Error('This Lottie archive contains too many files.');
    for (let i = 0; i < count; i++) {
        if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid Lottie archive directory.');
        size += view.getUint32(offset + 24, true);
        offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    }
    if (size > 16 * 1024 * 1024) throw new Error('The unpacked Lottie is too large (16 MB maximum).');
}
export function decodeLottieAsset(asset) {
    if (asset.kind === 'lottie-json') return validateLottieJSON(asset.data);
    const bytes = Uint8Array.from(atob(asset.data), char => char.charCodeAt(0)); validateDotLottie(bytes); return bytes.buffer;
}
