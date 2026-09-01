/**
 * ShareCodec — share a preset blob inside a URL.
 *
 * Algorithm (generalised from the original tool's PresetShareCodec):
 *   diff(blob, pristineDefaults) → JSON → deflate-raw → base64url → `v1.<payload>`
 *
 * Only values that differ from the pristine defaults are embedded, so links stay
 * short. When the URL would exceed the soft limit, the codec auto-tiers down a
 * configurable ladder (drop caches → drop heavy keys → quantize floats) instead
 * of asking the user to choose.
 *
 * Everything tool-specific (which keys to strip, which caches are optional,
 * which floats may be quantized) is injected via the constructor config, so the
 * codec itself carries no domain knowledge.
 */

const SHARE_VERSION_PREFIX = 'v1.';
const SHORT_QUERY_KEY_DEFAULT = 'preset';

/** Default budget so a link + a short message fits one Telegram message. */
export const SHARE_SOFT_LIMIT_CHARS = 3600;

export class ShareCodec {
    /**
     * @param {Object} config
     * @param {Object} config.pristineDefaults — baseline values for diffing
     * @param {string[]} [config.stripKeys] — keys never embedded (ids, timestamps)
     * @param {string[]} [config.optionalCacheKeys] — dropped at tier ≥ 1
     * @param {string[]} [config.heavyKeys] — dropped at tier ≥ 2 (e.g. palettes)
     * @param {string[]} [config.extraKeys] — non-default keys serialised only when non-empty
     * @param {string[]} [config.quantizableFloatKeys] — rounded to `decimals` at top tier
     * @param {number}   [config.decimals=4]
     * @param {number}   [config.softLimitChars]
     * @param {string}   [config.shortQueryKey='preset']
     * @param {string}   [config.labelKey='shareDisplayName'] — optional human label embedded in payload
     */
    constructor(config = {}) {
        this.pristineDefaults = config.pristineDefaults || {};
        this.stripKeys = new Set(config.stripKeys || ['id', 'createdAt', 'updatedAt', 'seeded']);
        this.optionalCacheKeys = config.optionalCacheKeys || [];
        this.heavyKeys = config.heavyKeys || [];
        this.extraKeys = config.extraKeys || [];
        this.quantizableFloatKeys = config.quantizableFloatKeys || [];
        this.decimals = config.decimals ?? 4;
        this.softLimitChars = config.softLimitChars ?? SHARE_SOFT_LIMIT_CHARS;
        this.shortQueryKey = config.shortQueryKey || SHORT_QUERY_KEY_DEFAULT;
        this.labelKey = config.labelKey || 'shareDisplayName';
    }

    /* ----------------------------- public encode ----------------------------- */

    /**
     * Encode a blob to `v1.<base64url>` (without the `#p=` prefix).
     * @returns {Promise<string>}
     */
    async encode(blob, options = {}) {
        const prepared = this._prepare(blob, options);
        const diff = this._buildDiff(prepared);
        const json = JSON.stringify(diff);
        const deflated = await deflateRawUtf8(json);
        return SHARE_VERSION_PREFIX + bytesToBase64Url(deflated);
    }

    /**
     * Encode trying progressively lighter tiers until the URL fits `maxUrlChars`.
     * @returns {Promise<{encoded:string,tier:number,urlChars:number,fits:boolean}>}
     */
    async encodeWithBudget(blob, { urlPrefix = '', maxUrlChars = this.softLimitChars } = {}) {
        const ladder = [
            {},
            { dropOptionalCaches: true },
            { dropOptionalCaches: true, dropHeavy: true },
            { dropOptionalCaches: true, dropHeavy: true, quantizeFloats: true }
        ];
        let best = null;
        for (let i = 0; i < ladder.length; i++) {
            let encoded;
            try {
                encoded = await this.encode(blob, ladder[i]);
            } catch (e) {
                if (best) continue;
                throw e;
            }
            const urlChars = urlPrefix.length + encoded.length;
            const candidate = { encoded, tier: i, urlChars, fits: urlChars <= maxUrlChars };
            if (candidate.fits) return candidate;
            if (!best || encoded.length < best.encoded.length) best = candidate;
        }
        return best;
    }

    /* ----------------------------- public decode ----------------------------- */

    /**
     * Decode a `#p=` fragment value (starting with `v1.`).
     * @returns {Promise<{full:Object, label:string}|null>}
     */
    async decode(payload) {
        const b64 = this.stripPayloadPrefix(String(payload || '').trim());
        if (!b64) return null;
        let utf8;
        try {
            utf8 = await inflateRawToUtf8(base64UrlToBytes(b64));
        } catch (e) {
            console.warn('[share] inflate failed:', e);
            return null;
        }
        let diff;
        try {
            diff = JSON.parse(utf8);
        } catch (e) {
            console.warn('[share] JSON parse failed:', e);
            return null;
        }
        if (!diff || typeof diff !== 'object') return null;
        return this.expandDiff(diff);
    }

