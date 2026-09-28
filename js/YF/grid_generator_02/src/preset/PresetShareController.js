import { PresetShareCodec, MAX_SHARE_CHARS } from './PresetShareCodec.js';
import { ListenerScope } from '../core/ListenerScope.js';

export class PresetShareController {
    constructor(host) {
        this.host = host;
        this.listeners = new ListenerScope();
        this.button = document.getElementById('presetToolbarShareBtn');
        this.status = document.getElementById('presetShareStatus');
        this.button.disabled = true;
        this.timer = null;
        this.listeners.listen(this.button, 'click', () => void this.copy());
    }

    async getCodec() {
        if (!this.codec) {
            const { SHARED_GRAPHICS_V1 } = await import('./SharedGraphicsV1.js');
            const catalog = new Map();
            for (const [id, source] of Object.entries(SHARED_GRAPHICS_V1)) {
                const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
                const fragment = svg?.localName === 'svg' ? svg.innerHTML : source;
                catalog.set(id, this.host.svgSanitizer.sanitizeFragment(fragment));
                // Existing presets contain both original and normalized paint/class variants.
                for (const className of ['claim-fill', 'icon-fill']) {
                    const normalized = this.host.graphicsAssetController.process(`<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`, className)?.content;
                    if (normalized) catalog.set(`${id}-${className}`, this.host.svgSanitizer.sanitizeFragment(normalized));
                }
            }
            this.codec = new PresetShareCodec({ catalog });
        }
        return this.codec;
    }

    async buildUrl() {
        const host = this.host;
        const codec = await this.getCodec();
        const source = { settings: host.settingsModule.getAll(), textBlocks: host.objectDocument.textBlocks,
            graphicsBlocks: host.objectDocument.graphicsBlocks, currentPresetName: host.currentPresetName };
        const payload = await codec.encode(source, { outlineFonts: Boolean(host.dom.convertToOutlinesCheckbox?.checked) });
        const base = new URL(location.href);
        base.search = ''; base.hash = '';
        const url = `${base.href}#p=${payload}`;
        if (url.length > MAX_SHARE_CHARS) throw new Error(`The complete link is ${url.length.toLocaleString()} characters (limit ${MAX_SHARE_CHARS.toLocaleString()}). Save a JSON project; no layout data has been removed.`);
        return url;
    }

    async copy() {
        if (this.button.disabled) return;
        this.button.disabled = true;
        try {
            const urlPromise = this.buildUrl();
            // Promise-backed ClipboardItem preserves user activation in Safari.
            const needsActivationPromise = /Safari/.test(navigator.userAgent) && !/(Chrome|Chromium|Edg|CriOS)/.test(navigator.userAgent);
            if (needsActivationPromise && globalThis.ClipboardItem && navigator.clipboard?.write) {
                await navigator.clipboard.write([new ClipboardItem({ 'text/plain': urlPromise.then(url => new Blob([url], { type: 'text/plain' })) })]);
            } else {
                await navigator.clipboard.writeText(await urlPromise);
            }
            const url = await urlPromise;
            const message = url.length > 3600 ? `Link copied (${url.length.toLocaleString()} characters). Some messengers may limit long links.` : 'Link copied!';
            this.button.title = message; this.status.textContent = message;
            clearTimeout(this.timer);
            this.timer = setTimeout(() => { this.button.title = 'Copy share link'; }, 5000);
        } catch (error) {
            this.host.errorPresenter.show(error, { title: 'Could not copy link' });
        } finally { this.button.disabled = false; }
    }

    async openFromLocation() {
        const payload = location.hash.startsWith('#p=') ? location.hash.slice(3) : '';
        if (!payload) return false;
        try {
            const shared = await (await this.getCodec()).decode(payload);
            this.host.isOpeningShare = true;
            await this.host.presetManager.addImportedPreset(shared.data, `Shared — ${shared.name || 'Custom'}`);
            if (this.host.dom.convertToOutlinesCheckbox) this.host.dom.convertToOutlinesCheckbox.checked = shared.outlineFonts;
            this.status.textContent = shared.missing ? `Shared layout opened. Relink ${shared.missing} image files through Objects.` : 'Shared layout opened.';
            return true;
        } catch (error) {
            this.host.errorPresenter.show(error, { title: 'Could not open shared preset' });
            return false;
        } finally { this.host.isOpeningShare = false; }
    }

    dispose() { clearTimeout(this.timer); this.listeners.dispose(); }
}
