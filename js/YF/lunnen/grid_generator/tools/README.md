# Tooling

Run commands from the project directory with `npm --prefix tools`:

```bash
npm --prefix tools install
npm --prefix tools run dev
npm --prefix tools test
npm --prefix tools run schema
npm --prefix tools run presets:check
npm --prefix tools run build
```

The Vite development server uses `http://127.0.0.1:8000`. Production output is
written to `build/`; fonts, graphics and source-of-truth preset JSON files are
copied into that output. PDF and outlined-SVG dependencies are pinned locally in
`package-lock.json` and loaded lazily as separate chunks. Ajv is a build-only
dependency that generates `src/preset/generated/validatePreset12.js`; `test`
and `build` verify that it still matches the checked-in schema.

Vite также импортирует HTML-фрагменты как raw-строки и объединяет восемь
CSS-модулей из корневого `style.css`. Поэтому и dev-сервер, и production build
проверяют ту же модульную оболочку интерфейса.
