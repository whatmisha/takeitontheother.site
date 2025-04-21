<?php
// Разрешаем кросс-домен запросы
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');

// Папка с SVG-файлами
$directory = 'source/';

// Результат по умолчанию
$result = [
    'success' => true,
    'files' => []
];

// Проверяем существование директории
if (!file_exists($directory) || !is_dir($directory)) {
    $result['success'] = false;
    $result['error'] = 'Directory not found';
    echo json_encode($result);
    exit;
}

try {
    // Получаем все файлы из директории
    $allFiles = scandir($directory);

    // Фильтруем только SVG файлы
    $svgFiles = [];
    if ($allFiles !== false) {
        foreach ($allFiles as $file) {
            if ($file != '.' && $file != '..' && strtolower(pathinfo($file, PATHINFO_EXTENSION)) === 'svg') {
                $svgFiles[] = $file;
            }
        }
    }

    // Формируем результат
    $files = [];
    foreach ($svgFiles as $file) {
        $files[] = [
            'file' => $file,
            'path' => $directory . $file,
            'name' => pathinfo($file, PATHINFO_FILENAME)
        ];
    }

    $result['files'] = $files;
} catch (Exception $e) {
    $result['success'] = false;
    $result['error'] = $e->getMessage();
}

// Возвращаем список файлов в JSON формате
echo json_encode($result);
