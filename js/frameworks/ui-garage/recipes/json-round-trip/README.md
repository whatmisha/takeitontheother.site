# Versioned JSON round trip

Keep `TOOL_ID`, `DOCUMENT_VERSION`, defaults and strict normalization in a
small application-owned module. Export `{ schemaVersion, toolId, settings }`.
On import, snapshot the current settings, parse with `SVGExporter.importJSON`,
normalize every field, apply only the complete valid result, and restore the
snapshot on failure. The full SVG starter is the canonical example.
