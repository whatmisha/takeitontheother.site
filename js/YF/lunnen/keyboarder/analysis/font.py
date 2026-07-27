"""Метрики шрифта YS Text и расчёт чернильного (ink) bbox набранной строки."""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'LCAKB23', 'Fonts', 'YS Text-Regular.ttf')
_f = TTFont(FONT)
UPM = _f['head'].unitsPerEm
_cmap = _f.getBestCmap()
_gs = _f.getGlyphSet()
_hmtx = _f['hmtx']
_os2 = _f['OS/2']

X_HEIGHT = _os2.sxHeight
CAP_HEIGHT = _os2.sCapHeight
ASC, DESC = _f['hhea'].ascent, _f['hhea'].descent

_bbcache = {}


def gname(ch):
    return _cmap.get(ord(ch))


def gbox(ch):
    """(xMin,yMin,xMax,yMax) в единицах em или None для пробельных."""
    g = gname(ch)
    if g is None:
        return None
    if g not in _bbcache:
        p = BoundsPen(_gs)
        _gs[g].draw(p)
        _bbcache[g] = p.bounds
    return _bbcache[g]


def adv(ch):
    g = gname(ch)
    return _hmtx[g][0] if g else 0


def sidebearings(ch):
    """(левый полуапрош, правый полуапрош) в единицах em."""
    bb = gbox(ch)
    if bb is None:
        return (0, 0)
    return (bb[0], adv(ch) - bb[2])


def layout(text, size, tracking=0.0, start=(0.0, 0.0)):
    """Разложить строку. Возвращает (ink_bbox, advance_bbox, per_glyph).

    ink_bbox   — bbox фактических контуров (то, что видит глаз), Y вниз (SVG).
    advance_bbox — bbox по пером/адвансам (то, что показывает Illustrator как «текстовый» бокс).
    """
    k = size / UPM
    pen = 0.0
    ink = [1e18, 1e18, -1e18, -1e18]
    per = []
    for ch in text:
        bb = gbox(ch)
        if bb is not None:
            x0 = start[0] + (pen + bb[0]) * k
            x1 = start[0] + (pen + bb[2]) * k
            y0 = start[1] - bb[3] * k
            y1 = start[1] - bb[1] * k
            ink[0] = min(ink[0], x0); ink[1] = min(ink[1], y0)
            ink[2] = max(ink[2], x1); ink[3] = max(ink[3], y1)
            per.append((ch, x0, y0, x1, y1, bb, adv(ch)))
        pen += adv(ch) + tracking * UPM
    advw = (pen - tracking * UPM) * k if text else 0.0
    if ink[0] > 1e17:
        return None, (start[0], start[1], advw, 0), per
    return ((ink[0], ink[1], ink[2] - ink[0], ink[3] - ink[1]),
            (start[0], start[1], advw, 0), per)


def info():
    return dict(upm=UPM, x_height=X_HEIGHT, cap_height=CAP_HEIGHT, asc=ASC, desc=DESC,
                x_height_em=X_HEIGHT / UPM, cap_em=CAP_HEIGHT / UPM)
