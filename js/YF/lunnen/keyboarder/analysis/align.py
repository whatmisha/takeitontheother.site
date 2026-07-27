"""Проверка гипотез о правилах выравнивания глифов относительно охранного поля."""
import statistics as st
import map_ as _map, font as _font

K, BY = _map.KEYS, _map.BY_KEY
CAP = _font.CAP_HEIGHT / _font.UPM      # 0.717
XH = _font.X_HEIGHT / _font.UPM         # 0.519


def cands_v(g, k):
    """Кандидаты вертикальной привязки -> невязка (px)."""
    s, b = g['size'], g['by']
    ink = g['ink']
    return {
        'baseline=guide.bottom': b - k['gy1'],
        'capline=guide.top': (b - CAP * s) - k['gy0'],
        'ink.top=guide.top': ink[1] - k['gy0'],
        'ink.bottom=guide.bottom': ink[1] + ink[3] - k['gy1'],
        'capbox.mid=guide.mid': (b - CAP * s / 2) - k['gcy'],
        'ink.mid=guide.mid': (ink[1] + ink[3] / 2) - k['gcy'],
        'xbox.mid=guide.mid': (b - XH * s / 2) - k['gcy'],
    }


def cands_h(g, k):
    ink = g['ink']
    return {
        'ink.left=guide.left': ink[0] - k['gx0'],
        'ink.right=guide.right': ink[0] + ink[2] - k['gx1'],
        'ink.mid=guide.mid': (ink[0] + ink[2] / 2) - k['gcx'],
        'pen.left=guide.left': g['bx'] - k['gx0'],
        'adv.right=guide.right': g['bx'] + g['advw'] - k['gx1'],
        'adv.mid=guide.mid': (g['bx'] + g['advw'] / 2) - k['gcx'],
    }


def best(d, tol=0.6):
    n, v = min(d.items(), key=lambda kv: abs(kv[1]))
    return (n, v) if abs(v) <= tol else (None, v)


def analyse():
    rows = []
    for g in _map.GLYPHS:
        if not g['ink']:
            continue
        k = K[g['key']]
        cv, ch = cands_v(g, k), cands_h(g, k)
        rows.append(dict(g=g, k=k, cv=cv, ch=ch,
                         v=best(cv), h=best(ch)))
    return rows


if __name__ == '__main__':
    import collections
    R = analyse()
    print('глифов с контуром:', len(R))
    print('\n=== ВЕРТИКАЛЬ: какая привязка выигрывает ===')
    c = collections.Counter(r['v'][0] for r in R)
    for n, cnt in c.most_common():
        res = [abs(r['v'][1]) for r in R if r['v'][0] == n]
        print(f'  {str(n):26s} n={cnt:3d}  |невязка| med={st.median(res):.3f} max={max(res):.3f}')
    print('\n=== ГОРИЗОНТАЛЬ ===')
    c = collections.Counter(r['h'][0] for r in R)
    for n, cnt in c.most_common():
        res = [abs(r['h'][1]) for r in R if r['h'][0] == n]
        print(f'  {str(n):26s} n={cnt:3d}  |невязка| med={st.median(res):.3f} max={max(res):.3f}')

    print('\n=== средняя |невязка| каждой гипотезы по всем глифам ===')
    for axis, fn in (('V', 'cv'), ('H', 'ch')):
        print(' ', axis)
        names = R[0][fn].keys()
        for n in names:
            vals = [abs(r[fn][n]) for r in R]
            print(f'    {n:26s} med={st.median(vals):7.3f}  доля<0.3px={sum(v<0.3 for v in vals)/len(vals):.0%}')
