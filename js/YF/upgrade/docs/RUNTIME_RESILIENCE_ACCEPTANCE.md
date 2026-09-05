# UPG-077 — Runtime resilience acceptance
Дата приёмки: 2026-09-05.

## Результат

UPG-077 принят. Все изменения и проверки ограничены `upgrade/**`. Восемь
entrypoints прошли cold load и два последовательных warm reload: 24/24 desktop
загрузки завершились с `document.readyState=complete`, непустым SVG/Canvas,
готовым ActionDock, без horizontal overflow, зависших `aria-busy`/
`.is-exporting` и console errors.

Единственное предупреждение — уже документированный Sticky Fingers
`EAN-13 checksum mismatch: provided 7, calculated 6`. Это предметное
предупреждение данных, а не ошибка asset/runtime.

## Исправленные lifecycle gaps

- `ApplicationShell.init()` теперь объединяет параллельные вызовы и не создаёт
  повторно listeners/subsystems после завершённой инициализации.
- ActionDock и preset-menu auto-init хранят controller вместе с observer;
  повторная установка отключает предыдущий observer и удаляет его listener.
- Document observer безопасно переживает смену iframe realm: не выбрасывает
  uncaught `MutationObserver.observe` во время навигации и один раз повторяет
  подключение после стабилизации документа.
- `FileIntakeController.destroy()` инвалидирует незавершённую операцию, снимает
  busy semantics и не позволяет позднему Promise мутировать уничтоженный UI.
- Sparky `AnimationExporter.destroy()` снимает cancel listener, завершает
  worker, очищает restore timer и возвращает кнопки из busy state.

## Assets, workers и Blob URLs

- startup-ресурсы восьми entrypoints остаются same-origin и локальными;
- Google Sheets остаётся единственным внешним runtime-исключением и запускается
  только явным действием пользователя в Sticky Fingers;
- 12 владельцев `URL.createObjectURL` машинно сопоставлены с
  `URL.revokeObjectURL`;
- static/runtime audit не обнаружил 404, failed module/font/worker loads или
  внешнего fallback.

## Sparky mobile sentinel

`qa/viewport.html` повторно проверен на 390×844 и 430×932: cold + два warm
reload для каждого размера, всего 6/6 чистых загрузок.

Оба размера дают одинаковые инварианты:

- точный iframe viewport, `sparky-mobile-showcase`, mobile media=true;
- `overflowX=false`, console errors=0;
- один file input и один связанный file control;
- ActionDock видим, `display:flex`, `centerDelta=0`, bottom=12 px;
- primary actions видимы, desktop utility actions скрыты.

Во время проверки ранняя версия lifecycle-helper выявила cross-realm race в
`MutationObserver.observe`. Исправление принято только после повторного
чистого прогона в новом browser tab.

## Машинная проверка

```sh
npm run check:resilience
npm run test:resilience
npm run gate:g6:static
```

`check:resilience` принимает 8 apps, 6 lifecycle proofs и 12 balanced Blob URL
owners. `test:resilience` включает lifecycle, double export/import artifact и
round-trip suites. Полный Gate G6 обязан оставаться зелёным.
