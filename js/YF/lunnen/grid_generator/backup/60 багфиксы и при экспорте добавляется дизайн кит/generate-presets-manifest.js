#!/usr/bin/env node

/**
 * Auto-generate presets manifest
 * 
 * This script scans the presets folder and automatically creates manifest.json
 * Usage: node generate-presets-manifest.js
 */

const fs = require('fs');
const path = require('path');

const PRESETS_DIR = path.join(__dirname, 'presets');
const MANIFEST_PATH = path.join(PRESETS_DIR, 'manifest.json');

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
            console.error(`  ✗ Error reading ${file}:`, error.message);
        }
    }
    
    // Sort presets alphabetically by name
    presets.sort((a, b) => a.name.localeCompare(b.name));
    
    // Create manifest object
    const manifest = {
        presets: presets,
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













