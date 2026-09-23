import { ExportDocumentBuilder } from '../svg/ExportDocumentBuilder.js';

const FONT_FILES = [
    ['TT Commons Classic', '400', 'TT_Commons_Classic_Regular.woff2'],
    ['TT Commons Classic', '500', 'TT_Commons_Classic_Medium.woff2'],
    ['Lunnen Display', '100 400', 'LunnenDisplay-VariableVF.woff2']
];

/** Detached artwork only: no guides, selection handles, or changes to export state. */
export class PreviewArtworkBuilder {
    constructor(host) {
        this.host = host;
        this.documentBuilder = new ExportDocumentBuilder(host);
        this.fontsPromise = null;
    }

    async fonts() {
        if (!this.fontsPromise) {
            this.fontsPromise = Promise.all(FONT_FILES.map(async ([family, weight, file]) => {
                const response = await fetch(`fonts/${file}`);
                if (!response.ok) throw new Error(`Cannot load preview font: ${file}`);
                const bytes = new Uint8Array(await response.arrayBuffer());
                let binary = '';
                for (const byte of bytes) binary += String.fromCharCode(byte);
                return `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(data:font/woff2;base64,${btoa(binary)}) format('woff2'); }`;
            })).then(rules => rules.join('\n')).catch(error => {
                this.fontsPromise = null;
                throw error;
            });
        }
        return this.fontsPromise;
    }

    async build() {
        const host = this.host;
        const { frontWidth, frontHeight, thickness, boxColor } = host.settingsModule.getAll();
        const width = frontWidth + 2 * thickness, height = frontHeight + 2 * thickness;
        const svg = this.documentBuilder.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${width} ${height}`
        });
        // Full atlas background avoids transparent seams at adjoining UV edges.
        this.documentBuilder.createElement('rect', { width, height, fill: boxColor }, svg);
        const defs = this.documentBuilder.createElement('defs', {}, svg);
        const clip = this.documentBuilder.createElement('clipPath', { id: 'preview-front-clip' }, defs);
        this.documentBuilder.createElement('rect', { x: thickness, y: thickness, width: frontWidth, height: frontHeight }, clip);
        const front = this.documentBuilder.createElement('g', { 'clip-path': 'url(#preview-front-clip)' }, svg);
        this.documentBuilder.drawFrontObjects(front, thickness, thickness, frontWidth, frontHeight, 1);
        const layout = { x: 0, y: 0, frontWidth, frontHeight, thickness };
        for (const surface of ['left', 'right', 'top', 'bottom']) {
            const { layer, geometry } = host.surfaceRenderer.createLayer(svg, surface, layout, 'preview');
            host.surfaceRenderer.drawObjects(layer, surface, geometry, 1, true);
        }
        svg.querySelectorAll('[id^="hover-area-"], [id^="bounds-"], [id^="resize-handle-"]').forEach(node => node.remove());
        const style = this.documentBuilder.createElement('style', {}, svg);
        style.textContent = await this.fonts();
        const scale = 2048 / Math.max(width, height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        svg.setAttribute('width', canvas.width);
        svg.setAttribute('height', canvas.height);
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
        try {
            const image = new Image();
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => reject(new Error('Could not render the artwork preview.'));
                image.src = url;
            });
            canvas.getContext('2d').drawImage(image, 0, 0);
            return canvas;
        } finally { URL.revokeObjectURL(url); }
    }
}
