# Gate G13 — UI repair

Дата: 2026-09-05. Статус: **Passed**.

G13 закрывает UPG-098—UPG-100: общий Fit hover без browser-conflicting
shortcuts, исправления Pizza Boxer, восстановленные Sticky Fingers HSB/custom
column controls, секции Wander Bender и повторный визуальный audit 8/8.

```sh
npm run gate:g13:static
```

Gate включает полный G12 regression, framework/Pizza/Sticky/Wander suites,
range/toggle/UI contracts и отдельную проверку документов G13.
