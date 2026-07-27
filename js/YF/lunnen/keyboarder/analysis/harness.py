"""Эталонные значения для сверки JS-порта с Python. Пишет analysis/harness.json.

Сверяется всё, на чём стоит выключка: метрики гарнитуры, ink-бокс и advance каждой
строки макета, признаки формы края и предсказанная компенсация. Расхождение хотя бы
в одном числе означает, что браузерный инструмент считает не то же, что проверенный
на макете Python.
"""
import json, os
import font as _font, map_ as _map, model as _model, optics as _optics, compensation as _comp

HERE = os.path.dirname(os.path.abspath(__file__))
EPS, W = _comp.EPS, _comp.W


def strings():
    """Все логические строки макета: текст, кегль, трекинг, ink и advance."""
    out = []
    seen = set()
    for g in _map.GLYPHS:
        k = (g['text'], round(g['size'], 6), round(g['tracking'], 7))
        if k in seen:
            continue
        seen.add(k)
        ink, advbox, per = _font.layout(g['text'], g['size'], g['tracking'], (0.0, 0.0))
        out.append(dict(text=g['text'], size=g['size'], tracking=g['tracking'],
                        ink=list(ink) if ink else None, advw=advbox[2]))
    return out


def glyph_features(coef):
    chars = sorted({c for g in _map.GLYPHS for c in g['text'] if c != ' '})
    out = []
    for ch in chars:
        if _font.gname(ch) is None:
            continue
        bb = _font.gbox(ch)
        b = _optics.band(ch)
        row = dict(ch=ch, adv=_font.adv(ch), bbox=list(bb) if bb else None,
                   band=list(b) if b else None)
        for side in ('L', 'R'):
            f = _model.feats(ch, side, EPS, W)
            row[side] = None if f is None else dict(
                noncontact=f['noncontact'], recess=f['recess'],
                depth=f['depth'], h=f['h'],
                outdent_em=sum(v * f[k] for k, v in coef.items()))
        out.append(row)
    return out


if __name__ == '__main__':
    import fit as _fit
    coef = _comp.coefficients([r for r in _fit.dataset()
                               if r[0].isalpha() or r[0].isdigit()])['coef']
    d = dict(
        metrics=_font.info(), eps=EPS, w=W, coef=coef,
        strings=strings(), glyphs=glyph_features(coef))
    out = os.path.join(HERE, 'harness.json')
    json.dump(d, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'строк {len(d["strings"])}, знаков {len(d["glyphs"])}')
    print('записано:', out)
