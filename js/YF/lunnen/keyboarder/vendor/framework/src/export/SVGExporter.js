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
        this.pdfLibPaths = {
            jsPDF: 'vendor/lib/jspdf.umd.min.js',
            svg2pdf: 'vendor/lib/svg2pdf.umd.min.js',
            ...options.pdfLibPaths
        };
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
        const hasJsPDF = () => !!window.jspdf?.jsPDF;
        const hasSvg2pdf = () => !!(window.svg2pdf?.svg2pdf || window.svg2pdf);
        if (this.pdfLibsLoaded && hasJsPDF() && hasSvg2pdf()) return;

        await this._loadExportLib(this.pdfLibPaths.jsPDF, hasJsPDF, 'jsPDF');
        await this._loadExportLib(this.pdfLibPaths.svg2pdf, hasSvg2pdf, 'svg2pdf.js');
        this.pdfLibsLoaded = true;
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

    async _loadExportLib(src, isReady, label) {
        if (isReady()) return;
        const url = new URL(src, document.baseURI).href;
        try {
            await import(url);
            if (isReady()) return;
        } catch (_) {
            // Some third-party bundles are classic scripts only; fall back below.
        }
        await this._loadScriptOnce(url, isReady, label);
    }

    _loadScriptOnce(src, isReady, label) {
        if (isReady()) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-export-lib="${label}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error(`Failed to load ${label}`)), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.dataset.exportLib = label;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${label}`));
            document.head.appendChild(script);
        }).then(() => {
            if (!isReady()) throw new Error(`${label} loaded but did not expose its API`);
        });
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
