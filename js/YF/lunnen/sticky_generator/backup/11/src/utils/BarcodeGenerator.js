/**
 * BarcodeGenerator - Генератор штрихкодов Code128 и EAN-13 в SVG
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
     * Таблица кодирования EAN-13
     * L-коды (левая группа, нечетная паритетность)
     * R-коды (правая группа)
     */
    static EAN13_L_CODES = {
        '0': '0001101',
        '1': '0011001',
        '2': '0010011',
        '3': '0111101',
        '4': '0100011',
        '5': '0110001',
        '6': '0101111',
        '7': '0111011',
        '8': '0110111',
        '9': '0001011',
    };

    static EAN13_G_CODES = {
        '0': '0100111',
        '1': '0110011',
        '2': '0011011',
        '3': '0100001',
        '4': '0011101',
        '5': '0111001',
        '6': '0000101',
        '7': '0010001',
        '8': '0001001',
        '9': '0010111',
    };

    static EAN13_R_CODES = {
        '0': '1110010',
        '1': '1100110',
        '2': '1101100',
        '3': '1000010',
        '4': '1011100',
        '5': '1001110',
        '6': '1010000',
        '7': '1000100',
        '8': '1001000',
        '9': '1110100',
    };

    // Таблица паритетности для первой цифры (определяет какие L/G коды использовать)
    static EAN13_FIRST_DIGIT_PATTERNS = {
        '0': 'LLLLLL',
        '1': 'LLGLGG',
        '2': 'LLGGLG',
        '3': 'LLGGGL',
        '4': 'LGLLGG',
        '5': 'LGGLLG',
        '6': 'LGGGLL',
        '7': 'LGLGLG',
        '8': 'LGLGGL',
        '9': 'LGGLGL',
    };

    /**
     * Генерирует SVG штрихкод
     * @param {string} data - Данные для кодирования (цифры)
     * @param {Object} options - Опции
     * @param {number} options.width - Желаемая ширина штрихкода в пикселях
     * @param {number} options.height - Высота штрихкода в пикселях
     * @param {boolean} options.displayValue - Показывать ли значение под штрихкодом
     * @param {boolean} options.quiet - Добавлять ли quiet zones (белые поля по краям)
     * @param {number} options.fontSize - Размер шрифта для текста (в пикселях)
     * @param {number} options.fontWeight - Вес шрифта (400, 500, etc.)
     * @returns {string} SVG код штрихкода
     */
    static generateCode128SVG(data, options = {}) {
        const {
            width = 200,
            height = 100,
            displayValue = true,
            quiet = false,
            fontSize = null,
            fontWeight = 400,
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
        
        // Вычисляем размер шрифта и высоту для текста
        const textFontSize = fontSize !== null ? fontSize : 18;
        
        // Метрики шрифта для расчета пространства
        const capHeight = 630; // cap-height в единицах шрифта
        const unitsPerEm = 1000;
        const capHeightRatio = capHeight / unitsPerEm; // 0.63
        
        // Вычисляем реальную высоту cap-height текста в единицах viewBox
        const actualCapHeight = textFontSize * capHeightRatio;
        
        // Добавляем небольшой отступ сверху
        const textTopPadding = actualCapHeight * 0.15; // 15% от высоты букв
        const textHeight = displayValue ? (actualCapHeight + textTopPadding) : 0;
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
            // Позиционируем baseline текста так, чтобы cap-height заканчивался на нижней границе
            const textBaselineY = height;
            const textX = width / 2;
            svg += `<text x="${textX.toFixed(2)}" y="${textBaselineY.toFixed(2)}" font-family="TT Commons Classic, Arial, sans-serif" font-size="${textFontSize.toFixed(2)}" font-weight="${fontWeight}" text-anchor="middle" dominant-baseline="alphabetic" fill="#000000">${cleanData}</text>`;
        }

        svg += '</svg>';
        
        return svg;
    }

    /**
     * Вычисляет контрольную сумму EAN-13
     * @param {string} digits - 12 цифр
     * @returns {string} - контрольная сумма (1 цифра)
     */
    static calculateEAN13Checksum(digits) {
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(digits[i]);
            sum += (i % 2 === 0) ? digit : digit * 3;
        }
        const checksum = (10 - (sum % 10)) % 10;
        return checksum.toString();
    }

    /**
     * Генерирует SVG штрихкод EAN-13
     * @param {string} data - 12 или 13 цифр
     * @param {Object} options - Опции
     * @param {number} options.width - Ширина штрихкода БЕЗ первой цифры (в мм)
     * @param {number} options.shortBarHeight - Высота коротких полосок (в мм)
     * @param {number} options.longBarHeight - Высота длинных полосок (guard bars) (в мм)
     * @param {number} options.fontSize - Размер шрифта для текста (в мм)
     * @param {number} options.fontWeight - Вес шрифта
     * @param {boolean} options.displayValue - Показывать ли цифры под штрихкодом
     * @returns {string} SVG код штрихкода
     */
    static generateEAN13SVG(data, options = {}) {
        const {
            width = 37.29,  // стандартная ширина EAN-13 без первой цифры
            shortBarHeight = 15,
            longBarHeight = 18,
            fontSize = null,
            fontWeight = 500,
            displayValue = true,
            baselineOffset = null, // позиция baseline текста от верха штрихкода (в мм)
        } = options;

        // Преобразуем данные в строку и оставляем только цифры
        let cleanData = String(data).replace(/[^0-9]/g, '');
        
        // EAN-13 требует ровно 13 цифр
        if (cleanData.length < 12) {
            // Дополняем нулями слева до 12 цифр
            cleanData = cleanData.padStart(12, '0');
        } else if (cleanData.length === 12) {
            // Вычисляем контрольную сумму
            cleanData += this.calculateEAN13Checksum(cleanData);
        } else if (cleanData.length > 13) {
            // Обрезаем до 13 цифр
            cleanData = cleanData.substring(0, 13);
        } else if (cleanData.length === 13) {
            // Проверяем контрольную сумму
            const providedChecksum = cleanData[12];
            const calculatedChecksum = this.calculateEAN13Checksum(cleanData.substring(0, 12));
            if (providedChecksum !== calculatedChecksum) {
                console.warn(`EAN-13 checksum mismatch: provided ${providedChecksum}, calculated ${calculatedChecksum}`);
            }
        }

        // Разбиваем на части
        const firstDigit = cleanData[0];
        const leftGroup = cleanData.substring(1, 7);
        const rightGroup = cleanData.substring(7, 13);

        // Определяем паттерн L/G кодов для левой группы
        const pattern = this.EAN13_FIRST_DIGIT_PATTERNS[firstDigit];

        // Генерируем битовую последовательность
        let bits = '';
        
        // Start guard
        bits += '101';
        
        // Левая группа (6 цифр)
        for (let i = 0; i < 6; i++) {
            const digit = leftGroup[i];
            const code = (pattern[i] === 'L') ? this.EAN13_L_CODES[digit] : this.EAN13_G_CODES[digit];
            bits += code;
        }
        
        // Middle guard
        bits += '01010';
        
        // Правая группа (6 цифр)
        for (let i = 0; i < 6; i++) {
            const digit = rightGroup[i];
            bits += this.EAN13_R_CODES[digit];
        }
        
        // End guard
        bits += '101';

        // Вычисляем ширину одного модуля (минимальной единицы)
        const totalModules = bits.length; // 95 модулей
        const moduleWidth = width / totalModules;

        // Вычисляем размер шрифта
        const textFontSize = fontSize !== null ? fontSize : 3;
        
        // Метрики шрифта для расчета пространства (геометрия сохраняется даже если текст не рисуем)
        const capHeight = 630;
        const unitsPerEm = 1000;
        const capHeightRatio = capHeight / unitsPerEm;
        const actualCapHeight = textFontSize * capHeightRatio;
        
        // Если указан baselineOffset, используем его для позиционирования текста
        // Иначе используем старую логику (текст под штрихкодом)
        let totalHeight;
        let textBaselineY;
        
        if (baselineOffset !== null && displayValue) {
            // Baseline текста на указанном расстоянии от верха штрихкода
            textBaselineY = baselineOffset;
            // Общая высота = baseline + высота текста ниже baseline
            totalHeight = baselineOffset + actualCapHeight;
        } else {
            // Старая логика: текст под штрихкодом
            const textTopPadding = actualCapHeight * 0.2;
            const textHeight = actualCapHeight + textTopPadding;
            totalHeight = displayValue ? (longBarHeight + textHeight) : longBarHeight;
            textBaselineY = totalHeight; // baseline внизу SVG
        }

        // Вычисляем общие размеры SVG
        // Первая цифра выходит за пределы основного кода
        const firstDigitWidth = textFontSize * 0.7; // примерная ширина цифры
        const firstDigitMargin = textFontSize * 0.3; // отступ от guard bars
        const totalWidth = firstDigitWidth + firstDigitMargin + width;

        // Начальная позиция для полосок (с учетом места для первой цифры)
        const barsStartX = firstDigitWidth + firstDigitMargin;

        // Генерируем SVG
        let svg = `<svg width="${totalWidth.toFixed(2)}" height="${totalHeight.toFixed(2)}" viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight.toFixed(2)}" xmlns="http://www.w3.org/2000/svg">`;
        
        // Рисуем полосы
        let x = barsStartX;
        let moduleIndex = 0;
        
        for (let i = 0; i < bits.length; i++) {
            const bit = bits[i];
            
            // Определяем высоту полоски
            let barHeight = shortBarHeight;
            
            // Guard bars (start, middle, end) - длинные
            if (i < 3 || // start guard (101)
                (i >= 45 && i < 50) || // middle guard (01010) - начинается после 3 + 6*7 = 45
                i >= bits.length - 3) { // end guard (101)
                barHeight = longBarHeight;
            }
            
            if (bit === '1') {
                svg += `<rect x="${x.toFixed(3)}" y="0" width="${moduleWidth.toFixed(3)}" height="${barHeight.toFixed(2)}" fill="#000000"/>`;
            }
            
            x += moduleWidth;
            moduleIndex++;
        }

        // Добавляем текст (если displayValue = true)
        if (displayValue) {
            // Если baselineOffset не указан, используем старую логику (baseline внизу SVG)
            const finalTextBaselineY = (baselineOffset !== null) ? textBaselineY : totalHeight;
            
            // Первая цифра слева
            const firstDigitX = firstDigitWidth / 2;
            svg += `<text x="${firstDigitX.toFixed(2)}" y="${finalTextBaselineY.toFixed(2)}" font-family="TT Commons Classic, Arial, sans-serif" font-size="${textFontSize.toFixed(2)}" font-weight="${fontWeight}" text-anchor="middle" dominant-baseline="alphabetic" fill="#000000">${firstDigit}</text>`;
            
            // Левая группа (6 цифр) - располагаем между start и middle guards
            // Структура: start guard (3 модуля) + левая группа (42 модуля) + center guard (5 модулей)
            // Все 4 расстояния должны быть равны:
            // 1. От start guard до первой цифры левой группы
            // 2. От последней цифры левой группы до center guard
            // 3. От center guard до первой цифры правой группы
            // 4. От последней цифры правой группы до end guard
            
            const startGuardEndX = barsStartX + (3 * moduleWidth); // конец start guard
            const centerGuardStartX = barsStartX + (3 + 42) * moduleWidth; // начало center guard
            const centerGuardEndX = barsStartX + (3 + 42 + 5) * moduleWidth; // конец center guard
            const endGuardStartX = barsStartX + (3 + 42 + 5 + 42) * moduleWidth; // начало end guard
            
            // Вычисляем равное расстояние между guard bars и цифрами
            // Доступное пространство для левой группы: 42 модуля
            // Нужно разместить 6 цифр с равными отступами от guard bars
            // Если расстояние от guard до цифры = X, то:
            // X + (расстояние между цифрами) * 5 + X = 42
            // Используем фиксированное расстояние между центрами цифр
            const leftGroupAvailableWidth = 42 * moduleWidth;
            const digitSpacing = leftGroupAvailableWidth / 7; // 7 интервалов для 6 цифр (5 между + 2 по краям)
            const guardToDigitDistance = digitSpacing; // расстояние от guard до первой/последней цифры
            
            // Позиции цифр левой группы
            for (let i = 0; i < 6; i++) {
                const digitX = startGuardEndX + guardToDigitDistance + i * digitSpacing;
                svg += `<text x="${digitX.toFixed(2)}" y="${finalTextBaselineY.toFixed(2)}" font-family="TT Commons Classic, Arial, sans-serif" font-size="${textFontSize.toFixed(2)}" font-weight="${fontWeight}" text-anchor="middle" dominant-baseline="alphabetic" fill="#000000">${leftGroup[i]}</text>`;
            }
            
            // Правая группа (6 цифр) - располагаем между middle и end guards
            // Используем то же расстояние от guard bars
            const rightGroupAvailableWidth = 42 * moduleWidth;
            const rightDigitSpacing = rightGroupAvailableWidth / 7; // такое же расстояние
            
            // Позиции цифр правой группы
            for (let i = 0; i < 6; i++) {
                const digitX = centerGuardEndX + guardToDigitDistance + i * rightDigitSpacing;
                svg += `<text x="${digitX.toFixed(2)}" y="${finalTextBaselineY.toFixed(2)}" font-family="TT Commons Classic, Arial, sans-serif" font-size="${textFontSize.toFixed(2)}" font-weight="${fontWeight}" text-anchor="middle" dominant-baseline="alphabetic" fill="#000000">${rightGroup[i]}</text>`;
            }
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
     * @param {string} barcodeType - Тип штрихкода: 'code128' или 'ean13' (по умолчанию 'code128')
     */
    static updateBarcodeBlock(block, barcodeData, gridSettings, displayValue = true, barcodeType = 'code128') {
        const { gridModule, columnCount, frontWidth, margins, marginsUnit, frontHeight } = gridSettings;
        
        // Вычисляем реальные margins в mm
        const marginsInMm = marginsUnit === 'mod' ? margins * gridModule : margins;
        
        // Вычисляем ширину рабочей области (без margins и gutters)
        const workingWidth = frontWidth - (marginsInMm * 2);
        const gutters = gridModule * (columnCount - 1);
        
        // Вычисляем ширину одной колонки
        const columnWidth = (workingWidth - gutters) / columnCount;
        
        // Вычисляем размер шрифта: 1 baseline = 1 модуль = gridModule мм
        const textHeightInModules = 1; // 1 baseline
        const textHeightInMm = textHeightInModules * gridModule;
        
        // Метрики TT Commons Classic
        const capHeight = 630; // cap-height в единицах шрифта
        const unitsPerEm = 1000; // em-квадрат
        
        // Вычисляем fontSize в мм с учетом метрик: fontSize * (capHeight/unitsPerEm) = textHeightInMm
        const textFontSize = textHeightInMm / (capHeight / unitsPerEm);
        
        console.log(`🔤 Barcode text fontSize: ${textFontSize.toFixed(2)}mm (for ${textHeightInModules} module height)`);
        
        let newSvg;
        let finalWidth;
        let finalHeight;
        let heightInModules;
        
        if (barcodeType === 'ean13') {
            // EAN-13: Длинные полоски СТРОГО 18мм, короткие СТРОГО 15мм
            const shortBarHeight = 15;
            const longBarHeight = 18;
            
            // Ширина основного кода = ширина колонки (без учета первой цифры)
            const barcodeWidth = columnWidth;
            
            // Размер шрифта: 10 pt = 10 * (25.4/72) = 3.5278 мм
            const textFontSizePt = 10;
            const textFontSizeMm = textFontSizePt * (25.4 / 72);
            
            // Baseline текста должен быть на уровне 6-го бейслайна от верха штрихкода
            const baselineOffset = 6 * gridModule; // 6 бейслайнов от верха
            
            // Вычисляем общую высоту SVG: длинные полоски + место до baseline текста + высота текста
            // Метрики TT Commons Classic
            const capHeight = 630;
            const unitsPerEm = 1000;
            const capHeightRatio = capHeight / unitsPerEm;
            const actualCapHeight = textFontSizeMm * capHeightRatio;
            
            // Вычисляем место для текста ниже baseline
            const textHeightBelowBaseline = actualCapHeight; // высота текста ниже baseline
            const totalHeightWithText = baselineOffset + textHeightBelowBaseline;
            
            // Вычисляем место для первой цифры слева
            const firstDigitWidth = textFontSizeMm * 0.7; // примерная ширина цифры
            const firstDigitMargin = textFontSizeMm * 0.3; // отступ от guard bars
            const totalWidthWithFirstDigit = firstDigitWidth + firstDigitMargin + barcodeWidth;
            
            // КРИТИЧНО: finalWidth и finalHeight должны соответствовать реальным размерам SVG
            // чтобы не было масштабирования в GraphicsRenderer
            finalWidth = totalWidthWithFirstDigit;
            finalHeight = displayValue ? totalHeightWithText : longBarHeight;
            heightInModules = finalHeight / gridModule;
            
            // Сохраняем размеры графической части и левого отступа (для подсветки на канвасе)
            block.barsWidthMm = barcodeWidth;
            block.leftPaddingMm = firstDigitWidth + firstDigitMargin;
            
            console.log(`📊 EAN-13 Barcode: ${finalWidth.toFixed(2)}×${finalHeight.toFixed(2)}mm (longBars=${longBarHeight}mm, shortBars=${shortBarHeight}mm, ${heightInModules.toFixed(2)} modules, fontSize=${textFontSizePt}pt)`);
            
            // Генерируем EAN-13 штрихкод с фиксированными размерами полосок
            newSvg = this.generateEAN13SVG(barcodeData, {
                width: barcodeWidth, // ширина БЕЗ первой цифры
                shortBarHeight: shortBarHeight, // СТРОГО 15 мм
                longBarHeight: longBarHeight,   // СТРОГО 18 мм
                fontSize: textFontSizeMm,
                fontWeight: 500, // Medium
                displayValue: displayValue,
                baselineOffset: baselineOffset // позиция baseline текста от верха штрихкода
            });
        } else {
            // Code128: стандартная логика
            heightInModules = block.height || block.heightInModules || 8;
            const barcodeHeight = heightInModules * gridModule;
            const barcodeWidth = columnWidth;
            
            finalWidth = barcodeWidth;
            finalHeight = barcodeHeight;
            
            console.log(`📊 Code128 Barcode dimensions: ${barcodeWidth.toFixed(2)}×${barcodeHeight.toFixed(2)}mm`);
            
            // Генерируем Code128 штрихкод
            newSvg = this.generateCode128SVG(barcodeData, {
                width: finalWidth,
                height: finalHeight,
                displayValue: displayValue,
                quiet: false,
                fontSize: textFontSize,
                fontWeight: 500, // Medium
            });
        }
        
        // Обновляем SVG в блоке (svgContent используется для рендеринга)
        block.svgContent = newSvg;
        
        // Обновляем параметры блока для корректного рендеринга
        block.heightInModules = heightInModules;
        block.originalWidth = finalWidth;  // Реальные размеры в мм
        block.originalHeight = finalHeight; // Реальные размеры в мм
        block.sizeMode = 'height'; // Используем высоту как базовый размер
        
        // Сохраняем тип штрихкода в блоке
        block.barcodeType = barcodeType;
        
        console.log(`✅ ${barcodeType.toUpperCase()} Barcode updated with data: ${barcodeData}`);
    }
}

