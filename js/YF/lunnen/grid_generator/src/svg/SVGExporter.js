/**
 * Экспорт SVG в файл
 */
export class SVGExporter {
    constructor(settings, textToPath = null) {
        this.settings = settings;
        this.textToPath = textToPath;
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
        const textBlocks = data.textBlocks || [];
        const graphicsBlocks = data.graphicsBlocks || [];
        
        // Извлекаем iconsBlock и claimBlock из graphicsBlocks (они там встроенные)
        const iconsBlock = graphicsBlocks.find(b => b.id === 'icons');
        const claimBlock = graphicsBlocks.find(b => b.id === 'claim');

        // Генерируем название пресета на основе параметров
        const currentPresetName = data.currentPresetName || 'Custom';
        const presetName = this.generatePresetName(settings, currentPresetName);

        return {
            // 1. Мета-информация и название пресета
            presetName: presetName,
            version: data.version || '1.0',
            timestamp: data.timestamp,
            
            // 2. Размеры макета
            dimensions: {
                width: settings.frontWidth,
                height: settings.frontHeight,
                thickness: settings.thickness,
                unit: 'mm'
            },

            // Ориентация, видимость и независимые сетки поверхностей
            surfaces: settings.surfaceSettings || null,
            
            // 3. Все текстовые блоки (удобно для копирайтера)
            texts: textBlocks.map((block, index) => ({
                id: block.id || `text_${index + 1}`,
                content: block.content || '',
                style: block.styleRef || 'headline',
                position: {
                    column: block.x || 1,
                    row: block.row || 0,
                    baseline: block.baselineOffset || 0
                },
                width: block.width || 3,
                alignment: block.alignment || 'left',
                textAlign: block.textAlign || 'left', // Выравнивание текста внутри абзаца: 'left', 'center', 'right'
                alignmentMode: block.alignmentMode || 'baseline',
                surface: block.surface || 'front',
                showBounds: block.showBounds || false,
                visible: block.visible !== undefined ? block.visible : true
            })),
            
            // 4. Настройки сетки
            grid: {
                module: settings.gridModule,
                margins: settings.margins,
                marginsUnit: settings.marginsUnit || 'mod',
                columns: settings.columnCount,
                rows: settings.rowCount,
                rowHeight: settings.rowHeight,
                linkMode: settings.linkMode,
                visibility: {
                    columns: settings.showColumns,
                    rows: settings.showRows,
                    baseline: settings.showBaseline
                }
            },
            
            // 5. Настройки цвета
            colors: {
                background: settings.boxColor
            },
            
            // 6. Настройки типографики
            typography: {
                headline: {
                    size: settings.headlineSize,
                    lineHeight: settings.lineHeight,
                    tracking: settings.tracking,
                    useXHeight: settings.useXHeight,
                    fontWeight: settings.headlineFontWeight
                },
                text: {
                    size: settings.textSize,
                    lineHeight: settings.textLineHeight,
                    tracking: settings.textTracking,
                    useXHeight: settings.useXHeight2,
                    fontWeight: settings.textFontWeight
                }
            },
            
            // 7. Настройки отображения
            display: {
                dimensions: settings.showDimensions,
                labels: settings.showLabels,
                sidePanels: settings.showSidePanels,
                objects: settings.showObjects
            },
            
            // 8. Графика (в конце, чтобы не мешать редактированию)
            graphics: {
                blocks: graphicsBlocks
                    .filter(block => !block.isBuiltIn) // Исключаем встроенные (icons, claim)
                    .map((block, index) => ({
                        id: block.id || `graphic_${index + 1}`,
                        name: block.name || `Graphic ${index + 1}`,
                        position: {
                            column: block.x || 1,
                            row: block.row || 0,
                            baseline: block.baselineOffset || 0
                        },
                        height: block.heightInModules || 3,
                        widthInColumns: block.widthInColumns !== undefined ? block.widthInColumns : undefined,
                        sizeMode: block.sizeMode || 'height',
                        originalWidth: block.originalWidth,
                        originalHeight: block.originalHeight,
                        alignment: block.alignment || 'left',
                        surface: block.surface || 'front',
                        visible: block.visible !== undefined ? block.visible : true,
                        // SVG код в самом конце
                        svg: block.svgContent || ''
                    })),
                icons: iconsBlock ? {
                    position: {
                        column: iconsBlock.x || 1,
                        row: iconsBlock.row || 0,
                        baseline: iconsBlock.baselineOffset || 0
                    },
                    height: iconsBlock.heightInModules || 3,
                    surface: iconsBlock.surface || 'front',
                    visible: iconsBlock.visible !== undefined ? iconsBlock.visible : true,
                    svg: iconsBlock.svgContent || ''
                } : null,
                claim: claimBlock ? {
                    position: {
                        column: claimBlock.x || 7,
                        row: claimBlock.row || 0,
                        baseline: claimBlock.baselineOffset || 0
                    },
                    height: claimBlock.heightInModules || 3,
                    surface: claimBlock.surface || 'front',
                    visible: claimBlock.visible !== undefined ? claimBlock.visible : true,
                    svg: claimBlock.svgContent || ''
                } : null
            }
        };
    }

