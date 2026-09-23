"""Выгрузка эталона легенд: позиция пера каждой строки и габарит каждой иконки.

В отличие от final.py, который пишет сводную таблицу по клавишам, здесь выгружается
поэлементный срез с измеренными координатами. Он нужен как цель верификации для
браузерного инструмента: JS считает позицию пера из слота, эталон говорит, где она
стоит в макете, разница — ошибка модели.
"""
import json, os
import kb, map_ as _map, font as _font, final as _final, types_ as _types

BLOCKS = ['main', 'nav', 'numpad']
R4 = lambda v: round(v, 4)


def elements(ci):
    k = _map.KEYS[ci]
    d = _map.BY_KEY[ci]
    lc = None
    bottom = [g for g in d['glyphs'] if abs(g['by'] - k['gy1']) < _final.TOL]
    if bottom:
        lc = min(g['by'] - _final.CAP * g['size'] for g in bottom)
    out = []
    for g in d['glyphs']:
        if not g['ink']:
            continue
        out.append(dict(
            slot=_final.anchors(g, k, 'glyph', lc), kind='txt', text=g['text'],
            size=R4(g['size']), tracking=round(g['tracking'], 7),
            bx=R4(g['bx']), by=R4(g['by']),
            ink=[R4(v) for v in g['ink']], advw=R4(g['advw'])))
    for ic in d['icons']:
        out.append(dict(
            slot=_final.anchors(ic, k, 'icon', lc), kind='ico', name=ic['kind'],
            group=ic['g'], bb=[R4(v) for v in ic['bb']]))
    OV, OH = {'T': 0, 't': 1, 'F': 2, 'U': 3, 'M': 4, 'b': 5, 'B': 6}, \
             {'L': 0, 'l': 1, 'C': 2, 'r': 3, 'R': 4}
    out.sort(key=lambda e: (OV[e['slot'][0]], OH[e['slot'][1]]))
    return out


def dump():
    keys = []
    for k in sorted(_map.KEYS, key=lambda k: (k['row'], k['cap'][0])):
        els = elements(k['i'])
        keys.append(dict(
            i=k['i'], row=k['row'], block=BLOCKS[min(_types.block_of(k), 2)],
            cap=[R4(v) for v in k['cap']], guide=[R4(v) for v in k['guide']],
            tpl=_final.template([(e['slot'], e['kind'],
                                  e.get('text', e.get('name')), e.get('size'))
                                 for e in els]),
            elements=els))
    return dict(
        font=dict(family='YS Text', style='Regular', upm=_font.UPM,
                  capHeight=_font.CAP_HEIGHT, xHeight=_font.X_HEIGHT,
                  ascender=_font.ASC, descender=_font.DESC),
        inset=_map.INSET, interline=_final.U_TIER, keys=keys)


if __name__ == '__main__':
    d = dump()
    out_dir = os.path.join(kb.ROOT, 'reference', 'keyboards')
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, 'Work_2_L.legends.json')
    json.dump(d, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    n_txt = sum(1 for k in d['keys'] for e in k['elements'] if e['kind'] == 'txt')
    n_ico = sum(1 for k in d['keys'] for e in k['elements'] if e['kind'] == 'ico')
    print(f'клавиш {len(d["keys"])}, строк {n_txt}, иконок {n_ico}')
    print('записано:', out)
