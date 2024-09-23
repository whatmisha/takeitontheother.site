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

  let firstAngle = HALF_PI; // Первый луч - вертикально вниз (90 градусов)
  let lastAngle = QUARTER_PI; // Последний луч - 45 градусов

  let angleIncrement = (lastAngle - firstAngle) / (numRays - 1); // Шаг между лучами

  let currentAngle = firstAngle;

  for (let i = 0; i < numRays; i++) {
    let x = centerX + cos(currentAngle) * rayLength;
    let y = centerY + sin(currentAngle) * rayLength;

    line(centerX, centerY, x, y); // Линии длиной 220 пикселей от центра

    currentAngle += angleIncrement; // Увеличиваем угол на следующий шаг
  }
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