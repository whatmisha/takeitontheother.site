// Размеры и параметры
let squareSize = 20; // Размер квадрата в пикселях
let lineWeightPercent = 3; // Толщина линий в процентах от размера квадрата
let cornerRadiusPercent = 50; // Радиус скругления в процентах от размера квадрата
let lineLengthPercent = 50; // Длина линий квадрата А в процентах
let roundCaps = true; // Круглые окончания штрихов по умолчанию
let spacingPercent = 50; // Расстояние между крестами в процентах от размера креста
let checkerboardMode = true; // Шахматный режим расстановки включен по умолчанию
let lineBLengthPercent = 100; // Длина линии квадрата Б в процентах
let bothSquaresBMode = false; // Режим, где оба квадрата работают как квадрат Б (режим двух дуг)

// Кэшированные вычисления для оптимизации
let cachedCornerRadius = 0;
let cachedLineWeight = 0;
let cachedLineLength = 0;
let cachedCrossSize = 0;
let cachedSpacing = 0;
let cachedGridStep = 0;
let cacheValid = false;

// Система отмены изменений
let stateHistory = [];
let redoHistory = []; // Массив для хранения отмененных состояний
let maxHistorySize = 50; // Максимальное количество шагов в истории
let isUpdatingControls = false; // Флаг для предотвращения циклических обновлений
let isInteractingWithControl = false; // Флаг активного взаимодействия с контролом

// Кэширование DOM элементов для оптимизации
let domElements = {};

// Общая функция для вычисления границ сетки
function calculateGridBounds(width, height, gridStep) {
  return {
    startX: -gridStep,
    startY: -gridStep,
    endX: width + gridStep,
    endY: height + gridStep
  };
}

// Общая функция для итерации по сетке
function iterateGrid(bounds, gridStep, checkerboardMode, callback) {
  let rowIndex = 0;
  let currentY = bounds.startY;
  
  while (currentY < bounds.endY) {
    for (let x = bounds.startX; x < bounds.endX; x += gridStep) {
      // В шахматном режиме сдвигаем каждую вторую строку
      let offsetX = x;
      if (checkerboardMode && rowIndex % 2 === 1) {
        offsetX = x + gridStep / 2;
      }
      
      // Вызываем callback функцию для каждой позиции
      callback(offsetX, currentY, rowIndex);
    }
    
    // Вычисляем шаг по вертикали
    if (checkerboardMode) {
      currentY += gridStep / 2;
    } else {
      currentY += gridStep;
    }
    
    rowIndex++;
  }
}

function setup() {
  // Создаем канвас
  createCanvas(windowWidth, windowHeight);
  // Устанавливаем цвет фона
  background(0);
  // Устанавливаем режим отрисовки
  noFill();
  stroke(255);
  
  // Останавливаем автоматическую перерисовку
  noLoop();
  
  // Сохраняем начальное состояние ПЕРВЫМ ДЕЛОМ
  saveCurrentStateImmediately();
  
  // Настраиваем обработчики событий для HTML контролов
  setupHTMLControls();
  
  // Добавляем обработчик клавиатуры для хоткеев
  setupKeyboardShortcuts();
  
  // Определяем платформу для кнопки экспорта
  setupPlatformSpecificUI();
  
  // Обновляем кэш и рисуем первый кадр
  updateCache();
  redraw();
}

