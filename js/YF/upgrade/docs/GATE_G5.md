# Gate G5 — Final unification acceptance

Дата приёмки: 2026-09-01.

## Результат

Gate G5 пройден. Восемь автономных Upgrade-инструментов используют один общий
framework через shared CSS и public JavaScript boundary. App-specific domain
code, presets/data, renderers, exports и согласованные варианты остаются внутри
приложений.

Главная воспроизводимая команда:

```sh
npm run gate:g5:static
```

Она запускает полный Gate G4, все component/app suites и финальный машинный
контракт `scripts/check-gate-g5.mjs`.

## Финальный контракт

- `/upgrade/index.html` содержит ровно восемь рабочих относительных ссылок;
- 8/8 приложений имеют shared CSS boundary;
- 8/8 приложений используют public `framework/src/index.js` boundary;
- local universal resets: 0;
- `all: revert-layer` reset promotions: 0;
- dormant overlays: 0;
- broad local native-dialog collisions: 0;
- каждый оставшийся app delta имеет owner, reason и removal condition;
- Pizza source/public runtime совпадает и содержит 14 hashed assets;
- Sparky desktop, 390×844 и 430×932 captures приняты без horizontal overflow
  и browser errors;
- storage, assets, source manifest и filesystem/runtime boundaries изолированы.

## Runtime smoke

Live smoke на `http://127.0.0.1:8010/upgrade/` загрузил все восемь entrypoints
до `document.readyState=complete`. Каждый имеет видимый SVG или Canvas и обратную
ссылку в Upgrade. Native dialogs закрыты; Dither/Pulsar overlays имеют
`aria-hidden=true`, opacity 0 и `pointer-events:none`. Реальных browser errors —
0. Sticky сохраняет известный исходный EAN-13 checksum warning.

## Suites

- framework: 42/42;
- Sparky: 196/196;
- Pizza Boxer: 167/167;
- Sticky Fingers: 5/5;
- Pulsar Coder: 8/8;
- Dither: 11/11;
- Wander Bender: 10/10;
- Keyboarder boundary + 5 domain analyses: pass;
- Wordplayer boundary + Dither/Forms workers: pass.

## Принятые частные варианты

Sparky сохраняет mobile/export orchestration; Pizza — repository/schema/history/
draft model; Sticky — Google Sheets, label/EAN/PDF domain; Keyboarder и
Wordplayer — собственные editors/renderers; Dither — raster controls/left action
anchor; Wander — Paper geometry/three modes/disabled Auto-Max; Pulsar — codec,
private zoom и rich verifier. Условия будущего удаления CSS-дельт находятся в
`LEGACY_CSS_CLEANUP_MATRIX.md`.

## Ограничения

Не исправлялись известный Pulsar Voyager verifier mismatch, Sticky EAN warning,
desktop/mobile overflow второстепенных инструментов и другие записанные исходные
особенности. Это отдельные продуктовые задачи, а не незавершённая миграция.

Дополнительный post-gate live regression пяти приоритетных приложений находится
в `POST_G5_RELEASE_READINESS.md`.
