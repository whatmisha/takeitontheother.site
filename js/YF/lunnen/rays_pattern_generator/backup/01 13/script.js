document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('patternCanvas');
    const ctx = canvas.getContext('2d');
    
    // Элементы управления
    const lineWidthSlider = document.getElementById('lineWidthSlider');
    const gapSlider = document.getElementById('gapSlider');
    const rayLengthSlider = document.getElementById('rayLengthSlider');
    const rayCountSlider = document.getElementById('rayCountSlider');
    const scaleSlider = document.getElementById('scaleSlider');
    const zeroRayLengthSlider = document.getElementById('zeroRayLengthSlider');
    const hundredRayLengthSlider = document.getElementById('hundredRayLengthSlider');
    const zeroLineWidthSlider = document.getElementById('zeroLineWidthSlider');
    const hundredLineWidthSlider = document.getElementById('hundredLineWidthSlider');
    const exportSvgBtn = document.getElementById('exportSvgBtn');
    const resetBtn = document.getElementById('resetBtn');
    const roundCapCheckbox = document.getElementById('roundCapCheckbox');
    const offsetRowsCheckbox = document.getElementById('offsetRowsCheckbox');
    const rasterModeCheckbox = document.getElementById('rasterModeCheckbox');
    const imageRasterModeCheckbox = document.getElementById('imageRasterModeCheckbox');
    const hideConnectingLinesCheckbox = document.getElementById('hideConnectingLinesCheckbox');
    const lineWidthValueDisplay = document.getElementById('lineWidthValue');
    const gapValueDisplay = document.getElementById('gapValue');
    const rayLengthValueDisplay = document.getElementById('rayLengthValue');
    const rayCountValueDisplay = document.getElementById('rayCountValue');
    const scaleValueDisplay = document.getElementById('scaleValue');
    const zeroRayLengthValueDisplay = document.getElementById('zeroRayLengthValue');
    const hundredRayLengthValueDisplay = document.getElementById('hundredRayLengthValue');
    const zeroLineWidthValueDisplay = document.getElementById('zeroLineWidthValue');
    const hundredLineWidthValueDisplay = document.getElementById('hundredLineWidthValue');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const imageRasterControls = document.getElementById('imageRasterControls');
    const imageInvertCheckbox = document.getElementById('imageInvertCheckbox');
    const brightnessContrastSlider = document.getElementById('brightnessContrastSlider');
    const brightnessContrastValueDisplay = document.getElementById('brightnessContrastValue');
    
    // Определяем, какую операционную систему использует пользователь
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const hotkeySymbol = isMac ? '⌘E' : 'Ctrl+E';
    
    // Обновляем текст кнопки с нужным сочетанием клавиш
    exportSvgBtn.textContent = `Export SVG (${hotkeySymbol})`;
    
    // Добавляем обработчик клавиатурных сокращений
    document.addEventListener('keydown', function(event) {
        // Cmd+E (Mac) или Ctrl+E (Windows/Linux)
        if ((event.metaKey || event.ctrlKey) && event.key === 'e') {
            event.preventDefault(); // Предотвращаем стандартное действие браузера
            exportToSvg();
        }
    });
    
    // Разрешенные значения для количества лучей
    const allowedRayCounts = [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24];
    
    // Базовые настройки размеров модуля и отступов
    const baseModuleWidth = 150;
    const baseModuleHeight = 75;
    const baseHorizontalGap = 20; // Базовый горизонтальный отступ между модулями
    const baseVerticalGap = 0;    // Базовый вертикальный отступ между модулями
    
    // Значения по умолчанию для сброса
    const defaultValues = {
        lineWidth: 2,
        gap: 19,
        rayLength: 56,
        rayCount: 5,
        scale: 1.0,
        roundCap: false,
        offsetRows: false,
        rasterMode: false,
        imageRasterMode: false,
        zeroRayLength: 30,
        hundredRayLength: 100,
        zeroLineWidth: 1.0,
        hundredLineWidth: 2.0,
        hideConnectingLines: false,
        brightnessContrast: 1.0,
        invertImage: false
    };
    
    // Функция получения ближайшего разрешенного значения
    function getNearestAllowedValue(value) {
        if (allowedRayCounts.includes(value)) return value;
        
        let nearestValue = allowedRayCounts[0];
        let minDistance = Math.abs(value - nearestValue);
        
        for (let i = 1; i < allowedRayCounts.length; i++) {
            const distance = Math.abs(value - allowedRayCounts[i]);
            if (distance < minDistance) {
                minDistance = distance;
                nearestValue = allowedRayCounts[i];
            }
        }
        
        return nearestValue;
    }
    
    // Базовые лучи 
    const baseRays = {
        // Горизонтальные лучи (фиксированные)
        horizontal: [
            Math.PI, // Влево (180°)
            0       // Вправо (0° или 360°)
        ],
        // Вертикальный луч вверх (фиксированный)
        vertical: Math.PI * 1.5 // Вверх (270°)
    };
    
    // Параметры лучей и паттерна
    const params = {
        // Точка схода (центр)
        vanishingPoint: { x: 75, y: 75 },
        // Общая длина от центра до конца луча (фиксированная)
        totalLength: 75,
        // Длина луча (видимая часть после отступа)
        rayLength: parseInt(rayLengthSlider.value),
        // Отступ (расстояние от точки схода до начала луча)
        gap: parseInt(gapSlider.value),
        // Количество лучей
        rayCount: getNearestAllowedValue(parseInt(rayCountSlider.value)),
        // Масштаб
        scale: parseFloat(scaleSlider.value),
        // Толщина линии
        lineWidth: parseFloat(lineWidthSlider.value),
        // Цвет линии
        strokeColor: '#FFFFFF',
        // Базовые лучи
        baseRays: baseRays,
        // Круглые окончания линий
        roundCap: false,
        // Использование стандартного режима (когда false - используется Grid Mode)
        offsetRows: false,
        // Режим растрового градиента
        rasterMode: false,
        // Режим растрового изображения
        imageRasterMode: false,
        // Длина луча на левом краю (0%)
        zeroRayLength: 30,
        // Длина луча на правом краю (100%)
        hundredRayLength: 100,
        // Толщина линии на левом краю (0%)
        zeroLineWidth: 1.0,
        // Толщина линии на правом краю (100%)
        hundredLineWidth: 2.0,
        // Скрывать вертикальные разделители
        hideConnectingLines: false,
        // Контраст изображения
        brightnessContrast: 1.0,
        // Инвертировать изображение
        invertImage: false,
        // Исходное изображение
        sourceImage: null,
        // Кэш данных изображения
        imageData: null
    };
    
    // Устанавливаем totalLength как сумму gap и rayLength
    params.totalLength = params.gap + params.rayLength;
    
    // Устанавливаем начальные значения на слайдерах и в отображении
    rayCountSlider.value = params.rayCount;
    rayCountValueDisplay.textContent = params.rayCount;
    scaleValueDisplay.textContent = params.scale.toFixed(1);
    lineWidthValueDisplay.textContent = params.lineWidth.toFixed(1);
    zeroRayLengthSlider.value = params.zeroRayLength;
    zeroRayLengthValueDisplay.textContent = params.zeroRayLength;
    hundredRayLengthSlider.value = params.hundredRayLength;
    hundredRayLengthValueDisplay.textContent = params.hundredRayLength;
    zeroLineWidthSlider.value = params.zeroLineWidth;
    zeroLineWidthValueDisplay.textContent = params.zeroLineWidth.toFixed(1);
    hundredLineWidthSlider.value = params.hundredLineWidth;
    hundredLineWidthValueDisplay.textContent = params.hundredLineWidth.toFixed(1);
    
    // Устанавливаем состояние чекбоксов
    roundCapCheckbox.checked = params.roundCap;
    offsetRowsCheckbox.checked = params.offsetRows;
    rasterModeCheckbox.checked = params.rasterMode;
    imageRasterModeCheckbox.checked = params.imageRasterMode;
    hideConnectingLinesCheckbox.checked = params.hideConnectingLines;
    
    // Отрисовка первоначального состояния
    drawPattern();
    
    // Инициализация отображения элементов управления растром
    toggleRasterControls();
    toggleImageRasterControls();
    
    // Устанавливаем начальное состояние слайдеров градиента в соответствии с начальным состоянием чекбокса
    if (!params.rasterMode) {
        setSliderActive(zeroRayLengthSlider, false);
        setSliderActive(hundredRayLengthSlider, false);
    }
    
    // Обработчик для кнопки экспорта в SVG
    exportSvgBtn.addEventListener('click', exportToSvg);
    
    // Обработчики событий для слайдеров
    lineWidthSlider.addEventListener('input', function() {
        params.lineWidth = parseFloat(this.value);
        lineWidthValueDisplay.textContent = params.lineWidth.toFixed(1);
        drawPattern();
    });
    
    gapSlider.addEventListener('input', function() {
        params.gap = parseInt(this.value);
        gapValueDisplay.textContent = this.value;
        // Обновляем видимую длину луча, чтобы общая длина оставалась неизменной
        params.rayLength = params.totalLength - params.gap;
        // Обновляем слайдер rayLength и его значение на экране
        rayLengthSlider.value = params.rayLength;
        rayLengthValueDisplay.textContent = params.rayLength;
        drawPattern();
    });
    
    rayLengthSlider.addEventListener('input', function() {
        params.rayLength = parseInt(this.value);
        // Обновляем totalLength, чтобы конечная точка перемещалась
        params.totalLength = params.gap + params.rayLength;
        rayLengthValueDisplay.textContent = this.value;
        drawPattern();
    });
    
    rayCountSlider.addEventListener('input', function() {
        const rawValue = parseInt(this.value);
        const nearestValue = getNearestAllowedValue(rawValue);
        
        // Обновляем слайдер и отображение значением из разрешенного списка
        params.rayCount = nearestValue;
        rayCountValueDisplay.textContent = nearestValue;
        
        // Если значение отличается от исходного, корректируем положение слайдера
        if (rawValue !== nearestValue) {
            this.value = nearestValue;
        }
        
        drawPattern();
    });
    
    scaleSlider.addEventListener('input', function() {
        params.scale = parseFloat(this.value);
        scaleValueDisplay.textContent = params.scale.toFixed(1);
        drawPattern();
    });
    
    // Обработчик для чекбокса округлых окончаний линий
    roundCapCheckbox.addEventListener('change', function() {
        params.roundCap = this.checked;
        drawPattern();
    });
    
    // Обработчик для чекбокса режима сетки (Grid Mode)
    offsetRowsCheckbox.addEventListener('change', function() {
        params.offsetRows = this.checked;
        drawPattern();
    });
    
    // Добавляем функцию для управления активностью слайдеров
    function setSliderActive(slider, isActive) {
        // Получаем родительский контейнер для слайдера
        const sliderContainer = slider.closest('.control-group');
        
        if (!isActive) {
            // Отключаем слайдер
            slider.disabled = true;
            slider.classList.add('inactive-slider');
            if (sliderContainer) {
                sliderContainer.classList.add('inactive-slider-container');
            }
        } else {
            // Включаем слайдер
            slider.disabled = false;
            slider.classList.remove('inactive-slider');
            if (sliderContainer) {
                sliderContainer.classList.remove('inactive-slider-container');
            }
        }
    }
    
    // Обработчик для чекбокса скрытия вертикальных разделителей
    hideConnectingLinesCheckbox.addEventListener('change', function() {
        params.hideConnectingLines = this.checked;
        drawPattern();
    });
    
    // Обработчик для чекбокса режима растрового градиента
    rasterModeCheckbox.addEventListener('change', function() {
        params.rasterMode = this.checked;
        toggleRasterControls();
        
        // Отключаем/включаем слайдер Ray Length при включении/выключении режима растра
        setSliderActive(rayLengthSlider, !this.checked);
        
        drawPattern();
    });
    
    // Обработчик для слайдера 0% Ray Length
    zeroRayLengthSlider.addEventListener('input', function() {
        params.zeroRayLength = parseInt(this.value);
        zeroRayLengthValueDisplay.textContent = this.value;
        drawPattern();
    });
    
    // Обработчик для слайдера 100% Ray Length
    hundredRayLengthSlider.addEventListener('input', function() {
        params.hundredRayLength = parseInt(this.value);
        hundredRayLengthValueDisplay.textContent = this.value;
        drawPattern();
    });
    
    // Обработчик для слайдера 0% Line Width
    zeroLineWidthSlider.addEventListener('input', function() {
        params.zeroLineWidth = parseFloat(this.value);
        zeroLineWidthValueDisplay.textContent = params.zeroLineWidth.toFixed(1);
        drawPattern();
    });
    
    // Обработчик для слайдера 100% Line Width
    hundredLineWidthSlider.addEventListener('input', function() {
        params.hundredLineWidth = parseFloat(this.value);
        hundredLineWidthValueDisplay.textContent = params.hundredLineWidth.toFixed(1);
        drawPattern();
    });
    
    // Обработчик для кнопки сброса настроек
    resetBtn.addEventListener('click', resetSettings);
    
    // Функция отрисовки паттерна
    function drawPattern() {
        // Очистка канваса
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Заполняем канвас модулями паттерна
        fillCanvasWithPattern();
    }
    
    // Функция заполнения канваса паттерном
    function fillCanvasWithPattern() {
        // Вычисляем реальные размеры модуля с учетом масштаба
        const moduleWidth = baseModuleWidth * params.scale;
        const moduleHeight = baseModuleHeight * params.scale;
        const horizontalGap = baseHorizontalGap * params.scale;
        
        // Вертикальный отступ применяется только в режиме смещения нечетных строк
        const verticalGap = !params.offsetRows ? 10 * params.scale : baseVerticalGap * params.scale;
        
        // Вычисляем количество модулей, которые поместятся на канвасе
        const modulesInRow = Math.ceil(canvas.width / (moduleWidth + horizontalGap));
        const modulesInColumn = Math.ceil(canvas.height / (moduleHeight + verticalGap));
        
        // Вычисляем смещение для нечетных строк
        const rowOffset = !params.offsetRows ? (moduleWidth + horizontalGap) / 2 : 0;
        
        // Вычисляем общую ширину паттерна с учетом смещения
        // Если используется смещение строк, добавляем половину модуля для последней нечетной строки
        const extraWidth = !params.offsetRows && (modulesInColumn % 2 === 0) ? rowOffset : 0;
        const totalPatternWidth = modulesInRow * moduleWidth + (modulesInRow - 1) * horizontalGap + extraWidth;
        const totalPatternHeight = modulesInColumn * moduleHeight + (modulesInColumn - 1) * verticalGap;
        
        const offsetX = (canvas.width - totalPatternWidth) / 2;
        const offsetY = (canvas.height - totalPatternHeight) / 2;
        
        // Отрисовываем модули паттерна
        for (let row = 0; row < modulesInColumn; row++) {
            // Вычисляем смещение для текущей строки (нечетные строки смещаются)
            const currentRowOffset = (row % 2 === 1 && !params.offsetRows) ? rowOffset : 0;
            
            // Определяем, нужно ли добавить дополнительный модуль в нечетных строках
            const additionalModule = (row % 2 === 1 && !params.offsetRows) ? 1 : 0;
            const actualModulesInRow = modulesInRow + additionalModule;
            
            for (let col = 0; col < actualModulesInRow; col++) {
                // Вычисляем позицию модуля с учетом смещения строки
                const x = offsetX + currentRowOffset + col * (moduleWidth + horizontalGap);
                const y = offsetY + row * (moduleHeight + verticalGap);
                
                // Отрисовываем модуль только если он видим на холсте
                if (x < canvas.width && y < canvas.height && x + moduleWidth > 0 && y + moduleHeight > 0) {
                    // Относительная позиция для растрового режима
                    let relativeX = null;
                    if (params.rasterMode || params.imageRasterMode) {
                        // Вычисляем относительную позицию по X для всей ширины холста (от 0 до 1)
                        relativeX = Math.min(1, Math.max(0, x / canvas.width));
                    }
                    
                    // Отрисовываем модуль на этой позиции
                    drawModuleAt(x, y, relativeX, y);
                    
                    // Отрисовываем вертикальную линию между модулями,
                    // но только если это не последний модуль в ряду и не включен режим скрытия разделителей
                    if (col < actualModulesInRow - 1 && !params.hideConnectingLines) {
                        drawConnectingLine(x + moduleWidth, y);
                    }
                }
            }
        }
    }
    
    // Создаем функцию для расчета длины луча и толщины линии
    function calculateRayLengthAndLineWidth(params, relativeX, moduleY) {
        // Значения по умолчанию
        let rayLength = params.rayLength;
        let lineWidth = params.lineWidth;
        
        // Если включен режим растра и передана позиция, интерполируем длину и толщину
        if (params.rasterMode && relativeX !== undefined) {
            // Используем параметр rayLength как коэффициент масштабирования для значений zeroRayLength и hundredRayLength
            const baseRayLength = params.rayLength;
            const scaleFactor = baseRayLength / 56; // 56 - значение rayLength по умолчанию
            const zeroRayScaled = params.zeroRayLength * scaleFactor;
            const hundredRayScaled = params.hundredRayLength * scaleFactor;
            
            // Линейно интерполируем длину между масштабированными значениями
            rayLength = zeroRayScaled + relativeX * (hundredRayScaled - zeroRayScaled);
            
            // Линейно интерполируем толщину между значениями zeroLineWidth и hundredLineWidth
            lineWidth = params.zeroLineWidth + relativeX * (params.hundredLineWidth - params.zeroLineWidth);
        }
        // Если включен режим изображения и есть данные изображения
        else if (params.imageRasterMode && params.imageData && relativeX !== undefined) {
            // Получаем яркость пикселя в зависимости от относительной позиции
            const brightness = getPixelBrightness(params, relativeX, moduleY);
            
            // Используем параметр rayLength как коэффициент масштабирования для значений zeroRayLength и hundredRayLength
            const baseRayLength = params.rayLength;
            const scaleFactor = baseRayLength / 56; // 56 - значение rayLength по умолчанию
            const zeroRayScaled = params.zeroRayLength * scaleFactor;
            const hundredRayScaled = params.hundredRayLength * scaleFactor;
            
            // Инвертируем яркость, если изображение НЕ инвертировано (чтобы темные области соответствовали zeroRay)
            // Если изображение инвертировано - оставляем как есть, так как логика уже будет перевернута
            const adjustedBrightness = params.invertImage ? brightness : 1 - brightness;
            
            // Линейно интерполируем длину между масштабированными значениями в зависимости от яркости
            // 1 - adjustedBrightness инвертирует логику: теперь 0% соответствует темным областям, 100% - светлым
            rayLength = zeroRayScaled + adjustedBrightness * (hundredRayScaled - zeroRayScaled);
            
            // Линейно интерполируем толщину между значениями zeroLineWidth и hundredLineWidth
            lineWidth = params.zeroLineWidth + adjustedBrightness * (params.hundredLineWidth - params.zeroLineWidth);
        }
        
        return { rayLength, lineWidth };
    }
    
    // Функция для получения яркости пикселя из изображения
    function getPixelBrightness(params, relativeX, moduleY) {
        // Если нет изображения, возвращаем 0.5 (средняя яркость)
        if (!params.imageData) return 0.5;
        
        const { width, height, data } = params.imageData;
        
        // Определяем координаты пикселя в изображении
        const x = Math.floor(relativeX * (width - 1));
        const y = Math.floor((moduleY / canvas.height) * (height - 1));
        
        // Убедимся, что координаты в пределах изображения
        const safeX = Math.max(0, Math.min(width - 1, x));
        const safeY = Math.max(0, Math.min(height - 1, y));
        
        // Вычисляем индекс пикселя в массиве данных (каждый пиксель представлен 4 байтами: R, G, B, A)
        const pixelIndex = (safeY * width + safeX) * 4;
        
        // Получаем компоненты RGB
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        
        // Вычисляем яркость пикселя
        // Используем средневзвешенное значение RGB компонентов (стандартная формула для яркости)
        let brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Применяем контраст
        if (params.brightnessContrast !== 1.0) {
            // Настраиваем контраст: значения > 1 усиливают контраст, < 1 уменьшают
            brightness = 0.5 + (brightness - 0.5) * params.brightnessContrast;
            // Ограничиваем значение в диапазоне [0, 1]
            brightness = Math.max(0, Math.min(1, brightness));
        }
        
        return brightness;
    }
    
    // Функция отрисовки соединительной линии между модулями
    function drawConnectingLine(x, y) {
        // Размеры элементов с учетом масштаба
        const moduleWidth = baseModuleWidth * params.scale;
        const moduleHeight = baseModuleHeight * params.scale;
        const horizontalGap = baseHorizontalGap * params.scale;
        
        // Вычисляем относительную позицию для определения длины линии
        const relativeX = (params.rasterMode || params.imageRasterMode) ? x / canvas.width : undefined;
        
        // Получаем длину луча и толщину линии
        const { rayLength, lineWidth } = calculateRayLengthAndLineWidth(params, relativeX, y);
        
        // Вычисляем длину линии с учетом масштаба
        const lineLength = rayLength * params.scale;
        
        // Позиция X - по центру отступа
        const lineX = x + horizontalGap / 2;
        // Позиция Y - центр модуля по вертикали, с учетом длины линии
        const lineY = y + moduleHeight / 2 - lineLength / 2;
        
        // Сохранение контекста
        ctx.save();
        
        // Установка стилей рисования
        ctx.strokeStyle = params.strokeColor;
        ctx.lineWidth = lineWidth * params.scale;
        ctx.lineCap = params.roundCap ? 'round' : 'butt';
        
        // Рисуем вертикальную линию
        ctx.beginPath();
        ctx.moveTo(lineX, lineY);
        ctx.lineTo(lineX, lineY + lineLength);
        ctx.stroke();
        
        // Восстановление контекста
        ctx.restore();
    }
    
    // Функция отрисовки одного модуля паттерна в указанной позиции
    function drawModuleAt(x, y, relativeX, moduleY) {
        // Сохранение контекста
        ctx.save();
        
        // Размеры с учетом масштаба
        const vanishingPointX = params.vanishingPoint.x * params.scale;
        const vanishingPointY = params.vanishingPoint.y * params.scale;
        
        // Перемещение к позиции модуля
        ctx.translate(x, y);
        
        // Масштабирование контекста рисования для размера модуля
        ctx.scale(params.scale, params.scale);
        
        // Установка стилей рисования
        ctx.strokeStyle = params.strokeColor;
        ctx.lineWidth = params.lineWidth;
        ctx.lineCap = params.roundCap ? 'round' : 'butt';
        
        // Отрисовка модуля
        // В режиме растра передаем позицию для вычисления градиента
        if (params.rasterMode || params.imageRasterMode) {
            drawRays(params, relativeX, moduleY);
        } else {
            drawRays(params);
        }
        
        // Восстановление контекста
        ctx.restore();
    }
    
    // Обновляем функцию drawRays для использования общей функции
    function drawRays(params, relativeX, moduleY) {
        const { vanishingPoint, gap, rayCount, baseRays } = params;
        
        // Определяем длину луча и толщину линии
        const { rayLength, lineWidth } = calculateRayLengthAndLineWidth(params, relativeX, moduleY);
        
        // Устанавливаем текущую толщину линии
        ctx.lineWidth = lineWidth;
        
        // Рисуем горизонтальные лучи (фиксированные)
        baseRays.horizontal.forEach(angle => {
            drawRay(angle, rayLength, moduleY);
        });
        
        // Рисуем вертикальный луч (фиксированный)
        drawRay(baseRays.vertical, rayLength, moduleY);
        
        // Определяем количество лучей в верхнем полукруге
        // Вычитаем 3 базовых луча
        const upperRaysCount = rayCount - 3;
        
        if (upperRaysCount > 0) {
            // Специальный случай для 5 лучей (2 дополнительных) - диагонали под 45°
            if (rayCount === 5) {
                // Диагональ вверх-влево (225°)
                drawRay(Math.PI * 1.25, rayLength, moduleY);
                
                // Диагональ вверх-вправо (315°)
                drawRay(Math.PI * 1.75, rayLength, moduleY);
            } else {
                // Для остальных случаев равномерно распределяем лучи по верхнему полукругу
                // Верхний полукруг: от 180° до 360° (не включая горизонтальные)
                
                // Равномерно распределяем лучи в верхнем полукруге
                for (let i = 0; i < upperRaysCount; i++) {
                    // Интерполируем угол от π до 2π (от 180° до 360°)
                    const angle = Math.PI + (i + 1) * Math.PI / (upperRaysCount + 1);
                    drawRay(angle, rayLength, moduleY);
                }
            }
        }
        
        function drawRay(angle, rayLength, moduleY) {
            // Длина видимой части луча уже учитывает масштабирование в соответствии с градиентом, если режим активен
            
            // Начальная точка луча (с отступом от точки схода)
            const startX = vanishingPoint.x + Math.cos(angle) * gap;
            const startY = vanishingPoint.y + Math.sin(angle) * gap;
            
            // Вычисляем конечную точку на основе текущего rayLength, а не фиксированного totalLength
            // Это позволит правильно масштабировать лучи в режиме градиента
            const endX = vanishingPoint.x + Math.cos(angle) * (gap + rayLength);
            const endY = vanishingPoint.y + Math.sin(angle) * (gap + rayLength);
            
            // Рисуем луч
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }
    
    // Функция переключения элементов управления растром
    function toggleRasterControls() {
        // Получаем контейнер для слайдеров растра
        const rasterControlsRow = document.querySelector('.raster-controls-row');
        
        if (params.rasterMode) {
            // При активном режиме растра
            
            // Удаляем класс для неактивного режима
            if (rasterControlsRow) {
                rasterControlsRow.classList.remove('raster-mode-inactive');
            }
            
            // Добавляем класс active для родительского контейнера
            const rasterSliders = document.querySelector('.raster-sliders');
            if (rasterSliders) {
                rasterSliders.classList.add('active');
            }
            
            // Отключаем слайдер Ray Length
            setSliderActive(rayLengthSlider, false);
            
            // Включаем слайдеры градиента
            setSliderActive(zeroRayLengthSlider, true);
            setSliderActive(hundredRayLengthSlider, true);
            setSliderActive(zeroLineWidthSlider, true);
            setSliderActive(hundredLineWidthSlider, true);
            
            // Отключаем основные слайдеры
            setSliderActive(lineWidthSlider, false);
        } else {
            // При неактивном режиме растра
            
            // Добавляем класс для неактивного режима
            if (rasterControlsRow) {
                rasterControlsRow.classList.add('raster-mode-inactive');
            }
            
            // Удаляем класс active у родительского контейнера
            const rasterSliders = document.querySelector('.raster-sliders');
            if (rasterSliders) {
                rasterSliders.classList.remove('active');
            }
            
            // Включаем основные слайдеры
            setSliderActive(rayLengthSlider, true);
            setSliderActive(lineWidthSlider, true);
            
            // Отключаем слайдеры градиента
            setSliderActive(zeroRayLengthSlider, false);
            setSliderActive(hundredRayLengthSlider, false);
            setSliderActive(zeroLineWidthSlider, false);
            setSliderActive(hundredLineWidthSlider, false);
        }
    }
    
    // Функция переключения элементов управления изображением
    function toggleImageRasterControls() {
        // Показываем или скрываем элементы управления изображением
        if (params.imageRasterMode) {
            imageRasterControls.style.display = 'flex';
        } else {
            imageRasterControls.style.display = 'none';
        }
        
        // Если выбран режим растрового изображения
        if (params.imageRasterMode) {
            // Отключаем слайдер Ray Length
            setSliderActive(rayLengthSlider, false);
            
            // Включаем слайдеры градиента
            setSliderActive(zeroRayLengthSlider, true);
            setSliderActive(hundredRayLengthSlider, true);
            setSliderActive(zeroLineWidthSlider, true);
            setSliderActive(hundredLineWidthSlider, true);
            
            // Отключаем основной слайдер толщины линии
            setSliderActive(lineWidthSlider, false);
            
            // Если включаем режим изображения, выключаем режим градиента
            if (params.rasterMode) {
                params.rasterMode = false;
                rasterModeCheckbox.checked = false;
                toggleRasterControls();
            }
            
            // Показываем и активируем слайдеры градиента
            const rasterControlsRow = document.querySelector('.raster-controls-row');
            if (rasterControlsRow) {
                rasterControlsRow.classList.remove('raster-mode-inactive');
            }
            
            // Добавляем класс active для родительского контейнера
            const rasterSliders = document.querySelector('.raster-sliders');
            if (rasterSliders) {
                rasterSliders.classList.add('active');
            }
        } else {
            // Если режим растрового изображения выключен и не включен режим градиента
            if (!params.rasterMode) {
                // Включаем основные слайдеры
                setSliderActive(rayLengthSlider, true);
                setSliderActive(lineWidthSlider, true);
                
                // Отключаем слайдеры градиента
                setSliderActive(zeroRayLengthSlider, false);
                setSliderActive(hundredRayLengthSlider, false);
                setSliderActive(zeroLineWidthSlider, false);
                setSliderActive(hundredLineWidthSlider, false);
                
                // Добавляем класс для неактивного режима
                const rasterControlsRow = document.querySelector('.raster-controls-row');
                if (rasterControlsRow) {
                    rasterControlsRow.classList.add('raster-mode-inactive');
                }
                
                // Удаляем класс active у родительского контейнера
                const rasterSliders = document.querySelector('.raster-sliders');
                if (rasterSliders) {
                    rasterSliders.classList.remove('active');
                }
            }
        }
    }
    
    // Функция экспорта в SVG
    function exportToSvg() {
        // Создаем SVG элемент
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', canvas.width);
        svg.setAttribute('height', canvas.height);
        svg.setAttribute('xmlns', svgNS);
        
        // Вычисляем параметры для отрисовки
        const moduleWidth = baseModuleWidth * params.scale;
        const moduleHeight = baseModuleHeight * params.scale;
        const horizontalGap = baseHorizontalGap * params.scale;
        
        // Вертикальный отступ применяется только в режиме смещения нечетных строк
        const verticalGap = !params.offsetRows ? 10 * params.scale : baseVerticalGap * params.scale;
        
        // Вычисляем количество модулей
        const modulesInRow = Math.ceil(canvas.width / (moduleWidth + horizontalGap));
        const modulesInColumn = Math.ceil(canvas.height / (moduleHeight + verticalGap));
        
        // Вычисляем смещение для нечетных строк
        const rowOffset = !params.offsetRows ? (moduleWidth + horizontalGap) / 2 : 0;
        
        // Вычисляем общую ширину паттерна с учетом смещения
        const extraWidth = !params.offsetRows && (modulesInColumn % 2 === 0) ? rowOffset : 0;
        const totalPatternWidth = modulesInRow * moduleWidth + (modulesInRow - 1) * horizontalGap + extraWidth;
        const totalPatternHeight = modulesInColumn * moduleHeight + (modulesInColumn - 1) * verticalGap;
        
        const offsetX = (canvas.width - totalPatternWidth) / 2;
        const offsetY = (canvas.height - totalPatternHeight) / 2;
        
        // Отрисовываем модули
        for (let row = 0; row < modulesInColumn; row++) {
            // Вычисляем смещение для текущей строки (нечетные строки смещаются)
            const currentRowOffset = (row % 2 === 1 && !params.offsetRows) ? rowOffset : 0;
            
            // Определяем, нужно ли добавить дополнительный модуль в нечетных строках
            const additionalModule = (row % 2 === 1 && !params.offsetRows) ? 1 : 0;
            const actualModulesInRow = modulesInRow + additionalModule;
            
            for (let col = 0; col < actualModulesInRow; col++) {
                // Вычисляем позицию модуля с учетом смещения строки
                const x = offsetX + currentRowOffset + col * (moduleWidth + horizontalGap);
                const y = offsetY + row * (moduleHeight + verticalGap);
                
                // Отрисовываем модуль только если он видим
                if (x < canvas.width && y < canvas.height && x + moduleWidth > 0 && y + moduleHeight > 0) {
                    // Создаем группу для модуля
                    const moduleGroup = document.createElementNS(svgNS, 'g');
                    moduleGroup.setAttribute('transform', `translate(${x}, ${y})`);
                    
                    // Добавляем лучи к группе модуля
                    // В режиме растра передаем позицию для вычисления градиента
                    if (params.rasterMode || params.imageRasterMode) {
                        // Вычисляем относительную позицию по X для всей ширины холста (от 0 до 1)
                        const relativeX = Math.min(1, Math.max(0, x / canvas.width));
                        addRaysToSvg(moduleGroup, params, relativeX);
                    } else {
                        addRaysToSvg(moduleGroup, params);
                    }
                    
                    // Добавляем группу к SVG
                    svg.appendChild(moduleGroup);
                    
                    // Отрисовываем вертикальную линию между модулями
                    if (col < actualModulesInRow - 1 && !params.hideConnectingLines) {
                        addConnectingLineToSvg(svg, x + moduleWidth, y, horizontalGap, moduleHeight);
                    }
                }
            }
        }
        
        // Преобразуем SVG в строку
        const svgData = new XMLSerializer().serializeToString(svg);
        
        // Создаем Blob для сохранения
        const blob = new Blob([svgData], {type: 'image/svg+xml'});
        
        // Создаем ссылку для скачивания
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'ray_pattern.svg';
        
        // Имитируем клик по ссылке для скачивания
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Обновляем функцию addRaysToSvg для использования общей функции
    function addRaysToSvg(parentNode, params, relativeX) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const { vanishingPoint, gap, rayCount, baseRays, scale, roundCap } = params;
        
        // Вычисляем относительную позицию по горизонтали (0-1), если она указана
        const effectiveRelativeX = relativeX !== undefined ? relativeX : undefined;
        
        // Определяем длину луча и толщину линии
        const { rayLength, lineWidth } = calculateRayLengthAndLineWidth(params, effectiveRelativeX, undefined);
        
        // Рисуем горизонтальные лучи (фиксированные)
        baseRays.horizontal.forEach(angle => {
            addRayToSvg(angle, rayLength);
        });
        
        // Рисуем вертикальный луч (фиксированный)
        addRayToSvg(baseRays.vertical, rayLength);
        
        // Определяем количество лучей в верхнем полукруге
        const upperRaysCount = rayCount - 3;
        
        if (upperRaysCount > 0) {
            // Специальный случай для 5 лучей (2 дополнительных) - диагонали под 45°
            if (rayCount === 5) {
                // Диагональ вверх-влево (225°)
                addRayToSvg(Math.PI * 1.25, rayLength);
                
                // Диагональ вверх-вправо (315°)
                addRayToSvg(Math.PI * 1.75, rayLength);
            } else {
                // Равномерно распределяем лучи в верхнем полукруге
                for (let i = 0; i < upperRaysCount; i++) {
                    // Интерполируем угол от π до 2π (от 180° до 360°)
                    const angle = Math.PI + (i + 1) * Math.PI / (upperRaysCount + 1);
                    addRayToSvg(angle, rayLength);
                }
            }
        }
        
        function addRayToSvg(angle, rayLength) {
            // Длина видимой части луча уже учитывает масштабирование в соответствии с градиентом, если режим активен
            
            // Начальная точка луча (с отступом от точки схода)
            const startX = vanishingPoint.x * scale + Math.cos(angle) * gap * scale;
            const startY = vanishingPoint.y * scale + Math.sin(angle) * gap * scale;
            
            // Вычисляем конечную точку на основе текущего rayLength, а не фиксированного totalLength
            // Это позволит правильно масштабировать лучи в режиме градиента
            const endX = vanishingPoint.x * scale + Math.cos(angle) * (gap + rayLength) * scale;
            const endY = vanishingPoint.y * scale + Math.sin(angle) * (gap + rayLength) * scale;
            
            // Создаем линию
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', startX);
            line.setAttribute('y1', startY);
            line.setAttribute('x2', endX);
            line.setAttribute('y2', endY);
            line.setAttribute('stroke', '#000000'); // Черный цвет для SVG
            line.setAttribute('stroke-width', lineWidth * (scale < 1 ? 1 : scale));
            if (roundCap) {
                line.setAttribute('stroke-linecap', 'round');
            }
            
            // Добавляем линию к родительскому элементу
            parentNode.appendChild(line);
        }
    }
    
    // Обновляем функцию addConnectingLineToSvg для использования общей функции
    function addConnectingLineToSvg(parentNode, x, y, horizontalGap, moduleHeight) {
        const svgNS = 'http://www.w3.org/2000/svg';
        
        // Вычисляем относительную позицию
        const relativeX = (params.rasterMode || params.imageRasterMode) ? x / canvas.width : undefined;
        
        // Получаем длину луча и толщину линии
        const { rayLength, lineWidth } = calculateRayLengthAndLineWidth(params, relativeX, undefined);
        
        // Вычисляем длину линии
        const lineLength = rayLength * params.scale;
        
        // Позиция X - после модуля, по центру отступа
        const lineX = x + horizontalGap / 2;
        // Позиция Y - центр модуля по вертикали, с учетом длины линии
        const lineY = y + moduleHeight / 2 - lineLength / 2;
        
        // Создаем линию
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', lineX);
        line.setAttribute('y1', lineY);
        line.setAttribute('x2', lineX);
        line.setAttribute('y2', lineY + lineLength);
        line.setAttribute('stroke', '#000000'); // Черный цвет для SVG
        line.setAttribute('stroke-width', lineWidth * params.scale);
        if (params.roundCap) {
            line.setAttribute('stroke-linecap', 'round');
        }
        
        // Добавляем линию к родительскому элементу
        parentNode.appendChild(line);
    }
    
    // Функция сброса настроек к значениям по умолчанию
    function resetSettings() {
        // Сбрасываем значения слайдеров и чекбоксов
        lineWidthSlider.value = defaultValues.lineWidth;
        gapSlider.value = defaultValues.gap;
        rayLengthSlider.value = defaultValues.rayLength;
        rayCountSlider.value = defaultValues.rayCount;
        scaleSlider.value = defaultValues.scale;
        roundCapCheckbox.checked = defaultValues.roundCap;
        offsetRowsCheckbox.checked = defaultValues.offsetRows;
        rasterModeCheckbox.checked = defaultValues.rasterMode;
        imageRasterModeCheckbox.checked = defaultValues.imageRasterMode;
        hideConnectingLinesCheckbox.checked = defaultValues.hideConnectingLines;
        zeroRayLengthSlider.value = defaultValues.zeroRayLength;
        hundredRayLengthSlider.value = defaultValues.hundredRayLength;
        zeroLineWidthSlider.value = defaultValues.zeroLineWidth;
        hundredLineWidthSlider.value = defaultValues.hundredLineWidth;
        brightnessContrastSlider.value = defaultValues.brightnessContrast;
        imageInvertCheckbox.checked = defaultValues.invertImage;
        
        // Обновляем значения в объекте params
        params.lineWidth = defaultValues.lineWidth;
        params.gap = defaultValues.gap;
        params.rayLength = defaultValues.rayLength;
        params.rayCount = defaultValues.rayCount;
        params.scale = defaultValues.scale;
        params.roundCap = defaultValues.roundCap;
        params.offsetRows = defaultValues.offsetRows;
        params.rasterMode = defaultValues.rasterMode;
        params.imageRasterMode = defaultValues.imageRasterMode;
        params.hideConnectingLines = defaultValues.hideConnectingLines;
        params.zeroRayLength = defaultValues.zeroRayLength;
        params.hundredRayLength = defaultValues.hundredRayLength;
        params.zeroLineWidth = defaultValues.zeroLineWidth;
        params.hundredLineWidth = defaultValues.hundredLineWidth;
        params.totalLength = params.gap + params.rayLength;
        params.brightnessContrast = defaultValues.brightnessContrast;
        params.invertImage = defaultValues.invertImage;
        
        // Сбрасываем данные изображения
        params.sourceImage = null;
        params.imageData = null;
        
        // Сбрасываем предпросмотр изображения
        imagePreview.src = '#';
        imagePreview.style.display = 'none';
        
        // Обновляем отображаемые значения
        lineWidthValueDisplay.textContent = defaultValues.lineWidth.toFixed(1);
        gapValueDisplay.textContent = defaultValues.gap;
        rayLengthValueDisplay.textContent = defaultValues.rayLength;
        rayCountValueDisplay.textContent = defaultValues.rayCount;
        scaleValueDisplay.textContent = defaultValues.scale.toFixed(1);
        zeroRayLengthValueDisplay.textContent = defaultValues.zeroRayLength;
        hundredRayLengthValueDisplay.textContent = defaultValues.hundredRayLength;
        zeroLineWidthValueDisplay.textContent = defaultValues.zeroLineWidth.toFixed(1);
        hundredLineWidthValueDisplay.textContent = defaultValues.hundredLineWidth.toFixed(1);
        brightnessContrastValueDisplay.textContent = defaultValues.brightnessContrast.toFixed(1);
        
        // Включаем слайдер Ray Length и Line Width (они могли быть отключены в режиме растра)
        setSliderActive(rayLengthSlider, true);
        setSliderActive(lineWidthSlider, true);
        
        // Обновляем видимость элементов управления
        toggleRasterControls();
        toggleImageRasterControls();
        
        // Устанавливаем состояние слайдеров градиента в зависимости от режима растра
        if (!defaultValues.rasterMode) {
            setSliderActive(zeroRayLengthSlider, false);
            setSliderActive(hundredRayLengthSlider, false);
            setSliderActive(zeroLineWidthSlider, false);
            setSliderActive(hundredLineWidthSlider, false);
        } else {
            setSliderActive(zeroRayLengthSlider, true);
            setSliderActive(hundredRayLengthSlider, true);
            setSliderActive(zeroLineWidthSlider, true);
            setSliderActive(hundredLineWidthSlider, true);
        }
        
        // Перерисовываем паттерн
        drawPattern();
    }
    
    // Обработчик для чекбокса режима изображения
    imageRasterModeCheckbox.addEventListener('change', function() {
        params.imageRasterMode = this.checked;
        
        // Если включаем режим изображения, выключаем режим градиента
        if (params.imageRasterMode && params.rasterMode) {
            params.rasterMode = false;
            rasterModeCheckbox.checked = false;
        }
        
        toggleRasterControls();
        toggleImageRasterControls();
        drawPattern();
    });
    
    // Обработчик для загрузки изображения
    imageUpload.addEventListener('change', function(event) {
        const file = event.target.files[0];
        
        if (file && file.type.match('image.*')) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
                
                // Загружаем изображение в объект Image для дальнейшего использования
                params.sourceImage = new Image();
                params.sourceImage.onload = function() {
                    // Создаем временный canvas для получения данных изображения
                    // с размерами соответствующими канвасу
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    // Рисуем изображение на временном canvas
                    // растягивая его на весь канвас
                    tempCtx.drawImage(params.sourceImage, 0, 0, canvas.width, canvas.height);
                    
                    // Получаем данные изображения в размере канваса
                    params.imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    // Перерисовываем паттерн с использованием изображения
                    drawPattern();
                };
                params.sourceImage.src = e.target.result;
            };
            
            reader.readAsDataURL(file);
        }
    });
    
    // Обработчик для слайдера контрастности изображения
    brightnessContrastSlider.addEventListener('input', function() {
        params.brightnessContrast = parseFloat(this.value);
        brightnessContrastValueDisplay.textContent = params.brightnessContrast.toFixed(1);
        drawPattern();
    });
    
    // Обработчик для чекбокса инвертирования изображения
    imageInvertCheckbox.addEventListener('change', function() {
        params.invertImage = this.checked;
        drawPattern();
    });
}); 