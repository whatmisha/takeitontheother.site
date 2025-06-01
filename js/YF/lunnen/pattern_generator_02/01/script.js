// Размеры и параметры
const squareSize = 100;
const strokeWeight = 2;

function setup() {
  // Создаем канвас
  createCanvas(windowWidth, windowHeight);
  // Устанавливаем цвет фона
  background(0);
  // Устанавливаем режим отрисовки
  noFill();
  stroke(255);
  strokeWeight(strokeWeight);
}

function draw() {
  // Очищаем канвас
  background(0);
  
  // Перемещаем начало координат в центр холста
  translate(width / 2, height / 2);
  
  // Рисуем квадрат Б (правый верхний)
  push();
  // Рисуем только левую и нижнюю грани
  beginShape();
  // Левая грань
  vertex(0, 0);
  vertex(0, squareSize);
  // Конец левой грани
  endShape();
  
  beginShape();
  // Нижняя грань
  vertex(0, squareSize);
  vertex(squareSize, squareSize);
  // Конец нижней грани
  endShape();
  pop();
  
  // Рисуем квадрат А (нижний левый)
  push();
  // Смещаем квадрат А
  translate(-squareSize, squareSize);
  
  // Рисуем только верхнюю и правую грани
  beginShape();
  // Верхняя грань
  vertex(0, 0);
  vertex(squareSize, 0);
  // Конец верхней грани
  endShape();
  
  beginShape();
  // Правая грань
  vertex(squareSize, 0);
  vertex(squareSize, squareSize);
  // Конец правой грани
  endShape();
  pop();
  
  // Отключаем цикл draw (статическое изображение)
  noLoop();
}

// Обработка изменения размера окна
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
  loop(); // Перезапускаем draw() один раз после изменения размера
} 