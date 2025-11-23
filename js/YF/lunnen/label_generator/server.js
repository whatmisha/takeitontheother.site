#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

// Дополнительные зависимости для экспорта PDF (подгружаются лениво)
let PDFDocument;
let SVGtoPDF;

const PORT = 8081; // Используем порт 8081 вместо 8080

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.woff': 'application/font-woff',
    '.woff2': 'application/font-woff2',
    '.ttf': 'application/font-ttf',
    '.otf': 'application/font-otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.csv': 'text/csv',
};

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Ленивая загрузка модулей PDF, чтобы не ломать окружения без зависимостей.
 */
function ensurePdfModulesLoaded() {
    if (!PDFDocument || !SVGtoPDF) {
        try {
            PDFDocument = require('pdfkit');
            SVGtoPDF = require('svg-to-pdfkit');
        } catch (e) {
            console.error('PDF export dependencies are not installed. Run "npm install pdfkit svg-to-pdfkit".', e);
            return false;
        }
    }
    return true;
}

/**
 * Обработка API-запроса для экспорта PDF из SVG.
 * Ожидает JSON: { svg, widthMm, heightMm, filename }
 */
function handlePdfExport(req, res) {
    if (!ensurePdfModulesLoaded()) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PDF export dependencies are not installed on the server.' }));
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
        // Safety limit ~5MB
        if (body.length > 5 * 1024 * 1024) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Payload too large' }));
            req.destroy();
        }
    });

    req.on('end', () => {
        try {
            const data = JSON.parse(body || '{}');
            const svg = data.svg || '';
            const widthMm = Number(data.widthMm) || 0;
            const heightMm = Number(data.heightMm) || 0;
            const requestedFilename = (data.filename || 'label.pdf').toString();

            if (!svg || !widthMm || !heightMm) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid payload: svg, widthMm and heightMm are required.' }));
                return;
            }

            // Конвертация мм → pt (1 inch = 25.4mm, 1 inch = 72pt)
            const mmToPt = (mm) => (mm * 72) / 25.4;
            const widthPt = mmToPt(widthMm);
            const heightPt = mmToPt(heightMm);

            // Простейшая очистка имени файла
            const safeFilename = requestedFilename.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_\-\.]/g, '_') || 'label.pdf';

            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${safeFilename}"`
            });

            const doc = new PDFDocument({
                size: [widthPt, heightPt],
                margins: { top: 0, left: 0, right: 0, bottom: 0 }
            });

            // Встраиваем SVG во всю страницу PDF
            SVGtoPDF(doc, svg, 0, 0, {
                assumePt: false
            });

            doc.pipe(res);
            doc.end();
        } catch (error) {
            console.error('PDF export error:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({ error: 'Internal server error during PDF export.' }));
        }
    });
}

const server = http.createServer((req, res) => {
    // Убираем query string, декодируем и нормализуем путь
    let requestPath = req.url.split('?')[0];
    
    try {
        // Декодируем URL, чтобы корректно работать с пробелами и спецсимволами
        requestPath = decodeURIComponent(requestPath);
    } catch (e) {
        console.warn('Failed to decode request URL:', req.url, e);
    }

    // API: экспорт PDF из SVG
    if (req.method === 'POST' && requestPath === '/api/export-pdf') {
        return handlePdfExport(req, res);
    }
    
    let filePath = '.' + requestPath;
    
    // Если путь заканчивается на /, добавляем index.html
    if (filePath === './') {
        filePath = './index.html';
    }
    
    // Если файл не указан, пробуем index.html
    if (filePath.endsWith('/')) {
        filePath += 'index.html';
    }

    // Безопасность: проверяем, что путь не выходит за пределы текущей директории
    const resolvedPath = path.resolve(filePath);
    const basePath = path.resolve('.');
    
    if (!resolvedPath.startsWith(basePath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
            }
            return;
        }

        const contentType = getContentType(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📁 Обслуживает файлы из: ${path.resolve('.')}`);
    console.log(`\nОткройте в браузере:`);
    console.log(`   http://localhost:${PORT}/index.html`);
    console.log(`\nНажмите Ctrl+C для остановки сервера`);
});


