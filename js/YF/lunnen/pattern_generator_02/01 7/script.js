// Размеры и параметры
let squareSize = 20; // Размер квадрата в пикселях
let lineWeightPercent = 3; // Толщина линий в процентах от размера квадрата
let cornerRadiusPercent = 50; // Радиус скругления в процентах от размера квадрата
let lineLengthPercent = 50; // Длина линий квадрата А в процентах
let roundCaps = true; // Круглые окончания штрихов по умолчанию
let spacingPercent = 50; // Расстояние между крестами в процентах от размера креста
let checkerboardMode = true; // Шахматный режим расстановки включен по умолчанию
let lineBLengthPercent = 100; // Длина линии квадрата Б в процентах
let controlsContainer; // Контейнер для всех контролов

// Ссылки на элементы интерфейса для прямого обновления
let controlElements = {
  radiusSlider: null,
  radiusLabel: null,
  lengthSlider: null,
  lengthLabel: null,
  lengthBSlider: null,
  lengthBLabel: null,
  thicknessSlider: null,
  thicknessLabel: null,
  spacingSlider: null,
  spacingLabel: null,
  sizeSlider: null,
  sizeLabel: null,
  capsCheckbox: null,
  checkerboardCheckbox: null
};

// Система отмены изменений
let stateHistory = [];
let redoHistory = []; // Массив для хранения отмененных состояний
let maxHistorySize = 50; // Максимальное количество шагов в истории
let isUpdatingControls = false; // Флаг для предотвращения циклических обновлений
let debounceTimeout = null; // Таймер для debouncing
let pendingStateUpdate = false; // Флаг ожидающего обновления состояния
let isInteractingWithControl = false; // Флаг активного взаимодействия с контролом

function setup() {
  // Создаем канвас
  createCanvas(windowWidth, windowHeight);
  // Устанавливаем цвет фона
  background(0);
  // Устанавливаем режим отрисовки
  noFill();
  stroke(255);
  
  // Создаем контейнер для контролов
  createControlsPanel();
  
  // Добавляем обработчик клавиатуры для хоткеев
  setupKeyboardShortcuts();
  
  // Сохраняем начальное состояние сразу (без debounce)
  saveCurrentStateImmediately();
}

// Функция создания панели контролов
function createControlsPanel() {
  // Создаем основной контейнер
  controlsContainer = createDiv('');
  controlsContainer.style('position', 'fixed');
  controlsContainer.style('bottom', '20px');
  controlsContainer.style('right', '20px');
  controlsContainer.style('background', '#606060'); // Светлее предыдущего #404040
  controlsContainer.style('padding', '20px');
  controlsContainer.style('border-radius', '6px');
  controlsContainer.style('font-family', 'Arial, sans-serif');
  controlsContainer.style('font-size', '14px');
  controlsContainer.style('color', 'black');
  controlsContainer.style('width', '280px'); // Увеличено с 240px до 280px
  
  // Создаем контролы и сохраняем ссылки
  let radiusControl = createControl('Радиус скругления', 'range', 0, 100, cornerRadiusPercent, updateRadius);
  controlElements.radiusSlider = radiusControl.slider;
  controlElements.radiusLabel = radiusControl.label;
  
  let lengthControl = createControl('Длина линий квадрата А', 'range', 0, 100, lineLengthPercent, updateLength);
  controlElements.lengthSlider = lengthControl.slider;
  controlElements.lengthLabel = lengthControl.label;
  
  let lengthBControl = createControl('Длина линии квадрата Б', 'range', 0, 100, lineBLengthPercent, updateLineBLength);
  controlElements.lengthBSlider = lengthBControl.slider;
  controlElements.lengthBLabel = lengthBControl.label;
  
  let thicknessControl = createControl('Толщина линий', 'range', 1, 100, lineWeightPercent, updateThickness);
  controlElements.thicknessSlider = thicknessControl.slider;
  controlElements.thicknessLabel = thicknessControl.label;
  
  let spacingControl = createControl('Расстояние между крестами', 'range', 0, 100, spacingPercent, updateSpacing);
  controlElements.spacingSlider = spacingControl.slider;
  controlElements.spacingLabel = spacingControl.label;
  
  let sizeControl = createControl('Размер креста', 'range', 10, 200, squareSize, updateSize);
  controlElements.sizeSlider = sizeControl.slider;
  controlElements.sizeLabel = sizeControl.label;
  
  // Создаем чекбокс
  let checkboxContainer = createDiv('');
  checkboxContainer.style('margin-top', '15px');
  checkboxContainer.parent(controlsContainer);
  
  controlElements.capsCheckbox = createCheckbox('Круглые окончания', roundCaps);
  controlElements.capsCheckbox.style('color', 'black');
  controlElements.capsCheckbox.style('font-family', 'Arial, sans-serif');
  controlElements.capsCheckbox.style('font-size', '14px');
  controlElements.capsCheckbox.changed(updateCaps);
  controlElements.capsCheckbox.parent(checkboxContainer);
  
  // Создаем чекбокс для шахматного режима
  let checkerboardContainer = createDiv('');
  checkerboardContainer.style('margin-top', '10px');
  checkerboardContainer.parent(controlsContainer);
  
  controlElements.checkerboardCheckbox = createCheckbox('Шахматный порядок', checkerboardMode);
  controlElements.checkerboardCheckbox.style('color', 'black');
  controlElements.checkerboardCheckbox.style('font-family', 'Arial, sans-serif');
  controlElements.checkerboardCheckbox.style('font-size', '14px');
  controlElements.checkerboardCheckbox.changed(updateCheckerboard);
  controlElements.checkerboardCheckbox.parent(checkerboardContainer);
  
  // Создаем кнопку экспорта SVG
  let buttonContainer = createDiv('');
  buttonContainer.style('margin-top', '15px');
  buttonContainer.parent(controlsContainer);
  
  // Определяем текст для кнопки в зависимости от операционной системы
  let isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  let buttonText = isMac ? 'SVG (⌘E)' : 'SVG (Ctrl+E)';
  
  let svgButton = createButton(buttonText);
  svgButton.style('background', 'white');
  svgButton.style('color', 'black');
  svgButton.style('border', '1px solid black');
  svgButton.style('padding', '8px 16px');
  svgButton.style('border-radius', '4px');
  svgButton.style('font-family', 'Arial, sans-serif');
  svgButton.style('font-size', '14px');
  svgButton.style('cursor', 'pointer');
  svgButton.style('width', '100%');
  svgButton.mousePressed(exportSVG);
  svgButton.parent(buttonContainer);
}

