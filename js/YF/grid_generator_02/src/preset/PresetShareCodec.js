import { buildMarkingGroup } from '../markings/MarkingGroup.js';
import { ShareCodec } from '../framework/FrameworkAdapter.js';
import { PresetFormatAdapter } from './PresetFormatAdapter.js';

export const MAX_SHARE_CHARS = 64000;
const graphics = doc => [...(doc.graphics?.blocks || []), ...['icons', 'claim', 'claim2026'].map(id => doc.graphics?.[id]).filter(Boolean)];

/** A lossless document envelope; binary assets stay out of the URL. */
export class PresetShareCodec {
    constructor({ catalog = new Map(), format = new PresetFormatAdapter() } = {}) {
        this.catalog = catalog;
        this.format = format;
        this.codec = new ShareCodec({ pristineDefaults: {}, stripKeys: [] });
        this.byContent = new Map([...catalog].map(([id, svg]) => [svg, id]));
    }

    prepare(source, { outlineFonts = false } = {}) {
        const document = this.format.organize(source);
        delete document.timestamp;
        const refs = {};
        graphics(document).forEach((block, index) => {
            if (block.markings) {
                block.svg = '';
                delete block.missingAsset;
                return;
            }
            const ref = this.byContent.get(block.svg);
            if (ref && !block.raster) refs[index] = ref;
            else block.missingAsset = true;
            block.svg = '';
            if (block.raster) block.raster.dataUrl = '';
        });
        return { tool: 'packaging-editor-02', shareVersion: 1, catalogVersion: 1, document, refs, outlineFonts };
    }

    async encode(source, options) { return this.codec.encode(this.prepare(source, options)); }

    async decode(payload) {
        if (payload.length > MAX_SHARE_CHARS) throw new Error('This link is too large. Open a JSON project instead.');
        const decoded = await this.codec.decode(payload);
        const envelope = decoded?.full;
        if (envelope?.tool !== 'packaging-editor-02' || envelope.shareVersion !== 1 || envelope.catalogVersion !== 1) {
            throw new Error('This is not a supported packaging preset link.');
        }
        const doc = envelope.document;
        // Validate before catalog expansion or applying any state.
        this.format.normalize(doc);
        let missing = 0;
        graphics(doc).forEach((block, index) => {
            if (block.markings) {
                block.svg = buildMarkingGroup(block.markings).svgContent;
                delete block.missingAsset;
                return;
            }
            const ref = envelope.refs?.[index];
            if (ref) {
                if (!this.catalog.has(ref)) throw new Error('This link refers to unavailable built-in artwork.');
                block.svg = this.catalog.get(ref);
                delete block.missingAsset;
            } else {
                block.svg = '';
                if (block.raster) block.raster.dataUrl = '';
                block.missingAsset = true;
                missing++;
            }
        });
        return { data: this.format.normalize(doc), name: doc.presetName, missing, outlineFonts: envelope.outlineFonts === true };
    }
}
