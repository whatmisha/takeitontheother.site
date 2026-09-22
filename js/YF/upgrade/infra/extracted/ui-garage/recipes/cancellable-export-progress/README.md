# Cancellable export and progress

Start exports through `runExport(kind, operation)` and pass its `signal` into
long-running work. Put the action in `aria-busy="true"` while active, expose a
polite status message, and restore both in `finally`. Duplicate requests of the
same kind are joined and `destroy()` aborts active work.
