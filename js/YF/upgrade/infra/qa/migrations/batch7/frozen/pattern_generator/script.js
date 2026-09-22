/**
 * Основной скрипт для управления приложением
 */
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация системы вкладок
    initTabs();
    
    // Инициализация событий изменения размера
    window.addEventListener('resize', handleResize);
    
    // Первоначальная настройка размеров канвасов
    handleResize();
    
    // Инициализация горячих клавиш
    initHotkeys();
});

/**
 * Инициализация системы вкладок
 */
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            // Удаляем активный класс со всех кнопок и контента
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Активируем выбранную вкладку
            button.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Вызываем обновление для активного канваса
            if (tabName === 'fibonacci' && window.fibonacciModule) {
                window.fibonacciModule.resizeCanvas();
                window.fibonacciModule.generatePattern();
            } else if (tabName === 'voronoi' && window.voronoiModule) {
                window.voronoiModule.resizeCanvas();
                window.voronoiModule.generatePoints();
            } else if (tabName === 'rectangle' && window.rectangleModule) {
                window.rectangleModule.resizeCanvas();
                window.rectangleModule.generatePoints();
            } else if (tabName === 'fibonacci-rect' && window.fibonacciRectModule) {
                window.fibonacciRectModule.resizeCanvas();
                window.fibonacciRectModule.generatePattern();
            }
        });
    });
}

/**
 * Обработчик изменения размера окна
 */
function handleResize() {
    // Вызываем обновление для активного канваса
    const activeTab = document.querySelector('.tab-button.active').getAttribute('data-tab');
    
    if (activeTab === 'fibonacci' && window.fibonacciModule) {
        window.fibonacciModule.resizeCanvas();
        window.fibonacciModule.generatePattern();
    } else if (activeTab === 'voronoi' && window.voronoiModule) {
        window.voronoiModule.resizeCanvas();
        window.voronoiModule.generatePoints();
    } else if (activeTab === 'rectangle' && window.rectangleModule) {
        window.rectangleModule.resizeCanvas();
        window.rectangleModule.generatePoints();
    } else if (activeTab === 'fibonacci-rect' && window.fibonacciRectModule) {
        window.fibonacciRectModule.resizeCanvas();
        window.fibonacciRectModule.generatePattern();
    }
}

/**
 * Инициализация горячих клавиш
 */
function initHotkeys() {
    // Обработчик горячей клавиши cmd+e для экспорта в SVG
    document.addEventListener('keydown', function(event) {
        // Проверяем, что нажата cmd+e (metaKey для macOS, ctrlKey для Windows)
        if ((event.metaKey || event.ctrlKey) && event.key === 'e') {
            // Предотвращаем стандартное поведение браузера
            event.preventDefault();
            
            // Получаем активную вкладку
            const activeTab = document.querySelector('.tab-button.active').getAttribute('data-tab');
            
            // Вызываем соответствующую функцию экспорта в зависимости от активной вкладки
            if (activeTab === 'fibonacci' && window.fibonacciModule) {
                window.fibonacciModule.exportAsSvg();
            } else if (activeTab === 'voronoi' && window.voronoiModule) {
                window.voronoiModule.exportAsSvg();
            } else if (activeTab === 'rectangle' && window.rectangleModule) {
                window.rectangleModule.exportSvg();
            } else if (activeTab === 'fibonacci-rect' && window.fibonacciRectModule) {
                window.fibonacciRectModule.exportSvg();
            }
        }
    });
} 