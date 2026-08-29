"""Подбор модели оптической компенсации по измеренным сдвигам глифов."""
import math
import map_ as _map, font as _font, optics as _optics

K = _map.KEYS
CAP = _font.CAP_HEIGHT / _font.UPM


def dataset():
    """[(ch, side, outdent_em, size)] для одиночных глифов, выровненных по краю."""
    out = []
    for g in _map.GLYPHS:
        if not g['ink'] or len(g['text']) != 1:
            continue
        k = K[g['key']]
        dL = g['ink'][0] - k['gx0']
        dR = g['ink'][0] + g['ink'][2] - k['gx1']
        if abs(dL) < 0.7 and abs(dL) <= abs(dR):
            out.append((g['text'], 'L', -dL / g['size'] * 1000, g['size'], g))
        elif abs(dR) < 0.7:
            out.append((g['text'], 'R', dR / g['size'] * 1000, g['size'], g))
    return out


def wedge(ch, side, w, band=None):
    """Средний «усечённый» белый зазор у края в полосе измерения, em-units.

    Учитывается только белое в пределах w от крайней точки — так модель
    насыщается на открытых формах (T, C, Г) и линейна на круглых и косых.
    """
    b = _optics.band(ch) if band is None else band
    if b is None or b[1] - b[0] < 1:
        return 0.0
    ys, L, R = _optics.profile(ch, b[0], b[1])
    prof = [v for v in (L if side == 'L' else R) if v is not None]
    if not prof:
        return 0.0
    ext = min(prof) if side == 'L' else max(prof)
    return sum(min(abs(v - ext), w) for v in prof) / len(prof)


def fit(rows, w, band_mode='cap'):
    """МНК без свободного члена: outdent = k * wedge."""
    xs, ys = [], []
    for ch, side, od, size, g in rows:
        b = None
        if band_mode == 'x':
            b = (0, _font.X_HEIGHT)
        xs.append(wedge(ch, side, w, b))
        ys.append(od)
    sxx = sum(x * x for x in xs)
    if sxx == 0:
        return None
    k = sum(x * y for x, y in zip(xs, ys)) / sxx
    ss_res = sum((y - k * x)**2 for x, y in zip(xs, ys))
    ss_tot = sum(y * y for y in ys)
    return k, 1 - ss_res / ss_tot, [(r[0], r[1], r[2], k * x) for r, x in zip(rows, xs)]


if __name__ == '__main__':
    rows = dataset()
    print('точек:', len(rows))
    print('\n=== подбор окна насыщения w ===')
    print(f'{"w":>6} {"k":>8} {"R2":>8}   {"RMSE, em":>9}  {"RMSE, px@15.2":>13}')
    best = None
    for w in list(range(10, 400, 10)) + [500, 700, 1000]:
        r = fit(rows, w)
        if not r:
            continue
        k, r2, pred = r
        rmse = math.sqrt(sum((o - p)**2 for _, _, o, p in pred) / len(pred))
        if best is None or r2 > best[1]:
            best = (w, r2, k, rmse)
        if w % 20 == 0 or w > 400:
            print(f'{w:6d} {k:8.4f} {r2:8.3f}   {rmse:9.2f}  {rmse*15.2/1000:13.3f}')
    print(f'\nлучшее: w={best[0]} k={best[2]:.4f} R2={best[1]:.3f} RMSE={best[3]:.2f}em '
          f'= {best[3]*15.2/1000:.3f}px @15.2')

    w, k = best[0], best[2]
    _, _, pred = fit(rows, w)
    print(f'\n=== предсказание (w={w}, k={k:.4f}) ===')
    print(f'{"гл":>3} {"бок":>3} {"факт,em":>8} {"модель":>8} {"Δ":>7} {"Δpx":>7}')
    for ch, side, o, p in sorted(pred, key=lambda t: -t[2]):
        print(f'{ch:>3} {side:>3} {o:8.1f} {p:8.1f} {o-p:7.1f} {(o-p)*15.2/1000:7.3f}')
