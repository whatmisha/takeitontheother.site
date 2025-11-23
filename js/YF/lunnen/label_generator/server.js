#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

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

const server = http.createServer((req, res) => {
    // Убираем query string, декодируем и нормализуем путь
    let requestPath = req.url.split('?')[0];
    
    try {
        // Декодируем URL, чтобы корректно работать с пробелами и спецсимволами
        requestPath = decodeURIComponent(requestPath);
    } catch (e) {
        console.warn('Failed to decode request URL:', req.url, e);
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


