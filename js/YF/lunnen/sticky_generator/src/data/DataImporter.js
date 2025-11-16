const XLSX_CDN_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

let xlsxModulePromise = null;

async function loadXlsx() {
    if (!xlsxModulePromise) {
        xlsxModulePromise = import(XLSX_CDN_URL);
    }
    return xlsxModulePromise;
}

export class DataImporter {
    static async fromGoogleSheet(url) {
        const parsed = this.parseGoogleSheetUrl(url);
        if (!parsed) {
            throw new Error('Некорректная ссылка на Google Sheets');
        }

        const csvUrl = this.buildGoogleCsvUrl(parsed);
        const response = await fetch(csvUrl, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error('Не удалось загрузить данные таблицы');
        }

        const csvText = await response.text();
        return this.sheetToJson(csvText, { type: 'string' });
    }

    static async fromFile(file) {
        const extension = (file.name?.split('.').pop() || '').toLowerCase();

        if (extension === 'csv') {
            const text = await file.text();
            return this.sheetToJson(text, { type: 'string' });
        }

        const buffer = await file.arrayBuffer();
        return this.sheetToJson(buffer, { type: 'array' });
    }

    static parseGoogleSheetUrl(url) {
        if (!url) return null;

        try {
            const normalized = new URL(url);
            const idMatch = normalized.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (!idMatch) return null;

            const id = idMatch[1];
            const gidParam = normalized.searchParams.get('gid');
            let gid = gidParam || '0';

            if (normalized.hash.includes('gid=')) {
                const hashGid = normalized.hash.split('gid=')[1];
                if (hashGid) {
                    gid = hashGid.replace(/[^0-9]/g, '') || gid;
                }
            }

            return { id, gid };
        } catch (error) {
            console.warn('Failed to parse Google Sheets URL', error);
            return null;
        }
    }

    static buildGoogleCsvUrl({ id, gid }) {
        const base = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq`;
        const params = new URLSearchParams({
            tqx: 'out:csv',
            gid: gid || '0'
        });
        return `${base}?${params.toString()}`;
    }

    static async sheetToJson(source, options) {
        const XLSX = await loadXlsx();
        const workbook = XLSX.read(source, options);

        const sheetName = workbook.SheetNames?.[0];
        if (!sheetName) {
            return { rows: [], columns: [] };
        }

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {
            defval: '',
            raw: false
        });

        let columns = [];
        if (rows.length > 0) {
            columns = Object.keys(rows[0]);
        } else {
            const headerMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            columns = (headerMatrix[0] || []).map((header, index) => header || `Column ${index + 1}`);
        }

        return {
            rows,
            columns,
            sheetName
        };
    }
}

