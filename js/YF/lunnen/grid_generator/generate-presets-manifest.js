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
    
    // Custom sort function for presets
    function sortPresets(a, b) {
        const nameA = a.name;
        const nameB = b.name;
        
        // "+New" always comes first
        if (nameA.startsWith('+New')) return -1;
        if (nameB.startsWith('+New')) return 1;
        
        // Extract first word (product line name) and size
        const extractGroupAndSize = (name) => {
            // Remove quotes and split by spaces
            const parts = name.replace(/"/g, '').split(/\s+/);
            const firstWord = parts[0] || '';
            
            // Find the first number (can be integer or decimal)
            let size = null;
            for (let i = 1; i < parts.length; i++) {
                const numMatch = parts[i].match(/^(\d+\.?\d*)/);
                if (numMatch) {
                    size = parseFloat(numMatch[1]);
                    break;
                }
            }
            
            return { group: firstWord, size: size !== null ? size : 0 };
        };
        
        const { group: groupA, size: sizeA } = extractGroupAndSize(nameA);
        const { group: groupB, size: sizeB } = extractGroupAndSize(nameB);
        
        // First sort by group (product line)
        const groupCompare = groupA.localeCompare(groupB);
        if (groupCompare !== 0) {
            return groupCompare;
        }
        
        // Within same group, sort by size descending (larger to smaller)
        return sizeB - sizeA;
    }
    
    // Sort presets using custom logic
    presets.sort(sortPresets);
    
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


























