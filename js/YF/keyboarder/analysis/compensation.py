"""Параметры оптической компенсации для гарнитуры: коэффициенты МНК + таблица знаков.

Коэффициенты считаются на буквах и цифрах (там формула работает, § 10.3 PIPELINE),
таблица — на знаках препинания, где формула бессильна (§ 10.4). Таблица не выдумывается:
это те самые сдвиги, которые дизайнер набил в макете глазом.

Выгружается модулем JS, чтобы браузерный инструмент не тянул Python.
"""
import collections, json, os, statistics
import kb, fit as _fit, legends as _legends, model as _model

EPS, W = 32.0, 300.0
FEATS = ('noncontact', 'recess')
ALNUM = lambda ch: ch.isalpha() or ch.isdigit()


def coefficients(rows):
    m = _model.build(rows, EPS, W, FEATS)
    return m


def table():
    """Медиана измеренного вылета знаков препинания по (знак, сторона), em-units.

    Источник — классификация слотов, а не отдельный порог по расстоянию до кромки:
    если анализ признал горизонталь элемента прижатой к краю поля, то и в таблицу
    он попадает. Иначе знаки на границе порога (`´` при 0.746 px) выпадают из таблицы,
    и инструмент считает для них формулу, которая на пунктуации не работает.
    """
    ref = _legends.dump()
    acc = collections.defaultdict(list)
    for k in ref['keys']:
        gx0 = k['guide'][0]
        gx1 = gx0 + k['guide'][2]
        for e in k['elements']:
            if e['kind'] != 'txt' or len(e['text']) != 1:
                continue
            ch = e['text']
            if ch.isalnum():
                continue
            side = e['slot'][1]
            if side not in ('L', 'R'):
                continue
            ink0, ink1 = e['ink'][0], e['ink'][0] + e['ink'][2]
            od = (gx0 - ink0) if side == 'L' else (ink1 - gx1)
            acc[(ch, side)].append(od / e['size'] * 1000)
    out = {}
    for (ch, side), v in sorted(acc.items()):
        out.setdefault(ch, {})[side] = round(statistics.median(v), 2)
    return out


def flat_stem_check(rows, m):
    """Контроль: знаки с плоским штамбом обязаны давать ноль."""
    FLAT = set('HIKLMNPRBDEF') | set('ИЙЛМНПЧШЫЯ') | set('-=[|')
    got = [(ch, od, _model.compensate(ch, side, 1000, m['coef'], EPS, W))
           for ch, side, od, size, g in rows if ch in FLAT]
    if not got:
        return None
    pred = [p for _, _, p in got]
    fact = [o for _, o, _ in got]
    return dict(n=len(got), pred_mean=statistics.mean(pred),
                fact_mean=statistics.mean(fact),
                fact_sigma=statistics.pstdev(fact) if len(fact) > 1 else 0.0)


if __name__ == '__main__':
    rows = _fit.dataset()
    alnum = [r for r in rows if ALNUM(r[0])]
    punct = [r for r in rows if not ALNUM(r[0])]
    m = coefficients(alnum)
    t = table()
    fs = flat_stem_check(alnum, m)

    print(f'выборка: всего {len(rows)}, букв и цифр {len(alnum)}, знаков {len(punct)}')
    print(f'eps={EPS:g} w={W:g}  R2={m["r2"]:.3f}  RMSE={m["rmse"] * 15.2 / 1000:.3f} px @15.2')
    print('коэффициенты:', {k: round(v, 2) for k, v in m['coef'].items()})
    print(f'инвариант плоского штамба: n={fs["n"]}, модель={fs["pred_mean"]:+.2f} em, '
          f'факт={fs["fact_mean"]:+.2f} em, sigma факта={fs["fact_sigma"]:.2f} em '
          f'= {fs["fact_sigma"] * 15.2 / 1000:.3f} px')
    print(f'таблица знаков: {len(t)} знаков, {sum(len(v) for v in t.values())} измерений')

    payload = dict(
        id='YS Text Regular', eps=EPS, w=W,
        coef={k: round(v, 4) for k, v in m['coef'].items()},
        r2=round(m['r2'], 4), rmse_em=round(m['rmse'], 3),
        table=t)
    body = json.dumps(payload, ensure_ascii=False, indent=4)
    out = os.path.join(kb.ROOT, 'app', 'kb', 'models', 'ys-text-regular.js')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write('/**\n * Параметры оптической компенсации YS Text Regular.\n'
                ' * Сгенерировано analysis/compensation.py — править там, не здесь.\n'
                ' *\n * coef  — МНК на буквах и цифрах, em-units на 1000 кегля.\n'
                ' * table — медиана измеренного вылета для знаков препинания,\n'
                ' *         по сторонам L и R, em-units. Формула на них не работает.\n */\n')
        f.write('export default ' + body + ';\n')
    print('записано:', out)