// Функция настройки HTML контролов
function setupHTMLControls() {
  // Кэшируем все DOM элементы
  domElements.radiusSlider = document.getElementById('radius-slider');
  domElements.lengthSlider = document.getElementById('length-slider');
  domElements.lengthBSlider = document.getElementById('length-b-slider');
  domElements.thicknessSlider = document.getElementById('thickness-slider');
  domElements.spacingSlider = document.getElementById('spacing-slider');
  domElements.sizeSlider = document.getElementById('size-slider');
  
  domElements.radiusValue = document.getElementById('radius-value');
  domElements.lengthValue = document.getElementById('length-value');
  domElements.lengthBValue = document.getElementById('length-b-value');
  domElements.thicknessValue = document.getElementById('thickness-value');
  domElements.spacingValue = document.getElementById('spacing-value');
  domElements.sizeValue = document.getElementById('size-value');
  
  domElements.capsCheckbox = document.getElementById('caps-checkbox');
  domElements.checkerboardCheckbox = document.getElementById('checkerboard-checkbox');
  domElements.bothSquaresCheckbox = document.getElementById('both-squares-checkbox');
  
  domElements.exportButton = document.getElementById('export-button');
  
  // Обработчики для слайдеров с сохранением состояния
  setupSliderWithHistory(domElements.radiusSlider, domElements.radiusValue, (value) => {
    cornerRadiusPercent = value;
    domElements.radiusValue.textContent = value + '%';
    cacheValid = false;
    redraw();
  });
  
  setupSliderWithHistory(domElements.lengthSlider, domElements.lengthValue, (value) => {
    lineLengthPercent = value;
    domElements.lengthValue.textContent = value + '%';
    cacheValid = false;
    redraw();
  });
  
  setupSliderWithHistory(domElements.lengthBSlider, domElements.lengthBValue, (value) => {
    lineBLengthPercent = value;
    domElements.lengthBValue.textContent = value + '%';
    cacheValid = false;
    redraw();
  });
  
  setupSliderWithHistory(domElements.thicknessSlider, domElements.thicknessValue, (value) => {
    lineWeightPercent = value;
    domElements.thicknessValue.textContent = value + '%';
    cacheValid = false;
    redraw();
  });
  
  setupSliderWithHistory(domElements.spacingSlider, domElements.spacingValue, (value) => {
    spacingPercent = value;
    domElements.spacingValue.textContent = value + '%';
    cacheValid = false;
    redraw();
  });
  
  setupSliderWithHistory(domElements.sizeSlider, domElements.sizeValue, (value) => {
    squareSize = value;
    domElements.sizeValue.textContent = value + 'px';
    cacheValid = false;
    redraw();
  });
  
  // Обработчики для чекбоксов
  domElements.capsCheckbox.addEventListener('change', () => {
    // Состояние уже изменено браузером, нужно сохранить предыдущее
    if (!isUpdatingControls) {
      // Временно возвращаем к предыдущему состоянию для сохранения
      let oldValue = !domElements.capsCheckbox.checked;
      roundCaps = oldValue;
      saveCurrentStateImmediately();
      // Применяем новое значение
      roundCaps = domElements.capsCheckbox.checked;
    } else {
      roundCaps = domElements.capsCheckbox.checked;
    }
    redraw();
  });
  
  domElements.checkerboardCheckbox.addEventListener('change', () => {
    // Состояние уже изменено браузером, нужно сохранить предыдущее
    if (!isUpdatingControls) {
      // Временно возвращаем к предыдущему состоянию для сохранения
      let oldValue = !domElements.checkerboardCheckbox.checked;
      checkerboardMode = oldValue;
      saveCurrentStateImmediately();
      // Применяем новое значение
      checkerboardMode = domElements.checkerboardCheckbox.checked;
    } else {
      checkerboardMode = domElements.checkerboardCheckbox.checked;
    }
    cacheValid = false;
    redraw();
  });
  
  domElements.bothSquaresCheckbox.addEventListener('change', () => {
    // Состояние уже изменено браузером, нужно сохранить предыдущее
    if (!isUpdatingControls) {
      // Временно возвращаем к предыдущему состоянию для сохранения
      let oldValue = !domElements.bothSquaresCheckbox.checked;
      bothSquaresBMode = oldValue;
      saveCurrentStateImmediately();
      // Применяем новое значение
      bothSquaresBMode = domElements.bothSquaresCheckbox.checked;
    } else {
      bothSquaresBMode = domElements.bothSquaresCheckbox.checked;
    }
    redraw();
  });
  
  // Обработчик для кнопки экспорта
  domElements.exportButton.addEventListener('click', exportSVG);
}

// Функция настройки слайдера с сохранением истории
function setupSliderWithHistory(slider, valueDisplay, callback) {
  // Обработчик начала взаимодействия
  slider.addEventListener('mousedown', () => {
    if (!isUpdatingControls && !isInteractingWithControl) {
      saveCurrentStateImmediately(); // Сохраняем состояние ДО начала изменений
      isInteractingWithControl = true;
    }
  });
  
  slider.addEventListener('mouseup', () => {
    isInteractingWithControl = false;
  });
  
  // Для сенсорных устройств
  slider.addEventListener('touchstart', () => {
    if (!isUpdatingControls && !isInteractingWithControl) {
      saveCurrentStateImmediately(); // Сохраняем состояние ДО начала изменений
      isInteractingWithControl = true;
    }
  });
  
  slider.addEventListener('touchend', () => {
    isInteractingWithControl = false;
  });
  
  // Обработчик изменения значения
  slider.addEventListener('input', () => {
    callback(parseInt(slider.value));
  });
}

