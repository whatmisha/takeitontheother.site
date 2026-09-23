# Public runtime

Generated, content-hashed browser assets used by the root `index.html`.
Do not edit this directory by hand. After changing application source, run:

```bash
npm --prefix tools run release
```

`release.json` binds these files to the exact source fingerprint checked by
`npm --prefix tools run public:check`.
