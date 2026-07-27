"""Финальная типизация клавиш и выгрузка модели раскладки в JSON."""
import collections, json, os
import kb, map_ as _map, font as _font, types_ as _types

K, BY = _map.KEYS, _map.BY_KEY
CAP = _font.CAP_HEIGHT / _font.UPM
XH = _font.X_HEIGHT / _font.UPM
U_TIER = 13.5279          # смещение baseline верхнего яруса нампада от низа поля
TOL = 0.75

BLOCKS = ['main', 'nav', 'numpad']


def refbox(el, kind):
    """Опорный бокс элемента: cap-бокс для букв/цифр, ink-бокс для остального."""
    if kind == 'icon':
        b = el['bb']
        return b[0], b[1], b[0] + b[2], b[1] + b[3]
    i = el['ink']
    if all(c.isalnum() or c == ' ' for c in el['text']):
        # буквы и цифры: типографский cap-бокс, выносные элементы игнорируются
        return i[0], el['by'] - CAP * el['size'], i[0] + i[2], el['by']
    return i[0], i[1], i[0] + i[2], i[1] + i[3]     # символы: чистый ink-бокс


def anchors(el, k, kind, label_capline=None):
    """Слот элемента: вертикальный якорь + горизонтальный якорь.

    Вертикаль: T верх поля, B низ поля, M x-центрирование, U верхний ярус нампада,
    F центр свободной зоны над подписью, t/b верхняя/нижняя половина без привязки.
    Горизонталь: L левый край, R правый край, C центр, l/r половина без привязки.
    """
    x0, y0, x1, y1 = refbox(el, kind)
    if kind == 'glyph':
        base, size = el['by'], el['size']
    else:
        base = size = None
    if abs(y0 - k['gy0']) < TOL:
        v = 'T'
    elif abs(y1 - k['gy1']) < TOL:
        v = 'B'
    elif base is not None and abs(base - (k['gcy'] + XH * size / 2)) < 0.6:
        v = 'M'
    elif base is not None and abs(base - (k['gy1'] - U_TIER)) < 0.3:
        v = 'U'
    elif label_capline is not None and abs((y0 + y1) / 2 - (k['gy0'] + label_capline) / 2) < TOL:
        v = 'F'
    elif abs((y0 + y1) / 2 - k['gcy']) < TOL:
        v = 'M'
    else:
        v = 't' if (y0 + y1) / 2 < k['gcy'] else 'b'
    cx = (el['bx'] + el['advw'] / 2) if kind == 'glyph' else (x0 + x1) / 2
    if abs(x0 - k['gx0']) < TOL:
        h = 'L'
    elif abs(x1 - k['gx1']) < TOL:
        h = 'R'
    elif abs(cx - k['gcx']) < 0.15:
        h = 'C'
    else:
        h = 'l' if cx < k['gcx'] else 'r'
    return v + h


def key_slots(ci):
    k = K[ci]
    d = BY[ci]
    lc = None
    bottom = [g for g in d['glyphs'] if abs(g['by'] - k['gy1']) < TOL]
    if bottom:
        lc = min(g['by'] - CAP * g['size'] for g in bottom)
    out = []
    for g in d['glyphs']:
        if g['ink']:
            out.append((anchors(g, k, 'glyph', lc), 'txt', g['text'], round(g['size'], 2)))
    for ic in d['icons']:
        out.append((anchors(ic, k, 'icon', lc), 'ico', ic['kind'], None))
    OV = {'T': 0, 't': 1, 'F': 2, 'U': 3, 'M': 4, 'b': 5, 'B': 6}
    OH = {'L': 0, 'l': 1, 'C': 2, 'r': 3, 'R': 4}
    out.sort(key=lambda t: (OV[t[0][0]], OH[t[0][1]]))
    return out


def quad(slot):
    """Квадрант/зона слота без учёта точности привязки."""
    v, h = slot[0], slot[1]
    v = {'T': 'top', 't': 'top', 'F': 'mid', 'U': 'mid', 'M': 'mid',
         'b': 'bot', 'B': 'bot'}[v]
    h = {'L': 'left', 'l': 'left', 'C': 'center', 'r': 'right', 'R': 'right'}[h]
    return v + '-' + h


