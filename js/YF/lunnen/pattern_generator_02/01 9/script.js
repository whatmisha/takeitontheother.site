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

// Система отмены изменений
let stateHistory = [];
let redoHistory = []; // Массив для хранения отмененных состояний
let maxHistorySize = 50; // Максимальное количество шагов в истории
let isUpdatingControls = false; // Флаг для предотвращения циклических обновлений
let isInteractingWithControl = false; // Флаг активного взаимодействия с контролом

function setup() {
  // Создаем канвас
  createCanvas(windowWidth, windowHeight);
  // Устанавливаем цвет фона
  background(0);
  // Устанавливаем режим отрисовки
  noFill();
  stroke(255);
  
  // Настраиваем обработчики событий для HTML контролов
  setupHTMLControls();
  
  // Добавляем обработчик клавиатуры для хоткеев
  setupKeyboardShortcuts();
  
  // Определяем платформу для кнопки экспорта
  setupPlatformSpecificUI();
  
  // Сохраняем начальное состояние сразу (без debounce)
  saveCurrentStateImmediately();
}

// Функция настройки HTML контролов
function setupHTMLControls() {
  // Слайдеры
  const radiusSlider = document.getElementById('radius-slider');
  const lengthSlider = document.getElementById('length-slider');
  const lengthBSlider = document.getElementById('length-b-slider');
  const thicknessSlider = document.getElementById('thickness-slider');
  const spacingSlider = document.getElementById('spacing-slider');
  const sizeSlider = document.getElementById('size-slider');
  
  // Значения слайдеров
  const radiusValue = document.getElementById('radius-value');
  const lengthValue = document.getElementById('length-value');
  const lengthBValue = document.getElementById('length-b-value');
  const thicknessValue = document.getElementById('thickness-value');
  const spacingValue = document.getElementById('spacing-value');
  const sizeValue = document.getElementById('size-value');
  
  // Чекбоксы
  const capsCheckbox = document.getElementById('caps-checkbox');
  const checkerboardCheckbox = document.getElementById('checkerboard-checkbox');
  const bothSquaresCheckbox = document.getElementById('both-squares-checkbox');
  
  // Кнопка экспорта
  const exportButton = document.getElementById('export-button');
  
  // Обработчики для слайдеров с сохранением состояния
  setupSliderWithHistory(radiusSlider, radiusValue, (value) => {
    cornerRadiusPercent = value;
    radiusValue.textContent = value + '%';
    loop();
  });
  
  setupSliderWithHistory(lengthSlider, lengthValue, (value) => {
    lineLengthPercent = value;
    lengthValue.textContent = value + '%';
    loop();
  });
  
  setupSliderWithHistory(lengthBSlider, lengthBValue, (value) => {
    lineBLengthPercent = value;
    lengthBValue.textContent = value + '%';
    loop();
  });
  
  setupSliderWithHistory(thicknessSlider, thicknessValue, (value) => {
    lineWeightPercent = value;
    thicknessValue.textContent = value + '%';
    loop();
  });
  
  setupSliderWithHistory(spacingSlider, spacingValue, (value) => {
    spacingPercent = value;
    spacingValue.textContent = value + '%';
    loop();
  });
  
  setupSliderWithHistory(sizeSlider, sizeValue, (value) => {
    squareSize = value;
    sizeValue.textContent = value + 'px';
    loop();
  });
  
  // Обработчики для чекбоксов
  capsCheckbox.addEventListener('change', () => {
    if (!isUpdatingControls) {
      saveCurrentStateImmediately();
    }
    roundCaps = capsCheckbox.checked;
    loop();
  });
  
  checkerboardCheckbox.addEventListener('change', () => {
    if (!isUpdatingControls) {
      saveCurrentStateImmediately();
    }
    checkerboardMode = checkerboardCheckbox.checked;
    loop();
  });
  
  bothSquaresCheckbox.addEventListener('change', () => {
    if (!isUpdatingControls) {
      saveCurrentStateImmediately();
    }
    bothSquaresBMode = bothSquaresCheckbox.checked;
    loop();
  });
  
  // Обработчик для кнопки экспорта
  exportButton.addEventListener('click', exportSVG);
}

