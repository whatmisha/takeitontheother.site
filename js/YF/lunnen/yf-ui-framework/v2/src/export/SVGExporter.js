/**
 * SVGExporter — экспорт SVG в файл (SVG, PDF) и экспорт/импорт настроек в JSON
 * 
 * @param {Object} options
 * @param {Object} [options.textToPath] — экземпляр TextToPath для конвертации текста в кривые
 */
export class SVGExporter {
    constructor(options = {}) {
        this.textToPath = options.textToPath || null;
        this.pdfLibsLoaded = false;
    }

    /**
     * Экспортировать SVG в файл
     * @param {SVGElement} svgElement
     * @param {string} filename
     * @param {Object} options
     * @param {boolean} [options.removeInteractive] — удалить интерактивные элементы
     * @param {boolean} [options.convertTextToOutlines] — конвертировать текст в кривые
     */
    async exportToFile(svgElement, filename = 'export.svg', options = {}) {
        const clonedSvg = svgElement.cloneNode(true);

        if (options.removeInteractive) {
            this.removeInteractiveElements(clonedSvg);
        }

        if (options.convertTextToOutlines && this.textToPath) {
            try {
                await this.textToPath.convertAllTextToPaths(clonedSvg);
            } catch (error) {
                console.error('Error converting text to paths:', error);
            }
        }

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(clonedSvg);
        this._downloadBlob(svgString, filename, 'image/svg+xml;charset=utf-8');
    }

    /**
     * Загрузить библиотеки для PDF (jsPDF + svg2pdf)
     */
    async loadPDFLibraries() {
        if (this.pdfLibsLoaded) return;

        return new Promise((resolve, reject) => {
            if (window.jspdf) {
                this.pdfLibsLoaded = true;
                resolve();
                return;
            }

            const jsPDFScript = document.createElement('script');
            jsPDFScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            jsPDFScript.onload = () => {
                const svg2pdfScript = document.createElement('script');
                svg2pdfScript.src = 'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js';
                svg2pdfScript.onload = () => {
                    this.pdfLibsLoaded = true;
                    resolve();
                };
                svg2pdfScript.onerror = () => reject(new Error('Failed to load svg2pdf.js'));
                document.head.appendChild(svg2pdfScript);
            };
            jsPDFScript.onerror = () => reject(new Error('Failed to load jsPDF'));
            document.head.appendChild(jsPDFScript);
        });
    }

    /**
     * Экспортировать SVG в PDF
     * @param {SVGElement} svgElement
     * @param {string} filename
     * @param {Object} options
     * @param {boolean} [options.removeInteractive]
     * @param {string} [options.unit] — 'mm', 'pt', 'in', 'px'
     * @param {Object} [options.format] — { width, height }
     */
    async exportToPDF(svgElement, filename = 'export.pdf', options = {}) {
        await this.loadPDFLibraries();

        const clonedSvg = svgElement.cloneNode(true);

        if (options.removeInteractive !== false) {
            this.removeInteractiveElements(clonedSvg);
        }

        if (this.textToPath) {
            try {
                await this.textToPath.convertAllTextToPaths(clonedSvg);
            } catch (error) {
                throw new Error('Failed to convert text to paths: ' + error.message);
            }
        }

        const svgWidth = parseFloat(clonedSvg.getAttribute('width')) || parseFloat(clonedSvg.viewBox?.baseVal?.width) || 500;
        const svgHeight = parseFloat(clonedSvg.getAttribute('height')) || parseFloat(clonedSvg.viewBox?.baseVal?.height) || 500;

        const unit = options.unit || 'mm';
        const pageWidth = options.format?.width || svgWidth;
        const pageHeight = options.format?.height || svgHeight;

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit,
            format: options.format ? [pageWidth, pageHeight] : undefined
        });

        if (!options.format) {
            pdf.internal.pageSize.setWidth(pageWidth);
            pdf.internal.pageSize.setHeight(pageHeight);
        }

        const svg2pdf = window.svg2pdf?.svg2pdf || window.svg2pdf;
        if (!svg2pdf) {
            throw new Error('svg2pdf not found');
        }

        await svg2pdf(clonedSvg, pdf, {
            xOffset: 0, yOffset: 0,
            width: pageWidth, height: pageHeight
        });

        pdf.save(filename);
    }

    /**
     * Экспортировать произвольные данные в JSON
     * @param {Object} data
     * @param {string} filename
     */
    exportJSON(data, filename = 'settings.json') {
        const jsonString = JSON.stringify(data, null, 2);
        this._downloadBlob(jsonString, filename, 'application/json;charset=utf-8');
    }

    /**
     * Импортировать JSON из файла
     * @param {File} file
     * @returns {Promise<Object>}
     */
    async importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    resolve(JSON.parse(e.target.result));
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    removeInteractiveElements(svg) {
        const selectors = [
            '.resize-handle', '.hover-overlay',
            '[data-interactive="true"]',
            '[class*="handle"]', '[class*="hover"]'
        ];
        selectors.forEach(sel => {
            svg.querySelectorAll(sel).forEach(el => el.remove());
        });
        svg.querySelectorAll('*').forEach(el => {
            ['onclick', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup'].forEach(attr => {
                el.removeAttribute(attr);
            });
        });
    }

    getCleanSVG(svgElement) {
        const cloned = svgElement.cloneNode(true);
        this.removeInteractiveElements(cloned);
        return cloned;
    }

    /** @private */
    _downloadBlob(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}
