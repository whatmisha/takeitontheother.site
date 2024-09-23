let centerX;
let centerY;
let numRays = 11;
let rayLength = 200; // Длина лучей
let inputField; // Поле для ввода числа лучей
let strokeWeightInput; // Поле для ввода толщины линий
let strokeWeightValue = 2; // Начальная толщина линий

function setup() {
  createCanvas(480, 480);
  background(0); // Черный фон

  centerX = width / 2;
  centerY = height / 2;

  // Кнопки для увеличения и уменьшения количества лучей
  let plusButton = createButton('+');
  plusButton.position(width - 50, height - 40); // Позиция кнопки «+»
  plusButton.mousePressed(increaseRays); // Обработчик нажатия на кнопку «+»

  let minusButton = createButton('-');
  minusButton.position(width - 126, height - 40); // Позиция кнопки «-»
  minusButton.mousePressed(decreaseRays); // Обработчик нажатия на кнопку «-»

  // Поле для ввода числа лучей
  inputField = createInput(numRays.toString());
  inputField.position(width - 100, height - 40); // Позиция поля для ввода
  inputField.size(40); // Размер поля ввода
  inputField.input(updateRays); // Обработчик изменения значения в поле

  // Кнопки для увеличения и уменьшения толщины линий
  let plusStrokeButton = createButton('+');
  plusStrokeButton.position(126, height - 40); // Позиция кнопки «+» для толщины
  plusStrokeButton.mousePressed(increaseStrokeWeight); // Обработчик нажатия на кнопку «+»

  let minusStrokeButton = createButton('-');
  minusStrokeButton.position(50, height - 40); // Позиция кнопки «-» для толщины
  minusStrokeButton.mousePressed(decreaseStrokeWeight); // Обработчик нажатия на кнопку «-»

  // Поле для ввода толщины линий
  strokeWeightInput = createInput(strokeWeightValue.toString());
  strokeWeightInput.position(76, height - 40); // Позиция поля для ввода
  strokeWeightInput.size(40); // Размер поля ввода
  strokeWeightInput.input(updateStrokeWeight); // Обработчик изменения толщины линий

  drawRays();
}

function draw() {
  // Не используем draw, так как отрисовка происходит только по событию
}

function drawRays() {
  background(0); // Очистка холста (черный фон)

  stroke(255); // Белый цвет для линий
  strokeWeight(strokeWeightValue); // Устанавливаем текущую толщину линий
  strokeCap(SQUARE); // Прямоугольные окончания линий

  let startAngle = HALF_PI; // Начинаем с вертикального луча вниз
  let endAngle = QUARTER_PI * 3; // Последний луч под углом 135 градусов

  // Угол для распределения остальных лучей
  let availableAngle = endAngle - startAngle;

  // Создаем массив углов с увеличивающимся шагом
  let angles = [];
  let angleSum = 0;

  // Накопительно увеличиваем шаг угла для промежуточных лучей
  for (let i = 0; i < numRays - 1; i++) {
    let normalizedIndex = i / (numRays - 2);
    let step = pow(normalizedIndex, 2); // Квадратная функция для увеличения шага
    angles.push(step);
    angleSum += step;
  }

  // Нормализуем шаги угла, чтобы они занимали доступный угол
  for (let i = 0; i < angles.length; i++) {
    angles[i] = (angles[i] / angleSum) * availableAngle;
  }

  let currentAngle = startAngle;

  for (let i = 0; i < numRays - 1; i++) {
    let angle = currentAngle;
    let x = centerX + cos(angle) * rayLength;
    let y = centerY + sin(angle) * rayLength;

    line(centerX, centerY, x, y); // Линии длиной 220 пикселей от центра

    currentAngle += angles[i]; // Увеличиваем угол на следующий шаг
  }

  // Рисуем последний луч под углом 135 градусов (QUARTER_PI * 3)
  let x = centerX + cos(endAngle) * rayLength;
  let y = centerY + sin(endAngle) * rayLength;
  line(centerX, centerY, x, y);
}

// Увеличение числа лучей
function increaseRays() {
  numRays++;
  inputField.value(numRays.toString()); // Обновляем значение в поле ввода
  drawRays(); // Перерисовываем лучи с новым количеством
}

// Уменьшение числа лучей (минимум 3)
function decreaseRays() {
  if (numRays > 3) {
    numRays--;
    inputField.value(numRays.toString()); // Обновляем значение в поле ввода
    drawRays(); // Перерисовываем лучи с новым количеством
  }
}

// Обновление количества лучей по вводу с клавиатуры
function updateRays() {
  let newValue = int(inputField.value()); // Получаем введенное значение
  if (newValue >= 3) { // Проверяем, что значение не меньше 3
    numRays = newValue;
    drawRays(); // Перерисовываем лучи с новым количеством
  }
}

// Увеличение толщины линий
function increaseStrokeWeight() {
  strokeWeightValue++;
  strokeWeightInput.value(strokeWeightValue.toString()); // Обновляем значение в поле ввода
  drawRays(); // Перерисовываем лучи с новой толщиной линий
}

// Уменьшение толщины линий (минимум 1)
function decreaseStrokeWeight() {
  if (strokeWeightValue > 1) {
    strokeWeightValue--;
    strokeWeightInput.value(strokeWeightValue.toString()); // Обновляем значение в поле ввода
    drawRays(); // Перерисовываем лучи с новой толщиной линий
  }
}

// Обновление толщины линий по вводу с клавиатуры
function updateStrokeWeight() {
  let newValue = int(strokeWeightInput.value()); // Получаем введенное значение
  if (newValue >= 1) { // Проверяем, что значение не меньше 1
    strokeWeightValue = newValue;
    drawRays(); // Перерисовываем лучи с новой толщиной линий
  }
}