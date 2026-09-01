# Gate G1 evidence

Дата проверки: 2026-08-30.

## Результат

Gate G1 пройден. Все восемь инструментов запускаются из `upgrade/index.html`; runtime не обращается к исходным проектам, внешним CDN или прежним browser storage namespaces.

## Статические проверки

```text
Gate G0 passed: 1179 source entries, 10 screenshots, architecture and test baselines present.
Verified 11 shared assets and 3 pinned downloads.
Storage isolation passed: 6 runtime files and 6 original sentinels checked.
Boundary check passed: 469 runtime text files, 9 entrypoints, internal dependency symlinks only, no escaping symlinks or forbidden references.
```

`grid_generator/tools/node_modules` установлен через `npm ci` по зафиксированному `package-lock.json`: 50 packages, 0 vulnerabilities. Каталог находится внутри `upgrade` и исключён из Git.

## Автоматические тесты

| Инструмент | Результат |
|---|---|
| Sparky | 195/195 pass |
| Pizza Boxer | source/public runtime match, 15 assets, 165/165 pass |
| Wordplayer Dither worker | pass |
| Wordplayer Forms worker | pass |

Pizza Boxer пересобран из изолированного source после изменения relocation-ссылки и имени IndexedDB. Проверка `public:check` подтверждает соответствие source и runtime.

## Browser smoke

Проверены `index.html` и восемь приложений на локальном HTTP server. Каждый инструмент имеет непустое доступное DOM-дерево и правильный title:

| Папка | Title | Runtime errors |
|---|---|---:|
| `sparky` | Lunnen Sparky — Parametric Character | 0 |
| `grid_generator` | Pizza Boxer — Packaging Layout Tool | 0 |
| `label_generator` | Sticky Fingers — Packaging Label Generator | 0 |
| `keyboarder` | Keyboarder | 0 |
| `wordplayer` | Wordplayer | 0 |
| `dither` | Dither - Image Dithering Tool | 0 |
| `wander_bender` | Wander Bender - YF Tools | 0 |
| `pulsar_coder` | Pulsar Coder - YF Tools | 0 |

У Sticky Fingers воспроизводится один исходный warning: `EAN-13 checksum mismatch: provided 7, calculated 6`. Он зафиксирован в исходном baseline и не появился из-за миграции.

## Sparky protected visual

Проверены desktop `1440×900` и mobile `390×844`, `430×932`. Desktop показывает полный UI и исходную геометрию Basic; обе mobile-версии показывают чистый showcase без desktop flash, горизонтального overflow и видимых layout regressions. Исходные контрольные снимки хранятся в `baselines/screenshots`.

## Граница репозитория

Рабочие изменения задачи находятся только в `upgrade/`. Вне него `git status` показывает только существовавшие до начала работы `.DS_Store` изменения; исходники инструментов, `othersite-ui-framework` и Void не изменялись.
