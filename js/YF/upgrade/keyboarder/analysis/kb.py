"""Извлечение и анализ геометрии раскладки из reference/keyboards/Work_2_L.svg."""
import os, re, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = os.path.join(ROOT, 'reference', 'keyboards', 'Work_2_L.svg')


def load(path=SVG):
    return open(path, encoding='utf-8').read()


def group(s, gid):
    """Вырезать содержимое группы верхнего уровня по id."""
    i = s.index('<g id="%s">' % gid)
    depth, j = 0, i
    while True:
        o, c = s.find('<g', j + 1), s.find('</g>', j + 1)
        if c == -1:
            return s[i:]
        if o != -1 and o < c:
            depth += 1
            j = o
        else:
            if depth == 0:
                return s[i:c + 4]
            depth -= 1
            j = c


_RECT = re.compile(r'<rect[^>]*?x="([-\d.]+)"[^>]*?y="([-\d.]+)"'
                   r'[^>]*?width="([-\d.]+)"[^>]*?height="([-\d.]+)"[^>]*?>')


def rects(s, gid):
    """Прямоугольники группы с развёрнутыми пустыми трансформациями rotate(-180)."""
    out = []
    for m in _RECT.finditer(group(s, gid)):
        x, y, w, h = map(float, m.groups())
        t = re.search(r'translate\(([-\d.]+) ([-\d.]+)\) rotate\(-180\)', m.group(0))
        if t:
            tx, ty = map(float, t.groups())
            x, y = tx - x - w, ty - y - h
        out.append((x, y, w, h))
    return out


# ---------------------------------------------------------------- path bbox

_NUM = re.compile(r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?')


def _cubic_extrema(p0, p1, p2, p3):
    """Точные экстремумы кубической кривой Безье по одной оси."""
    vals = [p0, p3]
    a = -p0 + 3 * p1 - 3 * p2 + p3
    b = 2 * (p0 - 2 * p1 + p2)
    c = p1 - p0
    if abs(a) < 1e-12:
        if abs(b) > 1e-12:
            ts = [-c / b]
        else:
            ts = []
    else:
        d = b * b - 4 * a * c
        ts = [] if d < 0 else [(-b + math.sqrt(d)) / (2 * a), (-b - math.sqrt(d)) / (2 * a)]
    for t in ts:
        if 0 < t < 1:
            u = 1 - t
            vals.append(u**3 * p0 + 3 * u**2 * t * p1 + 3 * u * t**2 * p2 + t**3 * p3)
    return min(vals), max(vals)


def path_bbox(d):
    """Точный bbox path'а: поддержаны M/L/H/V/C/S/Q/T/Z в абсолютном и относительном виде."""
    tokens = re.findall(r'([MmLlHhVvCcSsQqTtAaZz])|(' + _NUM.pattern + ')', d)
    cmds, cur = [], None
    for letter, num in tokens:
        if letter:
            cur = [letter]
            cmds.append(cur)
        elif cur is not None:
            cur.append(float(num))
    x = y = sx = sy = 0.0
    px = py = None          # предыдущая контрольная точка для S/T
    xs, ys = [], []

    def add(*pts):
        for a, b in pts:
            xs.append(a)
            ys.append(b)

    for c in cmds:
        op, a = c[0], c[1:]
        rel = op.islower()
        o = op.upper()
        k = 0
        while True:
            if o == 'Z':
                x, y = sx, sy
                add((x, y))
                break
            if o == 'M':
                n = 2
            elif o in 'L':
                n = 2
            elif o in 'HV':
                n = 1
            elif o == 'C':
                n = 6
            elif o == 'S':
                n = 4
            elif o == 'Q':
                n = 4
            elif o == 'T':
                n = 2
            elif o == 'A':
                n = 7
            else:
                break
            if k + n > len(a):
                break
            v = a[k:k + n]
            k += n
            if o == 'M':
                nx, ny = (x + v[0], y + v[1]) if rel else (v[0], v[1])
                x, y = nx, ny
                sx, sy = x, y
                add((x, y))
                px = py = None
                o = 'L'                      # последующие пары M трактуются как L
            elif o == 'L':
                x, y = (x + v[0], y + v[1]) if rel else (v[0], v[1])
                add((x, y))
                px = py = None
            elif o == 'H':
                x = x + v[0] if rel else v[0]
                add((x, y))
                px = py = None
            elif o == 'V':
                y = y + v[0] if rel else v[0]
                add((x, y))
                px = py = None
            elif o in 'CS':
                if o == 'C':
                    c1 = (x + v[0], y + v[1]) if rel else (v[0], v[1])
                    c2 = (x + v[2], y + v[3]) if rel else (v[2], v[3])
                    e = (x + v[4], y + v[5]) if rel else (v[4], v[5])
                else:
                    c1 = (2 * x - px, 2 * y - py) if px is not None else (x, y)
                    c2 = (x + v[0], y + v[1]) if rel else (v[0], v[1])
                    e = (x + v[2], y + v[3]) if rel else (v[2], v[3])
                x0, y0 = _cubic_extrema(x, c1[0], c2[0], e[0]), _cubic_extrema(y, c1[1], c2[1], e[1])
                xs += list(x0)
                ys += list(y0)
                px, py = c2
                x, y = e
            elif o in 'QT':
                if o == 'Q':
                    q = (x + v[0], y + v[1]) if rel else (v[0], v[1])
                    e = (x + v[2], y + v[3]) if rel else (v[2], v[3])
                else:
                    q = (2 * x - px, 2 * y - py) if px is not None else (x, y)
                    e = (x + v[0], y + v[1]) if rel else (v[0], v[1])
                c1 = (x + 2 / 3 * (q[0] - x), y + 2 / 3 * (q[1] - y))
                c2 = (e[0] + 2 / 3 * (q[0] - e[0]), e[1] + 2 / 3 * (q[1] - e[1]))
                xs += list(_cubic_extrema(x, c1[0], c2[0], e[0]))
                ys += list(_cubic_extrema(y, c1[1], c2[1], e[1]))
                px, py = q
                x, y = e
            elif o == 'A':
                e = (x + v[5], y + v[6]) if rel else (v[5], v[6])
                add((x, y), e)
                x, y = e
                px = py = None
    return (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)) if xs else None


