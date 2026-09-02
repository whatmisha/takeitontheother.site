# FileIntake compatibility matrix

Дата инвентаризации: 2026-09-02. Область: только `upgrade/`.

## Граница компонента

Framework владеет picker/drop/keyboard semantics, `accept`, необязательным
`maxBytes`, повторным выбором того же файла, состояниями
`empty/loading/ready/error`, ARIA live, drag/focus presentation и снятием
listeners. Framework не читает содержимое файла.

Приложение владеет `FileReader`/`file.text()`/`arrayBuffer()`, parsing,
sanitization, schema и domain validation, confirmation замены, history,
рендерингом, сообщениями предметной области и применением результата.

Google Sheets в Sticky Fingers — user-initiated URL/network flow, а не file
intake. Он не входит в компонент и остаётся частным.

## Инвентарь

| Tool | File surfaces | До UPG-062 | Частная логика, которую нельзя переносить в framework | Решение |
|---|---|---|---|---|
| Wordplayer | raster image; Forms SVG | 2 hidden inputs; ручной click/change/reset; drop отсутствовал | image decoding; SVG normalization/sanitization; Dither/Forms cache invalidation and render | Canary: два shared controllers; drop на соответствующую секцию; parser callbacks остаются в `AssetController` |
| Pizza Boxer | settings JSON; object SVG | JSON input создаётся на каждый вызов; SVG picker + editor dropzone | preset codec/schema/history; graphics sanitizer, geometry and object creation | После canary: постоянный JSON input/controller; SVG controller поверх существующего editor surface |
| Sticky Fingers | preset JSON; object SVG | JSON input создаётся на каждый вызов; SVG picker + editor dropzone | label preset/schema; graphics sanitizer; barcode/object document | Повторить Pizza adapter, не касаясь Google Sheets |
| Keyboarder | mixed new-layout JSON/SVG; model JSON; drawing SVG; font; legend-icon SVG | 5 hidden inputs; все picker inputs сбрасываются; font имеет отдельную dropzone | unsaved-change guard; layout review; model schema; font parsing/registry; icon path-only sanitizer | Пять controller instances; общими остаются только selection/state/guards, private dialogs и parsers сохраняются |
| Sparky | motion-path SVG | hidden input с reset; 2 MB guard; confirm замены | path import, closure edits, animation/history and replacement confirmation | Shared `accept` + `maxBytes`; confirm и parser остаются callback-последовательностью Sparky |
| Dither | source image; layout-sample image | 2 hidden inputs с reset; Canvas drop принимает только source image | two distinct image lifecycles; transforms/cache; overlay; raster/PNG invariants | Два controllers; source сохраняет Canvas drop target, sample остаётся отдельным flow; обязательный raw-RGBA proof |
| Wander Bender | нет | file input отсутствует | — | Не добавлять компонент |
| Pulsar Coder | нет | file input отсутствует | — | Не добавлять компонент |

Итого: 14 file surfaces в шести инструментах. Drop уже есть у Dither source,
Pizza SVG, Sticky SVG и Keyboarder font; Wordplayer получает drop как первое
намеренное улучшение. Повторный выбор одинакового файла уже вручную поддержан у
Wordplayer, Dither и Keyboarder; общий controller делает это обязательным для
всех picker flows.

## Состояния и copy

Общие machine states: `empty`, `loading`, `ready`, `error`. Framework ставит
`data-file-state`, `aria-busy`, `role=status`, `aria-live=polite` и
`aria-describedby`. Названия кнопок, текущего файла и ошибок передаются
приложением: универсальный компонент не должен говорить о шрифте, пресете,
раскладке или растровом изображении.

`accept` проверяется по extension, exact MIME или wildcard MIME. Это исправляет
разницу drag-and-drop браузеров, где SVG может прийти с пустым `file.type`.
Size guard включается только там, где он уже существует или отдельно принят;
первый обязательный лимит — 2 MB для motion-path SVG Sparky.

## Rollout и rollback

1. **Framework — complete:** `FileIntakeController`, public barrel, 6 component
   tests, state-only shared CSS и configurable `selectFile` для multi-file drop.
2. **Wordplayer canary — complete:** оба inputs подключены; исходный UI и
   status copy сохранены. Invalid file не меняет Canvas; три повторных выбора
   одного файла сбрасывают input и дают одинаковый raster hash
   `dd722b1d…`; Forms SVG трижды точно восстанавливает исходный Canvas hash
   `df819ef1…`. Полный Gate G5 проходит.
3. **Pizza Boxer — complete:** постоянные JSON/SVG inputs, private
   codec/schema/history/sanitizer сохранены; public runtime пересобран в 14
   assets. Invalid imports не меняют SVG; JSON 3× возвращает точные baseline
   SVG/form hashes, SVG 3× заменяет один block с одинаковым output hash.
4. **Sticky Fingers — complete:** JSON/SVG подключены через facade; private
   label/object parsers и Google Sheets flow сохранены; suite 5/5.
5. **Keyboarder — complete:** пять независимых controller instances, включая
   multi-file font selection; schemas, layout review, font registry и icon
   sanitizer остаются private; boundary и пять domain analyses проходят.
6. **Sparky — complete:** прежние confirmation/history/path callbacks и лимит
   2 MB сохранены. Browser probe отклоняет oversized SVG и импортирует path как
   `Imported · 5 points`; 196/196 tests, 390×844 и 430×932 без overflow.
7. **Dither — complete:** два controllers, Canvas drop только у source,
   private decode/cache/transform/PNG pipeline. Оба файла приняты 3× с reset;
   invalid type не меняет raw RGBA. Default/Bayer/Pixel 4 hashes точны.
8. **Component gate — complete:** `check:file-intake` фиксирует 14 surfaces в
   шести инструментах, 0 в Wander/Pulsar, private parser ownership и Sheets.
   Полный `gate:g5:static` проходит.

Rollback выполняется по одному tool: удалить только его controller wiring и
component classes, вернуть прежние listeners, не откатывая framework API или
другие принятые consumers.

UPG-062 завершён 2026-09-02. UPG-063 не начат.
