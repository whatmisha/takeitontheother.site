let video;
let poseNet;
let poses = [];
let letterO, letterN, letterY;
let labelDivs = {};
let currentPositions = {};
let labelCurrentPositions = {};
let videoBuffer;

// В начале файла добавим стиль
let style = document.createElement('style');
style.textContent = `
    .variable-font {
        font-family: 'Ony Track VGX';
        font-variation-settings: 'wdth' 1000;
    }
`;
document.head.appendChild(style);

function setup() {
    createCanvas(windowWidth, windowHeight);
    video = createCapture(VIDEO);
    video.size(640, 480);
    video.hide();
    
    poseNet = ml5.poseNet(video, modelReady);
    poseNet.on('pose', function(results) {
        poses = results;
    });
    
    // Создаем элементы для букв
    letterO = createDiv('O');
    letterN = createDiv('N');
    letterY = createDiv('Y');
    
    // Стилизуем элементы - убираем scaleX(-1)
    const letterStyle = `
        position: absolute;
        font-family: 'Ony Track VGX';
        font-size: 180px;
        color: rgb(0, 255, 0);
        transform: translate(-50%, -50%);
        pointer-events: none;
        text-align: center;
        z-index: 1000;
    `;
    
    letterO.style(letterStyle);
    letterN.style(letterStyle);
    letterY.style(letterStyle);
}

function modelReady() {
    console.log('PoseNet модель загружена');
}

function calculateWidth(nose, leftEye, rightEye) {
    // Вычисляем среднюю точку между глазами
    let centerX = (leftEye.position.x + rightEye.position.x) / 2;
    
    // Вычисляем отклонение носа от центра
    let deviation = Math.abs(nose.position.x - centerX);
    
    // Вычисляем максимально возможное отклонение (расстояние между глазами)
    let maxDeviation = Math.abs(rightEye.position.x - leftEye.position.x);
    
    // Нормализуем отклонение от 0 до 1 и делаем более чувствительным
    let normalizedDeviation = (deviation / maxDeviation) * 2; // Умножаем на 2 для большей чувствительности
    
    // Преобразуем в значение ширины от 100 до 1000
    let width = 1000 - (normalizedDeviation * 900);
    
    // Ограничиваем значения
    return Math.max(100, Math.min(1000, Math.round(width)));
}

function drawVariableText(x, y, text, width) {
    const ctx = drawingContext;
    ctx.save();
    ctx.font = `180px "Ony Track VGX"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgb(0, 255, 0)';
    
    // Устанавливаем вариативные настройки
    ctx.font = `180px "Ony Track VGX"`;
    ctx.fontVariationSettings = `"wdth" ${width}`;
    
    ctx.fillText(text, x, y);
    ctx.restore();
}

function smoothPosition(current, target, smoothing = 0.2) {
    return {
        x: lerp(current.x || target.x, target.x, smoothing),
        y: lerp(current.y || target.y, target.y, smoothing)
    };
}

function draw() {
    background(0);
    
    push();
    translate(width, 0);
    scale(-1, 1);
    
    let videoAspect = 4/3;
    let windowAspect = width / height;
    
    let w, h;
    
    if (windowAspect > videoAspect) {
        w = width;
        h = width / videoAspect;
    } else {
        h = height;
        w = height * videoAspect;
    }
    
    let x = (width - w) / 2;
    let y = (height - h) / 2;
    
    // Создаем отдельный графический буфер для видео
    if (!videoBuffer) {
        videoBuffer = createGraphics(w, h);
    }
    videoBuffer.image(video, 0, 0, w, h);
    // videoBuffer.filter(GRAY);  // закомментировали применение ч/б фильтра
    
    // Отображаем обработанное видео
    image(videoBuffer, x, y, w, h);
    
    if (poses.length > 0) {
        let pose = poses[0].pose;
        
        // Отрисовка всех ключевых точек
        for (let keypoint of pose.keypoints) {
            if (keypoint.part === 'leftEye' || keypoint.part === 'rightEye' || keypoint.part === 'nose') {
                continue;
            }
            
            if (keypoint.score > 0.2) {
                let scaledX = (keypoint.position.x / 640) * w + x;
                let scaledY = (keypoint.position.y / 480) * h + y;
                
                // Инициализируем текущую позицию, если её нет
                if (!labelCurrentPositions[keypoint.part]) {
                    labelCurrentPositions[keypoint.part] = { x: scaledX, y: scaledY };
                }
                
                // Сглаживаем движение
                labelCurrentPositions[keypoint.part] = smoothPosition(
                    labelCurrentPositions[keypoint.part],
                    { x: scaledX, y: scaledY },
                    0.1 // Меньшее значение = более плавное движение
                );
                
                let smoothX = labelCurrentPositions[keypoint.part].x;
                let smoothY = labelCurrentPositions[keypoint.part].y;
                
                fill(0, 255, 0);
                noStroke();
                ellipse(smoothX, smoothY, 10, 10);
                
                if (!labelDivs[keypoint.part]) {
                    labelDivs[keypoint.part] = createDiv(keypoint.part);
                    labelDivs[keypoint.part].style(`
                        position: absolute;
                        font-family: 'Ony Track VGX';
                        color: rgb(0, 255, 0);
                        pointer-events: none;
                        font-size: 24px;
                        font-variation-settings: 'wdth' 500;
                    `);
                }
                
                if (keypoint.part === 'leftEar') {
                    labelDivs[keypoint.part].style('text-align', 'right');
                    labelDivs[keypoint.part].position(width - smoothX - 70, smoothY - 12);
                } else {
                    labelDivs[keypoint.part].position(width - smoothX + 15, smoothY - 12);
                }
            }
        }
        
        let leftEye = pose.keypoints.find(k => k.part === 'leftEye');
        let rightEye = pose.keypoints.find(k => k.part === 'rightEye');
        let nose = pose.keypoints.find(k => k.part === 'nose');
        
        if (leftEye && rightEye && nose && 
            leftEye.score > 0.2 && rightEye.score > 0.2 && nose.score > 0.2) {
            
            let widthValue = calculateWidth(nose, leftEye, rightEye);
            
            // Сглаживаем движение букв
            ['leftEye', 'rightEye', 'nose'].forEach(part => {
                let point = pose.keypoints.find(k => k.part === part);
                let scaledX = (point.position.x / 640) * w + x;
                let scaledY = (point.position.y / 480) * h + y;
                
                if (!currentPositions[part]) {
                    currentPositions[part] = { x: scaledX, y: scaledY };
                }
                
                currentPositions[part] = smoothPosition(
                    currentPositions[part],
                    { x: scaledX, y: scaledY },
                    0.1
                );
            });
            
            // Обновляем позиции букв с использованием сглаженных координат
            letterO.position(width - currentPositions['leftEye'].x, currentPositions['leftEye'].y);
            letterN.position(width - currentPositions['rightEye'].x, currentPositions['rightEye'].y);
            letterY.position(width - currentPositions['nose'].x, currentPositions['nose'].y + 30);
            
            // Сглаживаем изменение ширины
            if (!currentPositions.width) currentPositions.width = widthValue;
            currentPositions.width = lerp(currentPositions.width, widthValue, 0.1);
            
            // Применяем сглаженную ширину
            letterO.style('font-variation-settings', `"wdth" ${currentPositions.width}`);
            letterN.style('font-variation-settings', `"wdth" ${currentPositions.width}`);
            letterY.style('font-variation-settings', `"wdth" ${currentPositions.width}`);
        }
    }
    
    pop();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
