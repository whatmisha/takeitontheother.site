export function exportPng(canvas, options = {}) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const suffix = options.transparent ? "transparent" : "canvas";
    link.download = `etica-${suffix}-${canvas.width}x${canvas.height}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}