// Функция настройки платформо-специфичного UI
function setupPlatformSpecificUI() {
  // Определяем мобильное устройство
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   (navigator.maxTouchPoints > 0 && navigator.platform === 'MacIntel'); // iPad на iOS 13+
  
  // Определяем Mac (но не мобильный)
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 && !isMobile;
  
  const macShortcut = document.querySelector('.mac-shortcut');
  const pcShortcut = document.querySelector('.pc-shortcut');
  
  if (isMobile) {
    // На мобильных устройствах показываем просто "SVG" без хоткея
    macShortcut.style.display = 'none';
    pcShortcut.style.display = 'none';
    // Создаем элемент для мобильной версии если его нет
    let mobileText = document.querySelector('.mobile-text');
    if (!mobileText) {
      mobileText = document.createElement('span');
      mobileText.className = 'mobile-text';
      mobileText.textContent = 'SVG';
      document.getElementById('export-button').appendChild(mobileText);
    }
    mobileText.style.display = 'inline';
  } else if (isMac) {
    macShortcut.style.display = 'inline';
    pcShortcut.style.display = 'none';
    // Скрываем мобильный текст если есть
    const mobileText = document.querySelector('.mobile-text');
    if (mobileText) mobileText.style.display = 'none';
  } else {
    macShortcut.style.display = 'none';
    pcShortcut.style.display = 'inline';
    // Скрываем мобильный текст если есть
    const mobileText = document.querySelector('.mobile-text');
    if (mobileText) mobileText.style.display = 'none';
  }
}

function draw() {
  // Проверяем валидность кэша
  if (!cacheValid) {
    updateCache();
  }
  
  // Очищаем канвас
  background(0);
  
  // Устанавливаем параметры для рисования
  noFill();
  stroke(255);
  strokeWeight(cachedLineWeight);
  // Устанавливаем тип окончаний штрихов
  if (roundCaps) {
    strokeCap(ROUND);
  } else {
    strokeCap(SQUARE);
  }
  
  // Вычисляем границы для рисования
  let bounds = calculateGridBounds(width, height, cachedGridStep);
  
  // Рисуем сетку крестов
  iterateGrid(bounds, cachedGridStep, checkerboardMode, (x, y) => {
    push();
    translate(x, y);
    
    // Рисуем один крест (квадрат Б + квадрат А)
    drawCross(cachedCornerRadius, cachedLineLength);
    
    pop();
  });
}

// Функция для рисования одного креста
function drawCross(cornerRadius, lineLength) {
  if (bothSquaresBMode) {
    // Режим двух дуг
    // Рисуем первый квадрат Б (верхний правый)
    push();
    drawSquareB(cornerRadius, lineBLengthPercent);
    pop();
    
    // Рисуем второй квадрат Б (нижний левый) - отраженный по обеим осям
    push();
    // Смещаем к позиции нижнего левого квадрата
    translate(-squareSize, squareSize);
    // Отражаем по обеим осям (поворот на 180 градусов)
    scale(-1, -1);
    // Компенсируем смещение после отражения
    translate(-squareSize, -squareSize);
    drawSquareB(cornerRadius, lineBLengthPercent);
    pop();
  } else {
    // Обычный режим (квадрат Б + квадрат А)
    // Рисуем квадрат Б (верхний правый)
    push();
    drawSquareB(cornerRadius, lineBLengthPercent);
    pop();
    
    // Рисуем квадрат А (нижний левый)
    push();
    // Смещаем квадрат А вниз и влево
    translate(-squareSize, squareSize);
    
    // Верхняя грань квадрата А с регулируемой длиной (фиксированная левая точка)
    line(0, 0, lineLength, 0);
    
    // Правая грань квадрата А с регулируемой длиной (фиксированная нижняя точка)
    line(squareSize, squareSize - lineLength, squareSize, squareSize);
    
    pop();
  }
}

// Функция для рисования квадрата Б с математическим вычислением разрыва
function drawSquareB(cornerRadius, totalLengthPercent) {
  // Если значение 0, используем 0.01% чтобы линия не исчезала полностью
  let actualLengthPercent = totalLengthPercent === 0 ? 0.01 : totalLengthPercent;
  
  // Вычисляем общую длину линии (вертикаль + дуга + горизонталь)
  let verticalLength = squareSize - cornerRadius;
  let arcLength = (PI / 2) * cornerRadius; // Четверть окружности
  let horizontalLength = squareSize - cornerRadius;
  let fullLength = verticalLength + arcLength + horizontalLength;
  
  let desiredLength = (actualLengthPercent / 100) * fullLength;
  
  if (desiredLength >= fullLength) {
    // Рисуем полную линию
    drawFullSquareB(cornerRadius);
  } else {
    // Вычисляем размер разрыва и позиции сегментов
    let gapSize = fullLength - desiredLength;
    let segment1Length = (desiredLength / 2);
    let segment2Start = fullLength - (desiredLength / 2);
    
    drawSegmentFromStart(segment1Length, cornerRadius, verticalLength, arcLength);
    drawSegmentFromEnd(segment2Start, cornerRadius, verticalLength, arcLength, fullLength);
  }
}