    /** Merge a diff onto pristine defaults to produce a full loadable blob. */
    expandDiff(diff) {
        const full = { ...JSON.parse(JSON.stringify(this.pristineDefaults)), ...diff };
        for (const key of this.extraKeys) {
            if (full[key] === undefined || full[key] === null) {
                full[key] = Array.isArray(this.pristineDefaults[key]) ? [] : {};
            }
        }
        let label = '';
        if (typeof diff[this.labelKey] === 'string') label = diff[this.labelKey].trim();
        delete full[this.labelKey];
        return { full, label };
    }

    /* ------------------------------ URL helpers ------------------------------ */

    parsePayloadFromHash(hash) {
        if (!hash || typeof hash !== 'string') return '';
        const h = hash.startsWith('#') ? hash.slice(1) : hash;
        if (!h.startsWith('p=')) return '';
        return h.slice(2).trim();
    }

    stripPayloadPrefix(payload) {
        if (!payload.startsWith(SHARE_VERSION_PREFIX)) return null;
        return payload.slice(SHARE_VERSION_PREFIX.length);
    }

    buildShareUrlPrefix(loc = location) {
        const url = new URL(loc.href);
        url.hash = '';
        url.searchParams.delete(this.shortQueryKey);
        const bareSearch = String(loc.search || '').slice(1);
        if (bareSearch && !bareSearch.includes('=')) url.search = '';
        return `${url.origin}${url.pathname}${url.search || ''}#p=`;
    }

    buildShortUrl(slug, loc = location) {
        const clean = ShareCodec.slugify(slug);
        if (!clean) return '';
        const url = new URL(loc.href);
        url.search = '';
        url.hash = '';
        url.searchParams.set(this.shortQueryKey, clean);
        return url.toString();
    }

    parseShortSlugFromLocation(loc = location) {
        const search = String(loc?.search || '');
        if (!search || search === '?') return '';
        const params = new URLSearchParams(search);
        const named = params.get(this.shortQueryKey);
        if (named) return ShareCodec.slugify(named);
        const bare = search.slice(1).trim();
        if (!bare || bare.includes('=')) return '';
        return ShareCodec.slugify(decodeURIComponent(bare));
    }

    static slugify(name) {
        return String(name || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/gu, '')
            .replace(/['’`]/gu, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '-')
            .replace(/^-+|-+$/gu, '');
    }

    /* -------------------------------- internals -------------------------------- */

    _prepare(blob, options) {
        const { dropOptionalCaches = false, dropHeavy = false, quantizeFloats = false } = options;
        const out = JSON.parse(JSON.stringify(blob));
        for (const k of this.stripKeys) delete out[k];
        if (dropOptionalCaches) for (const k of this.optionalCacheKeys) delete out[k];
        if (dropHeavy) for (const k of this.heavyKeys) delete out[k];
        if (quantizeFloats) {
            const f = Math.pow(10, this.decimals);
            for (const k of this.quantizableFloatKeys) {
                if (typeof out[k] === 'number' && Number.isFinite(out[k])) {
                    out[k] = Math.round(out[k] * f) / f;
                }
            }
        }
        for (const k of this.extraKeys) {
            if (out[k] !== undefined && isEmpty(out[k])) delete out[k];
        }
        return out;
    }

    _buildDiff(blob) {
        const diff = {};
        const label = blob[this.labelKey];
        if (typeof label === 'string' && label.trim() !== '') {
            diff[this.labelKey] = label.trim();
        }
        const pristineKeys = new Set(Object.keys(this.pristineDefaults));
        for (const key of Object.keys(blob)) {
            if (this.stripKeys.has(key) || key === this.labelKey) continue;
            const val = blob[key];
            if (pristineKeys.has(key)) {
                if (!valuesEqual(val, this.pristineDefaults[key])) diff[key] = val;
                continue;
            }
            if (this.extraKeys.includes(key)) {
                if (!isEmpty(val)) diff[key] = JSON.parse(JSON.stringify(val));
                continue;
            }
            diff[key] = JSON.parse(JSON.stringify(val));
        }
        return diff;
    }
}

/* ------------------------------- shared helpers ------------------------------- */

function valuesEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
}

function isEmpty(val) {
    if (val == null) return true;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === 'object') return Object.keys(val).length === 0;
    return false;
}

async function deflateRawUtf8(jsonString) {
    const bytes = new TextEncoder().encode(jsonString);
    if (typeof CompressionStream === 'undefined') {
        throw new Error('CompressionStream is not available in this browser');
    }
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(bytes);
    writer.close();
    return collectStream(cs.readable);
}

async function inflateRawToUtf8(compressedBytes) {
    const cs = new DecompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(compressedBytes);
    writer.close();
    const merged = await collectStream(cs.readable);
    return new TextDecoder().decode(merged);
}

async function collectStream(readable) {
    const out = [];
    const reader = readable.getReader();
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) out.push(value);
    }
    const len = out.reduce((n, x) => n + x.length, 0);
    const merged = new Uint8Array(len);
    let o = 0;
    for (const chunk of out) { merged.set(chunk, o); o += chunk.length; }
    return merged;
}

function bytesToBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlToBytes(str) {
    const padLen = (4 - (str.length % 4)) % 4;
    const padded = str.replace(/-/gu, '+').replace(/_/gu, '/') + '='.repeat(padLen);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}
