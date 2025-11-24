/**
 * Экспорт SVG в векторный PDF
 */
export class PDFExporter {
    constructor(settings, textToPath = null) {
        this.settings = settings;
        this.textToPath = textToPath;
    }

    /**
     * Экспортировать SVG элемент в векторный PDF файл
     * @param {SVGElement} svgElement - SVG элемент для экспорта
     * @param {string} filename - Имя файла
     * @param {Object} options - Опции экспорта
     * @param {boolean} options.removeInteractive - Удалить интерактивные элементы
     * @param {boolean} options.convertTextToOutlines - Конвертировать текст в кривые
     * @param {string|Array} options.format - Формат страницы: 'a4', 'letter', или размеры в мм [width, height]
     */
    async exportToFile(svgElement, filename = 'grid.pdf', options = {}) {
        // Проверяем наличие библиотек
        const jsPDF = window.jsPDF || window.jspdf?.jsPDF || (typeof jspdf !== 'undefined' ? jspdf.jsPDF : null);
        
        if (!jsPDF) {
            throw new Error('jsPDF library is not loaded. Please include jsPDF from CDN.');
        }
        
        // Проверяем, доступен ли метод svg() (добавляется плагином svg2pdf.js)
        // Создаем временный PDF для проверки
        const testPdf = new jsPDF({ unit: 'mm', format: [100, 100] });
        const hasSvgMethod = typeof testPdf.svg === 'function';
        
        if (!hasSvgMethod) {
            // Fallback: используем canvas (растровый, но работает)
            console.warn('svg2pdf plugin not available, falling back to raster export');
            return this.exportToFileRaster(svgElement, filename, options);
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

        // Получаем размеры SVG в мм
        // Парсим размеры, учитывая единицы измерения (mm, pt, px и т.д.)
        const widthAttr = clonedSvg.getAttribute('width') || '';
        const heightAttr = clonedSvg.getAttribute('height') || '';
        
        // Конвертируем в мм если нужно
        let svgWidth = parseFloat(widthAttr) || parseFloat(clonedSvg.viewBox.baseVal.width);
        let svgHeight = parseFloat(heightAttr) || parseFloat(clonedSvg.viewBox.baseVal.height);
        
        // Если размеры указаны в других единицах, конвертируем в мм
        if (widthAttr.includes('pt')) {
            svgWidth = svgWidth * 0.352778; // pt to mm: 1pt = 0.352778mm
        } else if (widthAttr.includes('px')) {
            svgWidth = svgWidth * 0.264583; // px to mm (при 96 DPI): 1px = 0.264583mm
        } else if (widthAttr.includes('in')) {
            svgWidth = svgWidth * 25.4; // inches to mm: 1in = 25.4mm
        }
        // Если уже в mm или без единиц (предполагаем mm), оставляем как есть
        
        if (heightAttr.includes('pt')) {
            svgHeight = svgHeight * 0.352778;
        } else if (heightAttr.includes('px')) {
            svgHeight = svgHeight * 0.264583;
        } else if (heightAttr.includes('in')) {
            svgHeight = svgHeight * 25.4;
        }
        
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

        // Создаем PDF документ с единицами измерения в мм
        const pdf = new jsPDF({
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pageWidth, pageHeight]
        });

        // Убеждаемся, что SVG имеет размеры в мм и правильный viewBox
        clonedSvg.setAttribute('width', `${svgWidth}mm`);
        clonedSvg.setAttribute('height', `${svgHeight}mm`);
        clonedSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
        
        // Удаляем единицы измерения из viewBox если они там есть
        const viewBox = clonedSvg.getAttribute('viewBox');
        if (viewBox && (viewBox.includes('mm') || viewBox.includes('pt') || viewBox.includes('px'))) {
            // viewBox должен быть без единиц измерения
            clonedSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
        }
        
        // Конвертируем SVG в векторный PDF используя метод svg() из jsPDF
        // Размеры передаем в мм (jsPDF работает в мм, так как unit: 'mm')
        try {
            await pdf.svg(clonedSvg, {
                x: 0,
                y: 0,
                width: svgWidth, // в мм
                height: svgHeight // в мм
            });
        } catch (error) {
            console.error('Error converting SVG to vector PDF:', error);
            // Fallback на растровый экспорт
            console.warn('Falling back to raster export');
            return this.exportToFileRaster(svgElement, filename, options);
        }

        // Сохраняем PDF
        pdf.save(filename);
    }