// Функция для рисования полной линии квадрата Б
function drawFullSquareB(cornerRadius) {
  if (cornerRadius <= 0) {
    // Если радиус 0, рисуем прямые линии
    line(0, 0, 0, squareSize);
    line(0, squareSize, squareSize, squareSize);
  } else {
    // Левая грань до скругления
    line(0, 0, 0, squareSize - cornerRadius);
    
    // Дуга скругления (вогнутая, как в p5.js)
    // В p5.js: arc(cornerRadius, squareSize - cornerRadius, cornerRadius * 2, cornerRadius * 2, HALF_PI, PI)
    // Это дуга от 90° до 180°, то есть вогнутая дуга в левом нижнем углу
    arc(cornerRadius, squareSize - cornerRadius, cornerRadius * 2, cornerRadius * 2, HALF_PI, PI);
    
    // Нижняя грань от скругления
    line(cornerRadius, squareSize, squareSize, squareSize);
  }
}

// Функция для рисования сегмента от начала линии
function drawSegmentFromStart(length, cornerRadius, verticalLength, arcLength) {
  if (length <= 0) return;
  
  if (length <= verticalLength) {
    // Рисуем только часть вертикальной линии
    line(0, 0, 0, length);
  } else if (length <= verticalLength + arcLength) {
    // Рисуем всю вертикальную линию и часть дуги
    line(0, 0, 0, squareSize - cornerRadius);
    
    let arcProgress = (length - verticalLength) / arcLength;
    let endAngle = HALF_PI + arcProgress * HALF_PI;
    arc(cornerRadius, squareSize - cornerRadius, cornerRadius * 2, cornerRadius * 2, HALF_PI, endAngle);
  } else {
    // Рисуем вертикальную линию, всю дугу и часть горизонтальной
    line(0, 0, 0, squareSize - cornerRadius);
    arc(cornerRadius, squareSize - cornerRadius, cornerRadius * 2, cornerRadius * 2, HALF_PI, PI);
    
    let horizontalProgress = length - verticalLength - arcLength;
    line(cornerRadius, squareSize, cornerRadius + horizontalProgress, squareSize);
  }
}

// Функция для рисования сегмента от конца линии
function drawSegmentFromEnd(startPos, cornerRadius, verticalLength, arcLength, fullLength) {
  let length = fullLength - startPos;
  if (length <= 0) return;
  
  if (startPos >= verticalLength + arcLength) {
    // Начинаем с горизонтальной части
    let horizontalStart = startPos - verticalLength - arcLength;
    line(cornerRadius + horizontalStart, squareSize, squareSize, squareSize);
  } else if (startPos >= verticalLength) {
    // Начинаем с дуги
    let arcStart = startPos - verticalLength;
    let arcProgress = arcStart / arcLength;
    let startAngle = HALF_PI + arcProgress * HALF_PI;
    
    arc(cornerRadius, squareSize - cornerRadius, cornerRadius * 2, cornerRadius * 2, startAngle, PI);
    line(cornerRadius, squareSize, squareSize, squareSize);
  } else {
    // Начинаем с вертикальной части
    line(0, startPos, 0, squareSize - cornerRadius);
    arc(cornerRadius, squareSize - cornerRadius, cornerRadius * 2, cornerRadius * 2, HALF_PI, PI);
    line(cornerRadius, squareSize, squareSize, squareSize);
  }
}

// Функция экспорта в SVG
function exportSVG() {
  // Создаем SVG строку
  let svgContent = generateSVGContent();
  
  // Создаем Blob и скачиваем файл
  let blob = new Blob([svgContent], { type: 'image/svg+xml' });
  let url = URL.createObjectURL(blob);
  
  let link = document.createElement('a');
  link.href = url;
  link.download = 'pattern.svg';
  link.click();
  
  URL.revokeObjectURL(url);
}

