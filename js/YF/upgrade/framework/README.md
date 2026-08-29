# Shared framework workspace

`framework/src`, `framework/css`, `framework/fonts` и `framework/demo` — рабочая общая версия framework. Приложения будут переключаться на неё по одному только после conformance Gate G2.

`framework/upstream-v3` — неизменяемый побайтовый снимок Othersite UI Framework v3. Его происхождение и SHA-256 записаны в `framework/UPSTREAM_V3.json` и проверяются командой `npm run framework:upstream:check`.

Рабочие файлы можно развивать независимо; статус `upgrade-modified` в реестре означает ожидаемое отличие от исходного v3. Восстанавливать рабочую версию из snapshot автоматически нельзя, чтобы не затереть миграционные улучшения.

Локальные third-party зависимости находятся в `framework/vendor`; CoFo Sans и framework-шрифты — в `framework/fonts`.
