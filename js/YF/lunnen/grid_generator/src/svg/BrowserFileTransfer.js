/** Owns browser downloads and local text-file reads. */
export class BrowserFileTransfer {
    constructor({
        documentRef = globalThis.document,
        urlApi = globalThis.URL,
        BlobClass = globalThis.Blob,
        FileReaderClass = globalThis.FileReader,
        schedule = (callback, delay) => globalThis.setTimeout(callback, delay)
    } = {}) {
        this.document = documentRef;
        this.urlApi = urlApi;
        this.BlobClass = BlobClass;
        this.FileReaderClass = FileReaderClass;
        this.schedule = schedule;
    }

    download(content, filename, type, revokeDelay = 0) {
        const blob = new this.BlobClass([content], { type });
        const url = this.urlApi.createObjectURL(blob);
        const link = this.document.createElement('a');
        link.href = url;
        link.download = filename;
        this.document.body.appendChild(link);
        link.click();
        link.remove();
        if (revokeDelay > 0) this.schedule(() => this.urlApi.revokeObjectURL(url), revokeDelay);
        else this.urlApi.revokeObjectURL(url);
    }

    readText(file) {
        return new Promise((resolve, reject) => {
            const reader = new this.FileReaderClass();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
}
