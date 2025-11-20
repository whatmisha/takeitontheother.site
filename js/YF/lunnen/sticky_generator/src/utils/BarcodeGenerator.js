/**
 * BarcodeGenerator - Генератор штрихкодов Code128 в SVG
 */

export class BarcodeGenerator {
    /**
     * Таблица кодирования Code128 (упрощенная версия для цифр)
     * Каждый символ кодируется как строка из 6 значений (ширина полос)
     */
    static CODE128 = {
        'START_B': '11010010000',
        'STOP': '1100011101011',
        '0': '11011001100',
        '1': '11001101100',
        '2': '11001100110',
        '3': '10010011000',
        '4': '10010001100',
        '5': '10001001100',
        '6': '10011001000',
        '7': '10011000100',
        '8': '10001100100',
        '9': '11001001000',
    };

    /**
     * Генерирует SVG штрихкод
     * @param {string} data - Данные для кодирования (цифры)
     * @param {Object} options - Опции
     * @param {number} options.width - Желаемая ширина штрихкода в пикселях
     * @param {number} options.height - Высота штрихкода в пикселях
     * @param {boolean} options.displayValue - Показывать ли значение под штрихкодом
     * @param {boolean} options.quiet - Добавлять ли quiet zones (белые поля по краям)
     * @returns {string} SVG код штрихкода
     */
    static generateCode128SVG(data, options = {}) {
        const {
            width = 200,
            height = 100,
            displayValue = true,
            quiet = false,
        } = options;

        // Преобразуем данные в строку и оставляем только цифры
        const cleanData = String(data).replace(/[^0-9]/g, '');
        
        if (!cleanData) {
            console.error('Barcode: no valid digits in data');
            return this.generateEmptyBarcode(width, height);
        }

        // Генерируем последовательность полос
        let pattern = this.CODE128.START_B;
        
        // Добавляем каждую цифру
        for (let char of cleanData) {
            pattern += this.CODE128[char];
        }
        
        // Добавляем STOP код
        pattern += this.CODE128.STOP;

        // Вычисляем ширину одной полосы
        const totalBars = pattern.length;
        const quietZoneWidth = quiet ? 10 : 0;
        const availableWidth = width - (quietZoneWidth * 2);
        const barWidth = availableWidth / totalBars;
        
        // Высота для штрихкода (оставляем место для текста если нужно)
        const textHeight = displayValue ? 20 : 0;
        const barcodeHeight = height - textHeight;

        // Генерируем SVG
        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
        
        // Рисуем полосы
        let x = quietZoneWidth;
        for (let i = 0; i < pattern.length; i++) {
            const bit = pattern[i];
            if (bit === '1') {
                svg += `<rect x="${x.toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${barcodeHeight}" fill="#000000"/>`;
            }
            x += barWidth;
        }

        // Добавляем текст если нужно
        if (displayValue) {
            const fontSize = Math.min(18, textHeight - 2);
            svg += `<text x="${width / 2}" y="${height - 2}" font-family="TT Commons Classic, Arial, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="#000000">${cleanData}</text>`;
        }

        svg += '</svg>';
        
        return svg;
    }

    /**
     * Генерирует пустой штрихкод (placeholder)
     */
    static generateEmptyBarcode(width, height) {
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"/>
            <text x="${width / 2}" y="${height / 2}" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#999999">No barcode data</text>
        </svg>`;
    }

    /**
     * Обновляет существующий графический блок штрихкода
     * @param {Object} block - Графический блок
     * @param {string} barcodeData - Данные для штрихкода
     * @param {Object} gridSettings - Настройки сетки для вычисления размера
     * @param {boolean} displayValue - Показывать ли текст под штрихкодом (по умолчанию true)
     */
    static updateBarcodeBlock(block, barcodeData, gridSettings, displayValue = true) {
        const { gridModule, columnCount, frontWidth, margins, marginsUnit, frontHeight } = gridSettings;
        
        // Вычисляем реальные margins в mm
        const marginsInMm = marginsUnit === 'mod' ? margins * gridModule : margins;
        
        // Вычисляем ширину рабочей области (без margins и gutters)
        const workingWidth = frontWidth - (marginsInMm * 2);
        const gutters = gridModule * (columnCount - 1);
        
        // Вычисляем ширину одной колонки
        const columnWidth = (workingWidth - gutters) / columnCount;
        
        // Высота штрихкода - берем либо height, либо heightInModules
        const heightInModules = block.height || block.heightInModules || 8;
        const barcodeHeight = heightInModules * gridModule;
        const barcodeWidth = columnWidth;
        
        console.log(`📊 Barcode dimensions: ${barcodeWidth.toFixed(2)}×${barcodeHeight.toFixed(2)}mm`);
        
        // Вычисляем aspect ratio для правильного масштабирования
        const aspectRatio = barcodeWidth / barcodeHeight;
        
        // Используем unitless размеры для viewBox с правильным aspect ratio
        // Берем высоту 100, а ширину вычисляем по aspect ratio
        const viewBoxHeight = 100;
        const viewBoxWidth = viewBoxHeight * aspectRatio;
        
        // Генерируем новый SVG штрихкода с правильным aspect ratio
        const newSvg = this.generateCode128SVG(barcodeData, {
            width: viewBoxWidth,
            height: viewBoxHeight,
            displayValue: displayValue, // Показывать текст или нет
            quiet: false, // Без quiet zones
        });
        
        // Обновляем SVG в блоке (svgContent используется для рендеринга)
        block.svgContent = newSvg;
        
        // Обновляем параметры блока для корректного рендеринга
        block.heightInModules = heightInModules;
        block.originalWidth = viewBoxWidth;
        block.originalHeight = viewBoxHeight;
        block.sizeMode = 'height'; // Используем высоту как базовый размер
        
        console.log(`✅ Barcode updated with data: ${barcodeData}`);
    }
}

