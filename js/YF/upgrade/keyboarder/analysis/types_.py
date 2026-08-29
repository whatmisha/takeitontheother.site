"""Типизация клавиш: геометрия, блоки, слоты легенд, роли."""
import collections
import map_ as _map, font as _font

K, BY = _map.KEYS, _map.BY_KEY
CAP = _font.CAP_HEIGHT / _font.UPM
XH = _font.X_HEIGHT / _font.UPM

# ------------------------------------------------------------ геометрия сетки
XS = sorted({round(k['cap'][0], 3) for k in K})
YS = sorted({round(k['cap'][1], 3) for k in K})
W1 = min(k['cap'][2] for k in K)
H1 = min(k['cap'][3] for k in K)
PX = min(b - a for a, b in zip(XS, XS[1:]) if b - a > W1 - 1)   # шаг по X
PY = min(b - a for a, b in zip(YS, YS[1:]))                      # шаг по Y
GX, GY = PX - W1, PY - H1


def u(w):
    """Ширина в юнитах: (w + gap) / pitch."""
    return (w + GX) / PX


# ------------------------------------------------------------ блоки по разрывам
def blocks():
    """Кластеризация клавиш по горизонтальным разрывам > 1.5 обычного зазора."""
    edges = sorted((k['cap'][0], k['cap'][0] + k['cap'][2]) for k in K)
    cuts, right = [], edges[0][1]
    for x0, x1 in edges[1:]:
        if x0 - right > GX * 1.5:
            cuts.append((right, x0))
        right = max(right, x1)
    return cuts


CUTS = blocks()
BOUNDS = [0] + [(a + b) / 2 for a, b in CUTS] + [1e9]
BLOCK_NAMES = ['main', 'nav', 'arrows', 'numpad']


def block_of(k):
    for i in range(len(BOUNDS) - 1):
        if BOUNDS[i] <= k['cx'] < BOUNDS[i + 1]:
            return i
    return -1


# ------------------------------------------------------------ слоты легенд
def slot_of(el, k, kind):
    """Слот элемента внутри охранного поля: (вертикаль, горизонталь)."""
    if kind == 'glyph':
        top = el['by'] - CAP * el['size']
        bot = el['by']
        x0, x1 = el['ink'][0], el['ink'][0] + el['ink'][2]
        if el['ink'][1] < top:            # ink выше cap-линии (скобки, диакритика)
            top = el['ink'][1]
        if el['ink'][1] + el['ink'][3] > bot:
            bot = el['ink'][1] + el['ink'][3]
    else:
        b = el['bb']
        top, bot, x0, x1 = b[1], b[1] + b[3], b[0], b[0] + b[2]
    tol = 0.7
    v = ('top' if abs(top - k['gy0']) < tol else
         'bottom' if abs(bot - k['gy1']) < tol else 'middle')
    h = ('left' if abs(x0 - k['gx0']) < tol else
         'right' if abs(x1 - k['gx1']) < tol else 'center')
    return v, h


def compose(ci):
    """Описание содержимого клавиши: список (слот, тип, текст)."""
    k = K[ci]
    d = BY[ci]
    out = []
    for g in d['glyphs']:
        if g['ink']:
            out.append((slot_of(g, k, 'glyph'), 'glyph', g['text'], g['size']))
    for ic in d['icons']:
        out.append((slot_of(ic, k, 'icon'), 'icon', ic['kind'], None))
    return out


ORDER_V = {'top': 0, 'middle': 1, 'bottom': 2}
ORDER_H = {'left': 0, 'center': 1, 'right': 2}


def signature(ci):
    """Подпись схемы расстановки: слоты + типы, без текста."""
    c = compose(ci)
    c.sort(key=lambda t: (ORDER_V[t[0][0]], ORDER_H[t[0][1]]))
    return tuple((f'{v}-{h}', t) for (v, h), t, _, _ in c)


if __name__ == '__main__':
    print('=== ГЕОМЕТРИЯ СЕТКИ ===')
    print(f'  1U ширина  W = {W1:.7f}')
    print(f'  1U высота  H = {H1:.7f}')
    print(f'  шаг по X   Px = {PX:.7f}   зазор Gx = {GX:.7f}')
    print(f'  шаг по Y   Py = {PY:.7f}   зазор Gy = {GY:.7f}')
    print(f'  инсет охранного поля = {_map.INSET}')
    print(f'  строк = {len(YS)}, колонок (уник. X) = {len(XS)}, клавиш = {len(K)}')
    print(f'\n  разрывы между блоками: ' +
          ', '.join(f'{a:.1f}..{b:.1f} (={b-a:.2f} = {(b-a)/GX:.2f}·Gx)' for a, b in CUTS))

    print('\n=== ШИРИНЫ КЛАВИШ ===')
    wc = collections.Counter(round(k['cap'][2], 4) for k in K)
    for w, n in sorted(wc.items()):
        print(f'  w={w:9.4f}  = {u(w):6.4f} U   n={n:3d}')
    print('  высоты:', {round(k['cap'][3], 4): 0 for k in K}.keys())
    hc = collections.Counter(round(k['cap'][3], 4) for k in K)
    for h, n in sorted(hc.items()):
        print(f'  h={h:9.4f}  = {(h+GY)/PY:6.4f} U   n={n:3d}')

    print('\n=== СХЕМЫ РАССТАНОВКИ (подписи) ===')
    sc = collections.Counter(signature(k['i']) for k in K)
    for sig, n in sc.most_common():
        print(f'  n={n:3d}  {" | ".join(f"{s}:{t}" for s, t in sig) or "(пусто)"}')

    print('\n=== СЛОТЫ: сколько элементов в каждом ===')
    sl = collections.Counter()
    for k in K:
        for (v, h), t, txt, sz in compose(k['i']):
            sl[(v, h, t)] += 1
    for key, n in sl.most_common():
        print(f'  {key[0]:6s}-{key[1]:6s} {key[2]:5s}  n={n}')