// Функция настройки слайдера с сохранением истории
function setupSliderWithHistory(slider, valueDisplay, callback) {
  // Обработчик начала взаимодействия
  slider.addEventListener('mousedown', () => {
    if (!isUpdatingControls && !isInteractingWithControl) {
      saveCurrentStateImmediately();
      isInteractingWithControl = true;
    }
  });
  
  slider.addEventListener('mouseup', () => {
    isInteractingWithControl = false;
  });
  
  // Для сенсорных устройств
  slider.addEventListener('touchstart', () => {
    if (!isUpdatingControls && !isInteractingWithControl) {
      saveCurrentStateImmediately();
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
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const macShortcut = document.querySelector('.mac-shortcut');
  const pcShortcut = document.querySelector('.pc-shortcut');
  
  if (isMac) {
    macShortcut.style.display = 'inline';
    pcShortcut.style.display = 'none';
  } else {
    macShortcut.style.display = 'none';
    pcShortcut.style.display = 'inline';
  }
}

function draw() {
  // Очищаем канвас
  background(0);
  
  // Вычисляем параметры в пикселях на основе процентов
  let cornerRadius = (cornerRadiusPercent / 100) * squareSize;
  let lineWeight = (lineWeightPercent / 100) * squareSize;
  
  // Вычисляем длину линий в пикселях на основе процентов
  // Если значение 0, используем 0.01% чтобы линии не исчезали полностью
  let actualLengthPercent = lineLengthPercent === 0 ? 0.01 : lineLengthPercent;
  let lineLength = (actualLengthPercent / 100) * squareSize;
  
  // Размер креста (два квадрата)
  let crossSize = squareSize * 2;
  // Расстояние между крестами в пикселях
  let spacing = (spacingPercent / 100) * crossSize;
  // Общий шаг сетки (размер креста + расстояние)
  let gridStep = crossSize + spacing;
  
  // Устанавливаем параметры для рисования
  noFill();
  stroke(255);
  strokeWeight(lineWeight);
  // Устанавливаем тип окончаний штрихов
  if (roundCaps) {
    strokeCap(ROUND);
  } else {
    strokeCap(SQUARE);
  }
  
  // Вычисляем количество крестов, которые поместятся на экране
  let startX = -gridStep;
  let startY = -gridStep;
  let endX = width + gridStep;
  let endY = height + gridStep;
  
  // Рисуем сетку крестов
  let rowIndex = 0;
  let currentY = startY;
  
  while (currentY < endY) {
    let colIndex = 0;
    for (let x = startX; x < endX; x += gridStep) {
      // В шахматном режиме сдвигаем каждую вторую строку
      let offsetX = x;
      if (checkerboardMode && rowIndex % 2 === 1) {
        offsetX = x + gridStep / 2;
      }
      
      push();
      translate(offsetX, currentY);
      
      // Рисуем один крест (квадрат Б + квадрат А)
      drawCross(cornerRadius, lineLength);
      
      pop();
      colIndex++;
    }
    
    // Вычисляем шаг по вертикали
    if (checkerboardMode) {
      // В шахматном режиме используем вертикальный шаг равный половине горизонтального
      currentY += gridStep / 2;
    } else {
      // Обычный режим
      currentY += gridStep;
    }
    
    rowIndex++;
  }
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
  // Вычисляем параметры
  let cornerRadius = (cornerRadiusPercent / 100) * squareSize;
  let lineWeight = (lineWeightPercent / 100) * squareSize;
  let actualLengthPercent = lineLengthPercent === 0 ? 0.01 : lineLengthPercent;
  let lineLength = (actualLengthPercent / 100) * squareSize;
  
  let crossSize = squareSize * 2;
  let spacing = (spacingPercent / 100) * crossSize;
  let gridStep = crossSize + spacing;
  
  // Размеры SVG (размер экрана)
  let svgWidth = windowWidth;
  let svgHeight = windowHeight;
  
  // Начало SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`;
  svg += `<rect width="100%" height="100%" fill="black"/>`;
  
  // Вычисляем границы для рисования
  let startX = -gridStep;
  let startY = -gridStep;
  let endX = svgWidth + gridStep;
  let endY = svgHeight + gridStep;
  
  // Рисуем сетку крестов
  let rowIndex = 0;
  let currentY = startY;
  
  while (currentY < endY) {
    for (let x = startX; x < endX; x += gridStep) {
      // В шахматном режиме сдвигаем каждую вторую строку
      let offsetX = x;
      if (checkerboardMode && rowIndex % 2 === 1) {
        offsetX = x + gridStep / 2;
      }
      
      // Генерируем SVG для одного креста
      svg += generateCrossSVG(offsetX, currentY, cornerRadius, lineLength, lineWeight);
    }
    
    // Вычисляем шаг по вертикали
    if (checkerboardMode) {
      currentY += gridStep / 2;
    } else {
      currentY += gridStep;
    }
    
    rowIndex++;
  }
  
  svg += '</svg>';
  return svg;
}

// Функция генерации SVG для одного креста
function generateCrossSVG(x, y, cornerRadius, lineLength, lineWeight) {
  let svg = '';
  let capStyle = roundCaps ? 'round' : 'square';
  
  if (bothSquaresBMode) {
    // Режим двух дуг
    // Первый квадрат Б (верхний правый)
    svg += generateSquareBSVG(x, y, cornerRadius, lineWeight, capStyle);
    
    // Второй квадрат Б (нижний левый) - отраженный по обеим осям
    // Позиция нижнего левого квадрата
    let aX = x - squareSize;
    let aY = y + squareSize;
    
    // Для отражения по обеим осям в SVG используем transform
    svg += `<g transform="translate(${aX + squareSize}, ${aY + squareSize}) scale(-1, -1) translate(${-squareSize}, ${-squareSize})">`;
    svg += generateSquareBSVG(0, 0, cornerRadius, lineWeight, capStyle);
    svg += '</g>';
  } else {
    // Обычный режим (квадрат Б + квадрат А)
    // Квадрат Б (верхний правый)
    svg += generateSquareBSVG(x, y, cornerRadius, lineWeight, capStyle);
    
    // Квадрат А (нижний левый)
    let aX = x - squareSize;
    let aY = y + squareSize;
    
    // Верхняя грань квадрата А
    svg += `<line x1="${aX}" y1="${aY}" x2="${aX + lineLength}" y2="${aY}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`;
    
    // Правая грань квадрата А
    svg += `<line x1="${aX + squareSize}" y1="${aY + squareSize - lineLength}" x2="${aX + squareSize}" y2="${aY + squareSize}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`;
  }
  
  return svg;
}

// Функция генерации SVG для квадрата Б
function generateSquareBSVG(x, y, cornerRadius, lineWeight, capStyle) {
  let actualLengthPercent = lineBLengthPercent === 0 ? 0.01 : lineBLengthPercent;
  
  // Вычисляем общую длину линии
  let verticalLength = squareSize - cornerRadius;
  let arcLength = (PI / 2) * cornerRadius;
  let horizontalLength = squareSize - cornerRadius;
  let fullLength = verticalLength + arcLength + horizontalLength;
  
  let desiredLength = (actualLengthPercent / 100) * fullLength;
  
  if (desiredLength >= fullLength) {
    // Полная линия
    return generateFullSquareBSVG(x, y, cornerRadius, lineWeight, capStyle);
  } else {
    // Сегменты с разрывом
    let segment1Length = desiredLength / 2;
    let segment2Start = fullLength - desiredLength / 2;
    
    let svg1 = generateSquareBSegmentSVG(x, y, cornerRadius, lineWeight, capStyle, 0, segment1Length, verticalLength, arcLength);
    let svg2 = generateSquareBSegmentSVG(x, y, cornerRadius, lineWeight, capStyle, segment2Start, fullLength, verticalLength, arcLength);
    
    return svg1 + svg2;
  }
}

// Функция генерации SVG для полного квадрата Б
function generateFullSquareBSVG(x, y, cornerRadius, lineWeight, capStyle) {
  let svg = '';
  
  if (cornerRadius <= 0) {
    // Прямые линии
    svg += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + squareSize}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`;
    svg += `<line x1="${x}" y1="${y + squareSize}" x2="${x + squareSize}" y2="${y + squareSize}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`;
  } else {
    // Левая грань
    svg += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + squareSize - cornerRadius}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`;
    
    // Дуга скругления - простой подход
    // От точки (x, y + squareSize - cornerRadius) к точке (x + cornerRadius, y + squareSize)
    // Это создает вогнутую дугу в левом нижнем углу
    svg += `<path d="M ${x} ${y + squareSize - cornerRadius} A ${cornerRadius} ${cornerRadius} 0 0 0 ${x + cornerRadius} ${y + squareSize}" stroke="white" stroke-width="${lineWeight}" fill="none" stroke-linecap="${capStyle}"/>`;
    
    // Нижняя грань
    svg += `<line x1="${x + cornerRadius}" y1="${y + squareSize}" x2="${x + squareSize}" y2="${y + squareSize}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`;
  }
  
  return svg;
}

// Функция генерации SVG для сегмента квадрата Б
function generateSquareBSegmentSVG(x, y, cornerRadius, lineWeight, capStyle, startPos, endPos, verticalLength, arcLength) {
  let svg = '';
  let length = endPos - startPos;
  
  if (length <= 0) return svg;
  
  if (startPos < verticalLength) {
    // Вертикальная часть
    let segmentStart = startPos;
    let segmentEnd = min(endPos, verticalLength);
    if (segmentEnd > segmentStart) {
      svg += `<line x1="${x}" y1="${y + segmentStart}" x2="${x}" y2="${y + segmentEnd}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`;
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
      svg += `<path d="M ${startX} ${startY} A ${cornerRadius} ${cornerRadius} 0 0 0 ${endX} ${endY}" stroke="white" stroke-width="${lineWeight}" fill="none" stroke-linecap="${capStyle}"/>`;
    }
  }
  
  if (endPos > verticalLength + arcLength) {
    // Горизонтальная часть
    let segmentStart = max(0, startPos - verticalLength - arcLength);
    let segmentEnd = endPos - verticalLength - arcLength;
    
    if (segmentEnd > segmentStart) {
      svg += `<line x1="${x + cornerRadius + segmentStart}" y1="${y + squareSize}" x2="${x + cornerRadius + segmentEnd}" y2="${y + squareSize}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`;
    }
  }
  
  return svg;
}

// Обработка изменения размера окна
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
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
  
  let currentState = {
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
  
  stateHistory.push(currentState);
  
  // При новом изменении очищаем redo историю
  redoHistory = [];
  
  // Ограничиваем размер истории
  if (stateHistory.length > maxHistorySize) {
    stateHistory.shift(); // Удаляем самый старый элемент
  }
}

// Функция сохранения текущего состояния в историю с debouncing (убираем, заменяем на немедленное сохранение)
function saveStateToHistory() {
  // Эта функция больше не нужна, но оставляем для совместимости
  saveCurrentStateImmediately();
}

// Функция отмены последнего изменения
function undoLastChange() {
  if (stateHistory.length === 0) {
    return; // Нет истории для отмены
  }
  
  // Сохраняем текущее состояние в redo историю
  let currentState = {
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
  
  redoHistory.push(currentState);
  
  // Ограничиваем размер redo истории
  if (redoHistory.length > maxHistorySize) {
    redoHistory.shift();
  }
  
  // Получаем предыдущее состояние
  let previousState = stateHistory.pop();
  
  // Устанавливаем флаг обновления
  isUpdatingControls = true;
  
  // Восстанавливаем все параметры
  squareSize = previousState.squareSize;
  lineWeightPercent = previousState.lineWeightPercent;
  cornerRadiusPercent = previousState.cornerRadiusPercent;
  lineLengthPercent = previousState.lineLengthPercent;
  roundCaps = previousState.roundCaps;
  spacingPercent = previousState.spacingPercent;
  checkerboardMode = previousState.checkerboardMode;
  lineBLengthPercent = previousState.lineBLengthPercent;
  bothSquaresBMode = previousState.bothSquaresBMode;
  
  // Обновляем интерфейс
  updateAllControls();
  
  // Сбрасываем флаг обновления
  isUpdatingControls = false;
  
  // Перерисовываем
  loop();
}

// Функция повтора последнего отмененного изменения
function redoLastChange() {
  if (redoHistory.length === 0) {
    return; // Нет истории для повтора
  }
  
  // Сохраняем текущее состояние в undo историю
  let currentState = {
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
  
  stateHistory.push(currentState);
  
  // Ограничиваем размер undo истории
  if (stateHistory.length > maxHistorySize) {
    stateHistory.shift();
  }
  
  // Получаем состояние для повтора
  let redoState = redoHistory.pop();
  
  // Устанавливаем флаг обновления
  isUpdatingControls = true;
  
  // Восстанавливаем все параметры
  squareSize = redoState.squareSize;
  lineWeightPercent = redoState.lineWeightPercent;
  cornerRadiusPercent = redoState.cornerRadiusPercent;
  lineLengthPercent = redoState.lineLengthPercent;
  roundCaps = redoState.roundCaps;
  spacingPercent = redoState.spacingPercent;
  checkerboardMode = redoState.checkerboardMode;
  lineBLengthPercent = redoState.lineBLengthPercent;
  bothSquaresBMode = redoState.bothSquaresBMode;
  
  // Обновляем интерфейс
  updateAllControls();
  
  // Сбрасываем флаг обновления
  isUpdatingControls = false;
  
  // Перерисовываем
  loop();
}

// Функция обновления всех контролов в интерфейсе
function updateAllControls() {
  // Устанавливаем флаг обновления
  isUpdatingControls = true;
  
  // Обновляем слайдеры и их значения
  const radiusSlider = document.getElementById('radius-slider');
  const radiusValue = document.getElementById('radius-value');
  if (radiusSlider && radiusValue) {
    radiusSlider.value = cornerRadiusPercent;
    radiusValue.textContent = cornerRadiusPercent + '%';
  }
  
  const lengthSlider = document.getElementById('length-slider');
  const lengthValue = document.getElementById('length-value');
  if (lengthSlider && lengthValue) {
    lengthSlider.value = lineLengthPercent;
    lengthValue.textContent = lineLengthPercent + '%';
  }
  
  const lengthBSlider = document.getElementById('length-b-slider');
  const lengthBValue = document.getElementById('length-b-value');
  if (lengthBSlider && lengthBValue) {
    lengthBSlider.value = lineBLengthPercent;
    lengthBValue.textContent = lineBLengthPercent + '%';
  }
  
  const thicknessSlider = document.getElementById('thickness-slider');
  const thicknessValue = document.getElementById('thickness-value');
  if (thicknessSlider && thicknessValue) {
    thicknessSlider.value = lineWeightPercent;
    thicknessValue.textContent = lineWeightPercent + '%';
  }
  
  const spacingSlider = document.getElementById('spacing-slider');
  const spacingValue = document.getElementById('spacing-value');
  if (spacingSlider && spacingValue) {
    spacingSlider.value = spacingPercent;
    spacingValue.textContent = spacingPercent + '%';
  }
  
  const sizeSlider = document.getElementById('size-slider');
  const sizeValue = document.getElementById('size-value');
  if (sizeSlider && sizeValue) {
    sizeSlider.value = squareSize;
    sizeValue.textContent = squareSize + 'px';
  }
  
  // Обновляем чекбоксы
  const capsCheckbox = document.getElementById('caps-checkbox');
  if (capsCheckbox) {
    capsCheckbox.checked = roundCaps;
  }
  
  const checkerboardCheckbox = document.getElementById('checkerboard-checkbox');
  if (checkerboardCheckbox) {
    checkerboardCheckbox.checked = checkerboardMode;
  }
  
  const bothSquaresCheckbox = document.getElementById('both-squares-checkbox');
  if (bothSquaresCheckbox) {
    bothSquaresCheckbox.checked = bothSquaresBMode;
  }
  
  // Сбрасываем флаг обновления
  isUpdatingControls = false;
} 