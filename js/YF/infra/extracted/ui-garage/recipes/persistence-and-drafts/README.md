# Persistence and recovery drafts

Preset persistence is handled by `PresetStore`. For session recovery, import
`DraftStore` from `src/index.js` and give every tool a unique versioned
namespace:

```js
import { DraftStore } from '../../src/index.js';

const drafts = new DraftStore({ namespace: 'my-tool', version: 1 });
await drafts.save(app.getSnapshot());
const record = await drafts.load();
if (record) app.applySnapshot(validate(record.value));
```

The application owns validation, the recovery prompt and migrations. Save only
after a committed change, validate before applying, retain the previous live
snapshot until recovery succeeds, and call `destroy()` with the application.
Unavailable IndexedDB disables drafts without disabling the tool. Updating UI
Garage never reads, deletes or migrates a tool namespace.
