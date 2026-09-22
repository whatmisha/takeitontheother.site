#!/usr/bin/env python3

"""
Auto-generate presets manifest

This script scans the presets folder and automatically creates manifest.json
Usage: python3 generate-presets-manifest.py
"""

import json
import os
from datetime import datetime
from pathlib import Path

PRESETS_DIR = Path(__file__).parent / 'presets'
MANIFEST_PATH = PRESETS_DIR / 'manifest.json'

def generate_manifest():
    print('🔍 Scanning presets folder...')
    
    # Check if presets directory exists
    if not PRESETS_DIR.exists():
        print('❌ Error: presets folder not found')
        exit(1)
    
    # Find all .json files except manifest.json
    preset_files = [
        f for f in os.listdir(PRESETS_DIR)
        if f.endswith('.json') and f != 'manifest.json'
    ]
    
    if not preset_files:
        print('⚠️  No preset files found in presets folder')
        manifest = {'presets': []}
        with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print('📝 Created empty manifest.json')
        return
    
    print(f'📦 Found {len(preset_files)} preset file(s)')
    
    # Read each preset file and extract name
    presets = []
    preset_names_count = {}
    
    for file in preset_files:
        file_path = PRESETS_DIR / file
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Get preset name from file, prefer filename for clarity
            preset_name_from_file = data.get('presetName', '')
            filename_without_ext = file.replace('.json', '')
            
            # Use filename as primary name (more descriptive)
            # Fall back to presetName only if filename is generic
            if filename_without_ext and not filename_without_ext.startswith('grid-settings'):
                name = filename_without_ext
            else:
                name = preset_name_from_file if preset_name_from_file else filename_without_ext
            
            # Track duplicate names
            if name in preset_names_count:
                preset_names_count[name] += 1
                name = f"{name} ({preset_names_count[name]})"
            else:
                preset_names_count[name] = 1
            
            presets.append({
                'name': name,
                'file': file
            })
            
            print(f'  ✓ {file} → "{name}"')
            
        except Exception as e:
            print(f'  ✗ Error reading {file}: {str(e)}')
    
    # Sort presets alphabetically by name
    presets.sort(key=lambda x: x['name'])
    
    # Create manifest object
    manifest = {
        'presets': presets,
        'generated': datetime.now().isoformat(),
        'count': len(presets)
    }
    
    # Write manifest.json
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write('\n')
    
    print('✅ manifest.json generated successfully')
    print(f'📊 Total presets: {len(presets)}')

if __name__ == '__main__':
    try:
        generate_manifest()
    except Exception as e:
        print(f'❌ Fatal error: {str(e)}')
        exit(1)

