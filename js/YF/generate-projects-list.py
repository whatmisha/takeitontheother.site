#!/usr/bin/env python3

import os
import json
import re

# Папки проектов
PROJECT_FOLDERS = ['bodycore', 'lunnen', 'muted']

def format_display_name(folder_name):
    """Форматирование имени папки в отображаемое имя"""
    words = re.split(r'[-_]', folder_name)
    return ' '.join(word.capitalize() for word in words)

def scan_projects():
    """Сканирование проектов"""
    projects = []
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    for project_folder in PROJECT_FOLDERS:
        project_path = os.path.join(script_dir, project_folder)
        
        if not os.path.exists(project_path):
            print(f"⚠️  Папка {project_folder} не найдена")
            continue
        
        apps = []
        
        try:
            items = os.listdir(project_path)
        except PermissionError:
            print(f"⚠️  Нет доступа к папке {project_folder}")
            continue
        
        for item in items:
            item_path = os.path.join(project_path, item)
            index_path = os.path.join(item_path, 'index.html')
            index_01_path = os.path.join(item_path, '01', 'index.html')
            
            # Проверяем, что это папка и в ней есть index.html (в корне или в папке 01/)
            if os.path.isdir(item_path):
                has_index = os.path.exists(index_path)
                has_index_01 = os.path.exists(index_01_path)
                
                if has_index or has_index_01:
                    apps.append({
                        'name': item,
                        'displayName': format_display_name(item),
                        'hasSubfolder': has_index_01 and not has_index
                    })
        
        # Сортируем приложения по имени
        apps.sort(key=lambda x: x['name'])
        
        if apps:
            projects.append({
                'name': project_folder.capitalize(),
                'apps': apps
            })
    
    return projects

def create_projects_js_code(projects):
    """Создание JavaScript кода для массива projects"""
    lines = ["    const projects = ["]
    
    for p_index, project in enumerate(projects):
        lines.append("      {")
        lines.append(f"        name: \"{project['name']}\",")
        lines.append("        apps: [")
        
        for a_index, app in enumerate(project['apps']):
            comma = ',' if a_index < len(project['apps']) - 1 else ''
            if app.get('hasSubfolder', False):
                lines.append(f"          {{ name: \"{app['name']}\", displayName: \"{app['displayName']}\", hasSubfolder: true }}{comma}")
            else:
                lines.append(f"          {{ name: \"{app['name']}\", displayName: \"{app['displayName']}\" }}{comma}")
        
        lines.append("        ]")
        comma = ',' if p_index < len(projects) - 1 else ''
        lines.append(f"      }}{comma}")
    
    lines.append("    ];")
    
    return '\n'.join(lines)

def update_index_html():
    """Обновление index.html"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    projects = scan_projects()
    index_path = os.path.join(script_dir, 'index.html')
    
    if not os.path.exists(index_path):
        print("❌ Файл index.html не найден!")
        return
    
    with open(index_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Создаем JavaScript код с массивом projects
    projects_js_code = create_projects_js_code(projects)
    
    # Заменяем массив projects в HTML
    pattern = r'    const projects = \[[\s\S]*?\];'
    html_content = re.sub(pattern, projects_js_code, html_content)
    
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print("✅ index.html обновлен!\n")
    print("Найдено проектов:\n")
    
    for project in projects:
        print(f"\n{project['name']}:")
        for app in project['apps']:
            print(f"  - {app['displayName']} ({app['name']})")

if __name__ == '__main__':
    update_index_html()

