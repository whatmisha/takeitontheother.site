# Post-G5 release-readiness audit

Дата: 2026-09-01.

## Scope

После закрытия Gate G5 выполнен дополнительный live regression пяти
приоритетных приложений на `http://127.0.0.1:8010/upgrade/`. Проверка не меняла
production source, baselines, storage namespaces или внешний network boundary.

## Sparky

- initial `Basic`: 68 fields, SVG 26,806 characters,
  SHA-256 `12b209a2d3bfdfaadcaf973758fe2d43a69cc17e700d6e8edd0dc87db29b2d8a`;
- `Basic → Spiky → Basic` возвращает exact fields/panels/SVG snapshot;
- Bolid включается, создаёт finite SVG без `NaN` и возвращается в Manual;
- collapse работает через отдельный `.collapse-icon` с `aria-expanded`;
- mode interaction ожидаемо создаёт transient `Basic *` history state; clean
  reload возвращает чистый `Basic` с исходным SVG hash;
- module/browser errors: 0.

## Pizza Boxer

- `New`: 113 fields, SVG 94,374,
  `4abbde0d74811c2d2997759ce0af21ac6d25321c8858a57cfafc2355e72240e4`;
- `E-ink`: 113 fields, SVG 78,234,
  `9d4f24e9dd94162b585dcc5855326676429ae25531ffb050f772596e53676e43`;
- `New → E-ink → New` возвращает exact fields, five-panel record и SVG;
- module/browser errors: 0.

## Sticky Fingers

- normal SVG 18,640 / `1592eaac…`;
- edit SVG 18,607 / `8850fd2f…`;
- `normal → edit → normal` возвращает exact DOM/form/panel/SVG snapshot;
- edit panels: Data 300×242, Layout 300×878.703125, Objects 300×383,
  Text 300×237;
- blank Google Sheets URL остаётся локальным guard: `Please enter a URL`,
  `role=alert`, `aria-live=assertive`, `aria-atomic=true`;
- browser errors: 0; сохраняется документированный EAN-13 checksum warning.

## Keyboarder

- `Work 2.0 L`: 82 fields, SVG 133,295,
  `f1c3d7952bf9825eb3421b6e0b6530736bc40c85c9a4e8eadc48f040169e78dd`;
- `Work 2.0 S`: 82 fields, SVG 100,716,
  `55c9fd6f9ff8a4382782ef8423d7243cb67069eb9dec7a39f5482877aff28be4`;
- `L → S → L` возвращает exact fields/panels/SVG snapshot;
- module/browser errors: 0.

## Wordplayer

- initial Dither: 68 fields, Canvas 2560×1440 displayed at 1280×720;
- `Dither → Forms → Dither` переключает worker-backed modes без errors;
- смена mode ожидаемо помечает текущий preset `Default *`; clean reload
  возвращает exact initial DOM/form/panel state и чистый `Default`;
- первый и warm-reload JPEG captures различаются на 1,614 RGB channels,
  max delta 13, bounds `[80,480,247,615]`, при полностью одинаковом DOM state;
- два последовательных warm captures byte-identical, поэтому это стабильный
  first/warm-load raster difference, а не продолжающаяся animation/layout drift;
- module/browser errors: 0.

## Verdict

Пять приоритетных приложений release-ready в границах принятого Gate G5.
Новых дефектов или production-изменений не потребовалось. Известные Pulsar CRC,
Sticky EAN warning и отсутствие согласованного mobile layout у secondary tools
остаются отдельными продуктовыми задачами.