// Функция генерации SVG контента
function generateSVGContent() {
  // Кэшируем все параметры для избежания повторных вычислений
  let cornerRadius = (cornerRadiusPercent / 100) * squareSize;
  let lineWeight = (lineWeightPercent / 100) * squareSize;
  let actualLengthPercent = lineLengthPercent === 0 ? 0.01 : lineLengthPercent;
  let lineLength = (actualLengthPercent / 100) * squareSize;
  let capStyle = roundCaps ? 'round' : 'square';
  
  let crossSize = squareSize * 2;
  let spacing = (spacingPercent / 100) * crossSize;
  let gridStep = crossSize + spacing;
  
  // Размеры SVG (размер экрана)
  let svgWidth = windowWidth;
  let svgHeight = windowHeight;
  
  // Используем массив для эффективной генерации SVG
  let svgParts = [];
  
  // Начало SVG
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`);
  svgParts.push(`<rect width="100%" height="100%" fill="black"/>`);
  
  // Вычисляем границы для рисования используя общую функцию
  let bounds = calculateGridBounds(svgWidth, svgHeight, gridStep);
  
  // Рисуем сетку крестов используя общую функцию
  iterateGrid(bounds, gridStep, checkerboardMode, (offsetX, offsetY) => {
    // Генерируем SVG для одного креста с кэшированными параметрами
    generateCrossSVG(svgParts, offsetX, offsetY, cornerRadius, lineLength, lineWeight, capStyle);
  });
  
  svgParts.push('</svg>');
  return svgParts.join('');
}

// Функция генерации SVG для одного креста
function generateCrossSVG(svgParts, x, y, cornerRadius, lineLength, lineWeight, capStyle) {
  if (bothSquaresBMode) {
    // Режим двух дуг
    // Первый квадрат Б (верхний правый)
    generateSquareBSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle);
    
    // Второй квадрат Б (нижний левый) - делаем отраженную копию
    // Позиция второго квадрата (нижний левый)
    let secondX = x - squareSize;
    let secondY = y + squareSize;
    
    // Генерируем отраженную версию квадрата Б для нижнего левого положения
    generateReflectedSquareBSVG(svgParts, secondX, secondY, cornerRadius, lineWeight, capStyle);
  } else {
    // Обычный режим (квадрат Б + квадрат А)
    // Квадрат Б (верхний правый)
    generateSquareBSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle);
    
    // Квадрат А (нижний левый)
    let aX = x - squareSize;
    let aY = y + squareSize;
    
    // Верхняя грань квадрата А
    svgParts.push(`<line x1="${aX}" y1="${aY}" x2="${aX + lineLength}" y2="${aY}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
    
    // Правая грань квадрата А
    svgParts.push(`<line x1="${aX + squareSize}" y1="${aY + squareSize - lineLength}" x2="${aX + squareSize}" y2="${aY + squareSize}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
  }
}

// Функция генерации отраженной версии квадрата Б для нижнего левого положения
function generateReflectedSquareBSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle) {
  let actualLengthPercent = lineBLengthPercent === 0 ? 0.01 : lineBLengthPercent;
  
  // Вычисляем общую длину линии
  let verticalLength = squareSize - cornerRadius;
  let arcLength = (PI / 2) * cornerRadius;
  let horizontalLength = squareSize - cornerRadius;
  let fullLength = verticalLength + arcLength + horizontalLength;
  
  let desiredLength = (actualLengthPercent / 100) * fullLength;
  
  if (desiredLength >= fullLength) {
    // Полная отраженная линия
    generateFullReflectedSquareBSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle);
  } else {
    // Сегменты с разрывом для отраженной версии
    let segment1Length = desiredLength / 2;
    let segment2Start = fullLength - desiredLength / 2;
    
    generateReflectedSquareBSegmentSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle, 0, segment1Length, verticalLength, arcLength);
    generateReflectedSquareBSegmentSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle, segment2Start, fullLength, verticalLength, arcLength);
  }
}

// Функция генерации полной отраженной версии квадрата Б
function generateFullReflectedSquareBSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle) {
  if (cornerRadius <= 0) {
    // Прямые линии для отраженной версии (правая вертикаль + верхняя горизонталь)
    svgParts.push(`<line x1="${x + squareSize}" y1="${y + squareSize}" x2="${x + squareSize}" y2="${y}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
    svgParts.push(`<line x1="${x + squareSize}" y1="${y}" x2="${x}" y2="${y}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
  } else {
    // Правая грань (снизу вверх)
    svgParts.push(`<line x1="${x + squareSize}" y1="${y + squareSize}" x2="${x + squareSize}" y2="${y + cornerRadius}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
    
    // Дуга скругления для отраженной версии - в правом верхнем углу
    // От точки (x + squareSize, y + cornerRadius) к точке (x + squareSize - cornerRadius, y)
    svgParts.push(`<path d="M ${x + squareSize} ${y + cornerRadius} A ${cornerRadius} ${cornerRadius} 0 0 0 ${x + squareSize - cornerRadius} ${y}" stroke="white" stroke-width="${lineWeight}" fill="none" stroke-linecap="${capStyle}"/>`);
    
    // Верхняя грань (справа налево)
    svgParts.push(`<line x1="${x + squareSize - cornerRadius}" y1="${y}" x2="${x}" y2="${y}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
  }
}

// Функция генерации сегмента отраженной версии квадрата Б
function generateReflectedSquareBSegmentSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle, startPos, endPos, verticalLength, arcLength) {
  let length = endPos - startPos;
  
  if (length <= 0) return;
  
  if (startPos < verticalLength) {
    // Вертикальная часть (правая грань, снизу вверх)
    let segmentStart = startPos;
    let segmentEnd = min(endPos, verticalLength);
    if (segmentEnd > segmentStart) {
      svgParts.push(`<line x1="${x + squareSize}" y1="${y + squareSize - segmentStart}" x2="${x + squareSize}" y2="${y + squareSize - segmentEnd}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
    }
  }
  
  if (startPos < verticalLength + arcLength && endPos > verticalLength) {
    // Дуга для отраженной версии
    let arcStart = max(0, startPos - verticalLength);
    let arcEnd = min(arcLength, endPos - verticalLength);
    
    if (arcEnd > arcStart) {
      let totalArcAngle = HALF_PI; // 90 градусов
      let startAngle = (arcStart / arcLength) * totalArcAngle;
      let endAngle = (arcEnd / arcLength) * totalArcAngle;
      
      // Центр дуги для отраженной версии
      let cx = x + squareSize - cornerRadius;
      let cy = y + cornerRadius;
      
      // Вычисляем начальную и конечную точки для отраженной дуги
      let startX = cx + cornerRadius * sin(startAngle);
      let startY = cy - cornerRadius * cos(startAngle);
      let endX = cx + cornerRadius * sin(endAngle);
      let endY = cy - cornerRadius * cos(endAngle);
      
      svgParts.push(`<path d="M ${startX} ${startY} A ${cornerRadius} ${cornerRadius} 0 0 0 ${endX} ${endY}" stroke="white" stroke-width="${lineWeight}" fill="none" stroke-linecap="${capStyle}"/>`);
    }
  }
  
  if (endPos > verticalLength + arcLength) {
    // Горизонтальная часть (верхняя грань, справа налево)
    let segmentStart = max(0, startPos - verticalLength - arcLength);
    let segmentEnd = endPos - verticalLength - arcLength;
    
    if (segmentEnd > segmentStart) {
      svgParts.push(`<line x1="${x + squareSize - cornerRadius - segmentStart}" y1="${y}" x2="${x + squareSize - cornerRadius - segmentEnd}" y2="${y}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
    }
  }
}

// Функция генерации SVG для квадрата Б
function generateSquareBSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle) {
  let actualLengthPercent = lineBLengthPercent === 0 ? 0.01 : lineBLengthPercent;
  
  // Вычисляем общую длину линии
  let verticalLength = squareSize - cornerRadius;
  let arcLength = (PI / 2) * cornerRadius;
  let horizontalLength = squareSize - cornerRadius;
  let fullLength = verticalLength + arcLength + horizontalLength;
  
  let desiredLength = (actualLengthPercent / 100) * fullLength;
  
  if (desiredLength >= fullLength) {
    // Полная линия
    generateFullSquareBSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle);
  } else {
    // Сегменты с разрывом
    let segment1Length = desiredLength / 2;
    let segment2Start = fullLength - desiredLength / 2;
    
    generateSquareBSegmentSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle, 0, segment1Length, verticalLength, arcLength);
    generateSquareBSegmentSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle, segment2Start, fullLength, verticalLength, arcLength);
  }
}

// Функция генерации SVG для полного квадрата Б
function generateFullSquareBSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle) {
  if (cornerRadius <= 0) {
    // Прямые линии
    svgParts.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y + squareSize}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
    svgParts.push(`<line x1="${x}" y1="${y + squareSize}" x2="${x + squareSize}" y2="${y + squareSize}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
  } else {
    // Левая грань
    svgParts.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y + squareSize - cornerRadius}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
    
    // Дуга скругления - простой подход
    // От точки (x, y + squareSize - cornerRadius) к точке (x + cornerRadius, y + squareSize)
    // Это создает вогнутую дугу в левом нижнем углу
    svgParts.push(`<path d="M ${x} ${y + squareSize - cornerRadius} A ${cornerRadius} ${cornerRadius} 0 0 0 ${x + cornerRadius} ${y + squareSize}" stroke="white" stroke-width="${lineWeight}" fill="none" stroke-linecap="${capStyle}"/>`);
    
    // Нижняя грань
    svgParts.push(`<line x1="${x + cornerRadius}" y1="${y + squareSize}" x2="${x + squareSize}" y2="${y + squareSize}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
  }
}

// Функция генерации SVG для сегмента квадрата Б
function generateSquareBSegmentSVG(svgParts, x, y, cornerRadius, lineWeight, capStyle, startPos, endPos, verticalLength, arcLength) {
  let length = endPos - startPos;
  
  if (length <= 0) return;
  
  if (startPos < verticalLength) {
    // Вертикальная часть
    let segmentStart = startPos;
    let segmentEnd = min(endPos, verticalLength);
    if (segmentEnd > segmentStart) {
      svgParts.push(`<line x1="${x}" y1="${y + segmentStart}" x2="${x}" y2="${y + segmentEnd}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
    }
  }
  
  if (startPos < verticalLength + arcLength && endPos > verticalLength) {
    // Дуга
    let arcStart = max(0, startPos - verticalLength);
    let arcEnd = min(arcLength, endPos - verticalLength);
    
    if (arcEnd > arcStart) {
      // Простой подход для сегментов дуги
      let totalArcAngle = HALF_PI; // 90 градусов
      let startAngle = (arcStart / arcLength) * totalArcAngle;
      let endAngle = (arcEnd / arcLength) * totalArcAngle;
      
      // Центр дуги
      let cx = x + cornerRadius;
      let cy = y + squareSize - cornerRadius;
      
      // Вычисляем начальную и конечную точки
      // Дуга идет от левой стороны (180°) к нижней стороне (270°) в стандартной системе координат
      let startX = cx - cornerRadius * cos(startAngle);
      let startY = cy + cornerRadius * sin(startAngle);
      let endX = cx - cornerRadius * cos(endAngle);
      let endY = cy + cornerRadius * sin(endAngle);
      
      // Используем sweep-flag = 0 для движения по часовой стрелке
      svgParts.push(`<path d="M ${startX} ${startY} A ${cornerRadius} ${cornerRadius} 0 0 0 ${endX} ${endY}" stroke="white" stroke-width="${lineWeight}" fill="none" stroke-linecap="${capStyle}"/>`);
    }
  }
  
  if (endPos > verticalLength + arcLength) {
    // Горизонтальная часть
    let segmentStart = max(0, startPos - verticalLength - arcLength);
    let segmentEnd = endPos - verticalLength - arcLength;
    
    if (segmentEnd > segmentStart) {
      svgParts.push(`<line x1="${x + cornerRadius + segmentStart}" y1="${y + squareSize}" x2="${x + cornerRadius + segmentEnd}" y2="${y + squareSize}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`);
    }
  }
}

// Обработка изменения размера окна
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  redraw();
}

// Функция настройки горячих клавиш
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', function(event) {
    // Проверяем комбинацию Cmd+E (на Mac) или Ctrl+E (на PC) для экспорта
    if ((event.metaKey || event.ctrlKey) && event.key === 'e') {
      event.preventDefault(); // Предотвращаем стандартное поведение браузера
      exportSVG(); // Вызываем функцию экспорта
    }
    
    // Проверяем комбинацию Cmd+Shift+Z (на Mac) или Ctrl+Shift+Z (на PC) для redo
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'Z') {
      event.preventDefault(); // Предотвращаем стандартное поведение браузера
      redoLastChange(); // Вызываем функцию redo
    }
    // Проверяем комбинацию Cmd+Z (на Mac) или Ctrl+Z (на PC) для отмены
    else if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
      event.preventDefault(); // Предотвращаем стандартное поведение браузера
      undoLastChange(); // Вызываем функцию отмены
    }
  });
}

