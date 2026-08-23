import { SvgAssetTemplateCache } from './SvgAssetTemplateCache.js';
import { CanvasRendererController } from '../grid/CanvasRendererController.js';

const STYLE_REFERENCES = Object.freeze([
    Object.freeze({ name: 'Headline', style: 'headline', size: 'headlineSize', lineHeight: 'lineHeight', fallbackSize: 1, fallbackLineHeight: 2 }),
    Object.freeze({ name: 'Text', style: 'text', size: 'textSize', lineHeight: 'textLineHeight', fallbackSize: 1, fallbackLineHeight: 2 }),
    Object.freeze({ name: 'Caption', style: 'caption', size: 'captionSize', lineHeight: 'captionLineHeight', fallbackSize: 0.5, fallbackLineHeight: 1 }),
    Object.freeze({ name: 'Lunnen Display', style: 'lunnenDisplay', size: 'lunnenDisplaySize', lineHeight: 'lunnenDisplayLineHeight', fallbackSize: 3, fallbackLineHeight: 4 })
]);

const DESIGN_KIT_ASSETS = Object.freeze([
    Object.freeze({ file: 'lunnen_logo.svg', name: 'Lunnen Logo' }),
    Object.freeze({ file: '1.svg', name: '1' }),
    Object.freeze({ file: '2.svg', name: '2' }),
    Object.freeze({ file: '3.svg', name: '3' }),
    Object.freeze({ file: 'icons.svg', name: 'Icons' }),
    Object.freeze({ file: 'l_sign.svg', name: 'L Sign' }),
    Object.freeze({ file: 'qr_lunnen.pro.svg', name: 'QR' }),
    Object.freeze({ file: 'yf_claim.svg', name: 'YF Claim' }),
    Object.freeze({ file: 'yf_claim_2026.svg', name: 'YF Claim 2026' })
]);

/** Builds Illustrator-friendly SVG documents independently from editor rendering. */
export class ExportDocumentBuilder {
    constructor(host, {
        fetchImpl = (...args) => globalThis.fetch(...args),
        parseSvg = source => new DOMParser().parseFromString(source, 'image/svg+xml'),
        assetCache = new SvgAssetTemplateCache(),
        now = () => globalThis.performance?.now?.() ?? Date.now()
    } = {}) {
        this.host = host;
        this.fetch = fetchImpl;
        this.parseSvg = parseSvg;
        this.assetCache = assetCache;
        this.now = now;
        this.metrics = { count: 0, totalMs: 0, lastMs: 0, maxMs: 0 };
    }

    createElement(type, attributes = {}, container = null) {
        return this.host.canvasRenderer.createSvgElement(type, attributes, container);
    }

    createGroup(container, id) {
        return this.createElement('g', { id }, container);
    }

    async build(includeReferenceElements = true) {
        const startedAt = this.now();
        try {
            return await this.buildDocument(includeReferenceElements);
        } finally {
            const duration = Math.max(0, this.now() - startedAt);
            this.metrics.count += 1;
            this.metrics.totalMs += duration;
            this.metrics.lastMs = duration;
            this.metrics.maxMs = Math.max(this.metrics.maxMs, duration);
        }
    }

