export class LayoutClient {
  constructor(onLayout, onGeography) {
    this.onLayout = onLayout;
    this.onGeography = onGeography;
    try {
      const builtWorker = globalThis.document?.querySelector?.('meta[name="npv-worker"]')?.content;
      const url = builtWorker ? new URL(builtWorker,document.baseURI) : new URL('./planet-worker.js',import.meta.url);
      this.worker = new Worker(url, {type:'module'});
      this.worker.onmessage = ({data}) => {
        if (data.type === 'layout') {
          const axes = [];
          for (let i=0;i<data.coordinates.length;i+=3) axes.push({
            x:data.coordinates[i], y:data.coordinates[i+1], z:data.coordinates[i+2]});
          this.onLayout({...data.settings,axes},data.version);
        } else if (data.type === 'geography') {
          this.onGeography(data.masks,data.version);
          this.busy = false;
          this.inFlight = null;
          this.flush();
        }
      };
      this.worker.onerror = () => this.fallback();
    } catch { this.failed = true; }
  }
  request(request) { this.pending = request; this.flush(); }
  flush() {
    if (this.busy || !this.pending) return;
    this.busy = true;
    const request = this.inFlight = this.pending;
    this.pending = null;
    if (!this.failed) { this.worker.postMessage(request); return; }
    // Keep the site usable if workers are unavailable (for example a restrictive
    // host CSP). This path is never part of a normal main-thread startup.
    import('./layout-cache.js').then(async ({LayoutCache}) => {
      this.cache ||= new LayoutCache();
      const entry = this.cache.get(request.cssSize);
      this.onLayout(entry.layout,request.version);
      this.onGeography(await this.cache.masks(entry),request.version);
    }).catch(error => console.error('Unable to prepare sphere:',error)).finally(() => {
      this.busy = false; this.inFlight = null; this.flush();
    });
  }
  fallback() {
    this.worker?.terminate(); this.failed = true;
    this.pending ||= this.inFlight;
    this.inFlight = null; this.busy = false; this.flush();
  }
}
