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
        this.pdfLibsPromise = null;
        this.pdfLibPaths = {
            jsPDF: new URL('../../vendor/jspdf/2.5.1/jspdf.umd.min.js', import.meta.url).href,
            svg2pdf: new URL('../../vendor/svg2pdf/2.2.3/svg2pdf.umd.min.js', import.meta.url).href,
            ...options.pdfLibPaths
        };
        this._objectUrls = new Set();
        this._revokeTimers = new Set();
        this._readers = new Set();
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
        this._throwIfAborted(options.signal);
        const clonedSvg = svgElement.cloneNode(true);
        this.normalizeSvgForExport(clonedSvg);

        if (options.removeInteractive) {
            this.removeInteractiveElements(clonedSvg);
        }

        if (options.convertTextToOutlines && this.textToPath) {
            try {
                await this.textToPath.convertAllTextToPaths(clonedSvg);
                this._throwIfAborted(options.signal);
            } catch (error) {
                console.error('Error converting text to paths:', error);
            }
        }

        const serializer = new XMLSerializer();
        const svgString = svgDocumentString(serializer.serializeToString(clonedSvg));
        this._downloadBlob(svgString, filename, 'image/svg+xml;charset=utf-8', options.signal);
    }

    /**
     * Загрузить библиотеки для PDF (jsPDF + svg2pdf)
     */
    async loadPDFLibraries() {
        const hasJsPDF = () => !!window.jspdf?.jsPDF;
        const hasSvg2pdf = () => !!(window.svg2pdf?.svg2pdf || window.svg2pdf);
        if (this.pdfLibsLoaded && hasJsPDF() && hasSvg2pdf()) return;
        if (this.pdfLibsPromise) return this.pdfLibsPromise;

        this.pdfLibsPromise = (async () => {
            await this._loadExportLib(this.pdfLibPaths.jsPDF, hasJsPDF, 'jsPDF');
            await this._loadExportLib(this.pdfLibPaths.svg2pdf, hasSvg2pdf, 'svg2pdf.js');
            this.pdfLibsLoaded = true;
        })();

        try {
            await this.pdfLibsPromise;
        } finally {
            this.pdfLibsPromise = null;
        }
    }

    /**
     * Экспортировать SVG в PDF
     * @param {SVGElement} svgElement
     * @param {string} filename
     * @param {Object} options
     * @param {boolean} [options.removeInteractive]
     * @param {boolean} [options.convertTextToOutlines=true]
     * @param {Array<{fileName:string,family:string,style?:string,weight?:number,data:ArrayBuffer|Uint8Array|string,preserveVariations?:boolean}>} [options.fonts]
     * @param {string} [options.unit] — 'mm', 'pt', 'in', 'px'
     * @param {Object} [options.format] — { width, height }
     */
    async exportToPDF(svgElement, filename = 'export.pdf', options = {}) {
        this._throwIfAborted(options.signal);
        await this.loadPDFLibraries();
        this._throwIfAborted(options.signal);

        const clonedSvg = svgElement.cloneNode(true);
        this.normalizeSvgForExport(clonedSvg);

        if (options.removeInteractive !== false) {
            this.removeInteractiveElements(clonedSvg);
        }

        if (options.convertTextToOutlines !== false && this.textToPath) {
            try {
                await this.textToPath.convertAllTextToPaths(clonedSvg);
                this._throwIfAborted(options.signal);
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
            format: options.format ? [pageWidth, pageHeight] : undefined,
            putOnlyUsedFonts: true
        });

        this._registerPDFFonts(pdf, options.fonts || []);

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

        this._throwIfAborted(options.signal);
        pdf.save(filename);
    }

    /**
     * Register optional fonts so svg2pdf can keep SVG text editable in the PDF.
     * Variable fonts may opt into preserving their complete OpenType program.
     */
    _registerPDFFonts(pdf, fonts = []) {
        for (const font of fonts) {
            if (!font?.data || !font.family) continue;
            const fileName = font.fileName || `${font.family}.ttf`;
            const style = font.style || 'normal';
            const weight = Number(font.weight) || 400;
            pdf.addFileToVFS(fileName, pdfFontDataBase64(font.data));
            pdf.addFont(fileName, font.family, style, weight);

            if (font.preserveVariations) {
                pdf.setFont(font.family, style, weight);
                const metadata = pdf.getFont()?.metadata;
                if (!metadata?.subset || !metadata?.rawData) {
                    throw new Error(`Could not preserve variable font data for ${font.family}.`);
                }
                const fullFontData = Array.from(metadata.rawData);
                metadata.subset.encode = () => fullFontData;
            }
        }
    }

    /**
     * Экспортировать произвольные данные в JSON
     * @param {Object} data
     * @param {string} filename
     */
    exportJSON(data, filename = 'settings.json', options = {}) {
        const jsonString = JSON.stringify(data, null, 2);
        this._downloadBlob(jsonString, filename, 'application/json;charset=utf-8', options.signal);
    }

    /**
     * Импортировать JSON из файла
     * @param {File} file
     * @returns {Promise<Object>}
     */
    async importJSON(file, { signal } = {}) {
        this._throwIfAborted(signal);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            this._readers.add(reader);
            const cleanup = () => {
                this._readers.delete(reader);
                signal?.removeEventListener?.('abort', onAbort);
            };
            const onAbort = () => {
                reader.abort?.();
                cleanup();
                reject(this._abortError());
            };
            reader.onload = (e) => {
                try {
                    this._throwIfAborted(signal);
                    resolve(JSON.parse(e.target.result));
                } catch (error) {
                    reject(error);
                } finally {
                    cleanup();
                }
            };
            reader.onerror = () => { cleanup(); reject(new Error('Failed to read file')); };
            reader.onabort = () => { cleanup(); reject(this._abortError()); };
            signal?.addEventListener('abort', onAbort, { once: true });
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
            '[data-export-exclude="true"]',
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
            // UMD/classic bundles are expected to fail module import in some browsers.
        }
        await this._loadScriptOnce(url, isReady, label);
    }

    _loadScriptOnce(src, isReady, label) {
        if (isReady()) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const selector = `script[data-export-lib="${label}"]`;
            const existing = document.querySelector(selector);
            if (existing) {
                if (existing.dataset.exportLibState === 'loaded') {
                    reject(new Error(`${label} loaded but did not expose its API`));
                    return;
                }
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', () => reject(new Error(`Failed to load ${label}`)), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.dataset.exportLib = label;
            script.onload = () => {
                script.dataset.exportLibState = 'loaded';
                resolve();
            };
            script.onerror = () => {
                script.dataset.exportLibState = 'error';
                reject(new Error(`Failed to load ${label}`));
            };
            document.head.appendChild(script);
        }).then(() => {
            if (!isReady()) throw new Error(`${label} loaded but did not expose its API`);
        });
    }

    /** @private */
    _downloadBlob(content, filename, mimeType, signal) {
        this._throwIfAborted(signal);
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        this._objectUrls.add(url);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        const timer = setTimeout(() => {
            this._revokeTimers.delete(timer);
            this._releaseObjectUrl(url);
        }, 100);
        this._revokeTimers.add(timer);
    }

    _releaseObjectUrl(url) {
        if (!this._objectUrls.delete(url)) return;
        URL.revokeObjectURL(url);
    }

    _abortError() {
        if (typeof DOMException === 'function') return new DOMException('Operation aborted', 'AbortError');
        const error = new Error('Operation aborted');
        error.name = 'AbortError';
        return error;
    }

    _throwIfAborted(signal) {
        if (signal?.aborted) throw this._abortError();
    }

    destroy() {
        for (const reader of this._readers) reader.abort?.();
        this._readers.clear();
        for (const timer of this._revokeTimers) clearTimeout(timer);
        this._revokeTimers.clear();
        for (const url of this._objectUrls) URL.revokeObjectURL(url);
        this._objectUrls.clear();
        this.pdfLibsPromise = null;
    }
}

/** Return a standalone, XML-declared SVG document with non-ASCII XML entities. */
export function svgDocumentString(serialized = '') {
    const asciiSafe = String(serialized).replace(/[^\x00-\x7F]/gu, (character) =>
        `&#x${character.codePointAt(0).toString(16).toUpperCase()};`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${asciiSafe}`;
}

function pdfFontDataBase64(data) {
    if (typeof data === 'string') return data;
    const bytes = data instanceof Uint8Array
        ? data
        : data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : ArrayBuffer.isView(data)
                ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
                : null;
    if (!bytes) throw new Error('Unsupported PDF font data.');
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}