// Функция немедленного сохранения текущего состояния в историю
function saveCurrentStateImmediately() {
  if (isUpdatingControls) return; // Не сохраняем состояние при программном обновлении
  
  stateHistory.push(getCurrentState());
  
  // При новом изменении очищаем redo историю
  redoHistory = [];
  
  // Ограничиваем размер истории
  if (stateHistory.length > maxHistorySize) {
    stateHistory.shift(); // Удаляем самый старый элемент
  }
}

// Функция отмены последнего изменения
function undoLastChange() {
  if (stateHistory.length === 0) {
    return; // Нет истории для отмены
  }
  
  // Сохраняем текущее состояние в redo историю
  redoHistory.push(getCurrentState());
  
  // Ограничиваем размер redo истории
  if (redoHistory.length > maxHistorySize) {
    redoHistory.shift();
  }
  
  // Получаем предыдущее состояние
  let previousState = stateHistory.pop();
  
  // Устанавливаем флаг обновления
  isUpdatingControls = true;
  
  // Восстанавливаем состояние
  restoreState(previousState);
  
  // Обновляем интерфейс
  updateAllControls();
  
  // Сбрасываем флаг обновления
  isUpdatingControls = false;
  
  // Инвалидируем кэш и перерисовываем
  cacheValid = false;
  redraw();
}

