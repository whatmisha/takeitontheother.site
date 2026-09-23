# SVG, PNG and PDF export

Use an SVG render target when editable vectors are primary. `defineTool`
provides the canonical SVG and PNG paths; call the public exporter's
`exportToPDF` inside `runExport` for PDF. Keep filenames application-owned,
exclude guides with `data-export-exclude`, and pass the operation signal. See
`starters/svg-full/tool.js`.
