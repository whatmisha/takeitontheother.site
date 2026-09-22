# Shared framework workspace

`framework/src`, `framework/css`, `framework/fonts`, `framework/demo` и `framework/demo-canvas` — рабочая общая версия framework. Gate G2 пройден; приложения теперь переключаются на неё по одному с отдельным parity-gate.

`framework/upstream-v3` — неизменяемый побайтовый снимок Othersite UI Framework v3. Его происхождение и SHA-256 записаны в `framework/UPSTREAM_V3.json` и проверяются командой `npm run framework:upstream:check`.

Эта проверка читает только `upgrade`: соседняя исходная папка v3 не нужна. Отдельная `npm run framework:source:check` дополнительно сверяет оригинал и требует его наличия; bootstrap также требует оригинал. Hashes исторического снимка при этом не пересоздаются.

Рабочие файлы можно развивать независимо; статус `upgrade-modified` в реестре означает ожидаемое отличие от исходного v3. Восстанавливать рабочую версию из snapshot автоматически нельзя, чтобы не затереть миграционные улучшения.

Локальные third-party зависимости находятся в `framework/vendor`; CoFo Sans и framework-шрифты — в `framework/fonts`.

Публичная точка импорта — `framework/src/index.js`; контракт — `framework/CONTRACT.md`. SVG и Canvas reference tools импортируют только этот barrel. CSS provenance записан в `framework/CSS_PROVENANCE.json`.

Для новых потребителей доступен opt-in `ToolUiController`: кнопки, хоткеи, справка и сводки через конфигурацию без веток по имени инструмента. Подключение, ограничения и проверки: [INT-02](../docs/INT_02_SHARED_UI_HOST.md); браузерный стенд — `qa/ui-host/`. Прежние восемь приложений пока используют compatibility-путь.

Проверка из корня `upgrade`:

```sh
npm run test:framework
npm run gate:g2:static
```
