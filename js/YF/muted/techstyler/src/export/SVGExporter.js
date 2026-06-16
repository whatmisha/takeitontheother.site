/**
 * SVGExporter — export SVG files (SVG, PDF) and import/export settings as JSON
 * 
 * @param {Object} options
 * @param {Object} [options.textToPath] — TextToPath instance for converting text to outlines
 */
export class SVGExporter {
    constructor(options = {}) {
        this.textToPath = options.textToPath || null;
        this.pdfLibsLoaded = false;
    }

    /**
     * Export SVG to a file
     * @param {SVGElement} svgElement
     * @param {string} filename
     * @param {Object} options
     * @param {boolean} [options.removeInteractive] — remove interactive elements
     * @param {boolean} [options.convertTextToOutlines] — convert text to outlines
     */
    async exportToFile(svgElement, filename = 'export.svg', options = {}) {
        const clonedSvg = svgElement.cloneNode(true);
        this.normalizeSvgForExport(clonedSvg);

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
     * Load PDF libraries (jsPDF + svg2pdf)
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
     * Export SVG to PDF
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
        this.normalizeSvgForExport(clonedSvg);

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
     * Export arbitrary data as JSON
     * @param {Object} data
     * @param {string} filename
     */
    exportJSON(data, filename = 'settings.json') {
        const jsonString = JSON.stringify(data, null, 2);
        this._downloadBlob(jsonString, filename, 'application/json;charset=utf-8');
    }

    /**
     * Import JSON from a file
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

    /**
     * Reset the root SVG viewBox and dimensions to the logical artboard.
     * ZoomPanManager changes the viewBox during zoom/pan; the export file needs
     * the full document, without the preview "window" or percentage dimensions.
     *
     * Numeric width/height attributes are expected on the root <svg> (set in update()).
     * Otherwise, fall back to data-export-width / data-export-height or 500×500.
     *
     * @param {SVGSVGElement} svg — cloned or live element
     */
    normalizeSvgForExport(svg) {
        let w = parseFloat(svg.getAttribute('width'));
        let h = parseFloat(svg.getAttribute('height'));
        if (!w || !h) {
            const dw = svg.getAttribute('data-export-width');
            const dh = svg.getAttribute('data-export-height');
            w = parseFloat(dw) || 0;
            h = parseFloat(dh) || 0;
        }
        if (!w || !h) {
            console.warn('SVGExporter: missing width/height on <svg> for export; using 500×500. Set width/height in render.');
            w = 500;
            h = 500;
        }
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('width', String(w));
        svg.setAttribute('height', String(h));
        svg.removeAttribute('x');
        svg.removeAttribute('y');
        svg.style.width = '';
        svg.style.height = '';
        svg.style.transform = '';
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
        this.normalizeSvgForExport(cloned);
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
