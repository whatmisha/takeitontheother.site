/**
 * Экспорт SVG в PDF
 */
export class PDFExporter {
    constructor(settings, textToPath = null) {
        this.settings = settings;
        this.textToPath = textToPath;
    }

    /**
     * Экспортировать SVG элемент в PDF файл
     * @param {SVGElement} svgElement - SVG элемент для экспорта
     * @param {string} filename - Имя файла
     * @param {Object} options - Опции экспорта
     * @param {boolean} options.removeInteractive - Удалить интерактивные элементы
     * @param {boolean} options.convertTextToOutlines - Конвертировать текст в кривые
     * @param {string} options.format - Формат страницы: 'a4', 'letter', или размеры в мм [width, height]
     */
    async exportToFile(svgElement, filename = 'grid.pdf', options = {}) {
        // Проверяем наличие библиотек (проверяем разные варианты имен)
        const jsPDF = window.jsPDF || window.jspdf?.jsPDF || (typeof jspdf !== 'undefined' ? jspdf.jsPDF : null);
        const svg2pdf = window.svg2pdf || window.svg2pdfjs?.svg2pdf || (typeof svg2pdfjs !== 'undefined' ? svg2pdfjs.svg2pdf : null);
        
        if (!jsPDF) {
            throw new Error('jsPDF library is not loaded. Please include jsPDF from CDN.');
        }
        if (!svg2pdf) {
            throw new Error('svg2pdf library is not loaded. Please include svg2pdf from CDN.');
        }

        // Клонируем SVG для экспорта
        const clonedSvg = svgElement.cloneNode(true);
        
        // Удаляем интерактивные элементы если нужно
        if (options.removeInteractive) {
            this.removeInteractiveElements(clonedSvg);
        }
        
        // Конвертируем текст в кривые если нужно
        if (options.convertTextToOutlines && this.textToPath) {
            try {
                await this.textToPath.convertAllTextToPaths(clonedSvg);
            } catch (error) {
                console.error('Error converting text to paths:', error);
                // Продолжаем экспорт даже если конвертация не удалась
            }
        }

        // Получаем размеры SVG
        const svgWidth = parseFloat(clonedSvg.getAttribute('width')) || parseFloat(clonedSvg.viewBox.baseVal.width);
        const svgHeight = parseFloat(clonedSvg.getAttribute('height')) || parseFloat(clonedSvg.viewBox.baseVal.height);
        
        // Определяем формат страницы
        let pageWidth, pageHeight;
        const format = options.format || 'a4';
        
        if (format === 'a4') {
            pageWidth = 210; // A4 width in mm
            pageHeight = 297; // A4 height in mm
        } else if (format === 'letter') {
            pageWidth = 215.9; // Letter width in mm
            pageHeight = 279.4; // Letter height in mm
        } else if (Array.isArray(format) && format.length === 2) {
            pageWidth = format[0];
            pageHeight = format[1];
        } else {
            // Используем размеры SVG
            pageWidth = svgWidth;
            pageHeight = svgHeight;
        }

        // Создаем PDF документ
        const pdf = new jsPDF({
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pageWidth, pageHeight]
        });

        // Конвертируем SVG в PDF
        try {
            await svg2pdf(clonedSvg, pdf, {
                xOffset: 0,
                yOffset: 0,
                width: svgWidth,
                height: svgHeight
            });
        } catch (error) {
            console.error('Error converting SVG to PDF:', error);
            throw new Error('Failed to convert SVG to PDF: ' + error.message);
        }

        // Сохраняем PDF
        pdf.save(filename);
    }

    /**
     * Удалить интерактивные элементы из SVG
     * @param {SVGElement} svg
     */
    removeInteractiveElements(svg) {
        // Удаляем элементы с классами интерактивности
        const interactiveSelectors = [
            '.resize-handle',
            '.hover-overlay',
            '[data-interactive="true"]',
            '[class*="handle"]',
            '[class*="hover"]'
        ];
        
        interactiveSelectors.forEach(selector => {
            const elements = svg.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });
        
        // Удаляем обработчики событий из атрибутов
        const allElements = svg.querySelectorAll('*');
        allElements.forEach(el => {
            ['onclick', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup'].forEach(attr => {
                el.removeAttribute(attr);
            });
        });
    }

    /**
     * Экспортировать все стикеры из таблицы в один PDF файл
     * @param {Array<SVGElement>} svgElements - Массив SVG элементов
     * @param {string} filename - Имя файла
     * @param {Object} options - Опции экспорта
     */
    async exportMultipleToFile(svgElements, filename = 'labels.pdf', options = {}) {
        const jsPDF = window.jsPDF || window.jspdf?.jsPDF || (typeof jspdf !== 'undefined' ? jspdf.jsPDF : null);
        const svg2pdf = window.svg2pdf || window.svg2pdfjs?.svg2pdf || (typeof svg2pdfjs !== 'undefined' ? svg2pdfjs.svg2pdf : null);
        
        if (!jsPDF) {
            throw new Error('jsPDF library is not loaded. Please include jsPDF from CDN.');
        }
        if (!svg2pdf) {
            throw new Error('svg2pdf library is not loaded. Please include svg2pdf from CDN.');
        }

        if (!svgElements || svgElements.length === 0) {
            throw new Error('No SVG elements provided');
        }

        // Определяем формат страницы из первого SVG
        const firstSvg = svgElements[0];
        const svgWidth = parseFloat(firstSvg.getAttribute('width')) || parseFloat(firstSvg.viewBox.baseVal.width);
        const svgHeight = parseFloat(firstSvg.getAttribute('height')) || parseFloat(firstSvg.viewBox.baseVal.height);
        
        const format = options.format || 'a4';
        let pageWidth, pageHeight;
        
        if (format === 'a4') {
            pageWidth = 210;
            pageHeight = 297;
        } else if (format === 'letter') {
            pageWidth = 215.9;
            pageHeight = 279.4;
        } else if (Array.isArray(format) && format.length === 2) {
            pageWidth = format[0];
            pageHeight = format[1];
        } else {
            pageWidth = svgWidth;
            pageHeight = svgHeight;
        }

        // Создаем PDF документ
        const pdf = new jsPDF({
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pageWidth, pageHeight]
        });

        // Добавляем каждый SVG на отдельную страницу
        for (let i = 0; i < svgElements.length; i++) {
            if (i > 0) {
                pdf.addPage();
            }

            const svg = svgElements[i].cloneNode(true);
            
            // Удаляем интерактивные элементы
            if (options.removeInteractive !== false) {
                this.removeInteractiveElements(svg);
            }
            
            // Конвертируем текст в кривые если нужно
            if (options.convertTextToOutlines && this.textToPath) {
                try {
                    await this.textToPath.convertAllTextToPaths(svg);
                } catch (error) {
                    console.error('Error converting text to paths:', error);
                }
            }

            const width = parseFloat(svg.getAttribute('width')) || parseFloat(svg.viewBox.baseVal.width);
            const height = parseFloat(svg.getAttribute('height')) || parseFloat(svg.viewBox.baseVal.height);

            try {
                await svg2pdf(svg, pdf, {
                    xOffset: 0,
                    yOffset: 0,
                    width: width,
                    height: height
                });
            } catch (error) {
                console.error(`Error converting SVG ${i + 1} to PDF:`, error);
            }
        }

        // Сохраняем PDF
        pdf.save(filename);
    }
}

