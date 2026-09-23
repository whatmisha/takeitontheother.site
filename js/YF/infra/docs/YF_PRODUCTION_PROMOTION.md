# YF Tools — production promotion

2026-09-23. The user authorized replacing the old `js/YF` collection with the completed shared-framework version and publishing it on `main`.

## Current layout

- `YF/index.html`: YF Tools, with Lunnen and Muted sections and 16 links.
- `YF/<tool>/`: the only active copy of each tool.
- `YF/infra/`: framework, assets, QA, scripts and documentation.
- `YF/lunnen/`, `YF/muted/`, `YF/upgrade/`: 60 small compatibility redirect pages, not old generators. This is the necessary exception to root cleanup on static hosting.

Every link in the previous catalogue remains valid, including `lunnen/pattern_generator_02/01/`, `lunnen/random_lines_generator/01/`, and `lunnen/rays_pattern_generator/01/`. Published experimental links and former `upgrade/tools/` links remain valid too. Redirects retain query strings and fragments, accept both directory and `index.html` addresses, and do not accept an external redirect destination from query parameters.

Visible navigation says `← YF Tools`; the catalogue title remains YF Tools. Historical documentation, frozen baselines, internal class names and existing storage namespaces deliberately retain their old names where renaming would invalidate evidence or lose settings.

## User data

The new-version localStorage/IndexedDB namespaces are unchanged, preserving existing work. A one-time additive import copies compatible custom Sparky, Wordplayer and Keyboarder presets and Keyboarder/Random Lines preferences. Existing new data wins; conflicting custom preset names receive a `(previous)` suffix. Old storage keys are not modified or deleted.

Pizza Boxer can read a valid previous draft from the old IndexedDB database and insert it into the new store only when the destination is empty, using an atomic transaction. A newer draft is never replaced. The normal Restore/Discard interface remains in charge; old data is not deleted. Unsupported/denied IndexedDB inspection does not block startup.

## Recovery

Commit `8b95386` is the pre-promotion checkpoint: it contains the previous YF sources (including Sparky stages) and the completed experimental version. The old local `lunnen`, `muted`, `pragma`, catalogue and Finder metadata were moved, not permanently deleted, into a separate backup outside the repository: `yf-before-promotion-1ql6gk` under the operator's Codex backups directory (about 407 MB).

Recovery should restore selected files from that commit or backup into an isolated directory. Do not run a hard reset or copy the previous experiment back over current production work. Historical copy/bootstrap scripts are not deployment commands. Existing source manifests and frozen acceptance evidence have not been rewritten.

## Checks performed before publication

- 704 Node tests: framework 103; Sparky 200; Pizza 177; Wordplayer 7; Keyboarder 6; Sticky Fingers 10; Pulsar/Dither/Wander 51; catalogue/audit/batch/Rays 150.
- Standalone boundary/worker/model/encoding checks, isolation, shared UI/actions, Component Lab, keyboard acceptance, generated redirect coverage and source-manifest checks.
- Archived migration sources: 32 files / 791667 bytes still match their original hashes.
- Browser: all 16 old catalogue links open the new tools, panels and export actions are present, navigation is YF Tools, and no experimental branding is visible. Old `/upgrade/sparky/index.html` retains its query/hash; back navigation reaches the catalogue.
- The existing GitHub Actions workflow now points to the promoted paths and checks the complete tool collection, not the deleted legacy Pizza directory.

No microphone was activated in this release pass. This checks the move and regression contracts, not every device or every possible document/export state.

## Ongoing commands

Run from `js/YF`:

```sh
npm run test:tier1
npm run test:tier2
npm run check:migration-foundation
npm run check:isolation
npm run check:ui-contract
npm run check:actions
npm run routes:check
```

`routes:sync` regenerates only the known compatibility pages. `build:pizza` rebuilds the published Pizza runtime after source edits. For an explicit archived-original comparison, append `-- --source-root <backup-directory>` to `migration:sources:check`.
