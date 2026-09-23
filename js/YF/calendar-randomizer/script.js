import { createCalendarScene } from './scene.js?v=2';
import { bindPageLifecycle } from '../infra/framework/src/ui/GeneratorHost.js?v=7';

document.addEventListener('DOMContentLoaded', function() {
    let calendarEvents = null;
    let pendingRequest = null;
    let currentScene = null;
    let suspended = false;
    let lastSvgPath = '';
    let interruptedLoad = false;
    bindPageLifecycle({
        suspend() {
            suspended = true;
            calendarEvents?.abort();
            interruptedLoad = Boolean(pendingRequest);
            const request = pendingRequest;
            pendingRequest = null;
            request?.abort();
        },
        resume() {
            suspended = false;
            if (interruptedLoad || !currentScene) loadSvg(lastSvgPath || svgSelector.value);
            else initializeCalendar();
        }
    });
    // Загружаем список SVG файлов
    loadSvgFilesList();
    
    // Обработчик выбора файла SVG
    const svgSelector = document.getElementById('svgSelector');
    svgSelector.addEventListener('change', function() {
        if (this.value) {
            loadSvg(this.value);
        }
    });
    
    // Функция для загрузки списка SVG файлов
    async function loadSvgFilesList() {
        try {
            // Используем функцию из list-svgs.js
            const data = await getSvgFiles();
            
            // Очищаем текущие опции
            svgSelector.innerHTML = '';
            
            // Проверяем успешность запроса
            if (!data.success) {
                throw new Error(data.error || 'Unknown error');
            }
            
            const files = data.files || [];
            
            if (files.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No SVG files found';
                svgSelector.appendChild(option);
            } else {
                // Добавляем опции для каждого файла
                files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.path;
                    option.textContent = file.name;
                    svgSelector.appendChild(option);
                });
                
                // Загружаем первый файл из списка
                if (files.length > 0) {
                    svgSelector.value = files[0].path;
                    loadSvg(files[0].path);
                }
            }
        } catch (error) {
            console.error('Ошибка при загрузке списка файлов:', error);
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Could not load templates';
            svgSelector.innerHTML = '';
            svgSelector.appendChild(option);
            
            // Загружаем файл по умолчанию в случае ошибки
            loadSvg('source/calend_01.svg');
        }
    }
    
    // Функция для загрузки SVG
    function loadSvg(svgPath) {
        lastSvgPath = svgPath;
        if (suspended) { interruptedLoad = true; return; }
        const previous = pendingRequest;
        pendingRequest = null;
        previous?.abort();
        calendarEvents?.abort();
        console.log('Загрузка SVG:', svgPath);
        const svgContainer = document.getElementById('svg-container');
        svgContainer.innerHTML = '<div class="loading">Loading SVG…</div>';
        
        // Добавляем случайный параметр для предотвращения кеширования
        const noCachePath = svgPath + '?v=' + new Date().getTime();
        console.log('Путь с предотвращением кеширования:', noCachePath);
        
        // Используем XMLHttpRequest вместо fetch для лучшей поддержки локальных файлов
        const xhr = new XMLHttpRequest();
        pendingRequest = xhr;
        xhr.open('GET', noCachePath, true);
        xhr.onreadystatechange = function() {
            if (pendingRequest !== xhr) return;
            if (xhr.readyState === 4) {
                pendingRequest = null;
                interruptedLoad = false;
                if (xhr.status === 200) {
                    svgContainer.innerHTML = xhr.responseText;
                    console.log('SVG успешно загружен через XMLHttpRequest');
                    
                    // Форсируем перерисовку SVG после загрузки
                    const svgElement = document.querySelector('#svg-container > svg');
                    if (svgElement) {
                        // Небольшая задержка для гарантии полной загрузки SVG
                        setTimeout(() => {
                            // Принудительно вызываем перерисовку
                            svgElement.style.display = 'none';
                            // Используем getBoundingClientRect для принудительного обновления макета
                            svgElement.getBoundingClientRect();
                            svgElement.style.display = '';
                            
                            console.log('SVG перерисован для корректного отображения');
                        }, 50);
                    }
                    
                    initializeCalendar();
                } else {
                    console.error('Ошибка загрузки SVG:', xhr.statusText);
                    
                    // Если не удалось загрузить SVG, показываем сообщение
                    svgContainer.innerHTML = `
                    <div style="padding: 20px; background-color: #f8d7da; color: #721c24; border-radius: 5px;">
                        <p style="font-size: 18px;">Could not load the SVG file.</p>
                        <p>Error: ${xhr.statusText || 'File not found'}</p>
                    </div>`;
                }
            }
        };
        xhr.send();
    }
    
        // Получаем элементы колор пикера для графики
        const colorPicker = document.getElementById('colorPicker');
        const hexInput = document.getElementById('hexInput');
        
        // Получаем элементы колор пикера для фона
        const bgColorPicker = document.getElementById('bgColorPicker');
        const bgHexInput = document.getElementById('bgHexInput');
        
        function initializeCalendar() {
            if (suspended) return;
            calendarEvents?.abort();
            const lifecycle = new AbortController();
            calendarEvents = lifecycle;
            const listen = (target, type, callback) => target.addEventListener(type, callback, { signal: lifecycle.signal });
            // Получаем SVG элемент
            const svgElement = document.querySelector('#svg-container > svg');
            if (!svgElement) {
                console.error('SVG элемент не найден');
                return;
            }
            
            console.log('SVG загружен успешно');
            
            // Сохраняем исходные позиции групп
            const groups = document.querySelectorAll('#svg-container > svg g');
            console.log(`Найдено ${groups.length} групп`);
            
            // Получаем все анимируемые элементы SVG
            if (currentScene?.svg !== svgElement) currentScene = { svg: svgElement, scene: createCalendarScene(svgElement) };
            const { scene } = currentScene;
            
            // Применяем цвет графики по умолчанию из пикера
            const defaultColor = colorPicker.value;
            console.log(`Применяем цвет графики по умолчанию: ${defaultColor}`);
            changeAllColors(defaultColor);
            changeBackgroundColor(bgColorPicker.value);
            
            // Добавляем обработчики для кнопок
            const randomizeBtn = document.getElementById('randomize');
            const resetBtn = document.getElementById('reset');
            const exportSVGBtn = document.getElementById('exportSVG');
            const randomRangeSlider = document.getElementById('randomRange');
            const rangeValueDisplay = document.getElementById('rangeValue');
            const easingSelect = document.getElementById('easingSelect');
            const speedRange = document.getElementById('speedRange');
            const speedValue = document.getElementById('speedValue');
            // BFCache/form restoration can change range values without an input event.
            const syncReadouts = () => {
                rangeValueDisplay.textContent = `${randomRangeSlider.value}px`;
                speedValue.textContent = `${speedRange.value}s`;
            };
            syncReadouts();
            requestAnimationFrame(() => { if (!lifecycle.signal.aborted) syncReadouts(); });
            
            // Обработчик изменения значения слайдера перемещения
            listen(randomRangeSlider, 'input', function() {
                rangeValueDisplay.textContent = `${this.value}px`;
            });
            
            // Обработчик изменения скорости анимации
            listen(speedRange, 'input', function() {
                speedValue.textContent = `${this.value}s`;
            });
        
        // Функция для изменения цвета всех элементов SVG
        function changeAllColors(color) {
            scene.recolor(color);
        }
        
        // Функция для валидации и нормализации hex-кода
        function normalizeHex(hex) {
            // Удаляем пробелы
            hex = hex.trim();
            
            // Добавляем # если его нет
            if (!hex.startsWith('#')) {
                hex = '#' + hex;
            }
            
            // Проверяем формат
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            if (hexRegex.test(hex)) {
                // Конвертируем короткую форму в полную
                if (hex.length === 4) {
                    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
                }
                return hex.toUpperCase();
            }
            
            return null;
        }
        
        // Обработчик колор пикера
        listen(colorPicker, 'input', function() {
            const color = this.value.toUpperCase();
            hexInput.value = color;
            changeAllColors(color);
        });
        
        // Обработчик ввода hex-кода
        listen(hexInput, 'input', function() {
            let hex = this.value;
            const normalized = normalizeHex(hex);
            
            if (normalized) {
                this.value = normalized;
                colorPicker.value = normalized;
                changeAllColors(normalized);
            }
        });
        
        // Обработчик потери фокуса (blur) для hex-инпута
        listen(hexInput, 'blur', function() {
            const normalized = normalizeHex(this.value);
            if (normalized) {
                this.value = normalized;
                colorPicker.value = normalized;
            } else {
                // Если некорректный hex, возвращаем значение из колор пикера
                this.value = colorPicker.value.toUpperCase();
            }
        });
        
        // Функция для изменения цвета фона
        function changeBackgroundColor(color) {
            document.getElementById('svg-container').style.backgroundColor = color;
            console.log(`Цвет фона изменён на: ${color}`);
        }
        
        // Обработчик колор пикера фона
        listen(bgColorPicker, 'input', function() {
            const color = this.value.toUpperCase();
            bgHexInput.value = color;
            changeBackgroundColor(color);
        });
        
        // Обработчик ввода hex-кода фона
        listen(bgHexInput, 'input', function() {
            let hex = this.value;
            const normalized = normalizeHex(hex);
            
            if (normalized) {
                this.value = normalized;
                bgColorPicker.value = normalized;
                changeBackgroundColor(normalized);
            }
        });
        
        // Обработчик потери фокуса (blur) для hex-инпута фона
        listen(bgHexInput, 'blur', function() {
            const normalized = normalizeHex(this.value);
            if (normalized) {
                this.value = normalized;
                bgColorPicker.value = normalized;
            } else {
                // Если некорректный hex, возвращаем значение из колор пикера
                this.value = bgColorPicker.value.toUpperCase();
            }
        });
        
        // Функция для случайного размещения групп
        function randomizeGroups() {
            console.log('Выполняем случайное размещение элементов...');
            
            // Получаем текущие значения настроек
            const randomRange = parseInt(randomRangeSlider.value);
            const easing = easingSelect.value;
            const speed = parseFloat(speedRange.value);
            
            console.log(`Диапазон случайного перемещения: ±${randomRange}px`);
            console.log(`Тип анимации: ${easing}`);
            console.log(`Скорость анимации: ${speed}s`);
            
            scene.randomize({ range: randomRange, speed, easing });
        }
        
        // Функция для сброса положения групп
        function resetGroups() {
            console.log('Сбрасываем положение элементов...');
            
            // Получаем текущие значения настроек
            const easing = easingSelect.value;
            const speed = parseFloat(speedRange.value);
            
            console.log(`Сброс с анимацией: ${easing}, скорость: ${speed}s`);
            
            scene.reset({ speed, easing });
            
            // Дополнительно форсируем перерисовку SVG
            const svgElement = document.querySelector('#svg-container > svg');
            if (svgElement) {
                // Используем getBoundingClientRect для принудительного обновления макета
                svgElement.getBoundingClientRect();
            }
        }
        
        // Привязываем обработчики событий для кнопок
        
        // Функция для экспорта SVG
        function exportSVG() {
            console.log('Экспорт SVG с рандомизацией по перемещению...');
            
            try {
                // Создаем копию текущего SVG
                const svgElement = document.querySelector('#svg-container > svg');
                if (!svgElement) {
                    console.error('SVG элемент не найден');
                    alert('Error: SVG element not found');
                    throw new Error('No calendar template loaded');
                }
                
                const svgClone = scene.exportClone({ range: parseInt(randomRangeSlider.value) });
                
                // Получаем SVG как строку
                const serializer = new XMLSerializer();
                let svgString = serializer.serializeToString(svgClone);
                
                // Добавляем XML-заголовок
                svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
                
                // Создаем Blob и URL для скачивания
                const blob = new Blob([svgString], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(blob);
                
                // Создаем ссылку для скачивания
                const a = document.createElement('a');
                a.href = url;
                a.download = 'calendar_randomized.svg';
                document.body.appendChild(a);
                a.click();
                
                // Очищаем
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                
                console.log('SVG экспортирован успешно');
            } catch (error) {
                console.error('Ошибка при экспорте SVG:', error);
                alert('Export failed: ' + error.message);
                throw error;
            }
        }
        
        // Привязываем обработчик события к кнопке экспорта
        import('../infra/framework/src/ui/GeneratorHost.js?v=7').then(({ mountGenerator }) => {
            if (lifecycle.signal.aborted) return;
            mountGenerator({
                id: 'calendar-randomizer', title: 'Calendar Randomizer',
                panels: [{ title: 'Calendar', selectors: ['.controls'], summary: () => `${svgSelector.selectedOptions[0]?.textContent || ''} · ${randomRangeSlider.value}` }],
                actions: [
                    { id: 'svg', button: 'exportSVG', label: 'SVG', kind: 'export', group: 'primary', shortcut: 'mod+e', run: exportSVG },
                    { id: 'randomize', button: 'randomize', label: 'Randomize', kind: 'command', group: 'panel', shortcut: 'space', run: randomizeGroups },
                    { id: 'reset', button: 'reset', label: 'Reset', kind: 'command', group: 'panel', shortcut: 'backspace', run: resetGroups }
                ]
            });
        }).catch(console.error);
    }
});
