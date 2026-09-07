# Updating a copied UI Garage folder

Each consumer repository owns its copy. Applications import their local copy;
they never reference the repository from which UI Garage was originally
released.

1. Record the current `VERSION.json` and archive SHA-256.
2. Keep the existing folder as a rollback copy.
3. Unpack the new release beside it and verify the distributed SHA-256.
4. Run `npm run gate:framework-extraction` inside the unpacked folder.
5. Compare `CHANGELOG.md`, `PUBLIC_API.json`, `CONTRACT.md` and CSS tokens.
6. Replace the consumer's copied folder as one atomic directory change.
7. Run the consumer tool's browser and artifact tests.
8. Remove the rollback copy only after acceptance.

Framework updates never migrate application storage automatically. Preset and
draft namespaces belong to each tool; schema changes require an application-
owned migration hook. To roll back, restore the previous complete folder and
its recorded hash. Existing applications in the source repository are not
consumers of this release and require no migration.
