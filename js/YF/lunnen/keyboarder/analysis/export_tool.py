"""Выгрузка модели содержимого и библиотеки иконок для браузерного инструмента.

Пишет два модуля JS:
  app/kb/content/lcakb23.js — что стоит на каждой клавише: слот, текст, кегль, трекинг;
  app/kb/icons/lcakb23.js   — геометрия 28 пиктограмм.

Смещение (offset) выгружается только для нежёстких слотов — там, где правила нет
и позицию задал глаз. Для жёстких слотов координата не сохраняется вовсе: её обязан
воспроизвести инструмент, и расхождение будет видно в отчёте верификации.
"""
import json, os, re, unicodedata
import kb, map_ as _map, font as _font, final as _final, legends as _legends

ICON_GEOM = {}
for gid in ('icons', 'f-icons'):
    for bb, kind, d in kb.shape_geometry(kb.load(), gid):
        ICON_GEOM[(gid, round(bb[0], 3), round(bb[1], 3))] = d

TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ж': 'zh', 'з': 'z',
    'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
    'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch',
    'ш': 'sh', 'щ': 'sch', 'ъ': 'hard', 'ы': 'y', 'ь': 'soft', 'э': 'e', 'ю': 'yu',
    'я': 'ya', 'ё': 'jo'
}


def slug(text):
    t = ''.join(TRANSLIT.get(c, c) for c in text.lower())
    t = re.sub(r'[^a-z0-9]+', '-', t).strip('-')
    return t or 'icon'


# Автоимя выводится из подписи на клавише и потому для иконок без подписи бессмысленно
# (`nav-r5-2`), а для F-ряда описывает клавишу, а не рисунок. Таблица даёт имена по смыслу
# рисунка — они переиспользуемы в других раскладках, в отличие от «иконка клавиши F9».
RENAME = {
    '1': 'bluetooth-1', '2': 'bluetooth-2',
    '4': 'numpad-left', '6': 'numpad-right', '8': 'numpad-up', '2-2': 'numpad-down',
    'f1': 'volume-mute', 'f2': 'volume-down', 'f3': 'volume-up',
    'f4': 'brightness-down', 'f5': 'brightness-up', 'f6': 'backlight',
    'f7': 'lock', 'f8': 'calculator', 'f9': 'cut', 'f10': 'search',
    'f11': 'window-split', 'f12': 'display',
    'main-r0': 'emoji', 'numpad-r0': 'clipboard',
    'nav-r4': 'arrow-up', 'nav-r5': 'arrow-left',
    'nav-r5-2': 'arrow-down', 'nav-r5-3': 'arrow-right',
    'option': 'squares-left', 'option-2': 'squares-right',
}


def icon_ids(keys):
    """Стабильные имена иконок: от подписи на клавише, иначе по положению."""
    used, out = {}, {}
    for k in keys:
        labels = [e['text'] for e in k['elements'] if e['kind'] == 'txt']
        icons = [e for e in k['elements'] if e['kind'] == 'ico']
        for n, e in enumerate(icons):
            base = slug(labels[0]) if labels else f'{k["block"]}-r{k["row"]}'
            name = base if len(icons) == 1 else f'{base}-{n + 1}'
            if name in used:
                used[name] += 1
                name = f'{name}-{used[name]}'
            else:
                used[name] = 1
            out[(k['i'], n)] = RENAME.get(name, name)
    return out


def build():
    ref = _legends.dump()
    ids = icon_ids(ref['keys'])
    icons, keys = {}, []
    for k in ref['keys']:
        gx0, gy0 = k['guide'][0], k['guide'][1]
        gy1 = gy0 + k['guide'][3]
        els, ni = [], 0
        for e in k['elements']:
            v, h = e['slot'][0], e['slot'][1]
            item = dict(slot=e['slot'], kind=e['kind'])
            off = {}
            if e['kind'] == 'txt':
                item.update(text=e['text'], size=e['size'])
                if e['tracking']:
                    item['tracking'] = e['tracking']
                if v.islower():
                    off['by'] = round(e['by'] - gy1, 4)
                if h.islower():
                    off['bx'] = round(e['bx'] - gx0, 4)
            else:
                bb = e['bb']
                iid = ids[(k['i'], ni)]
                ni += 1
                item.update(icon=iid, w=round(bb[2], 4), h=round(bb[3], 4))
                if v.islower():
                    off['y'] = round(bb[1] - gy0, 4)
                if h.islower():
                    off['x'] = round(bb[0] - gx0, 4)
                d = ICON_GEOM.get((e['group'], round(bb[0], 3), round(bb[1], 3)))
                icons[iid] = dict(w=round(bb[2], 4), h=round(bb[3], 4),
                                  ox=round(bb[0], 4), oy=round(bb[1], 4), d=d)
            if off:
                item['offset'] = off
            els.append(item)
        keys.append(dict(row=k['row'], x=k['cap'][0], block=k['block'],
                         tpl=k['tpl'], elements=els))
    return keys, icons, ref


HEAD_CONTENT = '''/**
 * Содержимое клавиш LCAKB23. Сгенерировано analysis/export_tool.py — править там.
 *
 * Клавиша адресуется парой (row, x) — так же, как в verify.js: геометрия
 * воспроизводится с невязкой 1e-4 px, поэтому x надёжно её опознаёт.
 * offset присутствует только у нежёстких слотов (строчный код), где правила нет.
 */
'''

HEAD_ICONS = '''/**
 * Пиктограммы LCAKB23. Сгенерировано analysis/export_tool.py — править там.
 *
 * d — контур в исходных координатах макета, ox/oy — угол его габарита.
 * Чтобы поставить иконку в точку (x, y), достаточно translate(x − ox, y − oy):
 * так контур не переписывается и остаётся побитово тем же, что в чертеже.
 */
'''


if __name__ == '__main__':
    keys, icons, ref = build()
    base = os.path.join(kb.ROOT, 'app', 'kb')
    os.makedirs(os.path.join(base, 'content'), exist_ok=True)
    os.makedirs(os.path.join(base, 'icons'), exist_ok=True)

    payload = dict(id='LCAKB23',
                   font=dict(family='YS Text', style='Regular',
                             file='Fonts/YS Text/YS Text-Regular.ttf'),
                   interline=ref['interline'], keys=keys)
    p1 = os.path.join(base, 'content', 'lcakb23.js')
    with open(p1, 'w', encoding='utf-8') as f:
        f.write(HEAD_CONTENT + 'export default ' +
                json.dumps(payload, ensure_ascii=False, indent=1) + ';\n')

    p2 = os.path.join(base, 'icons', 'lcakb23.js')
    with open(p2, 'w', encoding='utf-8') as f:
        f.write(HEAD_ICONS + 'export default ' +
                json.dumps(icons, ensure_ascii=False, indent=1) + ';\n')

    n_txt = sum(1 for k in keys for e in k['elements'] if e['kind'] == 'txt')
    n_off = sum(1 for k in keys for e in k['elements'] if 'offset' in e)
    miss = [i for i, v in icons.items() if not v['d']]
    print(f'клавиш {len(keys)}, строк {n_txt}, иконок {len(icons)}, '
          f'элементов со смещением {n_off}')
    if miss:
        print('БЕЗ ГЕОМЕТРИИ:', miss)
    print('записано:', p1)
    print('записано:', p2)