// Функция повтора последнего отмененного изменения
function redoLastChange() {
  if (redoHistory.length === 0) {
    return; // Нет истории для повтора
  }
  
  // Сохраняем текущее состояние в undo историю
  stateHistory.push(getCurrentState());
  
  // Ограничиваем размер undo истории
  if (stateHistory.length > maxHistorySize) {
    stateHistory.shift();
  }
  
  // Получаем состояние для повтора
  let redoState = redoHistory.pop();
  
  // Устанавливаем флаг обновления
  isUpdatingControls = true;
  
  // Восстанавливаем состояние
  restoreState(redoState);
  
  // Обновляем интерфейс
  updateAllControls();
  
  // Сбрасываем флаг обновления
  isUpdatingControls = false;
  
  // Инвалидируем кэш и перерисовываем
  cacheValid = false;
  redraw();
}

// Функция обновления всех контролов в интерфейсе
function updateAllControls() {
  // Устанавливаем флаг обновления
  isUpdatingControls = true;
  
  // Обновляем слайдеры и их значения
  if (domElements.radiusSlider && domElements.radiusValue) {
    domElements.radiusSlider.value = cornerRadiusPercent;
    domElements.radiusValue.textContent = cornerRadiusPercent + '%';
  }
  
  if (domElements.lengthSlider && domElements.lengthValue) {
    domElements.lengthSlider.value = lineLengthPercent;
    domElements.lengthValue.textContent = lineLengthPercent + '%';
  }
  
  if (domElements.lengthBSlider && domElements.lengthBValue) {
    domElements.lengthBSlider.value = lineBLengthPercent;
    domElements.lengthBValue.textContent = lineBLengthPercent + '%';
  }
  
  if (domElements.thicknessSlider && domElements.thicknessValue) {
    domElements.thicknessSlider.value = lineWeightPercent;
    domElements.thicknessValue.textContent = lineWeightPercent + '%';
  }
  
  if (domElements.spacingSlider && domElements.spacingValue) {
    domElements.spacingSlider.value = spacingPercent;
    domElements.spacingValue.textContent = spacingPercent + '%';
  }
  
  if (domElements.sizeSlider && domElements.sizeValue) {
    domElements.sizeSlider.value = squareSize;
    domElements.sizeValue.textContent = squareSize + 'px';
  }
  
  // Обновляем чекбоксы
  if (domElements.capsCheckbox) {
    domElements.capsCheckbox.checked = roundCaps;
  }
  
  if (domElements.checkerboardCheckbox) {
    domElements.checkerboardCheckbox.checked = checkerboardMode;
  }
  
  if (domElements.bothSquaresCheckbox) {
    domElements.bothSquaresCheckbox.checked = bothSquaresBMode;
  }
  
  // Сбрасываем флаг обновления
  isUpdatingControls = false;
}

