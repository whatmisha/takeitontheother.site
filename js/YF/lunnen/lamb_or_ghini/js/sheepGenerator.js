/**
 * Генератор овечки — создаёт SVG-группу одной овечки с параметризацией
 * Основано на images/lamb_or_ghini.svg
 */

import { DOMUtils } from './utils/DOMUtils.js';

// Канонические позиции относительно центра овечки (0, 0)
// Центр ≈ (118, 83) из оригинального SVG
const BODY_CENTERS = [
    { x: -68, y: -4 },   // левый: (50, 79)
    { x: 8, y: -33 },    // верхний: (126, 50)
    { x: -5, y: 40 },    // нижний левый: (113, 123)
    { x: 65, y: -3 }     // правый: (183, 79)
];

const BODY_RADIUS = 50;
const BODY_FILL = '#D9D9D9';

// Глаза: вертикальные эллипсы (rx < ry)
const EYE_POSITIONS = [
    { x: 53.5, y: -17.7 },  // (171.5, 65.3)
    { x: 84, y: -17.7 }     // (202, 65.3)
];
const EYE_RX = 8.15;
const EYE_RY = 13.78;

// Уши: повёрнутые эллипсы
const EAR_POSITIONS = [
    { x: 15.5, y: -22.3, rotation: 45 },   // (133.5, 60.7)
    { x: 115.5, y: -22.3, rotation: -45 }   // (233.5, 60.7)
];
const EAR_RX = 8.15;
const EAR_RY = 36.58;

/**
 * Создаёт SVG-группу одной овечки
 * @param {Object} params
 * @param {number} params.x - X центра овечки
 * @param {number} params.y - Y центра овечки
 * @param {number} [params.scale=1] - масштаб
 * @param {number} [params.bodySpread=0] - разброс кругов тела (0..1, 0 = без разброса)
 * @param {number} [params.eyeSize=1] - множитель размера глаз
 * @param {number} [params.earSize=1] - множитель размера ушей
 * @param {number} [params.rotation=0] - поворот в градусах
 * @param {Function} [params.random=Math.random] - функция рандома (для seed)
 * @returns {SVGGElement}
 */
export function generateSheep(params) {
    const {
        x = 0,
        y = 0,
        scale = 1,
        bodySpread = 0,
        eyeSize = 1,
        earSize = 1,
        rotation = 0,
        random = Math.random
    } = params;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', `translate(${x}, ${y}) rotate(${rotation}) scale(${scale})`);

    // Разброс тела: смещение каждого круга
    const spreadAmount = bodySpread * 25; // max ±25 единиц при bodySpread=1

    // 4 круга тела
    for (let i = 0; i < BODY_CENTERS.length; i++) {
        const base = BODY_CENTERS[i];
        const offsetX = spreadAmount > 0 ? (random() * 2 - 1) * spreadAmount : 0;
        const offsetY = spreadAmount > 0 ? (random() * 2 - 1) * spreadAmount : 0;
        const cx = base.x + offsetX;
        const cy = base.y + offsetY;

        DOMUtils.createSVGElement('circle', {
            cx: String(cx),
            cy: String(cy),
            r: String(BODY_RADIUS),
            fill: BODY_FILL
        }, group);
    }

    // 2 глаза
    const eyeRx = EYE_RX * eyeSize;
    const eyeRy = EYE_RY * eyeSize;
    for (const pos of EYE_POSITIONS) {
        DOMUtils.createSVGElement('ellipse', {
            cx: String(pos.x),
            cy: String(pos.y),
            rx: String(eyeRx),
            ry: String(eyeRy),
            fill: 'black'
        }, group);
    }

    // 2 уха
    const earRx = EAR_RX * earSize;
    const earRy = EAR_RY * earSize;
    for (const pos of EAR_POSITIONS) {
        DOMUtils.createSVGElement('ellipse', {
            cx: String(pos.x),
            cy: String(pos.y),
            rx: String(earRx),
            ry: String(earRy),
            transform: `rotate(${pos.rotation} ${pos.x} ${pos.y})`,
            fill: 'black'
        }, group);
    }

    return group;
}
