# Release checklist

## Автоматически

```bash
npm --prefix tools test
npm --prefix tools run presets:check
npm --prefix tools audit --audit-level=low
npm --prefix tools run build
```

Открыть `tests/browser-smoke.html` через dev-сервер и получить `PASS — 64 checks`.

## Chrome и Safari

- Открыть `New`, Front-пресет и Back-пресет.
- Проверить Fit, zoom, четыре поворота и панорамирование по экранным осям.
- Перетащить текст и графику между Front и каждой боковой гранью.
- Включить Own Grid, сменить единицы, lock и orientation.
- Выполнить JSON export/import и сверить Caption/Lunnen Display/side settings.

## macOS Quick Look и Illustrator

- Экспортировать SVG с baseline и без baseline.
- Открыть оба файла Quick Look: кириллица должна отображаться без mojibake.
- Открыть SVG в Illustrator с текстом и с Outline fonts.
- Проверить размеры artboard, ориентацию граней, объекты и clipping.
- Экспортировать PDF и сверить размеры и кривые.
