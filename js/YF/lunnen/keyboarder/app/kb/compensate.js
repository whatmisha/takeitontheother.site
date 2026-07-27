/**
 * Оптическая компенсация: насколько выпустить знак за край охранного поля. Порт § 10 PIPELINE.
 *
 * Все параметры гарнитуры собраны в один объект `params`, а не зашиты в код: на этапе 8
 * они станут вычисляемыми из шрифтового файла, и логика останется прежней.
 */
import { makeFeatureCache } from './optics.js';
import YS_TEXT_REGULAR from './models/ys-text-regular.js';

export { YS_TEXT_REGULAR };

const isAlnum = (ch) => /[\p{L}\p{N}]/u.test(ch);
/** Буквы и цифры — формула; всё остальное — таблица. */
export const formulaApplies = (text) => [...text].every((c) => isAlnum(c) || c === ' ');

export class Compensator {
    constructor(typeface, params = YS_TEXT_REGULAR) {
        this.tf = typeface;
        this.params = params;
        this.feats = makeFeatureCache(typeface);
    }

    /** Вылет в em-units (1000 = кегль) для одного знака у стороны side. */
    outdentEm(ch, side) {
        const { eps, w, coef, table } = this.params;
        const row = table && table[ch];
        if (row && row[side] !== undefined) return row[side];
        const f = this.feats(ch, side, eps, w);
        if (!f) return 0;
        return Object.entries(coef).reduce((s, [k, v]) => s + v * f[k], 0);
    }

    /**
     * Вылет строки в px. Считается по краевому знаку: именно он касается края поля.
     * @param {'L'|'R'} side
     */
    outdentPx(text, side, size) {
        if (!text) return 0;
        const chars = [...text].filter((c) => c !== ' ');
        if (!chars.length) return 0;
        const ch = side === 'L' ? chars[0] : chars[chars.length - 1];
        return (this.outdentEm(ch, side) * size) / 1000;
    }

    /** Из чего сложилась компенсация — для отчёта и отладки. */
    explain(ch, side) {
        const { eps, w, coef, table } = this.params;
        const row = table && table[ch];
        if (row && row[side] !== undefined) {
            return { ch, side, source: 'table', em: row[side] };
        }
        const f = this.feats(ch, side, eps, w);
        if (!f) return { ch, side, source: 'none', em: 0 };
        return {
            ch, side, source: 'formula', em: this.outdentEm(ch, side),
            noncontact: f.noncontact, recess: f.recess
        };
    }
}
