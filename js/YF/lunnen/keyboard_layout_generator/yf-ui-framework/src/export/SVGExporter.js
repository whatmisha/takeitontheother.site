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
     * @param {boolean} [options.convertTextToOutlines] — default true (text -> path);
     *        when false, rely on PDF font embedding (requires svg2pdf to handle it).
     * @param {string} [options.unit] — 'mm', 'pt', 'in', 'px' (default 'mm')
     * @param {Object} [options.format] — { width, height } (legacy, kept for BC)
     * @param {number} [options.pageWidth]  — page size in `unit` (preferred)
     * @param {number} [options.pageHeight] — page size in `unit` (preferred)
     * @param {number} [options.renderWidth]  — SVG render size on page; defaults to SVG own width
     * @param {number} [options.renderHeight] — SVG render size on page; defaults to SVG own height
     * @param {number} [options.xOffset] — explicit x offset on the page
     * @param {number} [options.yOffset] — explicit y offset on the page
     * @param {boolean} [options.center] — center renderSize on the page (used if xOffset/yOffset unset)
     */
    async exportToPDF(svgElement, filename = 'export.pdf', options = {}) {
        await this.loadPDFLibraries();

        const clonedSvg = svgElement.cloneNode(true);
        this.normalizeSvgForExport(clonedSvg);

        if (options.removeInteractive !== false) {
            this.removeInteractiveElements(clonedSvg);
        }

        const doOutline = options.convertTextToOutlines !== false;
        if (doOutline && this.textToPath) {
            try {
                await this.textToPath.convertAllTextToPaths(clonedSvg);
            } catch (error) {
                console.error('Failed to convert text to paths:', error);
            }
        }

        const svgWidth  = parseFloat(clonedSvg.getAttribute('width'))  || parseFloat(clonedSvg.viewBox?.baseVal?.width)  || 500;
        const svgHeight = parseFloat(clonedSvg.getAttribute('height')) || parseFloat(clonedSvg.viewBox?.baseVal?.height) || 500;

        const unit = options.unit || 'mm';

        // Resolve page size (preferred: explicit pageWidth/pageHeight; fallback: legacy `format`; else the SVG size)
        const pageWidth  = options.pageWidth  ?? options.format?.width  ?? svgWidth;
        const pageHeight = options.pageHeight ?? options.format?.height ?? svgHeight;

        // Render size = how big the SVG is drawn on the page (default: SVG own mm)
        const renderWidth  = options.renderWidth  ?? svgWidth;
        const renderHeight = options.renderHeight ?? svgHeight;

        const xOffset = options.xOffset ?? (options.center ? (pageWidth  - renderWidth)  / 2 : 0);
        const yOffset = options.yOffset ?? (options.center ? (pageHeight - renderHeight) / 2 : 0);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit,
            format: [pageWidth, pageHeight]
        });

        const svg2pdf = window.svg2pdf?.svg2pdf || window.svg2pdf;
        if (!svg2pdf) {
            throw new Error('svg2pdf not found');
        }

        await svg2pdf(clonedSvg, pdf, {
            xOffset, yOffset,
            width:  renderWidth,
            height: renderHeight
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

    /**
     * Сбрасывает viewBox и размеры корня SVG к логическому артборду.
     * ZoomPanManager меняет viewBox при зуме/пане — в файле экспорта должен быть полный документ,
     * без «окна» и без процентных размеров от превью.
     *
     * Ожидаются числовые атрибуты width/height на корневом <svg> (задаётся в update()).
     * Иначе — fallback из data-export-width / data-export-height или 500×500.
     *
     * @param {SVGSVGElement} svg — клон или живой элемент
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

        // If data-export-unit is provided (e.g. "mm", "in", "pt"), preserve it on
        // width/height so the exported SVG opens at real size in vector editors.
        // Otherwise fall back to unitless (user units / pixels).
        const unit = svg.getAttribute('data-export-unit') || '';

        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('width',  unit ? `${w}${unit}` : String(w));
        svg.setAttribute('height', unit ? `${h}${unit}` : String(h));
        svg.removeAttribute('x');
        svg.removeAttribute('y');
        svg.removeAttribute('data-export-width');
        svg.removeAttribute('data-export-height');
        svg.removeAttribute('data-export-unit');
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
