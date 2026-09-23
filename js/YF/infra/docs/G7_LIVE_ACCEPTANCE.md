# UPG-078 — Final live acceptance
Дата приёмки: 2026-09-05.

## Verdict

Приняты все восемь Upgrade workflows: пять priority и три secondary. Результат
записан отдельно от неизменённых G6 rollback-baselines. Ни один файл вне
`upgrade/**` не изменялся.

## Общий live smoke

- 8 cold desktop loads + 16 warm reloads: 24/24 complete;
- во всех entrypoints есть непустой SVG/Canvas output и готовый ActionDock;
- horizontal overflow, зависшие busy/export states, console errors и 404: 0;
- единственный intentional warning: Sticky Fingers сообщает несовпадение
  контрольной цифры текущего EAN-13 (`provided 7, calculated 6`).

## Priority workflows

- **Sparky:** desktop render, 390×844/430×932 mobile showcase, motion-path
  FileIntake, static SVG и cancellable animation lifecycle.
- **Pizza Boxer:** New preset, три реальных JSON imports, три SVG replacements,
  invalid-file rollback и SVG/PDF artifacts. Исправлен двойной deserialize:
  импортированная уже нормализованная модель больше не проходит file-boundary
  повторно. Три JSON imports сходятся к SVG `48cfa08a…` и form
  `448f3718…`, errors=0.
- **Sticky Fingers:** template render, lossless readable/private JSON
  round-trip, vector PDF/SVG и сохранённый explicit Google Sheets boundary.
- **Keyboarder:** layout/model round-trip, UTF-8/geometry-safe SVG и private
  PDF/PNG paths.
- **Wordplayer:** invalid + три repeated image/form intakes, стабильные Canvas
  hashes и SVG/PNG artifacts.

## Secondary workflows

- **Dither:** invalid + repeated image/sample intake, exact default raster hash,
  algorithm invariants и 1×/2×/4×/8× PNG packaging.
- **Pulsar Coder:** deterministic Voyager output, сохранённый известный legacy
  verifier mismatch и точный SVG artifact.
- **Wander Bender:** Radial/Random/Flow Field invariants и SVG без служебной
  границы области.

## Mobile and visual acceptance

Sparky прошёл cold + 2 warm reload на обоих обязательных размерах. В каждом из
6 запусков viewport точный, `sparky-mobile-showcase` активен, overflow/errors=0,
ActionDock центрирован (`centerDelta=0`) и расположен в 12 px от низа; primary
actions видимы, utility actions скрыты. Desktop layout/output invariants всех
восьми entrypoints совпадают с принятыми G6 состояниями; исходные G6 screenshot
files не перезаписывались и остаются rollback reference.

## Evidence

- `FINAL_LIVE_ACCEPTANCE.json` — машинный срез 8 workflows;
- `RUNTIME_RESILIENCE.json` — reload/lifecycle/Blob URL contracts;
- четыре same-origin QA-harness не читают и не пишут пользовательские файлы;
- export, round-trip, persistence, keyboard и application suites остаются
  исполняемым доказательством private поведения.
