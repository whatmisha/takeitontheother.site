/**
 * Единицы измерения.
 *
 * Внутренняя единица инструмента — px, она же pt, она же 1/72 дюйма. Это подтверждено замером
 * по чертежу: 10000 px = 3527.778 мм, то есть 1 px = 25.4/72 мм ровно (см. PIPELINE.md § 8.3).
 */

export const MM_PER_PX = 25.4 / 72;          // 0.352777…
export const PX_PER_MM = 72 / 25.4;          // 2.834645…

export const toMm = (px) => px * MM_PER_PX;
export const toPx = (mm) => mm * PX_PER_MM;

/** Формат «12.34 px / 4.35 мм» для полей ввода. */
export const fmtMm = (px, decimals = 2) => toMm(px).toFixed(decimals);