// Функция создания одного контрола
function createControl(label, type, min, max, value, callback) {
  // Контейнер для контрола
  let container = createDiv('');
  container.style('margin-bottom', '15px');
  container.parent(controlsContainer);
  
  // Лейбл
  let labelDiv = createDiv(label + ': ' + (type === 'range' && max <= 100 ? value + '%' : value + (max > 100 ? 'px' : '')));
  labelDiv.style('margin-bottom', '5px');
  labelDiv.style('font-size', '14px');
  labelDiv.style('color', 'black');
  labelDiv.parent(container);
  
  // Слайдер
  let slider = createSlider(min, max, value);
  slider.style('width', '100%');
  slider.style('height', '1px');
  slider.style('background', 'black');
  slider.style('outline', 'none');
  slider.style('-webkit-appearance', 'none');
  slider.style('appearance', 'none');
  slider.parent(container);
  
  // Стили для круглого элемента слайдера (thumb)
  let sliderElement = slider.elt;
  let style = document.createElement('style');
  style.textContent = `
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      height: 12px;
      width: 12px;
      border-radius: 50%;
      background: black;
      cursor: pointer;
    }
    
    input[type="range"]::-moz-range-thumb {
      height: 12px;
      width: 12px;
      border-radius: 50%;
      background: black;
      cursor: pointer;
      border: none;
    }
  `;
  document.head.appendChild(style);
  
  // Обработчик начала взаимодействия (нажатие на слайдер)
  sliderElement.addEventListener('mousedown', function() {
    if (!isUpdatingControls && !isInteractingWithControl) {
      saveCurrentStateImmediately(); // Сохраняем состояние только при начале взаимодействия
      isInteractingWithControl = true;
    }
  });
  
  // Обработчик окончания взаимодействия (отпускание мыши)
  sliderElement.addEventListener('mouseup', function() {
    isInteractingWithControl = false;
  });
  
  // Для сенсорных устройств
  sliderElement.addEventListener('touchstart', function() {
    if (!isUpdatingControls && !isInteractingWithControl) {
      saveCurrentStateImmediately();
      isInteractingWithControl = true;
    }
  });
  
  sliderElement.addEventListener('touchend', function() {
    isInteractingWithControl = false;
  });
  
  // Обработчик изменения - теперь НЕ сохраняет состояние
  slider.input(() => {
    let newValue = slider.value();
    let unit = max <= 100 ? '%' : (max > 100 ? 'px' : '');
    labelDiv.html(label + ': ' + newValue + unit);
    callback(newValue);
  });
  
  // Возвращаем ссылки на созданные элементы
  return {
    container: container,
    label: labelDiv,
    slider: slider
  };
}

