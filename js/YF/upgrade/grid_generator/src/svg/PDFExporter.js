import { loadPdfRuntime } from '../runtime/BrowserRuntimeLoader.js';

/** Owns lazy PDF dependencies and SVG-to-PDF conversion. */
export class PDFExporter {
    constructor({
        textToPath,
        cleanSvg,
        windowRef = globalThis.window,
        dependencyLoader = () => loadPdfRuntime({
            globalRef: windowRef || globalThis,
            documentRef: windowRef?.document || globalThis.document
        })
    }) {
        this.textToPath = textToPath;
        this.cleanSvg = cleanSvg;
        this.window = windowRef;
        this.dependencyLoader = dependencyLoader;
        this.jsPDF = null;
        this.svg2pdf = null;
        this.libsLoaded = false;
        this.loadingPromise = null;
    }

    async loadLibraries() {
        if (this.libsLoaded) return;
        this.jsPDF ||= this.window?.jspdf?.jsPDF || null;
        this.svg2pdf ||= this.window?.svg2pdf?.svg2pdf || this.window?.svg2pdf || null;
        if (!this.jsPDF || !this.svg2pdf) {
            this.loadingPromise ||= this.dependencyLoader()
                .then(({ jsPDF, svg2pdf }) => {
                    this.jsPDF ||= jsPDF;
                    this.svg2pdf ||= svg2pdf;
                })
                .catch(error => {
                    this.loadingPromise = null;
                    throw new Error(`Не удалось загрузить PDF-библиотеки: ${error.message}`);
                });
            await this.loadingPromise;
        }
        if (!this.jsPDF || !this.svg2pdf) {
            throw new Error('Не удалось инициализировать библиотеки PDF-экспорта');
        }
        this.libsLoaded = true;
    }

    async export(svgElement, filename = 'grid.pdf', options = {}) {
        if (!this.textToPath) {
            throw new Error('TextToPath не доступен. Конвертация текста в кривые обязательна для PDF экспорта.');
        }
        await this.loadLibraries();
        const svg = svgElement.cloneNode(true);
        if (options.removeInteractive !== false) this.cleanSvg(svg);
        try {
            await this.textToPath.convertAllTextToPaths(svg);
        } catch (error) {
            throw new Error(`Не удалось конвертировать текст в кривые. Убедитесь, что шрифты доступны. ${error.message}`);
        }

        const svgWidth = Number.parseFloat(svg.getAttribute('width')) || Number.parseFloat(svg.viewBox.baseVal.width);
        const svgHeight = Number.parseFloat(svg.getAttribute('height')) || Number.parseFloat(svg.viewBox.baseVal.height);
        const pageWidth = options.format?.width || svgWidth;
        const pageHeight = options.format?.height || svgHeight;
        const pdf = new this.jsPDF({
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit: options.unit || 'mm',
            format: options.format ? [pageWidth, pageHeight] : undefined
        });
        if (!options.format) {
            pdf.internal.pageSize.setWidth(pageWidth);
            pdf.internal.pageSize.setHeight(pageHeight);
        }
        try {
            await this.svg2pdf(svg, pdf, { xOffset: 0, yOffset: 0, width: pageWidth, height: pageHeight });
            pdf.save(filename);
        } catch (error) {
            throw new Error(`Ошибка при экспорте PDF: ${error.message}`);
        }
    }
}
