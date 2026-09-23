// Public addresses shipped before YF Tools promotion. Only tiny redirect pages
// live at these addresses; application code exists once, at the YF root.
export const compatibilityRoots = new Set(['lunnen', 'muted', 'upgrade']);
export function legacyRoutes(catalog) {
    const routes = [
        { path: 'upgrade/', target: '' },
        { path: 'lunnen/', target: '' },
        { path: 'muted/', target: '' }
    ];
    for (const tool of catalog.tools) {
        routes.push({ path: `${tool.group}/${tool.id}/`, target: `${tool.id}/` });
        routes.push({ path: `upgrade/${tool.id}/`, target: `${tool.id}/` });
        routes.push({ path: `upgrade/tools/${tool.id}/`, target: `${tool.id}/` });
        if (['pattern_generator_02', 'random_lines_generator', 'rays_pattern_generator'].includes(tool.id)) {
            routes.push({ path: `${tool.group}/${tool.id}/01/`, target: `${tool.id}/` });
        }
    }
    for (const page of ['ui-audit', 'ui-host', 'migrations']) {
        routes.push({ path: `upgrade/infra/qa/${page}/`, target: `infra/qa/${page}/` });
        routes.push({ path: `upgrade/qa/${page}/`, target: `infra/qa/${page}/` });
    }
    return routes;
}

export function redirectDocument(route) {
    const prefix = '../'.repeat(route.path.split('/').filter(Boolean).length);
    const target = prefix + route.target;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>YF Tools</title>
  <link rel="canonical" href="${target}">
  <noscript><meta http-equiv="refresh" content="0;url=${target}"></noscript>
  <style>body{margin:24px;background:#000;color:#d2d2d2;font:400 16px -apple-system,Inter,"Segoe UI",Roboto,sans-serif}a{color:inherit}</style>
</head>
<body>
  <a data-yf-target href="${target}">Open YF Tools</a>
  <script src="${prefix}infra/navigation/redirect.js?v=yf-1"></script>
</body>
</html>
`;
}