    async buildDocument(includeReferenceElements = true) {
        const host = this.host;
        const { frontWidth, frontHeight, thickness } = host.settingsModule.getAll();
        const artboard = CanvasRendererController.calculateArtboard({
            frontWidth,
            frontHeight,
            thickness
        });
        const totalWidth = artboard.width;
        const totalHeight = artboard.height;
        const scale = 1;
        const svg = this.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: `${totalWidth}mm`,
            height: `${totalHeight}mm`,
            viewBox: `0 0 ${totalWidth} ${totalHeight}`
        });

        host.canvasRenderer.drawBoxSurfaces(
            this.createGroup(svg, 'box'),
            0,
            0,
            frontWidth,
            frontHeight,
            thickness,
            scale
        );

        const layout = { x: 0, y: 0, frontWidth, frontHeight, thickness, scale };
        host.surfaceRenderer.drawPlaneLayers(svg, layout, scale, { forExport: true });

        if (host.settingsModule.get('showLabels')) {
            host.canvasRenderer.drawLabels(
                this.createGroup(svg, 'labels'),
                0,
                0,
                frontWidth,
                frontHeight,
                thickness,
                scale
            );
        }

        if (includeReferenceElements) {
            this.addTextStylesSummary(svg, totalWidth, scale);
            await this.addDesignKitReference(svg, totalWidth, scale);
        }
        return svg;
    }

    getTextStylesInfo() {
        const host = this.host;
        const module = host.settingsModule.get('gridModule');
        const millimetersToPoints = 2.83465;
        return STYLE_REFERENCES.map(reference => {
            const size = host.settingsModule.get(reference.size) ?? reference.fallbackSize;
            const lineHeight = host.settingsModule.get(reference.lineHeight) ??
                reference.fallbackLineHeight;
            return {
                name: reference.name,
                fontSize: (
                    host.textStyleResolver.calculateFontSize(reference.style, size) *
                    millimetersToPoints
                ).toFixed(1),
                lineHeight: (lineHeight * module * millimetersToPoints).toFixed(1)
            };
        });
    }

    addTextStylesSummary(svg, artboardWidth, scale = 1) {
        const startX = artboardWidth + 20;
        const startY = 10;
        const gap = 5;
        const color = this.host.canvasRenderer.getContrastColor();
        const group = this.createElement('g', {
            id: 'text-styles-reference',
            opacity: '0.7'
        });
        const line = (content, x, y, fontSize = 3, fontWeight = 400) => {
            const element = this.createElement('text', {
                x: x * scale,
                y: y * scale,
                'font-family': 'TT Commons Classic, -apple-system, sans-serif',
                'font-size': fontSize * scale,
                'font-weight': fontWeight,
                fill: color
            }, group);
            element.textContent = content;
        };

        line('Text Styles', startX, startY, 4, 500);
        let y = startY + gap * 1.5;
        this.getTextStylesInfo().forEach(style => {
            line(`${style.name}  ${style.fontSize}/${style.lineHeight} pt`, startX, y);
            y += gap;
        });
        svg.appendChild(group);
    }

    async addDesignKitReference(svg, artboardWidth, scale = 1) {
        try {
            const module = this.host.settingsModule.get('gridModule');
            const startX = artboardWidth + 20;
            const verticalGap = 3;
            const sectionGap = 10;
            const sizes = [6, 5, 4, 3, 2, 1];
            const color = this.host.canvasRenderer.getContrastColor();
            const group = this.createElement('g', {
                id: 'design-kit-reference',
                opacity: '0.7'
            });
            let currentY = 40;

            for (const asset of DESIGN_KIT_ASSETS) {
                const source = await this.loadSvgAsset(asset.file);
                if (!source) continue;
                const { element, width, height } = source;
                const aspectRatio = width / height;

                const title = this.createElement('text', {
                    x: startX * scale,
                    y: currentY * scale,
                    'font-family': 'TT Commons Classic, -apple-system, sans-serif',
                    'font-size': 4 * scale,
                    'font-weight': 500,
                    fill: color,
                    'dominant-baseline': 'hanging'
                }, group);
                title.textContent = asset.name;
                currentY += 6;

                sizes.forEach(heightInModules => {
                    const heightInMm = module * heightInModules;
                    const widthInMm = heightInMm * aspectRatio;
                    const instance = this.createElement('g', {
                        transform: `translate(${startX * scale}, ${currentY * scale}) ` +
                            `scale(${(heightInMm / height) * scale})`
                    }, group);
                    Array.from(element.children).forEach(child => {
                        instance.appendChild(child.cloneNode(true));
                    });

                    const label = this.createElement('text', {
                        x: (startX + widthInMm + 5) * scale,
                        y: (currentY + heightInMm / 2) * scale,
                        'font-family': 'TT Commons Classic, -apple-system, sans-serif',
                        'font-size': 3 * scale,
                        'font-weight': 400,
                        fill: color,
                        'dominant-baseline': 'middle'
                    }, group);
                    label.textContent = `${heightInModules} mod`;
                    currentY += heightInMm + verticalGap;
                });
                currentY += sectionGap;
            }
            svg.appendChild(group);
        } catch (error) {
            console.error('Error adding design kit reference:', error);
        }
    }

    async loadSvgAsset(filename) {
        return this.assetCache.load(filename, async () => {
            const response = await this.fetch(`graphics/${filename}`, { cache: 'force-cache' });
            if (!response.ok) {
                console.warn(`Failed to load ${filename}`);
                return null;
            }
            const document = this.parseSvg(await response.text());
            const element = document.querySelector('svg');
            const viewBox = element?.getAttribute('viewBox')
                ?.trim()
                .split(/[ ,]+/)
                .map(Number);
            if (!element || viewBox?.length !== 4 || !viewBox.every(Number.isFinite)) {
                console.warn(`Invalid SVG structure for ${filename}`);
                return null;
            }
            return { element, width: viewBox[2], height: viewBox[3] };
        });
    }

    getPerformanceMetrics() {
        const { count, totalMs, lastMs, maxMs } = this.metrics;
        return Object.freeze({
            count,
            totalMs,
            lastMs,
            maxMs,
            averageMs: count ? totalMs / count : 0,
            assets: this.assetCache.getMetrics()
        });
    }
}

export { DESIGN_KIT_ASSETS, STYLE_REFERENCES };