TEMPLATES = [
    ('blank',            lambda s: not s),
    ('alpha-dual',       lambda s: [quad(x[0]) for x in s] == ['top-left', 'bot-right']),
    ('legend-corners',   lambda s: len(s) >= 3 and all(x[1] == 'txt' for x in s)
                                   and all(quad(x[0]).split('-')[1] != 'center' for x in s)),
    ('legend-2corners',  lambda s: len(s) == 2 and all(x[1] == 'txt' for x in s)
                                   and all(quad(x[0]).split('-')[1] != 'center' for x in s)),
    ('fkey-icon+label',  lambda s: [quad(x[0]) for x in s] == ['mid-center', 'bot-center']
                                   and s[0][1] == 'ico' and s[1][1] == 'txt'),
    ('icon-center',      lambda s: len(s) == 1 and s[0][1] == 'ico'),
    ('word-center',      lambda s: len(s) == 1 and s[0][1] == 'txt'
                                   and quad(s[0][0]) == 'mid-center'),
    ('word-outer',       lambda s: len(s) == 1 and s[0][1] == 'txt'
                                   and quad(s[0][0]) in ('bot-left', 'bot-right')),
    ('word-bottom',      lambda s: len(s) == 1 and s[0][1] == 'txt'
                                   and quad(s[0][0]) == 'bot-center'),
    ('word-2line',       lambda s: len(s) == 2 and all(x[1] == 'txt' for x in s)
                                   and [quad(x[0]) for x in s] == ['mid-center', 'bot-center']),
    ('word-stack',       lambda s: len(s) == 2 and all(x[1] == 'txt' for x in s)
                                   and [quad(x[0]) for x in s] == ['top-center', 'bot-center']),
    ('numpad-tier',      lambda s: len(s) == 2 and s[0][0] == 'UC'),
    ('numpad-tier-solo', lambda s: len(s) == 1 and s[0][0] == 'UC'),
    ('icon+word-stack',  lambda s: len(s) == 2 and s[0][1] == 'ico'
                                   and quad(s[1][0]) == 'bot-center'),
    ('corner-icon+word', lambda s: len(s) == 2 and s[0][1] == 'ico'
                                   and quad(s[0][0]) in ('top-left', 'top-right')),
    ('status-pair',      lambda s: len(s) == 2 and {x[1] for x in s} == {'ico', 'txt'}),
]


def template(slots):
    for name, test in TEMPLATES:
        try:
            if test(slots):
                return name
        except Exception:
            pass
    return 'other:' + '+'.join(quad(x[0]) for x in slots)


def table():
    rows = []
    for k in sorted(K, key=lambda k: (k['row'], k['cap'][0])):
        s = key_slots(k['i'])
        rows.append(dict(
            row=k['row'], x=round(k['cap'][0], 4), y=round(k['cap'][1], 4),
            w=round(k['cap'][2], 4), h=round(k['cap'][3], 4),
            u=round(_types.u(k['cap'][2]), 4),
            block=BLOCKS[min(_types.block_of(k), 2)],
            legend=' '.join(x[2] for x in s if x[1] == 'txt') or '',
            icons=sum(1 for x in s if x[1] == 'ico'),
            slots=[x[0] for x in s], tpl=template(s)))
    return rows


if __name__ == '__main__':
    T = table()
    print('=== ТИПЫ ПО ШАБЛОНАМ РАССТАНОВКИ ===')
    for t, n in collections.Counter(r['tpl'] for r in T).most_common():
        ex = [r['legend'] or '(иконка)' for r in T if r['tpl'] == t][:6]
        print(f'  {n:3d}  {t:20s}  напр.: {", ".join(ex)}')
    print('\n=== ПОЛНАЯ ТАБЛИЦА ===')
    print(f'{"ряд":>3} {"x":>9} {"U":>7} {"h":>4} {"блок":>7} {"слоты":>22} {"шаблон":22} легенда')
    for r in T:
        print(f'{r["row"]:>3} {r["x"]:9.2f} {r["u"]:7.4f} {r["h"]/46.1885:4.0f} {r["block"]:>7} '
              f'{",".join(r["slots"]):>22} {r["tpl"]:22} {r["legend"]}'
              + (f'  +{r["icons"]}ico' if r['icons'] else ''))
    out = os.path.join(kb.ROOT, 'LCAKB23.layout.json')
    json.dump(T, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\nзаписано:', out)
