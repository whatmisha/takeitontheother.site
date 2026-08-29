# Storage policy

Экспериментальные приложения не читают и не изменяют storage действующих инструментов.

| Инструмент | Изолированное имя |
|---|---|
| Sparky presets | `upgrade:sparky:presets:v1` |
| Keyboarder presets | `upgrade:keyboarder:presets:v1` |
| Keyboarder UI mode | `upgrade:keyboarder:ui-mode:v1` |
| Keyboarder SVG text mode | `upgrade:keyboarder:svg-export-mode:v1` |
| Keyboarder performance flag | `upgrade:keyboarder:perf:v1` |
| Wordplayer presets | `upgrade:wordplayer:presets:v1` |
| Pizza Boxer drafts (IndexedDB) | `upgrade-pizza-boxer-v1` |

Sparky намеренно не импортирует данные из `lunnenSparkyGeneratorV1` или `lunnenSparkyGeneratorV2`. Seed markers автоматически наследуют изолированный ключ пресетов.

`npm run check:storage` проверяет литералы в исходном и собранном runtime, а затем записывает тестовые данные в новые namespace при наличии sentinel-значений во всех известных старых ключах. Sentinel-значения должны остаться неизменными.
