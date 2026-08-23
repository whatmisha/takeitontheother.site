# Tooling

Run commands from the project directory with `npm --prefix tools`:

```bash
npm --prefix tools install
npm --prefix tools run dev
npm --prefix tools test
npm --prefix tools run public:check
npm --prefix tools run schema
npm --prefix tools run presets:check
npm --prefix tools run build
npm --prefix tools run release
```

The Vite development server uses `http://127.0.0.1:8100` and rewrites `/` to
the source document. Production output is written to `build/`. `release` then
synchronizes its non-map hashed assets into the tracked `runtime/` folder and
updates the root `index.html`. PDF and outlined-SVG dependencies are pinned in
`package-lock.json`, synchronized into `vendor/` with `npm run vendor`, and
loaded lazily as separate hashed assets. Ajv is a build-only dependency that
generates `src/preset/generated/validatePreset12.js`; `test` and `build` verify
that it still matches the checked-in schema.

`public:check` не допускает bare-imports и bundler-only imports в исходном
module graph, проверяет manifest, schema, точные vendor-копии и fingerprint
хэшированного runtime. Поэтому Netlify обслуживает папку напрямую, но браузер
получает атомарный набор версионированных файлов без зависимости от локального
`tools/node_modules`.

Репозиторный GitHub Actions workflow запускает `npm ci`, полный `test` и
production `build` на Node 22 для каждого изменения Grid Generator в push/PR.
Он только проверяет состояние и не делает bot commits.
