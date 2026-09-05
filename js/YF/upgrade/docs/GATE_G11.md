# Gate G11 — control consolidation

Дата: 2026-09-05. Статус: **Passed**.

G11 закрывает одобренные следующие шаги G10: оставшиеся boolean pills Pizza
Boxer, единый color trigger, `Width / Height`, Dither Reset и один checkbox
`Follow cursor` в Sparky.

```sh
npm run gate:g11:static
```

Gate включает полный G10 regression, UI/toggle contracts и проверяет документы
UPG-092—UPG-094. OpenType feature tags остаются осознанным отдельным семейством:
их поведение не менялось.
