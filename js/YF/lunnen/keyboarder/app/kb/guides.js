/**
 * Охранные поля (PIPELINE.md § 7).
 *
 * Поле — прямоугольник, вписанный в габарит клавиши с одинаковым инсетом со всех четырёх сторон.
 * Инсет измерен по эталону: 6.6085 px, медиана по 440 кромкам, разброс 0.0008.
 *
 * Смысл поля — не «безопасная зона», а система координат для легенд (§ 9), поэтому его метрики
 * нужны на каждой клавише независимо от того, рисуем ли мы его на экране.
 */

/**
 * @param {{x:number,y:number,w:number,h:number}} key
 * @param {number} inset
 * @returns {{x0,y0,x1,y1,cx,cy,w,h}} метрики поля
 */
export function guideOf(key, inset) {
    const x0 = key.x + inset;
    const y0 = key.y + inset;
    const x1 = key.x + key.w - inset;
    const y1 = key.y + key.h - inset;
    return {
        x0, y0, x1, y1,
        cx: (x0 + x1) / 2,
        cy: (y0 + y1) / 2,
        w: x1 - x0,
        h: y1 - y0
    };
}

/** Проставляет поле каждой клавише как `key.guide`. Мутирует список — он наш, локальный. */
export function attachGuides(keys, inset) {
    for (const k of keys) k.guide = guideOf(k, inset);
    return keys;
}