    /**
     * Сгенерировать название пресета на основе параметров
     * @param {Object} settings
     * @param {string} currentPresetName - Название текущего пресета
     * @returns {string}
     */
    generatePresetName(settings, currentPresetName = 'Custom') {
        const width = settings.frontWidth || 0;
        const height = settings.frontHeight || 0;
        const thickness = settings.thickness || 0;
        const showSidePanels = settings.showSidePanels || false;
        
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
        
        // Если пресет не Custom и не начинается с "+New", используем его название
        if (currentPresetName !== 'Custom' && !currentPresetName.startsWith('+New')) {
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
        // Если это новый формат (с организованной структурой)
        if (data.dimensions && data.grid && data.typography) {
            return this.convertNewFormatToOld(data);
        }
        
        // Если это старый формат - возвращаем как есть
        return data;
    }

    /**
     * Конвертировать новый формат в старый для обратной совместимости
     * @param {Object} newData - Данные в новом формате
     * @returns {Object} - Данные в старом формате
     */
    convertNewFormatToOld(newData) {
        // ВАЖНО: margins в JSON всегда сохраняется в модулях (как во внутренней системе),
        // независимо от marginsUnit. marginsUnit - это только единица отображения в интерфейсе.
        const settings = {
            // Размеры
            frontWidth: newData.dimensions?.width,
            frontHeight: newData.dimensions?.height,
            thickness: newData.dimensions?.thickness,
            
            // Сетка
            gridModule: newData.grid?.module,
            margins: newData.grid?.margins, // Всегда в модулях в JSON
            marginsUnit: newData.grid?.marginsUnit || 'mod',
            columnCount: newData.grid?.columns,
            rowCount: newData.grid?.rows,
            rowHeight: newData.grid?.rowHeight,
            linkMode: newData.grid?.linkMode,
            showColumns: newData.grid?.visibility?.columns,
            showRows: newData.grid?.visibility?.rows,
            showBaseline: newData.grid?.visibility?.baseline,
            
            // Цвета
            boxColor: newData.colors?.background,
            
            // Типографика - Headline
            headlineSize: newData.typography?.headline?.size,
            lineHeight: newData.typography?.headline?.lineHeight,
            tracking: newData.typography?.headline?.tracking,
            useXHeight: newData.typography?.headline?.useXHeight,
            headlineFontWeight: newData.typography?.headline?.fontWeight,
            
            // Типографика - Text
            textSize: newData.typography?.text?.size,
            textLineHeight: newData.typography?.text?.lineHeight,
            textTracking: newData.typography?.text?.tracking,
            useXHeight2: newData.typography?.text?.useXHeight,
            textFontWeight: newData.typography?.text?.fontWeight,
            
            // Отображение
            showDimensions: newData.display?.dimensions,
            showLabels: newData.display?.labels,
            showSidePanels: newData.display?.sidePanels,
            showObjects: newData.display?.objects,
            surfaceSettings: newData.surfaces || undefined
        };

        // Текстовые блоки (маппинг полей для внутренней структуры приложения)
        const textBlocks = (newData.texts || []).map(text => ({
            id: text.id || 'text_' + Date.now(),
            content: text.content,
            styleRef: text.style,
            x: text.position?.column || 1,
            row: text.position?.row || 0,
            baselineOffset: text.position?.baseline || 0,
            width: text.width || 3,
            alignment: text.alignment || 'left',
            textAlign: text.textAlign || text.alignment || 'left', // Выравнивание текста внутри абзаца
            alignmentMode: text.alignmentMode || 'baseline',
            surface: text.surface || 'front',
            showBounds: text.showBounds || false,
            visible: text.visible !== undefined ? text.visible : true
        }));

        // Графические блоки (маппинг полей для внутренней структуры приложения)
        const graphicsBlocks = [];
        
        // Добавляем пользовательские графические блоки
        (newData.graphics?.blocks || []).forEach(graphic => {
            graphicsBlocks.push({
                id: graphic.id || 'graphic_' + Date.now(),
                name: graphic.name || 'Graphic',
                isBuiltIn: false,
                svgContent: graphic.svg || '',
                heightInModules: graphic.height || 3,
                widthInColumns: graphic.widthInColumns !== undefined ? graphic.widthInColumns : null,
                widthInModules: graphic.widthInModules !== undefined ? graphic.widthInModules : null, // Для обратной совместимости
                sizeMode: graphic.sizeMode || 'height',
                x: graphic.position?.column || 1,
                row: graphic.position?.row || 0,
                baselineOffset: graphic.position?.baseline || 0,
                alignment: graphic.alignment || 'left',
                surface: graphic.surface || 'front',
                showBounds: false,
                visible: graphic.visible !== undefined ? graphic.visible : true,
                originalWidth: graphic.originalWidth || 100,
                originalHeight: graphic.originalHeight || 100
            });
        });

        // Добавляем Icons (встроенный блок)
        if (newData.graphics?.icons) {
            graphicsBlocks.push({
                id: 'icons',
                name: 'Icons',
                isBuiltIn: true,
                svgContent: newData.graphics.icons.svg || '',
                heightInModules: newData.graphics.icons.height || 3,
                x: newData.graphics.icons.position?.column || 1,
                row: newData.graphics.icons.position?.row || 0,
                baselineOffset: newData.graphics.icons.position?.baseline || 0,
                surface: newData.graphics.icons.surface || 'front',
                showBounds: false,
                visible: newData.graphics.icons.visible !== undefined ? newData.graphics.icons.visible : true,
                originalWidth: 204.0944882,
                originalHeight: 28.3464567
            });
        }

        // Добавляем Claim (встроенный блок)
        if (newData.graphics?.claim) {
            graphicsBlocks.push({
                id: 'claim',
                name: 'Claim',
                isBuiltIn: true,
                svgContent: newData.graphics.claim.svg || '',
                heightInModules: newData.graphics.claim.height || 3,
                x: newData.graphics.claim.position?.column || 7,
                row: newData.graphics.claim.position?.row || 0,
                baselineOffset: newData.graphics.claim.position?.baseline || 0,
                surface: newData.graphics.claim.surface || 'front',
                showBounds: false,
                visible: newData.graphics.claim.visible !== undefined ? newData.graphics.claim.visible : true,
                originalWidth: 186.2242584,
                originalHeight: 28.3464565
            });
        }

        return {
            version: newData.version,
            timestamp: newData.timestamp,
            presetName: newData.presetName,
            settings: settings,
            textBlocks: textBlocks,
            graphicsBlocks: graphicsBlocks
        };
    }
}
