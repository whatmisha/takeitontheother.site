# Project layout

UI Garage is copied once into a consumer repository. Tools are siblings at the
repository root; infrastructure is isolated under `infra/`.

```text
project/
├── index.html                 optional tool catalogue
├── infra/
│   └── ui-garage/             this complete copied distribution
├── first-tool/
│   ├── index.html
│   ├── app.js
│   ├── app.css
│   ├── favicon.svg
│   ├── assets/                only this tool's private assets
│   ├── presets/               only this tool's shipped presets
│   └── tests/                 optional tool-local tests
└── second-tool/
    └── …
```

Rules:

- keep exactly one runtime copy at `infra/ui-garage/`;
- do not place applications, generated art or user data inside UI Garage;
- import only `../infra/ui-garage/src/index.js` from a top-level tool;
- load `framework.css`, then `ui-contract.css`, then the tool's `app.css`;
- use `generator-host.css` only with `mountGenerator`;
- keep domain models, presets, schemas, filenames, assets and copy in the tool;
- give every tool unique, versioned localStorage and IndexedDB namespaces;
- do not use symlinks or paths back to the repository from which the folder was
  copied;
- keep only one active directory per tool—no nested stage, migration or legacy
  copies in the runtime tree.

From the project root, generate a clean sibling tool with:

```sh
node infra/ui-garage/scripts/create-tool.mjs ./my-tool \
  --id my-tool --renderer svg --name "My Tool"
```

The scaffolder calculates the relative framework import, refuses to overwrite
an existing directory and creates no dependency on any other tool.