def _union(boxes):
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
    x1 = max(b[0] + b[2] for b in boxes); y1 = max(b[1] + b[3] for b in boxes)
    return (x0, y0, x1 - x0, y1 - y0)


def shapes(s, gid):
    """[(bbox, kind)] для path / polygon / rect группы.

    Вложенная <g> без id трактуется как один составной объект (иконка из частей).
    """
    body = group(s, gid)
    body = body[body.index('>') + 1:body.rindex('</g>')]
    out = []
    # сначала выделить вложенные группы
    nested = []
    pos = 0
    while True:
        i = body.find('<g', pos)
        if i == -1:
            break
        j = body.index('</g>', i)
        nested.append((i, j + 4))
        pos = j + 4
    flat = ''.join(body[a:b] for a, b in nested)
    outer = body
    for a, b in reversed(nested):
        outer = outer[:a] + outer[b:]

    def prim(chunk):
        res = []
        for m in re.finditer(r'<path[^>]*d="([^"]+)"', chunk):
            bb = path_bbox(m.group(1))
            if bb:
                res.append((bb, 'path'))
        for m in re.finditer(r'<polygon[^>]*points="([^"]+)"', chunk):
            v = [float(x) for x in re.findall(_NUM.pattern, m.group(1))]
            xs, ys = v[0::2], v[1::2]
            res.append(((min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)), 'polygon'))
        for m in _RECT.finditer(chunk):
            x, y, w, h = map(float, m.groups())
            res.append(((x, y, w, h), 'rect'))
        return res

    out += prim(outer)
    for a, b in nested:
        p = prim(body[a:b])
        if p:
            out.append((_union([x[0] for x in p]), 'group:%d' % len(p)))
    return out


