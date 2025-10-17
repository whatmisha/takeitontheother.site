<?php
// Папки проектов
$projectFolders = ['bodycore', 'lunnen', 'muted'];

// Функция для форматирования имени папки в отображаемое имя
function formatDisplayName($folderName) {
    $words = preg_split('/[-_]/', $folderName);
    $words = array_map('ucfirst', $words);
    return implode(' ', $words);
}

// Функция для сканирования проектов
function scanProjects($projectFolders) {
    $projects = [];

    foreach ($projectFolders as $projectFolder) {
        $projectPath = __DIR__ . '/' . $projectFolder;
        
        if (!is_dir($projectPath)) {
            continue;
        }

        $apps = [];
        $items = @scandir($projectPath);
        
        if (!$items) continue;

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            
            $itemPath = $projectPath . '/' . $item;
            $indexPath = $itemPath . '/index.html';
            $index01Path = $itemPath . '/01/index.html';

            // Проверяем, что это папка и в ней есть index.html (в корне или в /01/)
            if (is_dir($itemPath)) {
                $hasIndex = file_exists($indexPath);
                $hasIndex01 = file_exists($index01Path);
                
                if ($hasIndex || $hasIndex01) {
                    $apps[] = [
                        'name' => $item,
                        'displayName' => formatDisplayName($item),
                        'hasSubfolder' => $hasIndex01 && !$hasIndex
                    ];
                }
            }
        }

        // Сортируем приложения по имени
        usort($apps, function($a, $b) {
            return strcmp($a['name'], $b['name']);
        });

        if (count($apps) > 0) {
            $projects[] = [
                'name' => ucfirst($projectFolder),
                'apps' => $apps
            ];
        }
    }

    return $projects;
}

// Получаем список проектов
$projects = scanProjects($projectFolders);
$projectsJson = json_encode($projects, JSON_UNESCAPED_UNICODE);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YF Projects</title>
  <style>
    @font-face {
      font-family: 'CoFo Sans';
      src: url('/fonts/CoFoSans-Regular.woff2') format('woff2'),
           url('/fonts/CoFoSans-Regular.woff') format('woff');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
    
    @font-face {
      font-family: 'CoFo Sans';
      src: url('/fonts/CoFoSans-Medium.woff2') format('woff2'),
           url('/fonts/CoFoSans-Medium.woff') format('woff');
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    
    body {
      font-family: 'CoFo Sans', 'Arial', sans-serif;
      background-color: black;
      color: white;
      margin: 0;
      padding: 0;
    }
    h1 {
      text-align: left;
      margin: 0;
      margin-bottom: 30px;
      padding: 20px 20px 20px 20px;
      font-weight: 500;
      width: 100%;
      box-sizing: border-box;
      font-size: 18vw;
      line-height: 0.9;
      display: block;
      letter-spacing: -0.02em;
      white-space: nowrap;
      overflow: visible;
    }
    #projects-container {
      padding: 0 20px 20px 20px;
    }
    .project-section {
      margin-bottom: 40px;
    }
    .project-title {
      font-size: 24px;
      margin-bottom: 15px;
      border-bottom: 1px solid #444;
      padding-bottom: 5px;
      font-weight: 500;
    }
    .app-list {
      list-style-type: none;
      padding-left: 0;
    }
    .app-list li {
      margin-bottom: 10px;
    }
    .app-link {
      color: #777;
      text-decoration: none;
      font-size: 18px;
    }
    .app-link:hover {
      text-decoration: none;
      color: white;
    }
  </style>
</head>
<body>
  <h1>YF Projects</h1>

  <div id="projects-container">
    <!-- Projects will be loaded by JavaScript -->
  </div>

  <script>
    // Структура проектов и приложений (генерируется динамически PHP)
    const projects = <?php echo $projectsJson; ?>;

    // Функция для преобразования имени приложения
    function formatAppName(name) {
      return name
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    // Функция для динамического создания списка проектов и приложений
    function renderProjects() {
      const container = document.getElementById('projects-container');
      
      projects.forEach(project => {
        // Создаем секцию проекта
        const projectSection = document.createElement('div');
        projectSection.className = 'project-section';
        
        // Заголовок проекта
        const projectTitle = document.createElement('h2');
        projectTitle.className = 'project-title';
        projectTitle.textContent = project.name;
        projectSection.appendChild(projectTitle);
        
        // Список приложений
        const appList = document.createElement('ul');
        appList.className = 'app-list';
        
        project.apps.forEach(app => {
          const listItem = document.createElement('li');
          const link = document.createElement('a');
          link.className = 'app-link';
          
          // Если index.html находится в подпапке /01/, добавляем /01/ к ссылке
          if (app.hasSubfolder) {
            link.href = `${project.name.toLowerCase()}/${app.name}/01/`;
          } else {
            link.href = `${project.name.toLowerCase()}/${app.name}/`;
          }
          
          // Используем предоставленное отображаемое имя, если оно есть, иначе форматируем имя папки
          link.textContent = app.displayName || formatAppName(app.name);
          
          listItem.appendChild(link);
          appList.appendChild(listItem);
        });
        
        projectSection.appendChild(appList);
        container.appendChild(projectSection);
      });
    }

    // Загружаем проекты при загрузке страницы
    document.addEventListener('DOMContentLoaded', renderProjects);
  </script>
</body>
</html>

