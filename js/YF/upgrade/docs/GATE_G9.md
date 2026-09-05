# Gate G9 — control rhythm and YF Tools hub

Дата: 2026-09-05. Статус: **Passed**.

G9 закрывает пропущенную G8 геометрию одинаковых контролов, не меняя частные
функции генераторов.

```sh
npm run gate:g9:static
```

Gate включает полный G8 regression и проверяет slider spacing, panel padding,
segmented geometry, `#d2d2d2`, восемь back links, заголовки hub и disabled
future tools.
