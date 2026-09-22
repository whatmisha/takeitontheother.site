"""Итоговая модель оптической компенсации: признаки формы края + МНК."""
import math
import fit as _fit, font as _font, optics as _optics

CAP = _font.CAP_HEIGHT


def solve(A, b):
    """МНК через нормальные уравнения (метод Гаусса)."""
    n = len(A[0])
    M = [[sum(A[r][i] * A[r][j] for r in range(len(A))) for j in range(n)]
         + [sum(A[r][i] * b[r] for r in range(len(A)))] for i in range(n)]
    for i in range(n):
        p = max(range(i, n), key=lambda r: abs(M[r][i]))
        M[i], M[p] = M[p], M[i]
        if abs(M[i][i]) < 1e-12:
            return None
        for r in range(n):
            if r != i:
                f = M[r][i] / M[i][i]
                for c in range(i, n + 1):
                    M[r][c] -= f * M[i][c]
    return [M[i][n] / M[i][i] for i in range(n)]


def feats(ch, side, eps=6.0, w=120.0):
    """Признаки формы края глифа (безразмерные, 0..1)."""
    b = _optics.band(ch)
    if b is None or b[1] - b[0] < 1:
        return None
    ys, L, R = _optics.profile(ch, b[0], b[1])
    prof = [v for v in (L if side == 'L' else R) if v is not None]
    if not prof:
        return None
    ext = min(prof) if side == 'L' else max(prof)
    d = [abs(v - ext) for v in prof]
    n = len(d)
    contact = sum(1 for x in d if x <= eps) / n
    recess = sum(min(x, w) for x in d) / (w * n)
    return dict(noncontact=1 - contact, recess=recess,
                depth=min(max(d) / CAP, 1.0),
                h=(b[1] - b[0]) / CAP)


def build(rows, eps, w, keys):
    A, y, meta = [], [], []
    for ch, side, od, size, g in rows:
        f = feats(ch, side, eps, w)
        if f is None:
            continue
        A.append([f[k] for k in keys])
        y.append(od)
        meta.append((ch, side, od, size))
    c = solve(A, y)
    if c is None:
        return None
    pred = [sum(ci * ai for ci, ai in zip(c, row)) for row in A]
    ssr = sum((a - b_) ** 2 for a, b_ in zip(y, pred))
    sst = sum(v * v for v in y)
    return dict(coef=dict(zip(keys, c)), r2=1 - ssr / sst,
                rmse=math.sqrt(ssr / len(y)), rows=list(zip(meta, pred)))


def compensate(ch, side, size, coef, eps=6.0, w=120.0):
    """Оптическая компенсация (вылет за край поля) в px для кегля size."""
    f = feats(ch, side, eps, w)
    if f is None:
        return 0.0
    return sum(v * f[k] for k, v in coef.items()) * size / 1000


if __name__ == '__main__':
    rows = [r for r in _fit.dataset() if r[0].isalpha() or r[0].isdigit()]
    print('букв и цифр в выборке:', len(rows))
    print('\n=== перебор наборов признаков (eps=6, w=120) ===')
    combos = [('noncontact',), ('recess',), ('depth',),
              ('noncontact', 'recess'), ('noncontact', 'depth'),
              ('recess', 'depth'), ('noncontact', 'recess', 'depth')]
    for keys in combos:
        m = build(rows, 6.0, 120.0, keys)
        print(f'  {str(keys):44s} R2={m["r2"]:.3f} RMSE={m["rmse"]*15.2/1000:.3f}px  '
              + ' '.join(f'{k}={v:+7.2f}' for k, v in m['coef'].items()))

    print('\n=== перебор eps и w для (noncontact, recess) ===')
    best = None
    for eps in (2, 4, 6, 8, 12, 16, 24, 32):
        for w in (40, 60, 80, 120, 160, 220, 300):
            m = build(rows, eps, w, ('noncontact', 'recess'))
            if best is None or m['r2'] > best[2]['r2']:
                best = (eps, w, m)
    eps, w, m = best
    print(f'  лучшее: eps={eps} w={w}  R2={m["r2"]:.3f} RMSE={m["rmse"]*15.2/1000:.3f}px')
    print('  коэффициенты (em-units):', {k: round(v, 2) for k, v in m['coef'].items()})

    print('\n=== факт vs модель, em-units (1000 = кегль) ===')
    print(f'{"гл":>3} {"бок":>3} {"кегль":>6} {"факт":>7} {"модель":>7} {"Δ,px":>7}')
    for (ch, side, od, size), p in sorted(m['rows'], key=lambda t: -t[0][2]):
        print(f'{ch:>3} {side:>3} {size:6.2f} {od:7.1f} {p:7.1f} {(od-p)*size/1000:7.3f}')
