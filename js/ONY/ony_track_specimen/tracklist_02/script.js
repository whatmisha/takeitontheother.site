// Устанавливаем начальный цвет фона светло-серым и добавляем transition
document.body.style.backgroundColor = 'hsl(0, 0%, 95%)';
document.body.style.transition = 'background-color 0.8s';

// Добавляем переменную для отслеживания текущего типа цвета
let isLightColor = true;

function adjustFontSize() {
    const items = document.querySelectorAll('.tracklist li');
    const viewportWidth = window.innerWidth * 0.97;
    let fontSize = 20;
    
    // Оборачиваем каждую букву в span с нормальной шириной для первичной проверки
    items.forEach(item => {
        const text = item.textContent;
        item.textContent = ''; // очищаем содержимое
        [...text].forEach(letter => {
            const span = document.createElement('span');
            span.textContent = letter;
            span.style.fontVariationSettings = "'wdth' 500";
            span.style.transition = 'font-variation-settings 0.2s';
            item.appendChild(span);
        });
    });
    
    // Устанавливаем начальный размер шрифта для каждого элемента
    items.forEach(item => {
        item.style.fontSize = fontSize + 'vw';
    });
    
    // Находим самый широкий элемент
    let maxWidth = Math.max(...Array.from(items).map(item => item.offsetWidth));
    
    // Увеличиваем шрифт большими шагами
    while (maxWidth < viewportWidth && fontSize < 200) {
        fontSize += 5;
        items.forEach(item => {
            item.style.fontSize = fontSize + 'vw';
        });
        maxWidth = Math.max(...Array.from(items).map(item => item.offsetWidth));
    }
    
    // Уменьшаем на 5 и делаем точную подгонку
    fontSize -= 5;
    while (maxWidth < viewportWidth && fontSize < 200) {
        fontSize++;
        items.forEach(item => {
            item.style.fontSize = fontSize + 'vw';
        });
        maxWidth = Math.max(...Array.from(items).map(item => item.offsetWidth));
    }
    
    // Уменьшаем размер шрифта для учета расширения букв
    fontSize = Math.max(1, fontSize * 0.5);
    
    // Применяем финальный размер и добавляем обработчики
    items.forEach(item => {
        item.style.fontSize = fontSize + 'vw';
        item.style.visibility = 'visible';
        
        let currentHue, currentSaturation;
        
        // Обработчик наведения - только генерирует новый цвет
        item.addEventListener('mouseenter', () => {
            currentHue = Math.floor(Math.random() * 360);
            currentSaturation = Math.floor(Math.random() * 30) + 60; // 60-90%
        });
        
        // Обработчик движения мыши - обновляет яркость
        item.addEventListener('mousemove', (e) => {
            if (currentHue === undefined) {
                currentHue = Math.floor(Math.random() * 360);
                currentSaturation = Math.floor(Math.random() * 30) + 60;
            }
            
            const mouseXRatio = e.clientX / window.innerWidth;
            const lightness = Math.floor(20 + (mouseXRatio * 70));
            
            const newColor = `hsl(${currentHue}, ${currentSaturation}%, ${lightness}%)`;
            document.body.style.backgroundColor = newColor;
        });
        
        // Очищаем и заново создаем спаны
        const text = item.textContent;
        item.textContent = '';
        const spans = [...text].map(letter => {
            const span = document.createElement('span');
            span.textContent = letter;
            span.style.fontVariationSettings = "'wdth' 500";
            span.style.transition = 'font-variation-settings 0.2s';
            item.appendChild(span);
            return span;
        });
        
        // Добавляем обработчики с учетом соседних букв
        spans.forEach((span, index) => {
            span.addEventListener('mouseover', () => {
                // Расширяем текущую букву максимально
                span.style.fontVariationSettings = "'wdth' 1000";
                
                // Расширяем соседние буквы с убывающим эффектом
                for (let i = 1; i <= 2; i++) {
                    if (spans[index - i]) {
                        spans[index - i].style.fontVariationSettings = `'wdth' ${1000 - i * 200}`;
                    }
                    if (spans[index + i]) {
                        spans[index + i].style.fontVariationSettings = `'wdth' ${1000 - i * 200}`;
                    }
                }
            });
            
            span.addEventListener('mouseout', () => {
                // Возвращаем нормальную ширину для текущей и соседних букв
                span.style.fontVariationSettings = "'wdth' 500";
                for (let i = 1; i <= 2; i++) {
                    if (spans[index - i]) {
                        spans[index - i].style.fontVariationSettings = "'wdth' 500";
                    }
                    if (spans[index + i]) {
                        spans[index + i].style.fontVariationSettings = "'wdth' 500";
                    }
                }
            });
        });
    });

    // Ждем применения стилей и проверяем каждый элемент
    setTimeout(() => {
        // Находим самый широкий элемент после финальной установки размера
        const finalMaxWidth = Math.max(...Array.from(items).map(item => item.offsetWidth));
        console.log('Max width:', finalMaxWidth);
        
        items.forEach(item => {
            const itemWidth = item.offsetWidth;
            console.log(`Item "${item.textContent}": ${itemWidth}px`);
            
            // Если элемент заметно уже максимального
            if (itemWidth < finalMaxWidth - 10) {
                console.log(`Marking as red: ${item.textContent}`);
                item.style.color = '#ff0000';
            }
        });
    }, 100);
}

// Запускаем после загрузки шрифта
document.fonts.ready.then(() => {
    adjustFontSize();
});

// Перерасчет при изменении размера окна
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(adjustFontSize, 100);
});

document.addEventListener('mousemove', function(e) {
    const letters = document.querySelectorAll('.letter');
    const cursorX = e.clientX;
    const defaultWidth = 400;
    
    // Сначала посчитаем, сколько "лишней" ширины добавляется при расширении
    let expansionSum = 0;
    let expandedLettersCount = 0;
    
    letters.forEach(letter => {
        const rect = letter.getBoundingClientRect();
        const distance = Math.abs(cursorX - (rect.left + rect.width / 2));
        
        if (distance < rect.width * 3) {
            const expansion = Math.max(0, 1 - distance / (rect.width * 3));
            expansionSum += expansion * 600; // расширение до 1000
            expandedLettersCount++;
        }
    });
    
    // Вычисляем, насколько нужно сузить остальные буквы
    const remainingLetters = letters.length - expandedLettersCount;
    const narrowingPerLetter = remainingLetters > 0 ? expansionSum / remainingLetters : 0;
    
    // Применяем эффекты
    letters.forEach(letter => {
        const rect = letter.getBoundingClientRect();
        const distance = Math.abs(cursorX - (rect.left + rect.width / 2));
        
        if (distance < rect.width * 3) {
            // Расширяем буквы около курсора
            const expansion = Math.max(0, 1 - distance / (rect.width * 3));
            const newWidth = defaultWidth + (expansion * 600);
            letter.style.fontVariationSettings = `'wdth' ${newWidth}`;
        } else {
            // Сужаем остальные буквы
            const newWidth = Math.max(100, defaultWidth - narrowingPerLetter);
            letter.style.fontVariationSettings = `'wdth' ${newWidth}`;
        }
    });
}); 