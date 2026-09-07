# Source-project independence

UI Garage is a copied, self-contained release. No existing application loads,
imports, builds, aliases or stores data through this folder, and this folder has
no path, symlink or runtime dependency on its source project.

The source-project proof is intentionally maintained outside this portable
folder. Removing or moving UI Garage requires no application rollback or data
migration. `npm run verify` independently rejects imports outside this folder,
symlinks, remote runtime dependencies, stale hashes and duplicate starter
storage namespaces.
