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
}

// Функция создания панели контролов
function createControlsPanel() {
  // Создаем основной контейнер
  controlsContainer = createDiv('');
  controlsContainer.style('position', 'fixed');
  controlsContainer.style('bottom', '20px');
  controlsContainer.style('right', '20px');
  controlsContainer.style('background', '#404040');
  controlsContainer.style('padding', '20px');
  controlsContainer.style('border-radius', '6px');
  controlsContainer.style('font-family', 'Arial, sans-serif');
  controlsContainer.style('font-size', '14px');
  controlsContainer.style('color', 'black');
  controlsContainer.style('width', '240px');
  
  // Создаем контролы
  createControl('Радиус скругления', 'range', 0, 100, cornerRadiusPercent, updateRadius);
  createControl('Длина линий квадрата А', 'range', 0, 100, lineLengthPercent, updateLength);
  createControl('Длина линии квадрата Б', 'range', 0, 100, lineBLengthPercent, updateLineBLength);
  createControl('Толщина линий', 'range', 1, 100, lineWeightPercent, updateThickness);
  createControl('Расстояние между крестами', 'range', 0, 100, spacingPercent, updateSpacing);
  createControl('Размер креста', 'range', 10, 200, squareSize, updateSize);
  
  // Создаем чекбокс
  let checkboxContainer = createDiv('');
  checkboxContainer.style('margin-top', '15px');
  checkboxContainer.parent(controlsContainer);
  
  let checkbox = createCheckbox('Круглые окончания', roundCaps);
  checkbox.style('color', 'black');
  checkbox.style('font-family', 'Arial, sans-serif');
  checkbox.style('font-size', '14px');
  checkbox.changed(updateCaps);
  checkbox.parent(checkboxContainer);
  
  // Создаем чекбокс для шахматного режима
  let checkerboardContainer = createDiv('');
  checkerboardContainer.style('margin-top', '10px');
  checkerboardContainer.parent(controlsContainer);
  
  let checkerboardCheckbox = createCheckbox('Шахматный порядок', checkerboardMode);
  checkerboardCheckbox.style('color', 'black');
  checkerboardCheckbox.style('font-family', 'Arial, sans-serif');
  checkerboardCheckbox.style('font-size', '14px');
  checkerboardCheckbox.changed(updateCheckerboard);
  checkerboardCheckbox.parent(checkerboardContainer);
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
  
  // Обработчик изменения
  slider.input(() => {
    let newValue = slider.value();
    let unit = max <= 100 ? '%' : (max > 100 ? 'px' : '');
    labelDiv.html(label + ': ' + newValue + unit);
    callback(newValue);
  });
}

// Функция обновления радиуса при изменении слайдера
function updateRadius(newValue) {
  cornerRadiusPercent = newValue;
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления длины линий при изменении слайдера
function updateLength(newValue) {
  lineLengthPercent = newValue;
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления толщины линий при изменении слайдера
function updateThickness(newValue) {
  lineWeightPercent = newValue;
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления окончаний штрихов при изменении чекбокса
function updateCaps() {
  // Получаем состояние чекбокса из события
  roundCaps = this.checked();
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления расстояния между крестами при изменении слайдера
function updateSpacing(newValue) {
  spacingPercent = newValue;
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления размера креста при изменении слайдера
function updateSize(newValue) {
  squareSize = newValue;
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления шахматного режима при изменении чекбокса
function updateCheckerboard() {
  // Получаем состояние чекбокса из события
  checkerboardMode = this.checked();
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления длины линии квадрата Б при изменении слайдера
function updateLineBLength(newValue) {
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
    
    // Дуга скругления
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

// Обработка изменения размера окна
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
} 