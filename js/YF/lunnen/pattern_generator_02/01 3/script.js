// Размеры и параметры
const squareSize = 50; // Уменьшаем размер квадратов в три раза (было 150)
let lineWeightPercent = 3; // Толщина линий в процентах от размера квадрата
let cornerRadiusPercent = 33; // Радиус скругления в процентах от размера квадрата
let lineLengthPercent = 100; // Длина линий квадрата А в процентах
let roundCaps = true; // Круглые окончания штрихов по умолчанию
let spacingPercent = 10; // Расстояние между крестами в процентах от размера креста
let radiusSlider; // Слайдер для управления радиусом
let lengthSlider; // Слайдер для управления длиной линий
let thicknessSlider; // Слайдер для управления толщиной линий
let capsCheckbox; // Чекбокс для управления окончаниями штрихов
let spacingSlider; // Слайдер для управления расстоянием между крестами

function setup() {
  // Создаем канвас
  createCanvas(windowWidth, windowHeight);
  // Устанавливаем цвет фона
  background(0);
  // Устанавливаем режим отрисовки
  noFill();
  stroke(255);
  
  // Позиционируем контролы в правой нижней части
  let controlsX = windowWidth - 250; // Отступ от правого края
  let controlsY = windowHeight - 340; // Увеличиваем отступ для нового слайдера
  
  // Создаем слайдер для управления радиусом скругления в процентах
  radiusSlider = createSlider(0, 100, cornerRadiusPercent);
  radiusSlider.position(controlsX, controlsY);
  radiusSlider.style('width', '200px');
  radiusSlider.style('height', '1px');
  radiusSlider.style('background', 'white');
  radiusSlider.style('outline', 'none');
  radiusSlider.style('-webkit-appearance', 'none');
  radiusSlider.style('appearance', 'none');
  radiusSlider.input(updateRadius);
  
  // Создаем слайдер для управления длиной линий квадрата А
  lengthSlider = createSlider(0, 100, lineLengthPercent);
  lengthSlider.position(controlsX, controlsY + 60); // Увеличиваем расстояние
  lengthSlider.style('width', '200px');
  lengthSlider.style('height', '1px');
  lengthSlider.style('background', 'white');
  lengthSlider.style('outline', 'none');
  lengthSlider.style('-webkit-appearance', 'none');
  lengthSlider.style('appearance', 'none');
  lengthSlider.input(updateLength);
  
  // Создаем слайдер для управления толщиной линий в процентах
  thicknessSlider = createSlider(1, 100, lineWeightPercent);
  thicknessSlider.position(controlsX, controlsY + 120); // Увеличиваем расстояние
  thicknessSlider.style('width', '200px');
  thicknessSlider.style('height', '1px');
  thicknessSlider.style('background', 'white');
  thicknessSlider.style('outline', 'none');
  thicknessSlider.style('-webkit-appearance', 'none');
  thicknessSlider.style('appearance', 'none');
  thicknessSlider.input(updateThickness);
  
  // Создаем слайдер для управления расстоянием между крестами
  spacingSlider = createSlider(0, 100, spacingPercent);
  spacingSlider.position(controlsX, controlsY + 180);
  spacingSlider.style('width', '200px');
  spacingSlider.style('height', '1px');
  spacingSlider.style('background', 'white');
  spacingSlider.style('outline', 'none');
  spacingSlider.style('-webkit-appearance', 'none');
  spacingSlider.style('appearance', 'none');
  spacingSlider.input(updateSpacing);
  
  // Создаем чекбокс для управления окончаниями штрихов
  capsCheckbox = createCheckbox('Круглые окончания', roundCaps);
  capsCheckbox.position(controlsX, controlsY + 240);
  capsCheckbox.style('color', 'white');
  capsCheckbox.style('font-family', 'Arial, sans-serif');
  capsCheckbox.style('font-size', '14px');
  capsCheckbox.changed(updateCaps);
}

// Функция обновления радиуса при изменении слайдера
function updateRadius() {
  cornerRadiusPercent = radiusSlider.value();
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления длины линий при изменении слайдера
function updateLength() {
  lineLengthPercent = lengthSlider.value();
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления толщины линий при изменении слайдера
function updateThickness() {
  lineWeightPercent = thicknessSlider.value();
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления окончаний штрихов при изменении чекбокса
function updateCaps() {
  roundCaps = capsCheckbox.checked();
  loop(); // Перезапускаем цикл отрисовки
}

// Функция обновления расстояния между крестами при изменении слайдера
function updateSpacing() {
  spacingPercent = spacingSlider.value();
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
  
  // Отображаем текущие значения в правой нижней части
  let textX = windowWidth - 250;
  let textY = windowHeight - 360; // Корректируем позицию текста
  
  fill(255);
  noStroke();
  textSize(14);
  text('Радиус скругления: ' + cornerRadiusPercent + '%', textX, textY);
  text('Длина линий квадрата А: ' + lineLengthPercent + '%', textX, textY + 60);
  text('Толщина линий: ' + lineWeightPercent + '%', textX, textY + 120);
  text('Расстояние между крестами: ' + spacingPercent + '%', textX, textY + 180);
  
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
  for (let x = startX; x < endX; x += gridStep) {
    for (let y = startY; y < endY; y += gridStep) {
      push();
      translate(x, y);
      
      // Рисуем один крест (квадрат Б + квадрат А)
      drawCross(cornerRadius, lineLength);
      
      pop();
    }
  }
}

// Функция для рисования одного креста
function drawCross(cornerRadius, lineLength) {
  // Рисуем квадрат Б (верхний правый)
  push();
  
  // Левая грань с учетом скругления
  if (cornerRadius <= 0) {
    // Если радиус 0, рисуем прямую линию
    line(0, 0, 0, squareSize);
  } else {
    // Рисуем верхнюю часть левой грани
    line(0, 0, 0, squareSize - cornerRadius);
    
    // Рисуем вогнутую дугу скругления в левом нижнем углу
    arc(cornerRadius, squareSize - cornerRadius, cornerRadius * 2, cornerRadius * 2, HALF_PI, PI);
  }
  
  // Нижняя грань с учетом скругления
  if (cornerRadius <= 0) {
    line(0, squareSize, squareSize, squareSize);
  } else {
    // Рисуем правую часть нижней грани
    line(cornerRadius, squareSize, squareSize, squareSize);
  }
  
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

// Обработка изменения размера окна
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  // Обновляем позиции контролов при изменении размера окна
  let controlsX = windowWidth - 250;
  let controlsY = windowHeight - 340;
  
  radiusSlider.position(controlsX, controlsY);
  lengthSlider.position(controlsX, controlsY + 60);
  thicknessSlider.position(controlsX, controlsY + 120);
  spacingSlider.position(controlsX, controlsY + 180);
  capsCheckbox.position(controlsX, controlsY + 240);
  
  background(0);
} 