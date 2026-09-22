# Gate G12 — OpenType feature controls

Дата: 2026-09-05. Статус: **Passed**.

G12 завершает UPG-094: Pizza Boxer и Sticky Fingers используют один визуальный
контракт OpenType feature chips, сохраняя собственные модели, рендеринг и export.

```sh
npm run gate:g12:static
```

Gate включает полный G11 regression, UI/toggle contracts и проверяет документы
UPG-094 и UPG-096. Browser acceptance подтверждает условное появление секции и
одинаковый набор из шести технических тегов в каждом инструменте.