def paths(s, gid):
    return [(bb, k) for bb, k in shapes(s, gid)]


def shape_geometry(s, gid):
    """[(bbox, kind, d)] — то же, что shapes(), плюс контур как единый path-d.

    Полигоны переводятся в path, координаты остаются исходными: чтобы поставить
    иконку в другое место, достаточно translate на разницу углов габарита.
    """
    body = group(s, gid)
    body = body[body.index('>') + 1:body.rindex('</g>')]
    nested, pos = [], 0
    while True:
        i = body.find('<g', pos)
        if i == -1:
            break
        j = body.index('</g>', i)
        nested.append((i, j + 4))
        pos = j + 4
    outer = body
    for a, b in reversed(nested):
        outer = outer[:a] + outer[b:]

    def prim(chunk):
        res = []
        for m in re.finditer(r'<path[^>]*d="([^"]+)"', chunk):
            bb = path_bbox(m.group(1))
            if bb:
                res.append((bb, 'path', m.group(1).strip()))
        for m in re.finditer(r'<polygon[^>]*points="([^"]+)"', chunk):
            v = [float(x) for x in re.findall(_NUM.pattern, m.group(1))]
            xs, ys = v[0::2], v[1::2]
            d = 'M' + 'L'.join(f'{a},{b}' for a, b in zip(xs, ys)) + 'Z'
            res.append(((min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)), 'polygon', d))
        for m in _RECT.finditer(chunk):
            x, y, w, h = map(float, m.groups())
            d = f'M{x},{y}H{x + w}V{y + h}H{x}Z'
            res.append(((x, y, w, h), 'rect', d))
        return res

    out = [(bb, k, d) for bb, k, d in prim(outer)]
    for a, b in nested:
        p = prim(body[a:b])
        if p:
            out.append((_union([x[0] for x in p]), 'group:%d' % len(p),
                        ' '.join(x[2] for x in p)))
    return out


# ---------------------------------------------------------------- text

def texts(s, gid='glyphs'):
    """[{cls, x, y, spans:[(attrs, text)]}] для всех <text>."""
    out = []
    for m in re.finditer(r'<text class="([^"]+)" transform="translate\(([-\d.]+) ([-\d.]+)\)">(.*?)</text>',
                         group(s, gid), re.S):
        out.append(dict(cls=m.group(1), x=float(m.group(2)), y=float(m.group(3)),
                        spans=re.findall(r'<tspan([^>]*)>(.*?)</tspan>', m.group(4), re.S)))
    return out


def styles(s):
    """{класс: {свойство: значение}} из <style>."""
    css = re.search(r'<style>(.*?)</style>', s, re.S).group(1)
    res = {}
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', css):
        sels = [x.strip().lstrip('.') for x in m.group(1).split(',')]
        props = {}
        for p in m.group(2).split(';'):
            if ':' in p:
                k, v = p.split(':', 1)
                props[k.strip()] = v.strip()
        for sel in sels:
            res.setdefault(sel, {}).update(props)
    return res


def font_size(st, cls):
    for c in cls.split():
        if 'font-size' in st.get(c, {}):
            return float(st[c]['font-size'].replace('px', ''))
    return None


def letter_spacing(st, cls):
    for c in cls.split():
        if 'letter-spacing' in st.get(c, {}):
            return float(st[c]['letter-spacing'].replace('em', ''))
    return 0.0


# ---------------------------------------------------------------- helpers

def inside(pt, r, pad=0.0):
    x, y = pt
    return r[0] - pad <= x <= r[0] + r[2] + pad and r[1] - pad <= y <= r[1] + r[3] + pad


def assign(pt, keys):
    """Индекс клавиши, содержащей точку; иначе ближайшая по центру."""
    for i, r in enumerate(keys):
        if inside(pt, r):
            return i
    best, bd = None, 1e18
    for i, r in enumerate(keys):
        d = (r[0] + r[2] / 2 - pt[0])**2 + (r[1] + r[3] / 2 - pt[1])**2
        if d < bd:
            best, bd = i, d
    return best
