import { PresetFormatAdapter } from '../preset/PresetFormatAdapter.js';

/**
 * Экспорт SVG в файл
 */
export class SVGExporter {
    constructor(settings, textToPath = null) {
        this.settings = settings;
        this.textToPath = textToPath;
        this.presetFormat = new PresetFormatAdapter();
        // Загружаем библиотеки для PDF экспорта динамически
        this.pdfLibsLoaded = false;
    }

    /**
     * Экспортировать SVG элемент в файл
     * @param {SVGElement} svgElement
     * @param {string} filename
     * @param {Object} options - Опции экспорта
     * @param {boolean} options.removeInteractive - Удалить интерактивные элементы
     * @param {boolean} options.optimizeSize - Оптимизировать размер
     * @param {boolean} options.convertTextToOutlines - Конвертировать текст в кривые
     */
    async exportToFile(svgElement, filename = 'grid.svg', options = {}) {
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
        
        // Сериализуем SVG в строку
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(clonedSvg);
        
        // Создаем blob и скачиваем
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    /**
     * Загрузить библиотеки для PDF экспорта
     * @returns {Promise<void>}
     */
    async loadPDFLibraries() {
        if (this.pdfLibsLoaded) {
            return;
        }

        return new Promise((resolve, reject) => {
            // Проверяем, загружены ли библиотеки
            if (window.jspdf) {
                this.pdfLibsLoaded = true;
                resolve();
                return;
            }

            // Загружаем jsPDF (включает svg2pdf как плагин в новых версиях)
            const jsPDFScript = document.createElement('script');
            jsPDFScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            jsPDFScript.onload = () => {
                // Загружаем svg2pdf отдельно (как плагин)
                const svg2pdfScript = document.createElement('script');
                svg2pdfScript.src = 'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js';
                svg2pdfScript.onload = () => {
                    this.pdfLibsLoaded = true;
                    resolve();
                };
                svg2pdfScript.onerror = () => {
                    reject(new Error('Не удалось загрузить svg2pdf.js'));
                };
                document.head.appendChild(svg2pdfScript);
            };
            jsPDFScript.onerror = () => {
                reject(new Error('Не удалось загрузить jsPDF'));
            };
            document.head.appendChild(jsPDFScript);
        });
    }

    /**
     * Экспортировать SVG элемент в PDF файл
     * @param {SVGElement} svgElement
     * @param {string} filename
     * @param {Object} options - Опции экспорта
     * @param {boolean} options.removeInteractive - Удалить интерактивные элементы
     * @param {boolean} options.convertTextToOutlines - Конвертировать текст в кривые
     * @param {string} options.unit - Единица измерения для PDF (mm, pt, in, px)
     * @param {Object} options.format - Формат страницы (например, {width: 210, height: 297} для A4)
     */
    async exportToPDF(svgElement, filename = 'grid.pdf', options = {}) {
        // Загружаем библиотеки если еще не загружены
        await this.loadPDFLibraries();

        // Клонируем SVG для экспорта
        const clonedSvg = svgElement.cloneNode(true);
        
        // Удаляем интерактивные элементы если нужно
        if (options.removeInteractive !== false) {
            this.removeInteractiveElements(clonedSvg);
        }
        
        // Для PDF ВСЕГДА конвертируем текст в кривые, чтобы избежать проблем с кириллицей и шрифтами
        // svg2pdf плохо работает с кириллицей, поэтому конвертация в кривые обязательна
        if (this.textToPath) {
            try {
                console.log('Converting text to paths for PDF export (required for Cyrillic support)...');
                await this.textToPath.convertAllTextToPaths(clonedSvg);
                console.log('Text converted to paths successfully');
            } catch (error) {
                console.error('Error converting text to paths:', error);
                // Для PDF это критично, поэтому выбрасываем ошибку
                throw new Error('Не удалось конвертировать текст в кривые. Убедитесь, что шрифты доступны. ' + error.message);
            }
        } else {
            throw new Error('TextToPath не доступен. Конвертация текста в кривые обязательна для PDF экспорта.');
        }

        // Получаем размеры SVG
        const svgWidth = parseFloat(clonedSvg.getAttribute('width')) || parseFloat(clonedSvg.viewBox.baseVal.width);
        const svgHeight = parseFloat(clonedSvg.getAttribute('height')) || parseFloat(clonedSvg.viewBox.baseVal.height);
        
        // Определяем единицы измерения (по умолчанию mm)
        const unit = options.unit || 'mm';
        
        // Определяем формат страницы
        let pageWidth, pageHeight;
        if (options.format) {
            pageWidth = options.format.width;
            pageHeight = options.format.height;
        } else {
            // Используем размеры SVG
            pageWidth = svgWidth;
            pageHeight = svgHeight;
        }

        // Создаем PDF документ
        // jsPDF доступен через window.jspdf (UMD версия)
        const { jsPDF } = window.jspdf;
        
        const pdf = new jsPDF({
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit: unit,
            format: options.format ? [pageWidth, pageHeight] : undefined
        });

        // Если формат не задан, устанавливаем кастомный размер
        if (!options.format) {
            pdf.internal.pageSize.setWidth(pageWidth);
            pdf.internal.pageSize.setHeight(pageHeight);
        }

        try {
            // Проверяем наличие svg2pdf
            let svg2pdf;
            if (window.svg2pdf) {
                svg2pdf = window.svg2pdf.svg2pdf || window.svg2pdf;
            } else if (pdf.svg) {
                // В новых версиях jsPDF svg2pdf может быть встроен как метод
                // Используем альтернативный подход через canvas если доступен
                throw new Error('svg2pdf не загружен. Используйте экспорт SVG.');
            }

            if (!svg2pdf) {
                throw new Error('svg2pdf не найден');
            }

            // Конвертируем SVG в PDF
            await svg2pdf(clonedSvg, pdf, {
                xOffset: 0,
                yOffset: 0,
                width: pageWidth,
                height: pageHeight
            });

            // Сохраняем PDF
            pdf.save(filename);
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            throw new Error('Ошибка при экспорте PDF: ' + error.message);
        }
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
     * Получить чистый SVG без интерактивных элементов
     * @param {SVGElement} svgElement
     * @returns {SVGElement}
     */
    getCleanSVG(svgElement) {
        const cloned = svgElement.cloneNode(true);
        this.removeInteractiveElements(cloned);
        return cloned;
    }

    /**
     * Создать полный SVG документ для экспорта
     * @param {string} content
     * @param {string} width
     * @param {string} height
     * @param {string} viewBox
     * @returns {string}
     */
    createExportSVG(content, width, height, viewBox) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="${viewBox}" 
     xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink">
    <title>Grid Generator Export</title>
    <desc>Generated by Grid Generator for Lunnen packaging</desc>
    ${content}
</svg>`;
    }

    /**
     * Экспортировать настройки в JSON файл с удобной структурой для копирайтера
     * @param {Object} data - Данные для экспорта
     * @param {string} filename
     */
    exportSettings(data, filename = 'grid-settings.json') {
        // Реорганизуем данные для удобства редактирования
        const organizedData = this.organizeSettingsForExport(data);
        
        // Используем кастомный stringify для красивого форматирования
        const jsonString = this.beautifyJSON(organizedData);
        
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Организовать настройки в понятную структуру
     * @param {Object} data - Исходные данные
     * @returns {Object} - Организованные данные
     */
    organizeSettingsForExport(data) {
        const settings = data.settings || {};
        const presetName = this.generatePresetName(
            settings,
            data.currentPresetName || 'Custom'
        );
        return this.presetFormat.organize(data, { presetName });
    }

    /**
     * Сгенерировать название пресета на основе параметров
     * @param {Object} settings
     * @param {string} currentPresetName - Название текущего пресета
     * @returns {string}
     */
    generatePresetName(settings, currentPresetName = 'Custom') {
        const width = settings.frontWidth ?? 0;
        const height = settings.frontHeight ?? 0;
        const thickness = settings.thickness ?? 0;
        const showSidePanels = settings.showSidePanels ?? false;
        
        // Формируем строку размеров
        let dimensionsStr;
        if (showSidePanels && thickness > 0) {
            dimensionsStr = `${width}×${height}×${thickness}mm`;
        } else {
            dimensionsStr = `${width}×${height}mm`;
        }
        
        // Формируем дату и время в формате "25.12.31, 22:00"
        const now = new Date();
        const year = String(now.getFullYear()).slice(-2); // Последние 2 цифры года
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const dateTimeStr = `${year}.${month}.${day}, ${hours}:${minutes}`;
        
        // Imported presets have a synthetic UI prefix. Their embedded name is
        // already descriptive, so appending dimensions and a date again would
        // make the name grow after every import/export cycle.
        if (/^Custom\s+—\s*/i.test(currentPresetName)) {
            return currentPresetName.replace(/^(?:Custom\s+—\s*)+/i, '');
        }

        // Если пресет не Custom и не начинается с "+ New", используем его название
        if (currentPresetName !== 'Custom' && !/^\+\s*New/i.test(currentPresetName)) {
            return `${currentPresetName}, ${dimensionsStr} — ${dateTimeStr}`;
        }
        
        // Иначе возвращаем только размеры с датой и временем
        return `${dimensionsStr} — ${dateTimeStr}`;
    }

    /**
     * Красиво форматировать JSON для удобства чтения
     * @param {Object} data
     * @returns {string}
     */
    beautifyJSON(data) {
        return JSON.stringify(data, null, 2);
    }

    /**
     * Импортировать настройки из JSON
     * @param {File} file
     * @returns {Promise<Object>} - Промис с данными из файла
     */
    async importSettings(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const jsonString = e.target.result;
                    const data = JSON.parse(jsonString);
                    
                    // Конвертируем новую структуру в старую для обратной совместимости
                    const normalizedData = this.normalizeImportedData(data);
                    resolve(normalizedData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Нормализовать импортированные данные (поддержка старого и нового формата)
     * @param {Object} data - Импортированные данные
     * @returns {Object} - Данные в старом формате для совместимости
     */
    normalizeImportedData(data) {
        return this.presetFormat.normalize(data);
    }

    /**
     * Конвертировать новый формат в старый для обратной совместимости
     * @param {Object} newData - Данные в новом формате
     * @returns {Object} - Данные в старом формате
     */
    convertNewFormatToOld(newData) {
        return this.presetFormat.fromOrganized(newData);
    }
}
