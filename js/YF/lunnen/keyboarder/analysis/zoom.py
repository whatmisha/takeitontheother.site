"""Диагностический рендер: увеличенный фрагмент раскладки + измеренные боксы."""
import re, subprocess, os
import kb as _kb, map_ as _map, font as _font

OUT = os.path.join(_kb.ROOT, 'docs', 'render')

s = _kb.load()
STYLE = re.search(r'<style>.*?</style>', s, re.S).group(0)


def frag(x0, y0, x1, y1, name, scale=1.0, show=('guide', 'ink', 'cap', 'icon')):
    body = []
    for gid in ('caps', 'glyphs', 'icons', 'f-icons'):
        body.append(_kb.group(s, gid))
    ov = []
    for k in _map.KEYS:
        if not (x0 - 60 < k['cx'] < x1 + 60 and y0 - 60 < k['cy'] < y1 + 60):
            continue
        g = k['guide']
        if 'guide' in show:
            ov.append(f'<rect x="{g[0]}" y="{g[1]}" width="{g[2]}" height="{g[3]}" '
                      f'fill="none" stroke="#00b7ff" stroke-width=".2"/>')
        d = _map.BY_KEY[k['i']]
        for gl in d['glyphs']:
            if 'ink' in show and gl['ink']:
                i = gl['ink']
                ov.append(f'<rect x="{i[0]}" y="{i[1]}" width="{i[2]}" height="{i[3]}" '
                          f'fill="none" stroke="#ff3b6b" stroke-width=".15"/>')
            if 'cap' in show:
                cy = gl['by'] - _font.CAP_HEIGHT / _font.UPM * gl['size']
                xy = gl['by'] - _font.X_HEIGHT / _font.UPM * gl['size']
                ov.append(f'<line x1="{g[0]-2}" y1="{gl["by"]}" x2="{g[0]+g[2]+2}" y2="{gl["by"]}" '
                          f'stroke="#3bff7a" stroke-width=".12"/>')
                ov.append(f'<line x1="{g[0]-2}" y1="{cy}" x2="{g[0]+g[2]+2}" y2="{cy}" '
                          f'stroke="#ffd93b" stroke-width=".12" stroke-dasharray=".6 .4"/>')
                ov.append(f'<line x1="{g[0]-2}" y1="{xy}" x2="{g[0]+g[2]+2}" y2="{xy}" '
                          f'stroke="#b06bff" stroke-width=".12" stroke-dasharray=".3 .3"/>')
        for ic in d['icons']:
            if 'icon' in show:
                b = ic['bb']
                ov.append(f'<rect x="{b[0]}" y="{b[1]}" width="{b[2]}" height="{b[3]}" '
                          f'fill="none" stroke="#ffa500" stroke-width=".15"/>')
    w, h = (x1 - x0) * scale, (y1 - y0) * scale
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {x1-x0} {y1-y0}" '
           f'width="{w}" height="{h}"><defs>{STYLE}</defs>'
           f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="#1c1f22"/>'
           + ''.join(body) + ''.join(ov) + '</svg>')
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name + '.svg')
    open(p, 'w', encoding='utf-8').write(svg)
    subprocess.run(['qlmanage', '-t', '-s', str(int(max(w, h))), '-o', OUT, p],
                   capture_output=True)
    return p + '.png'


if __name__ == '__main__':
    print(frag(84, 113, 300, 215, 'z_alpha', 9))          # QWERTY + ASDF
    print(frag(5, 59, 180, 110, 'z_num', 11))             # цифровой ряд
    print(frag(84, 0, 300, 56, 'z_frow', 9))              # F-клавиши
    print(frag(945, 105, 1165, 215, 'z_pad', 9))          # цифровой блок
    print(frag(5, 268, 260, 322, 'z_mods', 8))            # модификаторы
    print(frag(780, 55, 950, 160, 'z_nav', 11))           # nav-блок
