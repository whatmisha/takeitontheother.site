"""Сборка модели раскладки: клавиши, охранные поля, глифы, иконки + их привязка."""
import collections, html, re
import kb as _kb, font as _font

s = _kb.load()
ST = _kb.styles(s)
CAPS = _kb.rects(s, 'caps')
GUIDES = _kb.rects(s, 'guides')

# --- guide -> cap 1:1
G_OF_CAP = {}
for gi, g in enumerate(GUIDES):
    ci = _kb.assign((g[0] + g[2] / 2, g[1] + g[3] / 2), CAPS)
    G_OF_CAP[ci] = gi
INSET = 6.6085

# --- нумерация: строки сверху вниз, внутри строки слева направо
_rows = collections.defaultdict(list)
for i, r in enumerate(CAPS):
    _rows[round(r[1], 0)].append(i)
ROW_Y = sorted(_rows)
ROW_OF = {}
ORDER = []
for ri, y in enumerate(ROW_Y):
    for ci in sorted(_rows[y], key=lambda i: CAPS[i][0]):
        ROW_OF[ci] = ri
        ORDER.append(ci)


def key(ci):
    c, g = CAPS[ci], GUIDES[G_OF_CAP[ci]]
    return dict(i=ci, row=ROW_OF[ci], cap=c, guide=g,
                cx=c[0] + c[2] / 2, cy=c[1] + c[3] / 2,
                gx0=g[0], gy0=g[1], gx1=g[0] + g[2], gy1=g[1] + g[3],
                gcx=g[0] + g[2] / 2, gcy=g[1] + g[3] / 2)


KEYS = [key(i) for i in range(len(CAPS))]

# ------------------------------------------------------------------ глифы
GLYPHS = []
for t in _kb.texts(s, 'glyphs'):
    size = _kb.font_size(ST, t['cls'])
    # tspan'ы с одинаковым y — это одна строка, разбитая только из-за трекинга
    lines = collections.OrderedDict()
    for attrs, txt in t['spans']:
        dx = float(re.search(r'x="([-\d.]+)"', attrs).group(1)) if 'x=' in attrs else 0.0
        dy = float(re.search(r'y="([-\d.]+)"', attrs).group(1)) if 'y=' in attrs else 0.0
        scls = re.search(r'class="([^"]+)"', attrs)
        tr = _kb.letter_spacing(ST, (scls.group(1) if scls else '') + ' ' + t['cls'])
        lines.setdefault(round(dy, 4), []).append((dx, html.unescape(txt), tr))
    for dy, parts in lines.items():
        parts.sort()
        bx, by = t['x'] + parts[0][0], t['y'] + dy
        # ink считается по каждому фрагменту в его позиции, затем объединяется
        boxes, per, adv_end = [], [], bx
        for dx, txt, tr in parts:
            ink, advbox, pg = _font.layout(txt, size, tr, (t['x'] + dx, by))
            if ink:
                boxes.append(ink)
            per += pg
            adv_end = max(adv_end, t['x'] + dx + advbox[2])
        ink = _kb._union(boxes) if boxes else None
        GLYPHS.append(dict(text=''.join(p[1] for p in parts), size=size,
                           tracking=parts[0][2], bx=bx, by=by,
                           ink=ink, advw=adv_end - bx, cls=t['cls'], per=per))

for gl in GLYPHS:
    pt = (gl['ink'][0] + gl['ink'][2] / 2, gl['by']) if gl['ink'] else (gl['bx'], gl['by'])
    gl['key'] = _kb.assign(pt, CAPS)

# ------------------------------------------------------------------ иконки
ICONS = []
for gid in ('icons', 'f-icons'):
    for bb, kind in _kb.shapes(s, gid):
        ICONS.append(dict(g=gid, bb=bb, kind=kind,
                          key=_kb.assign((bb[0] + bb[2] / 2, bb[1] + bb[3] / 2), CAPS)))

# ------------------------------------------------------------------ индекс
BY_KEY = collections.defaultdict(lambda: dict(glyphs=[], icons=[]))
for gl in GLYPHS:
    BY_KEY[gl['key']]['glyphs'].append(gl)
for ic in ICONS:
    BY_KEY[ic['key']]['icons'].append(ic)
