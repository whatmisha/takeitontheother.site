// Preserve preset/share parameters and fragments. The target is checked-in
// markup, never a query-string destination (no open redirects).
(() => {
    const link = document.querySelector('[data-yf-target]');
    if (!link) return;
    const target = new URL(link.getAttribute('href'), location.href);
    if (target.origin !== location.origin) return;
    target.search = location.search;
    target.hash = location.hash;
    link.href = target.href;
    location.replace(target.href);
})();
