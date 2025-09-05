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
let isPaused = false;
let startColor;
let midColor;
let endColor;
let useColorGradient = false;
let circleRadius; // Радиус круговой маски для сброса линий

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // Инициализация точки схода в центре экрана
  vanishingPoint = createVector(width / 2, height / 2);
  
  // Инициализация цветов
  startColor = color('#2353DB');
  midColor = color('#23DBD3');
  endColor = color('#5723DB');
  
  // Расчет максимального расстояния от центра до угла экрана
  // Используется для нормализации длины линий
  maxDist = dist(0, 0, width, height);
  
  // Получение значений из слайдеров
  updateParameters();
  
  // Создание начальных звезд
  createStars();
  
  // Добавление обработчиков событий для слайдеров
  setupSliderEvents();
  
  // Добавление обработчика клавиш
  document.addEventListener('keydown', handleKeyPress);
}

function draw() {
  background(0);
  
  // Обновление и отображение звезд
  updateAndDrawStars();
  
  // Отображение индикатора паузы
  if (isPaused) {
    // Полупрозрачный фон для индикатора паузы
    fill(0, 0, 0, 150);
    noStroke();
    rect(10, height - 40, 100, 30, 5);
    
    // Текст "ПАУЗА"
    fill(255);
    textSize(16);
    textAlign(LEFT, CENTER);
    text("ПАУЗА", 20, height - 25);
  }
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
  
  // Расчет максимального расстояния по диагонали экрана (для гарантии выхода за пределы)
  let maxScreenDist = sqrt(width * width + height * height);
  
  return {
    angle: angle,
    currentLength: random(5, 20), // Начальная длина (короткая)
    maxLength: maxScreenDist * 2, // Гарантируем, что линия уйдет далеко за край экрана
    resetLength: edgeDist * circleRadius, // Длина, при которой линия будет сброшена
    speed: random(0.5, 1.5) * speed,
    active: true
  };
}