// Функция обновления кэша вычислений
function updateCache() {
  cachedCornerRadius = (cornerRadiusPercent / 100) * squareSize;
  cachedLineWeight = (lineWeightPercent / 100) * squareSize;
  
  // Если значение 0, используем 0.01% чтобы линии не исчезали полностью
  let actualLengthPercent = lineLengthPercent === 0 ? 0.01 : lineLengthPercent;
  cachedLineLength = (actualLengthPercent / 100) * squareSize;
  
  cachedCrossSize = squareSize * 2;
  cachedSpacing = (spacingPercent / 100) * cachedCrossSize;
  cachedGridStep = cachedCrossSize + cachedSpacing;
  
  cacheValid = true;
}

// Функция получения текущего состояния приложения
function getCurrentState() {
  return {
    squareSize: squareSize,
    lineWeightPercent: lineWeightPercent,
    cornerRadiusPercent: cornerRadiusPercent,
    lineLengthPercent: lineLengthPercent,
    roundCaps: roundCaps,
    spacingPercent: spacingPercent,
    checkerboardMode: checkerboardMode,
    lineBLengthPercent: lineBLengthPercent,
    bothSquaresBMode: bothSquaresBMode
  };
}

// Функция восстановления состояния приложения
function restoreState(state) {
  squareSize = state.squareSize;
  lineWeightPercent = state.lineWeightPercent;
  cornerRadiusPercent = state.cornerRadiusPercent;
  lineLengthPercent = state.lineLengthPercent;
  roundCaps = state.roundCaps;
  spacingPercent = state.spacingPercent;
  checkerboardMode = state.checkerboardMode;
  lineBLengthPercent = state.lineBLengthPercent;
  bothSquaresBMode = state.bothSquaresBMode;
} 