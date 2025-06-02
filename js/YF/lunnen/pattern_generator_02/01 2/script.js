// Размеры и параметры
const squareSize = 150; // Увеличим размер квадратов
let lineWeightPercent = 3; // Толщина линий в процентах от размера квадрата
let cornerRadiusPercent = 33; // Радиус скругления в процентах от размера квадрата
let lineLengthPercent = 100; // Длина линий квадрата А в процентах
let radiusSlider; // Слайдер для управления радиусом
let lengthSlider; // Слайдер для управления длиной линий
let thicknessSlider; // Слайдер для управления толщиной линий

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
  let controlsY = windowHeight - 220; // Увеличиваем отступ от нижнего края
  
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
  
  // Отображаем текущие значения в правой нижней части
  let textX = windowWidth - 250;
  let textY = windowHeight - 240; // Корректируем позицию текста
  
  fill(255);
  noStroke();
  textSize(14);
  text('Радиус скругления: ' + cornerRadiusPercent + '%', textX, textY);
  text('Длина линий квадрата А: ' + lineLengthPercent + '%', textX, textY + 60); // Увеличиваем расстояние
  text('Толщина линий: ' + lineWeightPercent + '%', textX, textY + 120); // Увеличиваем расстояние
  
  // Устанавливаем параметры для рисования
  noFill();
  stroke(255);
  strokeWeight(lineWeight);
  
  // Правильное центрирование паттерна:
  // Квадрат Б: от (0,0) до (squareSize, squareSize)
  // Квадрат А: от (-squareSize, squareSize) до (0, 2*squareSize)
  // Общие границы паттерна: X от -squareSize до +squareSize, Y от 0 до 2*squareSize
  // Центр паттерна: (-squareSize/2, squareSize)
  // Чтобы этот центр был в центре экрана, нужно сместить на:
  translate(width / 2 + squareSize / 2, height / 2 - squareSize);
  
  // Рисуем квадрат Б (верхний)
  push();
  
  // Левая грань с учетом скругления
  if (cornerRadius <= 0) {
    // Если радиус 0, рисуем прямую линию
    line(0, 0, 0, squareSize);
  } else {
    // Рисуем верхнюю часть левой грани
    line(0, 0, 0, squareSize - cornerRadius);
    
    // Рисуем вогнутую дугу скругления в левом нижнем углу
    // Для вогнутого скругления рисуем дугу от центра, расположенного внутри квадрата
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
  
  // Рисуем квадрат А (нижний)
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
  let controlsY = windowHeight - 220;
  
  radiusSlider.position(controlsX, controlsY);
  lengthSlider.position(controlsX, controlsY + 60);
  thicknessSlider.position(controlsX, controlsY + 120);
  
  background(0);
} 