// Функция обновления радиуса при изменении слайдера
function updateRadius(newValue) {
  // Убираем сохранение состояния отсюда - теперь оно происходит при нажатии на слайдер
  cornerRadiusPercent = newValue;
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления длины линий при изменении слайдера
function updateLength(newValue) {
  // Убираем сохранение состояния отсюда - теперь оно происходит при нажатии на слайдер
  lineLengthPercent = newValue;
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления толщины линий при изменении слайдера
function updateThickness(newValue) {
  // Убираем сохранение состояния отсюда - теперь оно происходит при нажатии на слайдер
  lineWeightPercent = newValue;
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления окончаний штрихов при изменении чекбокса
function updateCaps() {
  if (!isUpdatingControls) {
    saveCurrentStateImmediately(); // Для чекбоксов оставляем сохранение, так как это однократное действие
  }
  // Получаем состояние чекбокса из события
  roundCaps = this.checked();
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления расстояния между крестами при изменении слайдера
function updateSpacing(newValue) {
  // Убираем сохранение состояния отсюда - теперь оно происходит при нажатии на слайдер
  spacingPercent = newValue;
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления размера креста при изменении слайдера
function updateSize(newValue) {
  // Убираем сохранение состояния отсюда - теперь оно происходит при нажатии на слайдер
  squareSize = newValue;
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления шахматного режима при изменении чекбокса
function updateCheckerboard() {
  if (!isUpdatingControls) {
    saveCurrentStateImmediately(); // Для чекбоксов оставляем сохранение, так как это однократное действие
  }
  // Получаем состояние чекбокса из события
  checkerboardMode = this.checked();
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления длины линии квадрата Б при изменении слайдера
function updateLineBLength(newValue) {
  // Убираем сохранение состояния отсюда - теперь оно происходит при нажатии на слайдер
  lineBLengthPercent = newValue;
  loop(); // Перезапускаем цикл отрисовки
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
  
  // Квадрат Б (верхний правый)
  svg += generateSquareBSVG(x, y, cornerRadius, lineWeight, capStyle);
  
  // Квадрат А (нижний левый)
  let aX = x - squareSize;
  let aY = y + squareSize;
  
  // Верхняя грань квадрата А
  svg += `<line x1="${aX}" y1="${aY}" x2="${aX + lineLength}" y2="${aY}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`;
  
  // Правая грань квадрата А
  svg += `<line x1="${aX + squareSize}" y1="${aY + squareSize - lineLength}" x2="${aX + squareSize}" y2="${aY + squareSize}" stroke="white" stroke-width="${lineWeight}" stroke-linecap="${capStyle}"/>`;
  
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
    lineBLengthPercent: lineBLengthPercent
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
    lineBLengthPercent: lineBLengthPercent
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
    lineBLengthPercent: lineBLengthPercent
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
  
  // Обновляем интерфейс
  updateAllControls();
  
  // Сбрасываем флаг обновления
  isUpdatingControls = false;
  
  // Перерисовываем
  loop();
}

// Функция обновления всех контролов в интерфейсе
function updateAllControls() {
  // Обновляем слайдеры и их лейблы
  if (controlElements.radiusSlider && controlElements.radiusLabel) {
    controlElements.radiusSlider.value(cornerRadiusPercent);
    controlElements.radiusLabel.html('Радиус скругления: ' + cornerRadiusPercent + '%');
  }
  
  if (controlElements.lengthSlider && controlElements.lengthLabel) {
    controlElements.lengthSlider.value(lineLengthPercent);
    controlElements.lengthLabel.html('Длина линий квадрата А: ' + lineLengthPercent + '%');
  }
  
  if (controlElements.lengthBSlider && controlElements.lengthBLabel) {
    controlElements.lengthBSlider.value(lineBLengthPercent);
    controlElements.lengthBLabel.html('Длина линии квадрата Б: ' + lineBLengthPercent + '%');
  }
  
  if (controlElements.thicknessSlider && controlElements.thicknessLabel) {
    controlElements.thicknessSlider.value(lineWeightPercent);
    controlElements.thicknessLabel.html('Толщина линий: ' + lineWeightPercent + '%');
  }
  
  if (controlElements.spacingSlider && controlElements.spacingLabel) {
    controlElements.spacingSlider.value(spacingPercent);
    controlElements.spacingLabel.html('Расстояние между крестами: ' + spacingPercent + '%');
  }
  
  if (controlElements.sizeSlider && controlElements.sizeLabel) {
    controlElements.sizeSlider.value(squareSize);
    controlElements.sizeLabel.html('Размер креста: ' + squareSize + 'px');
  }
  
  // Обновляем чекбоксы
  if (controlElements.capsCheckbox) {
    controlElements.capsCheckbox.checked(roundCaps);
  }
  
  if (controlElements.checkerboardCheckbox) {
    controlElements.checkerboardCheckbox.checked(checkerboardMode);
  }
} 