function updateAndDrawStars() {
  for (let i = 0; i < stars.length; i++) {
    let star = stars[i];
    
    if (star.active) {
      // Увеличение длины линии только если не на паузе
      if (!isPaused) {
        star.currentLength += star.speed;
        
        // Если линия ушла достаточно далеко за край экрана, создаем новую
        // Используем resetLength вместо maxLength для сброса
        if (star.currentLength >= star.resetLength) {
          stars[i] = createRandomStar();
          continue;
        }
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
  useColorGradient = document.getElementById('useColorGradient').checked;
  speed = parseFloat(document.getElementById('speed').value);
  circleRadius = parseFloat(document.getElementById('circleRadius').value);
  
  // Обновление цветов
  startColor = color(document.getElementById('startColor').value);
  midColor = color(document.getElementById('midColor').value);
  endColor = color(document.getElementById('endColor').value);
  
  // Обновление отображаемых значений
  document.getElementById('lineCountValue').textContent = lineCount;
  document.getElementById('opacityValue').textContent = opacity;
  document.getElementById('fadeLengthValue').textContent = fadeLength;
  document.getElementById('segmentsCountValue').textContent = segmentsCount;
  document.getElementById('lineWidthValue').textContent = lineWidth;
  document.getElementById('widthGrowthValue').textContent = widthGrowth;
  document.getElementById('circleRadiusValue').textContent = circleRadius;
  document.getElementById('speedValue').textContent = speed;
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
  document.getElementById('circleRadius').addEventListener('input', updateParameters);
  document.getElementById('reverseWedge').addEventListener('change', updateParameters);
  document.getElementById('speed').addEventListener('input', updateParameters);
  
  // Обработчики для цветов и режима
  document.getElementById('startColor').addEventListener('input', function() {
    document.getElementById('startColorHex').value = this.value.toUpperCase();
    updateParameters();
  });
  document.getElementById('midColor').addEventListener('input', function() {
    document.getElementById('midColorHex').value = this.value.toUpperCase();
    updateParameters();
  });
  document.getElementById('endColor').addEventListener('input', function() {
    document.getElementById('endColorHex').value = this.value.toUpperCase();
    updateParameters();
  });
  
  // Обработчики для HEX-полей
  document.getElementById('startColorHex').addEventListener('input', function() {
    // Проверяем, что введен валидный HEX-код
    if (isValidHex(this.value)) {
      document.getElementById('startColor').value = this.value;
      updateParameters();
    }
  });
  document.getElementById('midColorHex').addEventListener('input', function() {
    if (isValidHex(this.value)) {
      document.getElementById('midColor').value = this.value;
      updateParameters();
    }
  });
  document.getElementById('endColorHex').addEventListener('input', function() {
    if (isValidHex(this.value)) {
      document.getElementById('endColor').value = this.value;
      updateParameters();
    }
  });
  
  document.getElementById('useColorGradient').addEventListener('change', updateParameters);
  
  // Добавление обработчика для кнопки экспорта
  document.getElementById('exportButton').addEventListener('click', exportCanvas);
  
  // Добавление обработчика для кнопки возврата в центр
  document.getElementById('centerButton').addEventListener('click', centerVanishingPoint);
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

// Функция для экспорта канваса в PNG
function exportCanvas() {
  // Создаем временный канвас для рендеринга изображения без UI
  let tempCanvas = createGraphics(width, height);
  
  // Устанавливаем черный фон
  tempCanvas.background(0);
  
  // Сохраняем текущее состояние звезд
  let currentStars = [...stars];
  
  // Рисуем звезды на временном канвасе
  for (let star of currentStars) {
    if (star.active) {
      let fadeStart = star.currentLength * (1 - fadeLength/100);
      
      for (let i = 0; i < segmentsCount; i++) {
        let t1 = i / segmentsCount;
        let t2 = (i + 1) / segmentsCount;
        
        let len1 = fadeStart + (star.currentLength - fadeStart) * t1;
        let len2 = fadeStart + (star.currentLength - fadeStart) * t2;
        
        if (len2 <= fadeStart) continue;
        if (len1 < fadeStart) len1 = fadeStart;
        
        let x1 = vanishingPoint.x + cos(star.angle) * len1;
        let y1 = vanishingPoint.y + sin(star.angle) * len1;
        let x2 = vanishingPoint.x + cos(star.angle) * len2;
        let y2 = vanishingPoint.y + sin(star.angle) * len2;
        
        let progress = (len1 - fadeStart) / (star.currentLength - fadeStart);
        let alpha = opacity * (1 - progress);
        
        // Базовая толщина линии из слайдера
        let baseWidth = lineWidth;
        let currentWidth = baseWidth;
        
        if (widthGrowth > 0) {
          // Используем resetLength вместо maxLength для более естественного изменения толщины
          let distFactor = min(1, len1 / star.resetLength);
          
          if (reverseWedge) {
            // Обратный клин: толще в центре, тоньше на краях
            currentWidth = baseWidth + (widthGrowth * (1 - distFactor) * (1 - distFactor));
          } else {
            // Прямой клин: тоньше в центре, толще на краях
            // Начинаем с минимальной толщины в центре
            let minWidth = max(0.5, baseWidth * 0.5); // Минимум 0.5px или половина базовой толщины
            currentWidth = minWidth + (widthGrowth * 1.5 * distFactor * distFactor);
          }
        }
        
        // Определение цвета сегмента
        let segmentColor;
        if (useColorGradient) {
          // Нормализуем прогресс цвета относительно видимой части линии
          // Используем resetLength для расчета градиента
          let visibleProgress = min(1, len1 / star.resetLength);
          
          if (visibleProgress < 0.5) {
            // Первая половина градиента: от startColor до midColor
            segmentColor = lerpColor(startColor, midColor, visibleProgress * 2);
          } else {
            // Вторая половина градиента: от midColor до endColor
            segmentColor = lerpColor(midColor, endColor, (visibleProgress - 0.5) * 2);
          }
          
          // Устанавливаем прозрачность
          segmentColor.setAlpha(alpha);
        } else {
          // Черно-белый режим
          segmentColor = color(255, 255, 255, alpha);
        }
        
        tempCanvas.strokeWeight(currentWidth);
        tempCanvas.stroke(segmentColor);
        tempCanvas.line(x1, y1, x2, y2);
      }
    }
  }
  
  // Генерируем имя файла с датой и временем
  let now = new Date();
  let filename = 'hyperspace_' + 
                 now.getFullYear() + 
                 padDigits(now.getMonth() + 1) + 
                 padDigits(now.getDate()) + '_' + 
                 padDigits(now.getHours()) + 
                 padDigits(now.getMinutes()) + 
                 padDigits(now.getSeconds()) + 
                 '.png';
  
  // Сохраняем изображение
  tempCanvas.save(filename);
  
  // Удаляем временный канвас
  tempCanvas.remove();
  
  // Показываем сообщение о сохранении
  let button = document.getElementById('exportButton');
  let originalText = button.textContent;
  let originalBackground = button.style.background;
  let originalColor = button.style.color;
  button.textContent = 'Сохранено!';
  button.style.background = '#3B53FD';
  button.style.color = 'white';
  button.style.boxShadow = 'none';
  
  // Возвращаем исходный текст кнопки через 2 секунды
  setTimeout(function() {
    button.textContent = originalText;
    button.style.background = originalBackground;
    button.style.color = originalColor;
    if (button !== document.getElementById('centerButton')) {
      button.style.boxShadow = '';
    } else {
      button.style.boxShadow = '0 0 0 2px white inset';
    }
  }, 2000);
}

// Вспомогательная функция для добавления ведущих нулей
function padDigits(number) {
  return number.toString().padStart(2, '0');
}

// Функция для проверки валидности HEX-кода цвета
function isValidHex(hex) {
  // Удаляем # в начале, если есть
  if (hex.startsWith('#')) {
    hex = hex.substring(1);
  }
  
  // Проверяем, что строка содержит только допустимые символы и имеет правильную длину
  return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(hex);
}

// Функция для возврата точки схода в центр экрана
function centerVanishingPoint() {
  // Устанавливаем точку схода в центр экрана
  vanishingPoint.x = width / 2;
  vanishingPoint.y = height / 2;
  
  // Пересоздаем звезды для корректного отображения
  createStars();
  
  // Визуальное подтверждение
  let button = document.getElementById('centerButton');
  let originalBackground = button.style.background;
  let originalColor = button.style.color;
  let originalBoxShadow = button.style.boxShadow;
  button.style.background = '#3B53FD';
  button.style.color = 'white';
  button.style.boxShadow = 'none';
  
  // Возвращаем исходный цвет кнопки через 0.5 секунды
  setTimeout(function() {
    button.style.background = originalBackground;
    button.style.color = originalColor;
    button.style.boxShadow = originalBoxShadow;
  }, 500);
}

// Обработчик нажатия клавиш
function handleKeyPress(event) {
  // Пробел - пауза/продолжение
  if (event.code === 'Space') {
    // Предотвращаем прокрутку страницы
    event.preventDefault();
    
    // Переключаем состояние паузы
    isPaused = !isPaused;
  }
  
  // Cmd+E (Mac) или Ctrl+E (Windows/Linux) - экспорт изображения
  if (event.code === 'KeyE' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    exportCanvas();
  }
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
    // Базовая толщина линии из слайдера
    let baseWidth = lineWidth;
    let currentWidth = baseWidth;
    
    if (widthGrowth > 0) {
      // Используем resetLength вместо maxLength для более естественного изменения толщины
      let distFactor = min(1, len1 / star.resetLength);
      
      if (reverseWedge) {
        // Обратный клин: толще в центре, тоньше на краях
        currentWidth = baseWidth + (widthGrowth * (1 - distFactor) * (1 - distFactor));
      } else {
        // Прямой клин: тоньше в центре, толще на краях
        // Начинаем с минимальной толщины в центре
        let minWidth = max(0.5, baseWidth * 0.5); // Минимум 0.5px или половина базовой толщины
        currentWidth = minWidth + (widthGrowth * 1.5 * distFactor * distFactor);
      }
    }
    
    // Определение цвета сегмента
    let segmentColor;
    if (useColorGradient) {
      // Нормализуем прогресс цвета относительно видимой части линии
      // Используем resetLength для расчета градиента
      let visibleProgress = min(1, len1 / star.resetLength);
      
      if (visibleProgress < 0.5) {
        // Первая половина градиента: от startColor до midColor
        segmentColor = lerpColor(startColor, midColor, visibleProgress * 2);
      } else {
        // Вторая половина градиента: от midColor до endColor
        segmentColor = lerpColor(midColor, endColor, (visibleProgress - 0.5) * 2);
      }
      
      // Устанавливаем прозрачность
      segmentColor.setAlpha(alpha);
    } else {
      // Черно-белый режим
      segmentColor = color(255, 255, 255, alpha);
    }
    
    // Рисование сегмента
    strokeWeight(currentWidth);
    stroke(segmentColor);
    line(x1, y1, x2, y2);
  }
}
