# Pizza Boxer v2 donor

`lunnen/grid_generator/v2` новее текущего верхнего публичного runtime и содержит schema 2.0, generic net/plane model, migrations и golden geometry. При этом общий YF index открывает верхний `grid_generator`, который остаётся baseline первой миграции.

Правила использования:

1. Не копировать v2 как текущий runtime.
2. Не смешивать schema 2.0 с паритетной миграцией schema 1.2.
3. До переноса функций исправить test mock и получить 222/222.
4. Переносить net/plane features отдельными post-parity задачами с migration и golden tests.

