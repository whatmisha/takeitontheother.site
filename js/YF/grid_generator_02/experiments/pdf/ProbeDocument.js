// Semantic fixture: LF separates paragraphs; U+2028 is a forced line break.
// All dimensions are millimeters, typography is points. No rendered SVG input.
export const FONT_FILES = Object.freeze({
    regular: 'TT Commons Classic Regular.otf',
    medium: 'TT Commons Classic Medium.otf',
    display: 'LunnenDisplay-VariableVF.ttf'
});

export function createProbeDocument() {
    const styles = {
        title: { name: 'Probe / Title', font: 'medium', size: 25, leading: 30 },
        note: { name: 'Probe / Note', font: 'regular', size: 10, leading: 13 },
        label: { name: 'Probe / Label', font: 'medium', size: 9, leading: 12 },
        body: { name: 'Brand / Body', font: 'regular', size: 13, leading: 17 },
        medium: { name: 'Brand / Medium', font: 'medium', size: 13, leading: 17, tracking: 0.04 },
        display: { name: 'Brand / Display 400', font: 'display', size: 34, leading: 40 },
        displayAlt: { name: 'Brand / Display alternates', font: 'display', size: 34, leading: 40,
            features: { salt: true, ss01: true, tnum: true } }
    };
    const frame = (id, style, x, y, width, height, text, extra = {}) =>
        ({ id, style, x, y, width, height, text, ...extra });
    return {
        version: 1,
        title: 'Pizza Boxer 02 - PDF editability probe',
        styles,
        pages: [
            { width: 210, height: 297, frames: [
                frame('title-1', 'title', 18, 17, 176, 16, 'PDF / проверка текста'),
                frame('intro-1', 'note', 18, 33, 176, 17, 'Контрольный файл для Illustrator 30.8.1. Создан в браузере.\nЖивой текст и PDF-теги; нативные стили Illustrator пока не подтверждены.'),
                frame('label-body', 'label', 18, 55, 105, 7, '01 / BODY - 100 mm / TT Commons Regular'),
                frame('body-frame', 'body', 18, 65, 100, 85,
                    'Это первый абзац. При изменении ширины рамки его строки должны переверстаться. Кириллица, Latin, Ёё, Йй, 0123456789.\n\nПосле пустого абзаца: масса 250\u00a0г, размер 100\u00a0мм.\u2028Это ручной перенос внутри второго непустого абзаца.', { border: true }),
                frame('label-medium', 'label', 133, 55, 60, 7, '02 / MEDIUM / RIGHT'),
                frame('medium-frame', 'medium', 133, 65, 59, 85, 'Упаковка\nPackaging 02\nТрекинг 0.04 em\nЁж / Quick fox', { align: 'right', border: true }),
                frame('label-display', 'label', 18, 161, 174, 7, '03 / LUNNEN DISPLAY / wght 400'),
                frame('display-frame', 'display', 18, 174, 174, 23, 'Луннен / Lunnen 0123'),
                frame('label-alt', 'label', 18, 209, 174, 7, '04 / LUNNEN / salt + ss01 + tnum'),
                frame('display-alt', 'displayAlt', 18, 222, 174, 24, 'Луннен / Lunnen 0123'),
                frame('footer-1', 'note', 18, 273, 174, 12, 'Проверить: единая рамка, переверстка, именованные стили.  /  1 of 2')
            ] },
            { width: 210, height: 297, frames: [
                frame('title-2', 'title', 18, 17, 176, 16, 'PDF / повороты и вектор'),
                frame('intro-2', 'note', 18, 33, 176, 17, 'Три текстовых блока повернуты целиком. Рамки - обычные векторы.\nВ документе нет изображений, прозрачностей и обтравочных масок.'),
                frame('label-rotation', 'label', 18, 55, 176, 7, '05 / FRAME ROTATION / 90 - 180 - 270'),
                frame('rotation-90', 'body', 54, 69, 75, 36, 'Поворот 90°\nЭто один текстовый блок. Измените ширину рамки.', { rotation: 90, border: true }),
                frame('rotation-270', 'body', 147, 144, 75, 36, 'Поворот 270°\nЭто один текстовый блок. Измените ширину рамки.', { rotation: 270, border: true }),
                frame('rotation-180', 'medium', 160, 201, 110, 36, 'Поворот 180° / Rotation\nКириллица и Latin остаются текстом.', { rotation: 180, align: 'center', border: true }),
                frame('label-ruler', 'label', 18, 223, 174, 7, '06 / VECTOR / LINE LENGTH = 100 mm'),
                frame('vector-note', 'note', 18, 243, 174, 13, 'Линия ниже метки имеет длину 100 мм; рядом - прямоугольник 20 × 15 мм.'),
                frame('footer-2', 'note', 18, 273, 174, 12, 'Проверить: углы, физические размеры, отсутствие лишних масок.  /  2 of 2')
            ], ruler: true }
        ]
    };
}
