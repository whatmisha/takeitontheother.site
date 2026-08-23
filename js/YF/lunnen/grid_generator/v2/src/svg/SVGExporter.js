import { BrowserFileTransfer } from './BrowserFileTransfer.js';
import { PDFExporter } from './PDFExporter.js';
import { PresetFileCodec } from './PresetFileCodec.js';

/** Coordinates SVG, PDF and JSON file export/import. */
export class SVGExporter {
    constructor(settings, textToPath = null, options = {}) {
        this.settings = settings;
        this.textToPath = textToPath;
        this.fileTransfer = options.fileTransfer || new BrowserFileTransfer(options);
        this.presetCodec = options.presetCodec || new PresetFileCodec(options);
        this.presetFormat = this.presetCodec.adapter;
        this.pdfExporter = options.pdfExporter || new PDFExporter({
            textToPath,
            cleanSvg: svg => this.removeInteractiveElements(svg),
            documentRef: options.documentRef,
            windowRef: options.windowRef
        });
    }

    async exportToFile(svgElement, filename = 'grid.svg', options = {}) {
        const svg = svgElement.cloneNode(true);
        if (options.removeInteractive) this.removeInteractiveElements(svg);
        if (options.convertTextToOutlines && this.textToPath) {
            try {
                await this.textToPath.convertAllTextToPaths(svg);
            } catch (error) {
                console.error('Error converting text to paths:', error);
            }
        }
        const content = this.serializeFile(svg);
        this.fileTransfer.download(content, filename, 'image/svg+xml;charset=utf-8', 100);
    }

    serializeFile(svg) {
        const serialized = new XMLSerializer()
            .serializeToString(svg)
            .replace(/^\uFEFF?\s*<\?xml[^?]*\?>\s*/i, '');
        return `\uFEFF<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
    }

    loadPDFLibraries() { return this.pdfExporter.loadLibraries(); }
    exportToPDF(svg, filename, options) { return this.pdfExporter.export(svg, filename, options); }

    removeInteractiveElements(svg) {
        [
            '.resize-handle', '.hover-overlay', '[data-interactive="true"]',
            '[class*="handle"]', '[class*="hover"]'
        ].forEach(selector => svg.querySelectorAll(selector).forEach(element => element.remove()));
        svg.querySelectorAll('*').forEach(element => {
            ['onclick', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup']
                .forEach(attribute => element.removeAttribute(attribute));
        });
    }

    getCleanSVG(svgElement) {
        const svg = svgElement.cloneNode(true);
        this.removeInteractiveElements(svg);
        return svg;
    }

    exportSettings(data, filename = 'grid-settings.json') {
        const content = this.beautifyJSON(this.organizeSettingsForExport(data));
        this.fileTransfer.download(content, filename, 'application/json;charset=utf-8');
    }

    organizeSettingsForExport(data) { return this.presetCodec.organize(data); }
    generatePresetName(settings, currentPresetName = 'Custom') {
        return this.presetCodec.generateName(settings, currentPresetName);
    }
    beautifyJSON(data) { return this.presetCodec.stringify(data); }

    async importSettings(file) {
        return this.normalizeImportedData(JSON.parse(await this.fileTransfer.readText(file)));
    }

    normalizeImportedData(data) { return this.presetCodec.normalize(data); }
}
