// Размеры и параметры
const squareSize = 150; // Увеличим размер квадратов
const lineWeight = 5; // Увеличим толщину линий
let cornerRadius = 50; // Увеличим начальное значение радиуса скругления
let radiusSlider; // Слайдер для управления радиусом

function setup() {
  // Создаем канвас
  createCanvas(windowWidth, windowHeight);
  // Устанавливаем цвет фона
  background(0);
  // Устанавливаем режим отрисовки
  noFill();
  stroke(255);
  strokeWeight(lineWeight);
  
  // Создаем слайдер для управления радиусом скругления
  radiusSlider = createSlider(0, 100, cornerRadius);
  radiusSlider.position(20, 20);
  radiusSlider.style('width', '200px');
  radiusSlider.input(updateRadius); // Вызывает функцию при изменении слайдера
}

// Функция обновления радиуса при изменении слайдера
function updateRadius() {
  cornerRadius = radiusSlider.value();
  loop(); // Перезапускаем цикл отрисовки
}

function draw() {
  // Очищаем канвас
  background(0);
  
  // Отображаем текущее значение радиуса
  fill(255);
  noStroke();
  textSize(16);
  text('Радиус скругления: ' + cornerRadius, 20, 60);
  noFill();
  stroke(255);
  strokeWeight(lineWeight);
  
  // Перемещаем начало координат в центр холста
  translate(width / 2 - squareSize/2, height / 2 - squareSize/2);
  
  // Рисуем квадрат Б (верхний)
  push();
  
  // Нижняя грань квадрата Б
  line(0, squareSize, squareSize, squareSize);
  
  // Левая грань с учетом скругления
  if (cornerRadius <= 0) {
    // Если радиус 0, рисуем прямую линию
    line(0, 0, 0, squareSize);
  } else {
    // Рисуем верхнюю часть левой грани
    line(0, 0, 0, squareSize - cornerRadius);
    
    // Рисуем дугу скругления в левом нижнем углу
    arc(cornerRadius, squareSize - cornerRadius, cornerRadius * 2, cornerRadius * 2, PI, PI + HALF_PI);
  }
  
  pop();
  
  // Рисуем квадрат А (нижний)
  push();
  // Смещаем квадрат А вниз и влево
  translate(-squareSize, squareSize);
  
  // Верхняя грань квадрата А
  line(0, 0, squareSize, 0);
  
  // Правая грань квадрата А
  line(squareSize, 0, squareSize, squareSize);
  
  pop();
}

// Обработка изменения размера окна
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
} 