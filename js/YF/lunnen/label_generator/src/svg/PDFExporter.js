/**
 * Экспорт SVG в PDF через Canvas
 */
export class PDFExporter {
    constructor(settings, textToPath = null) {
        this.settings = settings;
        this.textToPath = textToPath;
    }

    /**
     * Конвертировать SVG в Canvas
     * @param {SVGElement} svgElement - SVG элемент
     * @returns {Promise<HTMLCanvasElement>} - Canvas элемент
     */
    async svgToCanvas(svgElement) {
        return new Promise((resolve, reject) => {
            try {
                // Клонируем SVG для безопасности
                const clonedSvg = svgElement.cloneNode(true);
                
                // Получаем размеры SVG
                const svgWidth = parseFloat(clonedSvg.getAttribute('width')) || parseFloat(clonedSvg.viewBox.baseVal.width);
                const svgHeight = parseFloat(clonedSvg.getAttribute('height')) || parseFloat(clonedSvg.viewBox.baseVal.height);
                
                // Создаем canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Устанавливаем размеры canvas в пикселях (высокое разрешение для качества)
                const scale = 2; // Увеличиваем разрешение для лучшего качества
                canvas.width = svgWidth * scale;
                canvas.height = svgHeight * scale;
                
                // Масштабируем контекст
                ctx.scale(scale, scale);
                
                // Сериализуем SVG в строку
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(clonedSvg);
                
                // Создаем blob URL
                const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                
                // Создаем изображение
                const img = new Image();
                
                img.onload = () => {
                    // Рисуем изображение на canvas
                    ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
                    URL.revokeObjectURL(url);
                    resolve(canvas);
                };
                
                img.onerror = (error) => {
                    URL.revokeObjectURL(url);
                    reject(new Error('Failed to load SVG as image: ' + error));
                };
                
                img.src = url;
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Экспортировать SVG элемент в PDF файл
     * @param {SVGElement} svgElement - SVG элемент для экспорта
     * @param {string} filename - Имя файла
     * @param {Object} options - Опции экспорта
     * @param {boolean} options.removeInteractive - Удалить интерактивные элементы
     * @param {boolean} options.convertTextToOutlines - Конвертировать текст в кривые
     * @param {string|Array} options.format - Формат страницы: 'a4', 'letter', или размеры в мм [width, height]
     */
    async exportToFile(svgElement, filename = 'grid.pdf', options = {}) {
        // Проверяем наличие библиотеки jsPDF
        const jsPDF = window.jsPDF || window.jspdf?.jsPDF || (typeof jspdf !== 'undefined' ? jspdf.jsPDF : null);
        
        if (!jsPDF) {
            throw new Error('jsPDF library is not loaded. Please include jsPDF from CDN.');
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

        // Конвертируем SVG в Canvas
        const canvas = await this.svgToCanvas(clonedSvg);

        // Создаем PDF документ
        const pdf = new jsPDF({
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pageWidth, pageHeight]
        });

        // Добавляем изображение с canvas в PDF
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, svgWidth, svgHeight, undefined, 'FAST');

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
        
        if (!jsPDF) {
            throw new Error('jsPDF library is not loaded. Please include jsPDF from CDN.');
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
                // Конвертируем SVG в Canvas
                const canvas = await this.svgToCanvas(svg);
                const imgData = canvas.toDataURL('image/png');
                pdf.addImage(imgData, 'PNG', 0, 0, width, height, undefined, 'FAST');
            } catch (error) {
                console.error(`Error converting SVG ${i + 1} to PDF:`, error);
            }
        }

        // Сохраняем PDF
        pdf.save(filename);
    }
}
