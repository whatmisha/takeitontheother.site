# YF Tools — production promotion

2026-09-23. The user authorized replacing the old `js/YF` collection with the completed shared-framework version and publishing it on `main`.

## Current layout

- `YF/index.html`: YF Tools, with Lunnen and Muted sections and 16 links.
- `YF/<tool>/`: the only active copy of each tool.
- `YF/infra/`: framework, assets, QA, scripts and documentation.
- No compatibility directories: `YF/lunnen/`, `YF/muted/` and `YF/upgrade/` have been removed.

After promotion, the user explicitly approved retiring all previous addresses under `upgrade/`, `lunnen/` and `muted/`, including `upgrade/tools/`, old QA URLs and the former `/01/` tool variants. All 60 redirect pages were removed from YF and placed in `retired-upgrade-redirects`, `retired-lunnen-redirects` and `retired-muted-redirects` within the existing backup. Only canonical `YF/<tool>/` addresses are supported. The catalogue still groups the 16 tools under Lunnen and Muted and links directly to their canonical pages.

The unused redirect runtime, route definitions, generator and `routes:sync` command were removed. Public-route and layout tests reject the retired directory names and check all canonical links. User-data migration remains independent of URL redirects and is retained.

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
- Browser at promotion: all 16 old catalogue links opened the new tools, panels and export actions were present, navigation was YF Tools, and no experimental branding was visible. All redirects verified at promotion were subsequently retired by explicit user request as described above; current checks cover the canonical tool addresses.
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

`routes:check` verifies canonical catalogue links, absence of retired paths and user-data migration; it does not generate redirects. `build:pizza` rebuilds the published Pizza runtime after source edits. For an explicit archived-original comparison, append `-- --source-root <backup-directory>` to `migration:sources:check`.
