import { buildRaysScene } from './engine/scene.js?layout=root-infra-1';
import { paintRaysScene, raysSvgElement } from './engine/renderers.js';
import { mountGenerator, connectFileInput } from '../infra/framework/src/ui/GeneratorHost.js?v=4';

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
    const horizontalGapSlider = document.getElementById('horizontalGapSlider');
    const verticalGapSlider = document.getElementById('verticalGapSlider');
    const horizontalGapValueDisplay = document.getElementById('horizontalGapValue');
    const verticalGapValueDisplay = document.getElementById('verticalGapValue');
    
    // Элементы для восстановления настроек
    const settingsInput = document.getElementById('settingsInput');
    const restoreSettingsBtn = document.getElementById('restoreSettingsBtn');
    
    // Проверка наличия элементов и добавление обработчиков
    if (settingsInput && restoreSettingsBtn) {
        console.log('Settings elements found successfully');
        
        // Обработчик для кнопки восстановления настроек
        restoreSettingsBtn.addEventListener('click', function() {
            console.log('Restore button clicked');
            const fileName = settingsInput.value.trim();
            if (fileName) {
                restoreSettingsFromFileName(fileName);
            }
        });
        
        // Обработчик для поля ввода, чтобы восстанавливать настройки при нажатии Enter
        settingsInput.addEventListener('keyup', function(event) {
            console.log('Key pressed:', event.key);
            if (event.key === 'Enter') {
                const fileName = this.value.trim();
                if (fileName) {
                    restoreSettingsFromFileName(fileName);
                }
            }
        });
    } else {
        console.error('Settings elements not found:', {
            settingsInput: !!settingsInput,
            restoreSettingsBtn: !!restoreSettingsBtn
        });
    }
    
    // Определяем, какую операционную систему использует пользователь
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const hotkeySymbol = isMac ? '⌘E' : 'Ctrl+E';
    
    // Обновляем текст кнопки с нужным сочетанием клавиш
    exportSvgBtn.textContent = `Export SVG (${hotkeySymbol})`;
    
    // Добавляем обработчик клавиатурных сокращений
    
    // Разрешенные значения для количества лучей
    const allowedRayCounts = [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24];
    
    // Базовые настройки размеров модуля и отступов
    const baseModuleWidth = 150;
    const baseModuleHeight = 75;
    
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
        invertImage: false,
        horizontalGap: 20,
        verticalGap: 10
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
        // Горизонтальное расстояние между модулями
        horizontalGap: parseInt(horizontalGapSlider.value),
        // Вертикальное расстояние между модулями
        verticalGap: parseInt(verticalGapSlider.value),
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
    horizontalGapSlider.value = params.horizontalGap;
    horizontalGapValueDisplay.textContent = params.horizontalGap;
    verticalGapSlider.value = params.verticalGap;
    verticalGapValueDisplay.textContent = params.verticalGap;
    
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
    
    // Функции для работы с localStorage
    function saveSettingsToLocalStorage() {
        // Создаем объект с текущими настройками
        const settingsToSave = {
            lineWidth: params.lineWidth,
            gap: params.gap,
            rayLength: params.rayLength,
            rayCount: params.rayCount,
            scale: params.scale,
            roundCap: params.roundCap,
            offsetRows: params.offsetRows,
            rasterMode: params.rasterMode,
            imageRasterMode: params.imageRasterMode,
            zeroRayLength: params.zeroRayLength,
            hundredRayLength: params.hundredRayLength,
            zeroLineWidth: params.zeroLineWidth,
            hundredLineWidth: params.hundredLineWidth,
            hideConnectingLines: params.hideConnectingLines,
            brightnessContrast: params.brightnessContrast,
            invertImage: params.invertImage,
            horizontalGap: params.horizontalGap,
            verticalGap: params.verticalGap
        };
        
        // Сохраняем в localStorage
        try {
            localStorage.setItem('upgrade:rays-pattern:settings:v1', JSON.stringify(settingsToSave));
            console.log('Settings saved to localStorage');
        } catch (error) {
            console.error('Failed to save settings to localStorage:', error);
        }
    }
    
    function loadSettingsFromLocalStorage() {
        try {
            // Получаем сохраненные настройки из localStorage
            const savedSettings = localStorage.getItem('upgrade:rays-pattern:settings:v1');
            
            if (savedSettings) {
                // Преобразуем JSON строку в объект
                const parsedSettings = JSON.parse(savedSettings);
                console.log('Settings loaded from localStorage');
                
                // Применяем загруженные настройки
                applyRestoredSettings(parsedSettings);
            }
        } catch (error) {
            console.error('Failed to load settings from localStorage:', error);
        }
    }
    
    // Добавляем автоматическое сохранение после каждого изменения настроек
    function updateAndSave() {
        drawPattern();
        saveSettingsToLocalStorage();
    }
    
    // Загружаем настройки при инициализации
    loadSettingsFromLocalStorage();
    
    // Обработчики событий для слайдеров с сохранением
    lineWidthSlider.addEventListener('input', function() {
        params.lineWidth = parseFloat(this.value);
        lineWidthValueDisplay.textContent = params.lineWidth.toFixed(1);
        drawPattern();
    });
    
    lineWidthSlider.addEventListener('change', saveSettingsToLocalStorage);
    
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
    
    gapSlider.addEventListener('change', saveSettingsToLocalStorage);
    
    rayLengthSlider.addEventListener('input', function() {
        params.rayLength = parseInt(this.value);
        // Обновляем totalLength, чтобы конечная точка перемещалась
        params.totalLength = params.gap + params.rayLength;
        rayLengthValueDisplay.textContent = this.value;
        drawPattern();
    });
    
    rayLengthSlider.addEventListener('change', saveSettingsToLocalStorage);
    
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
    
    rayCountSlider.addEventListener('change', saveSettingsToLocalStorage);
    
    scaleSlider.addEventListener('input', function() {
        params.scale = parseFloat(this.value);
        scaleValueDisplay.textContent = params.scale.toFixed(1);
        drawPattern();
    });
    
    scaleSlider.addEventListener('change', saveSettingsToLocalStorage);
    
    // Обработчики для чекбоксов с сохранением
    roundCapCheckbox.addEventListener('change', function() {
        params.roundCap = this.checked;
        drawPattern();
        saveSettingsToLocalStorage();
    });
    
    offsetRowsCheckbox.addEventListener('change', function() {
        params.offsetRows = this.checked;
        drawPattern();
        saveSettingsToLocalStorage();
    });
    
    hideConnectingLinesCheckbox.addEventListener('change', function() {
        params.hideConnectingLines = this.checked;
        drawPattern();
        saveSettingsToLocalStorage();
    });
    
    rasterModeCheckbox.addEventListener('change', function() {
        params.rasterMode = this.checked;
        if (params.rasterMode) {
            params.imageRasterMode = false;
            imageRasterModeCheckbox.checked = false;
            toggleImageRasterControls();
        }
        toggleRasterControls();
        
        // Отключаем/включаем слайдер Line Length при включении/выключении режима растра
        setSliderActive(rayLengthSlider, !this.checked);
        
        drawPattern();
        saveSettingsToLocalStorage();
    });
    
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
        saveSettingsToLocalStorage();
    });
    
    // Обработчики для слайдеров растра с сохранением
    zeroRayLengthSlider.addEventListener('input', function() {
        params.zeroRayLength = parseInt(this.value);
        zeroRayLengthValueDisplay.textContent = this.value;
        drawPattern();
    });
    
    zeroRayLengthSlider.addEventListener('change', saveSettingsToLocalStorage);
    
    hundredRayLengthSlider.addEventListener('input', function() {
        params.hundredRayLength = parseInt(this.value);
        hundredRayLengthValueDisplay.textContent = this.value;
        drawPattern();
    });
    
    hundredRayLengthSlider.addEventListener('change', saveSettingsToLocalStorage);
    
    zeroLineWidthSlider.addEventListener('input', function() {
        params.zeroLineWidth = parseFloat(this.value);
        zeroLineWidthValueDisplay.textContent = params.zeroLineWidth.toFixed(1);
        drawPattern();
    });
    
    zeroLineWidthSlider.addEventListener('change', saveSettingsToLocalStorage);
    
    hundredLineWidthSlider.addEventListener('input', function() {
        params.hundredLineWidth = parseFloat(this.value);
        hundredLineWidthValueDisplay.textContent = params.hundredLineWidth.toFixed(1);
        drawPattern();
    });
    
    hundredLineWidthSlider.addEventListener('change', saveSettingsToLocalStorage);
    
    horizontalGapSlider.addEventListener('input', function() {
        params.horizontalGap = parseInt(this.value);
        horizontalGapValueDisplay.textContent = params.horizontalGap;
        drawPattern();
    });
    
    horizontalGapSlider.addEventListener('change', saveSettingsToLocalStorage);
    
    verticalGapSlider.addEventListener('input', function() {
        params.verticalGap = parseInt(this.value);
        verticalGapValueDisplay.textContent = params.verticalGap;
        drawPattern();
    });
    
    verticalGapSlider.addEventListener('change', saveSettingsToLocalStorage);
    
    brightnessContrastSlider.addEventListener('input', function() {
        params.brightnessContrast = parseFloat(this.value);
        brightnessContrastValueDisplay.textContent = params.brightnessContrast.toFixed(1);
        drawPattern();
    });
    
    brightnessContrastSlider.addEventListener('change', saveSettingsToLocalStorage);
    
    imageInvertCheckbox.addEventListener('change', function() {
        params.invertImage = this.checked;
        drawPattern();
        saveSettingsToLocalStorage();
    });
    
    // Модифицируем функцию сброса настроек для очистки localStorage
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
        horizontalGapSlider.value = defaultValues.horizontalGap;
        verticalGapSlider.value = defaultValues.verticalGap;
        
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
        params.horizontalGap = defaultValues.horizontalGap;
        params.verticalGap = defaultValues.verticalGap;
        
        // Сбрасываем данные изображения
        params.sourceImage = null;
        params.imageData = null;
        
        // Сбрасываем предпросмотр изображения
        imagePreview.removeAttribute('src');
        imagePreview.style.display = 'none';
        imageIntake.reset();
        
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
        horizontalGapValueDisplay.textContent = defaultValues.horizontalGap;
        verticalGapValueDisplay.textContent = defaultValues.verticalGap;
        
        // Включаем слайдер Line Length и Line Width (они могли быть отключены в режиме растра)
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
        
        // Очищаем localStorage
        try {
            localStorage.removeItem('upgrade:rays-pattern:settings:v1');
            console.log('Settings cleared from localStorage');
        } catch (error) {
            console.error('Failed to clear settings from localStorage:', error);
        }
    }
    
    // Обработчик для кнопки сброса настроек
    resetBtn.addEventListener('click', resetSettings);
    
    function scene() {
        return buildRaysScene(params, { width: canvas.width, height: canvas.height, imageData: params.imageData });
    }

    function drawPattern() {
        paintRaysScene(ctx, scene(), params.strokeColor);
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
            
            // Отключаем слайдер Line Length
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
            // Отключаем слайдер Line Length
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
        const svg = raysSvgElement(scene(), document);

        // Преобразуем SVG в строку
        const svgData = new XMLSerializer().serializeToString(svg);
        
        // Создаем Blob для сохранения
        const blob = new Blob([svgData], {type: 'image/svg+xml'});
        
        // Создаем имя файла с параметрами
        const fileName = generateFileNameWithParams();
        
        // Создаем ссылку для скачивания
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        
        // Имитируем клик по ссылке для скачивания
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }
    
    // Функция для генерации имени файла с параметрами
    function generateFileNameWithParams() {
        // Базовое имя файла
        let fileName = 'ray_pattern';
        
        // Добавляем основные параметры
        fileName += `_lw${params.lineWidth.toFixed(1)}`;  // Line Width
        fileName += `_ll${params.rayLength}`;             // Line Length
        fileName += `_lc${params.rayCount}`;              // Line Count
        fileName += `_co${params.gap}`;                   // Center Offset
        fileName += `_sc${params.scale.toFixed(1)}`;      // Scale
        
        // Добавляем настройки отступов между модулями
        fileName += `_hg${params.horizontalGap}`;         // Horizontal Gap
        fileName += `_vg${params.verticalGap}`;           // Vertical Gap
        
        // Добавляем флаги для чекбоксов
        if (params.roundCap) fileName += '_rc1';          // Round Caps
        if (params.offsetRows) fileName += '_cm1';        // Classic Mode
        if (params.hideConnectingLines) fileName += '_hd1';  // Hide Dividers
        
        // Добавляем параметры растра, если режим растра активен
        if (params.rasterMode || params.imageRasterMode) {
            if (params.rasterMode) fileName += '_rm1';     // Raster Mode
            fileName += `_hl${params.zeroRayLength}`;     // Highlights Length
            fileName += `_hw${params.zeroLineWidth.toFixed(1)}`; // Highlights Width
            fileName += `_sl${params.hundredRayLength}`;  // Shadows Length
            fileName += `_sw${params.hundredLineWidth.toFixed(1)}`; // Shadows Width
        }
        
        // Добавляем параметры растрового изображения, если режим активен
        if (params.imageRasterMode) {
            fileName += '_im1';                           // Image Mode
            fileName += `_ct${params.brightnessContrast.toFixed(1)}`; // Contrast
            if (params.invertImage) fileName += '_iv1';   // Invert
        }
        
        // Добавляем расширение файла
        fileName += '.svg';
        
        return fileName;
    }
    
    function restoreSettingsFromFileName(fileName) {
        // Удаляем расширение файла, если оно есть
        fileName = fileName.replace(/\.svg$/i, '');
        
        // Объект для хранения восстановленных настроек
        const restoredSettings = {};
        
        // Парсим основные параметры
        const lineWidthMatch = fileName.match(/_lw([\d.]+)/);
        if (lineWidthMatch) restoredSettings.lineWidth = parseFloat(lineWidthMatch[1]);
        
        const lineLengthMatch = fileName.match(/_ll(\d+)/);
        if (lineLengthMatch) restoredSettings.rayLength = parseInt(lineLengthMatch[1]);
        
        const lineCountMatch = fileName.match(/_lc(\d+)/);
        if (lineCountMatch) restoredSettings.rayCount = parseInt(lineCountMatch[1]);
        
        const centerOffsetMatch = fileName.match(/_co(\d+)/);
        if (centerOffsetMatch) restoredSettings.gap = parseInt(centerOffsetMatch[1]);
        
        const scaleMatch = fileName.match(/_sc([\d.]+)/);
        if (scaleMatch) restoredSettings.scale = parseFloat(scaleMatch[1]);
        
        const horizontalGapMatch = fileName.match(/_hg(\d+)/);
        if (horizontalGapMatch) restoredSettings.horizontalGap = parseInt(horizontalGapMatch[1]);
        
        const verticalGapMatch = fileName.match(/_vg(\d+)/);
        if (verticalGapMatch) restoredSettings.verticalGap = parseInt(verticalGapMatch[1]);
        
        // Парсим булевы параметры
        restoredSettings.roundCap = fileName.includes('_rc1');
        restoredSettings.offsetRows = fileName.includes('_cm1');
        restoredSettings.hideConnectingLines = fileName.includes('_hd1');
        
        // Парсим параметры растра
        restoredSettings.rasterMode = fileName.includes('_rm1');
        
        if (restoredSettings.rasterMode || fileName.includes('_im1')) {
            const highlightsLengthMatch = fileName.match(/_hl(\d+)/);
            if (highlightsLengthMatch) restoredSettings.zeroRayLength = parseInt(highlightsLengthMatch[1]);
            
            const highlightsWidthMatch = fileName.match(/_hw([\d.]+)/);
            if (highlightsWidthMatch) restoredSettings.zeroLineWidth = parseFloat(highlightsWidthMatch[1]);
            
            const shadowsLengthMatch = fileName.match(/_sl(\d+)/);
            if (shadowsLengthMatch) restoredSettings.hundredRayLength = parseInt(shadowsLengthMatch[1]);
            
            const shadowsWidthMatch = fileName.match(/_sw([\d.]+)/);
            if (shadowsWidthMatch) restoredSettings.hundredLineWidth = parseFloat(shadowsWidthMatch[1]);
        }
        
        // Парсим параметры растрового изображения
        restoredSettings.imageRasterMode = fileName.includes('_im1');
        
        if (restoredSettings.imageRasterMode) {
            const contrastMatch = fileName.match(/_ct([\d.]+)/);
            if (contrastMatch) restoredSettings.brightnessContrast = parseFloat(contrastMatch[1]);
            
            restoredSettings.invertImage = fileName.includes('_iv1');
        }
        
        // Применяем восстановленные настройки
        applyRestoredSettings(restoredSettings);
    }
    
    // Функция для применения восстановленных настроек
    function applyRestoredSettings(settings) {
        // Применяем числовые параметры только если они были найдены в имени файла
        if (settings.lineWidth !== undefined) {
            params.lineWidth = settings.lineWidth;
            lineWidthSlider.value = settings.lineWidth;
            lineWidthValueDisplay.textContent = settings.lineWidth.toFixed(1);
        }
        
        if (settings.rayLength !== undefined) {
            params.rayLength = settings.rayLength;
            rayLengthSlider.value = settings.rayLength;
            rayLengthValueDisplay.textContent = settings.rayLength;
        }
        
        if (settings.rayCount !== undefined) {
            params.rayCount = settings.rayCount;
            rayCountSlider.value = settings.rayCount;
            rayCountValueDisplay.textContent = settings.rayCount;
        }
        
        if (settings.gap !== undefined) {
            params.gap = settings.gap;
            gapSlider.value = settings.gap;
            gapValueDisplay.textContent = settings.gap;
        }
        
        if (settings.scale !== undefined) {
            params.scale = settings.scale;
            scaleSlider.value = settings.scale;
            scaleValueDisplay.textContent = settings.scale.toFixed(1);
        }
        
        if (settings.horizontalGap !== undefined) {
            params.horizontalGap = settings.horizontalGap;
            horizontalGapSlider.value = settings.horizontalGap;
            horizontalGapValueDisplay.textContent = settings.horizontalGap;
        }
        
        if (settings.verticalGap !== undefined) {
            params.verticalGap = settings.verticalGap;
            verticalGapSlider.value = settings.verticalGap;
            verticalGapValueDisplay.textContent = settings.verticalGap;
        }
        
        // Применяем булевы параметры
        params.roundCap = settings.roundCap;
        roundCapCheckbox.checked = settings.roundCap;
        
        params.offsetRows = settings.offsetRows;
        offsetRowsCheckbox.checked = settings.offsetRows;
        
        params.hideConnectingLines = settings.hideConnectingLines;
        hideConnectingLinesCheckbox.checked = settings.hideConnectingLines;
        
        // Применяем настройки растра
        params.rasterMode = settings.rasterMode;
        rasterModeCheckbox.checked = settings.rasterMode;
        
        if ((settings.rasterMode || settings.imageRasterMode) && settings.zeroRayLength !== undefined) {
            params.zeroRayLength = settings.zeroRayLength;
            zeroRayLengthSlider.value = settings.zeroRayLength;
            zeroRayLengthValueDisplay.textContent = settings.zeroRayLength;
        }
        
        if ((settings.rasterMode || settings.imageRasterMode) && settings.zeroLineWidth !== undefined) {
            params.zeroLineWidth = settings.zeroLineWidth;
            zeroLineWidthSlider.value = settings.zeroLineWidth;
            zeroLineWidthValueDisplay.textContent = settings.zeroLineWidth.toFixed(1);
        }
        
        if ((settings.rasterMode || settings.imageRasterMode) && settings.hundredRayLength !== undefined) {
            params.hundredRayLength = settings.hundredRayLength;
            hundredRayLengthSlider.value = settings.hundredRayLength;
            hundredRayLengthValueDisplay.textContent = settings.hundredRayLength;
        }
        
        if ((settings.rasterMode || settings.imageRasterMode) && settings.hundredLineWidth !== undefined) {
            params.hundredLineWidth = settings.hundredLineWidth;
            hundredLineWidthSlider.value = settings.hundredLineWidth;
            hundredLineWidthValueDisplay.textContent = settings.hundredLineWidth.toFixed(1);
        }
        
        // Применяем настройки растрового изображения
        params.imageRasterMode = settings.imageRasterMode;
        imageRasterModeCheckbox.checked = settings.imageRasterMode;
        
        if (settings.imageRasterMode && settings.brightnessContrast !== undefined) {
            params.brightnessContrast = settings.brightnessContrast;
            brightnessContrastSlider.value = settings.brightnessContrast;
            brightnessContrastValueDisplay.textContent = settings.brightnessContrast.toFixed(1);
        }
        
        if (settings.imageRasterMode) {
            params.invertImage = settings.invertImage;
            imageInvertCheckbox.checked = settings.invertImage;
        }
        
        params.totalLength = params.gap + params.rayLength;
        // Обновляем отображение элементов управления
        toggleRasterControls();
        toggleImageRasterControls();
        
        // Перерисовываем паттерн с новыми настройками
        drawPattern();
    }
    
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
    
    // Обработчик для загрузки изображения
    const imageIntake = connectFileInput({ input: imageUpload, onSelect: (file, { controller }) => new Promise((resolve, reject) => {
        const operationId = controller.operationId;
        
        if (file && file.type.match('image.*')) {
            const reader = new FileReader();
            
            reader.onerror = () => reject(new Error('Could not read the image.'));
            reader.onload = function(e) {
                
                // Загружаем изображение в объект Image для дальнейшего использования
                const decoded = new Image();
                decoded.onerror = () => reject(new Error('Could not decode the image.'));
                decoded.onload = function() {
                    try {
                    if (!controller.bound || controller.operationId !== operationId) { reject(new Error('Cancelled')); return; }
                    // Создаем временный canvas для получения данных изображения
                    // с размерами соответствующими канвасу
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    // Рисуем изображение на временном canvas
                    // растягивая его на весь канвас
                    tempCtx.drawImage(decoded, 0, 0, canvas.width, canvas.height);
                    
                    // Получаем данные изображения в размере канваса
                    params.imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
                    params.sourceImage = decoded;
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                    
                    // Перерисовываем паттерн с использованием изображения
                    drawPattern();
                    // Сохраняем настройки после загрузки изображения
                    saveSettingsToLocalStorage();
                    resolve();
                    } catch (error) { reject(error); }
                };
                decoded.src = e.target.result;
            };
            
            reader.readAsDataURL(file);
        } else reject(new Error('Choose an image.'));
    }), onRemove: () => {
        params.sourceImage = null; params.imageData = null;
        imagePreview.removeAttribute('src'); imagePreview.style.display = 'none';
        drawPattern();
    } });
    mountGenerator({
        id: 'rays_pattern_generator', title: 'Rays Pattern',
        panels: [
            { title: 'Pattern', selectors: ['.pattern-sliders', '.checkboxes-section'], summary: () => `${params.rayCount} · ${params.rayLength}×${params.lineWidth}` },
            { title: 'Tone', selectors: ['.raster-controls-row', '#imageRasterControls'], summary: () => params.imageRasterMode ? 'Image' : params.rasterMode ? 'Gradient' : 'Uniform' },
            { title: 'Settings', selectors: ['.settings-recovery-section', '#resetBtn'] }
        ],
        actions: [{ id: 'svg', button: 'exportSvgBtn', label: 'SVG', kind: 'export', group: 'primary', shortcut: 'mod+e', run: exportToSvg }]
    });
});
