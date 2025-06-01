document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('patternCanvas');
    const ctx = canvas.getContext('2d');
    
    // Элементы управления
    const lineWidthSlider = document.getElementById('lineWidthSlider');
    const lineLengthSlider = document.getElementById('lineLengthSlider');
    const lineCountSlider = document.getElementById('lineCountSlider');
    const scaleSlider = document.getElementById('scaleSlider');
    const safeFieldSlider = document.getElementById('safeFieldSlider');
    const zeroLineLengthSlider = document.getElementById('zeroLineLengthSlider');
    const hundredLineLengthSlider = document.getElementById('hundredLineLengthSlider');
    const zeroLineWidthSlider = document.getElementById('zeroLineWidthSlider');
    const hundredLineWidthSlider = document.getElementById('hundredLineWidthSlider');
    const exportSvgBtn = document.getElementById('exportSvgBtn');
    const resetBtn = document.getElementById('resetBtn');
    const generateBtn = document.getElementById('generateBtn');
    const roundCapCheckbox = document.getElementById('roundCapCheckbox');
    const rasterModeCheckbox = document.getElementById('rasterModeCheckbox');
    const imageRasterModeCheckbox = document.getElementById('imageRasterModeCheckbox');
    const lineWidthValueDisplay = document.getElementById('lineWidthValue');
    const lineLengthValueDisplay = document.getElementById('lineLengthValue');
    const lineCountValueDisplay = document.getElementById('lineCountValue');
    const scaleValueDisplay = document.getElementById('scaleValue');
    const safeFieldValueDisplay = document.getElementById('safeFieldValue');
    const zeroLineLengthValueDisplay = document.getElementById('zeroLineLengthValue');
    const hundredLineLengthValueDisplay = document.getElementById('hundredLineLengthValue');
    const zeroLineWidthValueDisplay = document.getElementById('zeroLineWidthValue');
    const hundredLineWidthValueDisplay = document.getElementById('hundredLineWidthValue');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const imageRasterControls = document.getElementById('imageRasterControls');
    const imageInvertCheckbox = document.getElementById('imageInvertCheckbox');
    const brightnessContrastSlider = document.getElementById('brightnessContrastSlider');
    const brightnessContrastValueDisplay = document.getElementById('brightnessContrastValue');
    
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
    }
    
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
    
    // Массив для хранения сгенерированных линий
    let lines = [];
    
    // Цвет линий
    const strokeColor = '#FFFFFF';
    
    // Значения по умолчанию для сброса
    const defaultValues = {
        lineWidth: 8,
        lineLength: 12,
        lineCount: 3000,
        scale: 1.0,
        safeField: 12,
        roundCap: false,
        rasterMode: false,
        imageRasterMode: false,
        zeroLineLength: 30,
        hundredLineLength: 100,
        zeroLineWidth: 1.0,
        hundredLineWidth: 2.0,
        brightnessContrast: 1.0,
        invertImage: false
    };
    
    // Текущие параметры
    const params = {
        lineWidth: parseFloat(lineWidthSlider.value),
        lineLength: parseInt(lineLengthSlider.value),
        lineCount: parseInt(lineCountSlider.value),
        scale: parseFloat(scaleSlider.value),
        safeField: parseInt(safeFieldSlider.value),
        roundCap: false,
        rasterMode: false,
        imageRasterMode: false,
        zeroLineLength: parseInt(zeroLineLengthSlider.value),
        hundredLineLength: parseInt(hundredLineLengthSlider.value),
        zeroLineWidth: parseFloat(zeroLineWidthSlider.value),
        hundredLineWidth: parseFloat(hundredLineWidthSlider.value),
        strokeColor: strokeColor,
        brightnessContrast: parseFloat(brightnessContrastSlider.value),
        invertImage: false,
        sourceImage: null,
        imageData: null
    };
    
    // Функция для генерации случайной линии
    function generateRandomLine(width, height) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const angle = Math.random() * Math.PI * 2; // Случайный угол от 0 до 2π
        
        return {
            x: x,
            y: y,
            angle: angle,
            length: params.lineLength,
            lineWidth: params.lineWidth,
            color: strokeColor
        };
    }
    
    // Функция для генерации всех линий (оптимизированная)
    function generateLines() {
        const width = canvas.width;
        const height = canvas.height;
        
        // Если требуется большое количество линий, используем оптимизированную генерацию
        const useOptimizedGeneration = params.lineCount > 1000;
        
        // Очищаем массив линий
        lines = [];
        
        // Предварительно выделяем память для массива
        const safeFieldRadius = params.safeField;
        
        // Если охранное поле равно 0, используем быструю генерацию
        if (safeFieldRadius <= 0) {
            // Инициализируем массив нужного размера
            lines = new Array(params.lineCount);
            
            // Генерируем массив линий
            if (useOptimizedGeneration) {
                // Для большого количества линий используем более эффективный подход
                for (let i = 0; i < params.lineCount; i++) {
                    lines[i] = {
                        x: Math.random() * width,
                        y: Math.random() * height,
                        angle: Math.random() * Math.PI * 2,
                        length: params.lineLength,
                        lineWidth: params.lineWidth,
                        color: strokeColor
                    };
                }
            } else {
                // Для небольшого количества используем стандартную функцию
                for (let i = 0; i < params.lineCount; i++) {
                    lines[i] = generateRandomLine(width, height);
                }
            }
        } else {
            // Используем алгоритм с проверкой охранных полей
            
            // Ограничим количество попыток для избежания бесконечных циклов
            const maxAttempts = 100000;
            let attempts = 0;
            
            // Генерируем линии с учетом охранных полей
            while (lines.length < params.lineCount && attempts < maxAttempts) {
                attempts++;
                
                // Создаем кандидата новой линии
                const candidate = generateRandomLine(width, height);
                
                // Проверяем, не пересекается ли новая линия с охранными полями существующих линий
                if (!doesLineIntersectWithSafeFields(candidate, lines, safeFieldRadius)) {
                    lines.push(candidate);
                }
            }
            
            // Если достигнут лимит попыток, выводим предупреждение
            if (attempts >= maxAttempts) {
                console.warn(`Достигнут лимит попыток (${maxAttempts}). Сгенерировано ${lines.length} из ${params.lineCount} линий. Попробуйте уменьшить охранное поле или количество линий.`);
            }
        }
    }
    
    // Функция для рисования всех линий
    function drawPattern() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666666';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Масштабирование
        ctx.save();
        ctx.scale(params.scale, params.scale);
        
        // Оптимизация для большого количества линий
        // Включаем буферизацию для уменьшения количества вызовов отрисовки
        ctx.beginPath();
        
        // Количество линий для пакетной отрисовки
        const batchSize = 1000;
        
        // Общие настройки стиля для линий
        ctx.lineWidth = params.lineWidth;
        ctx.strokeStyle = params.strokeColor;
        ctx.lineCap = params.roundCap ? 'round' : 'butt';
        
        for (let i = 0; i < lines.length; i += batchSize) {
            // Очищаем текущий путь для нового пакета
            ctx.beginPath();
            
            // Обрабатываем пакет линий
            const endIdx = Math.min(i + batchSize, lines.length);
            
            for (let j = i; j < endIdx; j++) {
                const line = lines[j];
                
                // Переопределяем стиль для каждой линии, если они различаются
                if (line.lineWidth !== ctx.lineWidth) {
                    ctx.stroke(); // Рисуем предыдущие линии
                    ctx.beginPath(); // Начинаем новый путь
                    ctx.lineWidth = line.lineWidth;
                }
                
                // Начальная точка
                const startX = line.x;
                const startY = line.y;
                
                // Конечная точка (вычисляем с помощью тригонометрии)
                const endX = startX + Math.cos(line.angle) * line.length;
                const endY = startY + Math.sin(line.angle) * line.length;
                
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
            }
            
            // Рисуем текущий пакет
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    // Функция для применения растрового режима к линиям
    function applyRasterMode() {
        if (!params.rasterMode && !params.imageRasterMode) return;
        
        const width = canvas.width;
        const height = canvas.height;
        
        lines.forEach(function(line) {
            // Позиция линии относительно ширины и высоты канваса
            const relativeX = line.x / width;
            
            let brightness = 0;
            
            if (params.imageRasterMode && params.imageData) {
                // Получаем яркость из данных изображения
                brightness = getPixelBrightness(params, relativeX, line.y / height);
            } else {
                // В режиме градиента яркость зависит от горизонтальной позиции
                brightness = relativeX;
            }
            
            // Инвертируем яркость если нужно
            if (params.invertImage) {
                brightness = 1 - brightness;
            }
            
            // Изменяем параметры линии в зависимости от яркости
            const lengthRange = params.hundredLineLength - params.zeroLineLength;
            const widthRange = params.hundredLineWidth - params.zeroLineWidth;
            
            line.length = params.zeroLineLength + brightness * lengthRange;
            line.lineWidth = params.zeroLineWidth + brightness * widthRange;
        });
    }
    
    // Функция для получения яркости пикселя из изображения
    function getPixelBrightness(params, relativeX, relativeY) {
        if (!params.imageData) return 0;
        
        const x = Math.floor(relativeX * params.imageData.width);
        const y = Math.floor(relativeY * params.imageData.height);
        
        // Индекс пикселя в массиве данных (4 байта на пиксель: R,G,B,A)
        const index = (y * params.imageData.width + x) * 4;
        
        // Вычисляем яркость как среднее значение RGB
        const r = params.imageData.data[index];
        const g = params.imageData.data[index + 1];
        const b = params.imageData.data[index + 2];
        
        // Формула яркости
        let brightness = (r + g + b) / (3 * 255);
        
        // Применяем контраст
        brightness = Math.pow(brightness, 1 / params.brightnessContrast);
        
        return Math.min(1, Math.max(0, brightness));
    }
    
    // Функция для обработки растрового изображения
    function processUploadedImage() {
        if (!params.sourceImage) return;
        
        // Создаем временный канвас для обработки изображения
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Устанавливаем размеры канваса равными размерам изображения
        tempCanvas.width = params.sourceImage.width;
        tempCanvas.height = params.sourceImage.height;
        
        // Рисуем изображение на временном канвасе
        tempCtx.drawImage(params.sourceImage, 0, 0);
        
        // Получаем данные изображения
        params.imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    }
    
    // Функция для сохранения настроек в локальное хранилище
    function saveSettingsToLocalStorage() {
        const settings = {
            lineWidth: params.lineWidth,
            lineLength: params.lineLength,
            lineCount: params.lineCount,
            scale: params.scale,
            safeField: params.safeField,
            roundCap: params.roundCap,
            rasterMode: params.rasterMode,
            imageRasterMode: params.imageRasterMode,
            zeroLineLength: params.zeroLineLength,
            hundredLineLength: params.hundredLineLength,
            zeroLineWidth: params.zeroLineWidth,
            hundredLineWidth: params.hundredLineWidth,
            brightnessContrast: params.brightnessContrast,
            invertImage: params.invertImage
        };
        
        localStorage.setItem('randomLinesSettings', JSON.stringify(settings));
    }
    
    // Функция для загрузки настроек из локального хранилища
    function loadSettingsFromLocalStorage() {
        const savedSettings = localStorage.getItem('randomLinesSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            
            // Применяем сохраненные настройки
            updateAndApplySettings(settings);
        }
    }
    
    // Функция обновления и сохранения настроек
    function updateAndSave() {
        // Обновляем параметры
        params.lineWidth = parseFloat(lineWidthSlider.value);
        params.lineLength = parseInt(lineLengthSlider.value);
        params.lineCount = parseInt(lineCountSlider.value);
        params.scale = parseFloat(scaleSlider.value);
        params.safeField = parseInt(safeFieldSlider.value);
        params.roundCap = roundCapCheckbox.checked;
        params.rasterMode = rasterModeCheckbox.checked;
        params.imageRasterMode = imageRasterModeCheckbox.checked;
        params.zeroLineLength = parseInt(zeroLineLengthSlider.value);
        params.hundredLineLength = parseInt(hundredLineLengthSlider.value);
        params.zeroLineWidth = parseFloat(zeroLineWidthSlider.value);
        params.hundredLineWidth = parseFloat(hundredLineWidthSlider.value);
        params.brightnessContrast = parseFloat(brightnessContrastSlider.value);
        params.invertImage = imageInvertCheckbox.checked;
        
        // Обновляем отображаемые значения
        lineWidthValueDisplay.textContent = params.lineWidth.toFixed(1);
        lineLengthValueDisplay.textContent = params.lineLength;
        lineCountValueDisplay.textContent = params.lineCount;
        scaleValueDisplay.textContent = params.scale.toFixed(1);
        safeFieldValueDisplay.textContent = params.safeField;
        zeroLineLengthValueDisplay.textContent = params.zeroLineLength;
        hundredLineLengthValueDisplay.textContent = params.hundredLineLength;
        zeroLineWidthValueDisplay.textContent = params.zeroLineWidth.toFixed(1);
        hundredLineWidthValueDisplay.textContent = params.hundredLineWidth.toFixed(1);
        brightnessContrastValueDisplay.textContent = params.brightnessContrast.toFixed(1);
        
        // Отображаем/скрываем элементы управления растром
        toggleRasterControls();
        
        // Отображаем/скрываем элементы управления растровым изображением
        toggleImageRasterControls();
        
        // Если изменилось охранное поле, регенерируем линии
        const safeFieldChanged = params.safeField > 0;
        
        // Если изменились параметры линий или охранное поле, регенерируем их
        if (params.lineCount !== lines.length || safeFieldChanged) {
            generateLines();
        } else {
            // Обновляем параметры существующих линий
            lines.forEach(function(line) {
                line.lineWidth = params.lineWidth;
                line.length = params.lineLength;
            });
        }
        
        // Применяем растровые эффекты, если они включены
        applyRasterMode();
        
        // Отрисовываем паттерн
        drawPattern();
        
        // Сохраняем настройки
        saveSettingsToLocalStorage();
    }
    
    // Функция для сброса настроек
    function resetSettings() {
        lineWidthSlider.value = defaultValues.lineWidth;
        lineLengthSlider.value = defaultValues.lineLength;
        lineCountSlider.value = defaultValues.lineCount;
        scaleSlider.value = defaultValues.scale;
        safeFieldSlider.value = defaultValues.safeField;
        roundCapCheckbox.checked = defaultValues.roundCap;
        rasterModeCheckbox.checked = defaultValues.rasterMode;
        imageRasterModeCheckbox.checked = defaultValues.imageRasterMode;
        zeroLineLengthSlider.value = defaultValues.zeroLineLength;
        hundredLineLengthSlider.value = defaultValues.hundredLineLength;
        zeroLineWidthSlider.value = defaultValues.zeroLineWidth;
        hundredLineWidthSlider.value = defaultValues.hundredLineWidth;
        brightnessContrastSlider.value = defaultValues.brightnessContrast;
        imageInvertCheckbox.checked = defaultValues.invertImage;
        
        // Обновляем и сохраняем
        updateAndSave();
        
        // Заново генерируем линии
        generateLines();
        drawPattern();
    }
    
    // Функция переключения элементов управления растром
    function toggleRasterControls() {
        const isRasterMode = params.rasterMode || params.imageRasterMode;
        
        // Получаем все слайдеры растра
        const rasterSliders = document.querySelectorAll('.raster-sliders input[type="range"]');
        
        // Активируем/деактивируем слайдеры
        rasterSliders.forEach(function(slider) {
            setSliderActive(slider, isRasterMode);
        });
    }
    
    // Функция переключения элементов управления растровым изображением
    function toggleImageRasterControls() {
        if (params.imageRasterMode) {
            imageRasterControls.style.display = 'flex';
        } else {
            imageRasterControls.style.display = 'none';
        }
    }
    
    // Обработчик для загрузки изображения
    if (imageUpload) {
        imageUpload.addEventListener('change', function(event) {
            if (event.target.files && event.target.files[0]) {
                const file = event.target.files[0];
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    // Создаем новое изображение
                    const img = new Image();
                    
                    // Когда изображение загружено, сохраняем его и обновляем канвас
                    img.onload = function() {
                        params.sourceImage = img;
                        imagePreview.src = e.target.result;
                        imagePreview.style.display = 'block';
                        
                        // Обрабатываем изображение и обновляем отображение
                        processUploadedImage();
                        applyRasterMode();
                        drawPattern();
                    };
                    
                    img.src = e.target.result;
                };
                
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Функция экспорта в SVG
    function exportToSvg() {
        // Создаем SVG документ
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        
        // Устанавливаем атрибуты SVG
        svg.setAttribute("width", canvas.width);
        svg.setAttribute("height", canvas.height);
        svg.setAttribute("viewBox", `0 0 ${canvas.width} ${canvas.height}`);
        svg.setAttribute("xmlns", svgNS);
        
        // Добавляем фон
        const background = document.createElementNS(svgNS, "rect");
        background.setAttribute("width", "100%");
        background.setAttribute("height", "100%");
        background.setAttribute("fill", "#666666");
        svg.appendChild(background);
        
        // Добавляем группу для масштабирования
        const scaleGroup = document.createElementNS(svgNS, "g");
        scaleGroup.setAttribute("transform", `scale(${params.scale})`);
        svg.appendChild(scaleGroup);
        
        // Добавляем все линии
        lines.forEach(function(line) {
            const svgLine = document.createElementNS(svgNS, "line");
            
            // Начальная и конечная точки
            const startX = line.x;
            const startY = line.y;
            const endX = startX + Math.cos(line.angle) * line.length;
            const endY = startY + Math.sin(line.angle) * line.length;
            
            svgLine.setAttribute("x1", startX);
            svgLine.setAttribute("y1", startY);
            svgLine.setAttribute("x2", endX);
            svgLine.setAttribute("y2", endY);
            svgLine.setAttribute("stroke", line.color);
            svgLine.setAttribute("stroke-width", line.lineWidth);
            
            if (params.roundCap) {
                svgLine.setAttribute("stroke-linecap", "round");
            }
            
            scaleGroup.appendChild(svgLine);
        });
        
        // Создаем строку SVG
        const svgString = new XMLSerializer().serializeToString(svg);
        
        // Кодируем SVG как Data URL
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);
        
        // Генерируем имя файла на основе текущих параметров
        const fileName = generateFileNameWithParams();
        
        // Создаем ссылку для скачивания и инициируем скачивание
        const downloadLink = document.createElement("a");
        downloadLink.href = svgUrl;
        downloadLink.download = fileName;
        downloadLink.click();
        
        // Освобождаем URL
        URL.revokeObjectURL(svgUrl);
    }
    
    // Функция для генерации имени файла на основе параметров
    function generateFileNameWithParams() {
        // Базовое имя файла
        let fileName = "random_lines";
        
        // Добавляем параметры
        fileName += `_w${params.lineWidth}`;
        fileName += `_l${params.lineLength}`;
        fileName += `_c${params.lineCount}`;
        fileName += `_s${params.scale.toFixed(1)}`;
        
        // Добавляем охранное поле, если оно ненулевое
        if (params.safeField > 0) {
            fileName += `_sf${params.safeField}`;
        }
        
        // Добавляем флаги
        if (params.roundCap) fileName += "_round";
        if (params.rasterMode) fileName += "_raster";
        if (params.imageRasterMode) fileName += "_img";
        
        // Добавляем расширение
        fileName += ".svg";
        
        return fileName;
    }
    
    // Функция для восстановления настроек из имени файла
    function restoreSettingsFromFileName(fileName) {
        try {
            const settings = {};
            
            // Удаляем расширение и разбиваем имя файла на части
            const baseName = fileName.replace(/\.svg$/, "");
            const parts = baseName.split("_");
            
            // Пропускаем первую часть (название паттерна)
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                
                // Извлекаем параметр и значение
                if (part.startsWith("w")) {
                    settings.lineWidth = parseFloat(part.substring(1));
                } else if (part.startsWith("l")) {
                    settings.lineLength = parseInt(part.substring(1));
                } else if (part.startsWith("c")) {
                    settings.lineCount = parseInt(part.substring(1));
                } else if (part.startsWith("s")) {
                    settings.scale = parseFloat(part.substring(1));
                } else if (part.startsWith("sf")) {
                    settings.safeField = parseInt(part.substring(2));
                } else if (part === "round") {
                    settings.roundCap = true;
                } else if (part === "raster") {
                    settings.rasterMode = true;
                } else if (part === "img") {
                    settings.imageRasterMode = true;
                }
            }
            
            // Применяем восстановленные настройки
            updateAndApplySettings(settings);
            console.log("Settings restored successfully:", settings);
        } catch (error) {
            console.error("Error restoring settings:", error);
        }
    }
    
    // Функция для применения восстановленных настроек
    function updateAndApplySettings(settings) {
        // Обновляем слайдеры и чекбоксы
        if (settings.lineWidth !== undefined) {
            lineWidthSlider.value = settings.lineWidth;
        }
        
        if (settings.lineLength !== undefined) {
            lineLengthSlider.value = settings.lineLength;
        }
        
        if (settings.lineCount !== undefined) {
            lineCountSlider.value = settings.lineCount;
        }
        
        if (settings.scale !== undefined) {
            scaleSlider.value = settings.scale;
        }
        
        if (settings.safeField !== undefined) {
            safeFieldSlider.value = settings.safeField;
        }
        
        if (settings.roundCap !== undefined) {
            roundCapCheckbox.checked = settings.roundCap;
        }
        
        if (settings.rasterMode !== undefined) {
            rasterModeCheckbox.checked = settings.rasterMode;
        }
        
        if (settings.imageRasterMode !== undefined) {
            imageRasterModeCheckbox.checked = settings.imageRasterMode;
        }
        
        if (settings.zeroLineLength !== undefined) {
            zeroLineLengthSlider.value = settings.zeroLineLength;
        }
        
        if (settings.hundredLineLength !== undefined) {
            hundredLineLengthSlider.value = settings.hundredLineLength;
        }
        
        if (settings.zeroLineWidth !== undefined) {
            zeroLineWidthSlider.value = settings.zeroLineWidth;
        }
        
        if (settings.hundredLineWidth !== undefined) {
            hundredLineWidthSlider.value = settings.hundredLineWidth;
        }
        
        if (settings.brightnessContrast !== undefined) {
            brightnessContrastSlider.value = settings.brightnessContrast;
        }
        
        if (settings.invertImage !== undefined) {
            imageInvertCheckbox.checked = settings.invertImage;
        }
        
        // Обновляем настройки и перерисовываем
        updateAndSave();
        
        // Заново генерируем линии
        generateLines();
        applyRasterMode();
        drawPattern();
    }
    
    // Функция для активации/деактивации слайдера
    function setSliderActive(slider, isActive) {
        if (isActive) {
            slider.classList.remove('inactive-slider');
            slider.disabled = false;
        } else {
            slider.classList.add('inactive-slider');
            slider.disabled = true;
        }
    }
    
    // Добавляем обработчики событий
    lineWidthSlider.addEventListener('input', updateAndSave);
    lineLengthSlider.addEventListener('input', updateAndSave);
    lineCountSlider.addEventListener('input', updateAndSave);
    scaleSlider.addEventListener('input', updateAndSave);
    safeFieldSlider.addEventListener('input', updateAndSave);
    zeroLineLengthSlider.addEventListener('input', updateAndSave);
    hundredLineLengthSlider.addEventListener('input', updateAndSave);
    zeroLineWidthSlider.addEventListener('input', updateAndSave);
    hundredLineWidthSlider.addEventListener('input', updateAndSave);
    roundCapCheckbox.addEventListener('change', updateAndSave);
    rasterModeCheckbox.addEventListener('change', updateAndSave);
    imageRasterModeCheckbox.addEventListener('change', updateAndSave);
    imageInvertCheckbox.addEventListener('change', updateAndSave);
    brightnessContrastSlider.addEventListener('input', updateAndSave);
    
    // Обработчики для кнопок
    exportSvgBtn.addEventListener('click', exportToSvg);
    resetBtn.addEventListener('click', resetSettings);
    generateBtn.addEventListener('click', function() {
        generateLines();
        applyRasterMode();
        drawPattern();
    });
    
    // Инициализация
    loadSettingsFromLocalStorage();
    generateLines();
    toggleRasterControls();
    toggleImageRasterControls();
    applyRasterMode();
    drawPattern();

    // Функция для проверки, находится ли точка внутри охранного поля линии
    function isPointInSafeField(x, y, line, safeFieldRadius) {
        // Вычисляем проекцию точки на линию
        const x1 = line.x;
        const y1 = line.y;
        const x2 = x1 + Math.cos(line.angle) * line.length;
        const y2 = y1 + Math.sin(line.angle) * line.length;
        
        // Вектор от начала линии до точки
        const vx = x - x1;
        const vy = y - y1;
        
        // Вектор линии
        const ux = x2 - x1;
        const uy = y2 - y1;
        
        // Длина линии в квадрате
        const lineLength2 = ux * ux + uy * uy;
        
        // Скалярное произведение векторов
        const dot = vx * ux + vy * uy;
        
        // Проекция на линию (от 0 до 1 - точка проецируется на отрезок)
        const t = Math.max(0, Math.min(1, dot / lineLength2));
        
        // Точка проекции
        const projX = x1 + t * ux;
        const projY = y1 + t * uy;
        
        // Расстояние от точки до проекции
        const distX = x - projX;
        const distY = y - projY;
        const distance = Math.sqrt(distX * distX + distY * distY);
        
        // Точка находится внутри охранного поля, если расстояние меньше радиуса
        return distance < safeFieldRadius;
    }

    // Функция для проверки, пересекается ли линия с охранными полями других линий
    function doesLineIntersectWithSafeFields(newLine, existingLines, safeFieldRadius) {
        // Если охранное поле равно 0, пропускаем проверку
        if (safeFieldRadius <= 0) return false;
        
        // Получаем начальную и конечную точки новой линии
        const x1 = newLine.x;
        const y1 = newLine.y;
        const x2 = x1 + Math.cos(newLine.angle) * newLine.length;
        const y2 = y1 + Math.sin(newLine.angle) * newLine.length;
        
        // Количество проверяемых точек на линии
        const numPoints = 10;
        
        // Проверяем точки вдоль линии
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const x = x1 + t * (x2 - x1);
            const y = y1 + t * (y2 - y1);
            
            // Проверяем, находится ли точка внутри охранного поля любой существующей линии
            for (let j = 0; j < existingLines.length; j++) {
                if (isPointInSafeField(x, y, existingLines[j], safeFieldRadius)) {
                    return true; // Найдено пересечение
                }
            }
        }
        
        // Проверяем, находятся ли концы существующих линий внутри охранного поля новой линии
        for (let i = 0; i < existingLines.length; i++) {
            const line = existingLines[i];
            const lineX1 = line.x;
            const lineY1 = line.y;
            const lineX2 = lineX1 + Math.cos(line.angle) * line.length;
            const lineY2 = lineY1 + Math.sin(line.angle) * line.length;
            
            // Проверяем оба конца линии
            if (isPointInSafeField(lineX1, lineY1, newLine, safeFieldRadius) ||
                isPointInSafeField(lineX2, lineY2, newLine, safeFieldRadius)) {
                return true; // Найдено пересечение
            }
        }
        
        return false; // Нет пересечений
    }
}); 