    /**
     * Растровый экспорт (fallback)
     */
    async exportToFileRaster(svgElement, filename = 'grid.pdf', options = {}) {
        const jsPDF = window.jsPDF || window.jspdf?.jsPDF || (typeof jspdf !== 'undefined' ? jspdf.jsPDF : null);
        
        if (!jsPDF) {
            throw new Error('jsPDF library is not loaded.');
        }

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

        // Получаем размеры SVG в мм
        const widthAttr = clonedSvg.getAttribute('width') || '';
        const heightAttr = clonedSvg.getAttribute('height') || '';
        
        let svgWidth = parseFloat(widthAttr) || parseFloat(clonedSvg.viewBox.baseVal.width);
        let svgHeight = parseFloat(heightAttr) || parseFloat(clonedSvg.viewBox.baseVal.height);
        
        // Конвертируем в мм если нужно
        if (widthAttr.includes('pt')) {
            svgWidth = svgWidth * 0.352778;
        } else if (widthAttr.includes('px')) {
            svgWidth = svgWidth * 0.264583;
        } else if (widthAttr.includes('in')) {
            svgWidth = svgWidth * 25.4;
        }
        
        if (heightAttr.includes('pt')) {
            svgHeight = svgHeight * 0.352778;
        } else if (heightAttr.includes('px')) {
            svgHeight = svgHeight * 0.264583;
        } else if (heightAttr.includes('in')) {
            svgHeight = svgHeight * 25.4;
        }
        
        // Убеждаемся, что SVG имеет размеры в мм
        clonedSvg.setAttribute('width', `${svgWidth}mm`);
        clonedSvg.setAttribute('height', `${svgHeight}mm`);
        
        let pageWidth, pageHeight;
        const format = options.format || 'a4';
        
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

        // Конвертируем SVG в Canvas
        const canvas = await this.svgToCanvas(clonedSvg);
        const imgData = canvas.toDataURL('image/png');

        const pdf = new jsPDF({
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pageWidth, pageHeight]
        });

