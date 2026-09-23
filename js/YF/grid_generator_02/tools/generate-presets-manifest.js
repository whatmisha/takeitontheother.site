#!/usr/bin/env node

/**
 * Auto-generate presets manifest
 * 
 * This script scans the presets folder and automatically creates manifest.json
 * Usage: node generate-presets-manifest.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = path.join(SCRIPT_DIR, '..', 'presets');
const MANIFEST_PATH = path.join(PRESETS_DIR, 'manifest.json');
const CHECK_ONLY = process.argv.includes('--check');

function generateManifest() {
    console.log('🔍 Scanning presets folder...');
    
    // Check if presets directory exists
    if (!fs.existsSync(PRESETS_DIR)) {
        console.error('❌ Error: presets folder not found');
        process.exit(1);
    }
    
    // Read all files in presets folder
    const files = fs.readdirSync(PRESETS_DIR);
    
    // Filter only .json files, exclude manifest.json
    const presetFiles = files.filter(file => 
        file.endsWith('.json') && 
        file !== 'manifest.json' &&
        file !== 'README.md'
    );
    
    if (presetFiles.length === 0) {
        console.warn('⚠️  No preset files found in presets folder');
        const manifest = { presets: [] };
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
        console.log('📝 Created empty manifest.json');
        return;
    }
    
    console.log(`📦 Found ${presetFiles.length} preset file(s)`);
    
    // Read each preset file and extract name
    const presets = [];
    let hasReadErrors = false;
    
    for (const file of presetFiles) {
        const filePath = path.join(PRESETS_DIR, file);
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            
            // Get preset name from file or use filename
            const name = data.presetName || path.basename(file, '.json');
            
            presets.push({
                name: name,
                file: file
            });
            
            console.log(`  ✓ ${file} → "${name}"`);
            
        } catch (error) {
            hasReadErrors = true;
            console.error(`  ✗ Error reading ${file}:`, error.message);
        }
    }

    if (hasReadErrors) {
        console.error('❌ Manifest was not changed because one or more presets are invalid');
        process.exitCode = 1;
        return;
    }

    let currentManifest = null;
    if (fs.existsSync(MANIFEST_PATH)) {
        try {
            currentManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        } catch (error) {
            console.warn(`⚠️  Existing manifest could not be read: ${error.message}`);
        }
    }
    const remainingPresets = new Map(presets.map(preset => [preset.file, preset]));
    const manifestPresets = [];
    (currentManifest?.presets || []).forEach(currentPreset => {
        if (!currentPreset.file) {
            manifestPresets.push(currentPreset);
            return;
        }
        const updatedPreset = remainingPresets.get(currentPreset.file);
        if (!updatedPreset) return;
        manifestPresets.push(updatedPreset);
        remainingPresets.delete(currentPreset.file);
    });
    const newPresets = Array.from(remainingPresets.values()).sort((first, second) => {
        if (first.file === 'New.json') return -1;
        if (second.file === 'New.json') return 1;
        return first.name.localeCompare(second.name, 'en');
    });
    manifestPresets.push(...newPresets);

    if (CHECK_ONLY) {
        const matches = currentManifest &&
            JSON.stringify(currentManifest.presets) === JSON.stringify(manifestPresets) &&
            currentManifest.count === presets.length;
        if (!matches) {
            console.error('❌ manifest.json is out of date. Run npm run presets');
            process.exitCode = 1;
            return;
        }
        console.log(`✅ manifest.json matches ${presets.length} preset file(s)`);
        return;
    }

    // Create manifest object
    const manifest = {
        presets: manifestPresets,
        generated: new Date().toISOString(),
        count: presets.length
    };
    
    // Write manifest.json
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    
    console.log('✅ manifest.json generated successfully');
    console.log(`📊 Total presets: ${presets.length}`);
}

// Run the script
try {
    generateManifest();
} catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
}
