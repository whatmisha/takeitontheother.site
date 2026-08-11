/** Owns lazy PDF dependencies and SVG-to-PDF conversion. */
export class PDFExporter {
    constructor({
        textToPath,
        cleanSvg,
        documentRef = globalThis.document,
        windowRef = globalThis.window
    }) {
        this.textToPath = textToPath;
        this.cleanSvg = cleanSvg;
        this.document = documentRef;
        this.window = windowRef;
        this.libsLoaded = false;
    }

    async loadLibraries() {
        if (this.libsLoaded) return;
        if (!this.window.jspdf?.jsPDF) {
            await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jsPDF');
        }
        if (!this.getSvg2PdfConverter()) {
            await this.loadScript('https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js', 'svg2pdf.js');
        }
        if (!this.window.jspdf?.jsPDF || !this.getSvg2PdfConverter()) {
            throw new Error('Не удалось инициализировать библиотеки PDF-экспорта');
        }
        this.libsLoaded = true;
    }

    getSvg2PdfConverter() {
        return this.window.svg2pdf?.svg2pdf || this.window.svg2pdf;
    }

    loadScript(src, name) {
        return new Promise((resolve, reject) => {
            const script = this.document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Не удалось загрузить ${name}`));
            this.document.head.appendChild(script);
        });
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
        const { jsPDF } = this.window.jspdf;
        const pdf = new jsPDF({
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit: options.unit || 'mm',
            format: options.format ? [pageWidth, pageHeight] : undefined
        });
        if (!options.format) {
            pdf.internal.pageSize.setWidth(pageWidth);
            pdf.internal.pageSize.setHeight(pageHeight);
        }
        const converter = this.getSvg2PdfConverter();
        if (!converter) throw new Error('Ошибка при экспорте PDF: svg2pdf не найден');
        try {
            await converter(svg, pdf, { xOffset: 0, yOffset: 0, width: pageWidth, height: pageHeight });
            pdf.save(filename);
        } catch (error) {
            throw new Error(`Ошибка при экспорте PDF: ${error.message}`);
        }
    }
}
