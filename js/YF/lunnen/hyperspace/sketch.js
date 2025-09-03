let stars = [];
let vanishingPoint;
let lineCount;
let opacity;
let fadeLength;
let segmentsCount;
let lineWidth;
let widthGrowth;
let reverseWedge;
let speed;
let maxDist;

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // Инициализация точки схода в центре экрана
  vanishingPoint = createVector(width / 2, height / 2);
  
  // Получение значений из слайдеров
  updateParameters();
  
  // Создание начальных звезд
  createStars();
  
  // Добавление обработчиков событий для слайдеров
  setupSliderEvents();
}

function draw() {
  background(0);
  
  // Обновление и отображение звезд
  updateAndDrawStars();
}

function mousePressed() {
  // Изменение точки схода при клике мыши
  // Получаем элемент панели управления
  let controlsPanel = document.querySelector('.controls');
  let controlsRect = controlsPanel.getBoundingClientRect();
  
  // Проверяем, что клик не на панели управления
  if (!(mouseX >= controlsRect.left && 
        mouseX <= controlsRect.right && 
        mouseY >= controlsRect.top && 
        mouseY <= controlsRect.bottom)) {
    vanishingPoint.x = mouseX;
    vanishingPoint.y = mouseY;
  }
}

function createStars() {
  stars = [];
  for (let i = 0; i < lineCount; i++) {
    stars.push(createRandomStar());
  }
}

function createRandomStar() {
  // Создание случайной звезды (линии) с началом в точке схода
  let angle = random(TWO_PI);
  
  // Расчет расстояния до края экрана от точки схода в этом направлении
  let edgeDist = distToEdge(vanishingPoint, angle);
  
  return {
    angle: angle,
    currentLength: random(5, 20), // Начальная длина (короткая)
    maxLength: edgeDist * 1.2, // Гарантируем, что линия выйдет за край экрана
    speed: random(0.5, 1.5) * speed,
    active: true
  };
}

function updateAndDrawStars() {
  for (let i = 0; i < stars.length; i++) {
    let star = stars[i];
    
    if (star.active) {
      // Увеличение длины линии
      star.currentLength += star.speed;
      
      // Если линия достигла максимальной длины, создаем новую
      if (star.currentLength >= star.maxLength) {
        stars[i] = createRandomStar();
        continue;
      }
      
      // Рисование линии с градиентом прозрачности
      drawStarLine(star);
    }
  }
}

function updateParameters() {
  // Получение значений из слайдеров
  lineCount = parseInt(document.getElementById('lineCount').value);
  opacity = parseInt(document.getElementById('opacity').value);
  fadeLength = parseInt(document.getElementById('fadeLength').value);
  segmentsCount = parseInt(document.getElementById('segmentsCount').value);
  lineWidth = parseFloat(document.getElementById('lineWidth').value);
  widthGrowth = parseFloat(document.getElementById('widthGrowth').value);
  reverseWedge = document.getElementById('reverseWedge').checked;
  speed = parseFloat(document.getElementById('speed').value);
  
  // Обновление отображаемых значений
  document.getElementById('lineCountValue').textContent = lineCount;
  document.getElementById('opacityValue').textContent = opacity;
  document.getElementById('fadeLengthValue').textContent = fadeLength;
  document.getElementById('segmentsCountValue').textContent = segmentsCount;
  document.getElementById('lineWidthValue').textContent = lineWidth;
  document.getElementById('widthGrowthValue').textContent = widthGrowth;
  document.getElementById('speedValue').textContent = speed;
  
  // Расчет максимального расстояния от центра до угла экрана
  // Используется для нормализации длины линий
  maxDist = dist(0, 0, width, height);
}

function setupSliderEvents() {
  // Добавление обработчиков событий для слайдеров
  document.getElementById('lineCount').addEventListener('input', function() {
    updateParameters();
    createStars();
  });
  
  document.getElementById('opacity').addEventListener('input', updateParameters);
  document.getElementById('fadeLength').addEventListener('input', updateParameters);
  document.getElementById('segmentsCount').addEventListener('input', updateParameters);
  document.getElementById('lineWidth').addEventListener('input', updateParameters);
  document.getElementById('widthGrowth').addEventListener('input', updateParameters);
  document.getElementById('reverseWedge').addEventListener('change', updateParameters);
  document.getElementById('speed').addEventListener('input', updateParameters);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // При изменении размера окна, если точка схода была в центре, оставляем ее в центре
  if (vanishingPoint.x === width / 2 && vanishingPoint.y === height / 2) {
    vanishingPoint.x = windowWidth / 2;
    vanishingPoint.y = windowHeight / 2;
  }
  
  // Пересчитываем максимальное расстояние
  maxDist = dist(0, 0, width, height);
  
  // Пересоздаем звезды, чтобы они корректно уходили за края экрана
  createStars();
}

// Функция для расчета расстояния от точки до края экрана в заданном направлении
function distToEdge(point, angle) {
  // Направляющий вектор
  let dx = cos(angle);
  let dy = sin(angle);
  
  // Расстояния до краев экрана
  let distX, distY;
  
  // Расчет расстояния до вертикальных краев
  if (dx > 0) distX = (width - point.x) / dx;
  else if (dx < 0) distX = -point.x / dx;
  else distX = Infinity;
  
  // Расчет расстояния до горизонтальных краев
  if (dy > 0) distY = (height - point.y) / dy;
  else if (dy < 0) distY = -point.y / dy;
  else distY = Infinity;
  
  // Возвращаем минимальное расстояние
  return min(distX, distY);
}

// Функция для рисования линии со звезды с градиентом
function drawStarLine(star) {
  let fadeStart = star.currentLength * (1 - fadeLength/100); // Начало затухания
  
  for (let i = 0; i < segmentsCount; i++) {
    // Начальная и конечная точки текущего сегмента
    let t1 = i / segmentsCount;
    let t2 = (i + 1) / segmentsCount;
    
    let len1 = fadeStart + (star.currentLength - fadeStart) * t1;
    let len2 = fadeStart + (star.currentLength - fadeStart) * t2;
    
    // Если мы еще не дошли до начала затухания, пропускаем
    if (len2 <= fadeStart) continue;
    
    // Если мы начали до точки затухания, корректируем
    if (len1 < fadeStart) len1 = fadeStart;
    
    // Координаты сегмента
    let x1 = vanishingPoint.x + cos(star.angle) * len1;
    let y1 = vanishingPoint.y + sin(star.angle) * len1;
    let x2 = vanishingPoint.x + cos(star.angle) * len2;
    let y2 = vanishingPoint.y + sin(star.angle) * len2;
    
    // Расчет прозрачности для текущего сегмента
    let progress = (len1 - fadeStart) / (star.currentLength - fadeStart);
    let alpha = opacity * (1 - progress);
    
    // Расчет толщины линии с учетом перспективы (клиновидность)
    let currentWidth = lineWidth;
    if (widthGrowth > 0) {
      // Нормализованное расстояние от точки схода (0 в центре, 1 на краю)
      let distFactor = len1 / star.maxLength;
      
      if (reverseWedge) {
        // Обратный клин: толще в центре, тоньше на краях
        currentWidth = lineWidth + (widthGrowth * (1 - distFactor) * (1 - distFactor));
      } else {
        // Прямой клин: тоньше в центре, толще на краях
        // Начинаем с 1px в центре
        currentWidth = 1 + (widthGrowth * 1.5 * distFactor * distFactor);
      }
    }
    
    // Рисование сегмента
    strokeWeight(currentWidth);
    stroke(255, 255, 255, alpha);
    line(x1, y1, x2, y2);
  }
}