        // Размеры изображения в мм
        pdf.addImage(imgData, 'PNG', 0, 0, svgWidth, svgHeight, undefined, 'FAST');
        pdf.save(filename);
    }

    /**
     * Конвертировать SVG в Canvas (для растрового fallback)
     */
    async svgToCanvas(svgElement) {
        return new Promise((resolve, reject) => {
            try {
                const clonedSvg = svgElement.cloneNode(true);
                const svgWidth = parseFloat(clonedSvg.getAttribute('width')) || parseFloat(clonedSvg.viewBox.baseVal.width);
                const svgHeight = parseFloat(clonedSvg.getAttribute('height')) || parseFloat(clonedSvg.viewBox.baseVal.height);
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const scale = 2;
                canvas.width = svgWidth * scale;
                canvas.height = svgHeight * scale;
                ctx.scale(scale, scale);
                
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(clonedSvg);
                const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                
                const img = new Image();
                img.onload = () => {
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
     * Удалить интерактивные элементы из SVG
     * @param {SVGElement} svg
     */
    removeInteractiveElements(svg) {
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
            throw new Error('jsPDF library is not loaded.');
        }

        if (!svgElements || svgElements.length === 0) {
            throw new Error('No SVG elements provided');
        }

        const firstSvg = svgElements[0];
        // Получаем размеры SVG в мм
        const widthAttr = firstSvg.getAttribute('width') || '';
        const heightAttr = firstSvg.getAttribute('height') || '';
        
        let svgWidth = parseFloat(widthAttr) || parseFloat(firstSvg.viewBox.baseVal.width);
        let svgHeight = parseFloat(heightAttr) || parseFloat(firstSvg.viewBox.baseVal.height);
        
        // Конвертируем в мм если нужно
        if (widthAttr.includes('pt')) {
            svgWidth = svgWidth * 0.352778;
        } else if (widthAttr.includes('px')) {
            svgWidth = svgWidth * 0.264583;
        } else if (widthAttr.includes('in')) {
            svgWidth = svgWidth * 25.4;
        }
        
        if (heightAttr.includes('pt')) {
            svgHeight = svgHeight * 0.352778;
        } else if (heightAttr.includes('px')) {
            svgHeight = svgHeight * 0.264583;
        } else if (heightAttr.includes('in')) {
            svgHeight = svgHeight * 25.4;
        }
        
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

        const pdf = new jsPDF({
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pageWidth, pageHeight]
        });

        // Проверяем доступность метода svg()
        const testPdf = new jsPDF({ unit: 'mm', format: [100, 100] });
        const useVector = typeof testPdf.svg === 'function';

        for (let i = 0; i < svgElements.length; i++) {
            if (i > 0) {
                pdf.addPage();
            }

            const svg = svgElements[i].cloneNode(true);
            
            if (options.removeInteractive !== false) {
                this.removeInteractiveElements(svg);
            }
            
            if (options.convertTextToOutlines && this.textToPath) {
                try {
                    await this.textToPath.convertAllTextToPaths(svg);
                } catch (error) {
                    console.error('Error converting text to paths:', error);
                }
            }

            // Получаем размеры SVG в мм
            const widthAttr = svg.getAttribute('width') || '';
            const heightAttr = svg.getAttribute('height') || '';
            
            let width = parseFloat(widthAttr) || parseFloat(svg.viewBox.baseVal.width);
            let height = parseFloat(heightAttr) || parseFloat(svg.viewBox.baseVal.height);
            
            // Конвертируем в мм если нужно
            if (widthAttr.includes('pt')) {
                width = width * 0.352778;
            } else if (widthAttr.includes('px')) {
                width = width * 0.264583;
            } else if (widthAttr.includes('in')) {
                width = width * 25.4;
            }
            
            if (heightAttr.includes('pt')) {
                height = height * 0.352778;
            } else if (heightAttr.includes('px')) {
                height = height * 0.264583;
            } else if (heightAttr.includes('in')) {
                height = height * 25.4;
            }
            
            // Убеждаемся, что SVG имеет размеры в мм и правильный viewBox
            svg.setAttribute('width', `${width}mm`);
            svg.setAttribute('height', `${height}mm`);
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            
            // Удаляем единицы измерения из viewBox если они там есть
            const viewBox = svg.getAttribute('viewBox');
            if (viewBox && (viewBox.includes('mm') || viewBox.includes('pt') || viewBox.includes('px'))) {
                svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }

            try {
                if (useVector) {
                    // Размеры передаем в мм (jsPDF работает в мм, так как unit: 'mm')
                    await pdf.svg(svg, {
                        x: 0,
                        y: 0,
                        width: width, // в мм
                        height: height // в мм
                    });
                } else {
                    const canvas = await this.svgToCanvas(svg);
                    const imgData = canvas.toDataURL('image/png');
                    pdf.addImage(imgData, 'PNG', 0, 0, width, height, undefined, 'FAST');
                }
            } catch (error) {
                console.error(`Error converting SVG ${i + 1} to PDF:`, error);
                // Если векторный экспорт не удался, пробуем растровый
                if (useVector) {
                    try {
                        const canvas = await this.svgToCanvas(svg);
                        const imgData = canvas.toDataURL('image/png');
                        pdf.addImage(imgData, 'PNG', 0, 0, width, height, undefined, 'FAST');
                    } catch (rasterError) {
                        console.error(`Error with raster fallback for SVG ${i + 1}:`, rasterError);
                    }
                }
            }
        }

        pdf.save(filename);
    }
}
