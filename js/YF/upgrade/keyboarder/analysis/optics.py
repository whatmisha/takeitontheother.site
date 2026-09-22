"""Профили контуров глифов и модель оптической компенсации."""
import math
from fontTools.pens.recordingPen import DecomposingRecordingPen
import font as _font

N_SCAN = 400          # число сканлайнов на полосу измерения


def _flatten(ch, steps=24):
    """Контуры глифа как список замкнутых полигонов (в единицах em)."""
    g = _font.gname(ch)
    if g is None:
        return []
    p = DecomposingRecordingPen(_font._gs)   # раскрывает составные глифы
    _font._gs[g].draw(p)
    polys, cur = [], []
    pt = (0, 0)

    def bez(p0, p1, p2, p3):
        for i in range(1, steps + 1):
            t = i / steps
            u = 1 - t
            cur.append((u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
                        u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]))

    for op, args in p.value:
        if op == 'moveTo':
            if len(cur) > 2:
                polys.append(cur)
            cur = [args[0]]
            pt = args[0]
        elif op == 'lineTo':
            cur.append(args[0])
            pt = args[0]
        elif op == 'curveTo':
            a = list(args)
            while len(a) > 3:
                bez(pt, a[0], a[1], a[2])
                pt = a[2]
                a = a[3:]
            if len(a) == 3:
                bez(pt, a[0], a[1], a[2])
                pt = a[2]
            elif len(a) == 2:                     # квадратичная в записи curveTo
                q = a[0]
                c1 = (pt[0] + 2 / 3 * (q[0] - pt[0]), pt[1] + 2 / 3 * (q[1] - pt[1]))
                c2 = (a[1][0] + 2 / 3 * (q[0] - a[1][0]), a[1][1] + 2 / 3 * (q[1] - a[1][1]))
                bez(pt, c1, c2, a[1])
                pt = a[1]
        elif op == 'qCurveTo':
            a = [x for x in args if x is not None]
            on = pt
            for i in range(len(a) - 1):
                q = a[i]
                nxt = a[i + 1] if i + 1 == len(a) - 1 else ((a[i][0] + a[i + 1][0]) / 2,
                                                           (a[i][1] + a[i + 1][1]) / 2)
                c1 = (on[0] + 2 / 3 * (q[0] - on[0]), on[1] + 2 / 3 * (q[1] - on[1]))
                c2 = (nxt[0] + 2 / 3 * (q[0] - nxt[0]), nxt[1] + 2 / 3 * (q[1] - nxt[1]))
                bez(on, c1, c2, nxt)
                on = nxt
            pt = on
        elif op == 'closePath':
            if len(cur) > 2:
                polys.append(cur)
            cur = []
    if len(cur) > 2:
        polys.append(cur)
    return polys


_pcache = {}


def profile(ch, y0, y1, n=N_SCAN):
    """Левый и правый профили ink по сканлайнам в полосе [y0,y1] (em).

    Возвращает (ys, left, right); None там, где на сканлайне нет контура.
    """
    k = (ch, round(y0), round(y1), n)
    if k in _pcache:
        return _pcache[k]
    polys = _flatten(ch)
    ys = [y0 + (y1 - y0) * (i + 0.5) / n for i in range(n)]
    L, R = [], []
    for y in ys:
        xs = []
        for poly in polys:
            m = len(poly)
            for i in range(m):
                (ax, ay), (bx, by) = poly[i], poly[(i + 1) % m]
                if (ay <= y < by) or (by <= y < ay):
                    xs.append(ax + (bx - ax) * (y - ay) / (by - ay))
        if xs:
            L.append(min(xs)); R.append(max(xs))
        else:
            L.append(None); R.append(None)
    _pcache[k] = (ys, L, R)
    return _pcache[k]


def band(ch):
    """Полоса измерения: пересечение ink-бокса глифа с [0, capHeight]."""
    bb = _font.gbox(ch)
    if bb is None:
        return None
    return (max(bb[1], 0), min(bb[3], _font.CAP_HEIGHT))


def gap(ch, side, y0=None, y1=None, p=1.0):
    """Средний «оптический зазор» между крайней точкой и профилем, em-units.

    p — показатель степени: gap = ( mean( d^p ) )^(1/p), d = |x_profile - x_extreme|.
    p=1 -> средний зазор (площадь/высота); p->inf -> максимум.
    """
    b = band(ch)
    if b is None:
        return 0.0
    y0 = b[0] if y0 is None else y0
    y1 = b[1] if y1 is None else y1
    if y1 - y0 < 1:
        return 0.0
    ys, L, R = profile(ch, y0, y1)
    prof = L if side == 'L' else R
    vals = [v for v in prof if v is not None]
    if not vals:
        return 0.0
    ext = min(vals) if side == 'L' else max(vals)
    ds = [abs(v - ext) for v in vals]
    return (sum(d**p for d in ds) / len(ds))**(1 / p)


def descriptors(ch, side):
    """Набор безразмерных дескрипторов формы для края глифа."""
    bb = _font.gbox(ch)
    if bb is None:
        return None
    b = band(ch)
    h = b[1] - b[0]
    ys, L, R = profile(ch, b[0], b[1])
    prof = [v for v in (L if side == 'L' else R) if v is not None]
    if not prof or h <= 0:
        return None
    ext = min(prof) if side == 'L' else max(prof)
    d = [abs(v - ext) for v in prof]
    n = len(d)
    flat = sum(1 for x in d if x < 8) / n          # доля высоты с «плоской» стенкой
    return dict(
        ch=ch, side=side, adv=_font.adv(ch),
        sb=(bb[0] if side == 'L' else _font.adv(ch) - bb[2]),
        h=h, w=bb[2] - bb[0],
        mean=sum(d) / n,                            # средний зазор
        rms=math.sqrt(sum(x * x for x in d) / n),
        p4=(sum(x**4 for x in d) / n)**0.25,
        med=sorted(d)[n // 2],
        q25=sorted(d)[n // 4],
        flat=flat,
        maxd=max(d),
    )
