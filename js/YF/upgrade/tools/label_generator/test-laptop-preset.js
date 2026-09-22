/**
 * Manual Browser Testing Guide for Laptop Box Label CZ Preset
 * 
 * INSTRUCTIONS:
 * 1. Open http://localhost:5001/ in your browser
 * 2. Open Developer Tools (F12 or Cmd+Option+I)
 * 3. Go to the Console tab
 * 4. Copy and paste this entire script
 * 5. Press Enter to run it
 * 
 * The script will:
 * - Check if the page loaded correctly
 * - Find and select the "Laptop Box Label CZ" preset
 * - Verify element positions
 * - Check for Height/Width input fields
 * - Report any issues
 */

(async function testLaptopPreset() {
    console.log('%c=== STARTING AUTOMATED TEST ===', 'color: blue; font-size: 16px; font-weight: bold');
    
    // Helper function to wait
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Helper function to log results
    const logResult = (test, passed, details = '') => {
        const emoji = passed ? '✓' : '✗';
        const color = passed ? 'green' : 'red';
        console.log(`%c${emoji} ${test}`, `color: ${color}; font-weight: bold`, details);
    };
    
    // 1. Check if page loaded
    console.log('\n%c1. Checking page load...', 'color: blue; font-weight: bold');
    const gridSvg = document.getElementById('gridSvg');
    logResult('Grid SVG exists', !!gridSvg, gridSvg ? `(has ${gridSvg.children.length} children)` : '');
    
    // 2. Find preset dropdown
    console.log('\n%c2. Finding preset dropdown...', 'color: blue; font-weight: bold');
    const presetDropdown = document.getElementById('presetDropdownToggle');
    logResult('Preset dropdown exists', !!presetDropdown);
    
    if (!presetDropdown) {
        console.error('Cannot continue - preset dropdown not found');
        return;
    }
    
    // 3. Click to open dropdown
    console.log('\n%c3. Opening preset dropdown...', 'color: blue; font-weight: bold');
    presetDropdown.click();
    await wait(500);
    
    const dropdownMenu = document.getElementById('presetDropdownMenu');
    logResult('Dropdown menu opened', !!dropdownMenu && dropdownMenu.children.length > 0, 
        dropdownMenu ? `(${dropdownMenu.children.length} presets)` : '');
    
    // 4. Find and select "Laptop Box Label CZ"
    console.log('\n%c4. Selecting "Laptop Box Label CZ" preset...', 'color: blue; font-weight: bold');
    let laptopPresetItem = null;
    if (dropdownMenu) {
        const items = Array.from(dropdownMenu.querySelectorAll('li'));
        laptopPresetItem = items.find(item => item.textContent.includes('Laptop Box Label CZ'));
        logResult('Found "Laptop Box Label CZ" preset', !!laptopPresetItem);
        
        if (laptopPresetItem) {
            laptopPresetItem.click();
            console.log('Waiting for preset to load...');
            await wait(2000); // Wait for preset to load
        }
    }
    
    // 5. Check grid configuration
    console.log('\n%c5. Checking grid configuration...', 'color: blue; font-weight: bold');
    const columnCountInput = document.getElementById('columnCountValue');
    const customColumnsSection = document.getElementById('customColumnsSection');
    
    if (columnCountInput) {
        const columnCount = parseInt(columnCountInput.value);
        logResult('Column count', columnCount === 4, `(value: ${columnCount}, expected: 4)`);
    }
    
    if (customColumnsSection) {
        const isVisible = window.getComputedStyle(customColumnsSection).display !== 'none';
        logResult('Custom columns section visible', isVisible);
        
        if (isVisible) {
            const customColumnsList = document.getElementById('customColumnsList');
            if (customColumnsList) {
                const items = customColumnsList.children.length;
                logResult('Custom column items present', items > 0, `(${items} items)`);
                
                // Check for column 4 (fixed width)
                const col4Item = Array.from(customColumnsList.children).find(el => 
                    el.textContent.includes('Column 4') || el.querySelector('[data-column="4"]')
                );
                logResult('Column 4 (fixed) found in list', !!col4Item);
            }
        }
    }
    
    // 6. Find graphics elements on canvas
    console.log('\n%c6. Checking graphics elements on canvas...', 'color: blue; font-weight: bold');
    
    // Check for EAN-13 barcode
    const ean13Element = gridSvg.querySelector('[data-id="sticker-barcode"]') || 
                         gridSvg.querySelector('g[id*="barcode"]');
    logResult('EAN-13 barcode rendered', !!ean13Element);
    
    // Check for CZ Marks
    const czMarksElement = gridSvg.querySelector('[data-id="cz-marks"]') ||
                          gridSvg.querySelector('g[id*="cz-marks"]');
    logResult('CZ Marks rendered', !!czMarksElement);
    
    // 7. Check Elements Navigator
    console.log('\n%c7. Checking Elements Navigator...', 'color: blue; font-weight: bold');
    const elementsList = document.getElementById('elementsList');
    if (elementsList) {
        const items = Array.from(elementsList.querySelectorAll('.element-item'));
        logResult('Elements in navigator', items.length > 0, `(${items.length} elements)`);
        
        const ean13Item = items.find(el => el.textContent.includes('EAN-13') || el.textContent.includes('Barcode'));
        const czMarksItem = items.find(el => el.textContent.includes('CZ Marks'));
        
        logResult('EAN-13 in navigator', !!ean13Item);
        logResult('CZ Marks in navigator', !!czMarksItem);
        
        // 8. Try clicking EAN-13 to open settings
        if (ean13Item) {
            console.log('\n%c8. Opening EAN-13 barcode settings...', 'color: blue; font-weight: bold');
            ean13Item.click();
            await wait(500);
            
            const graphicsPanel = document.getElementById('graphicsPanel');
            const isPanelVisible = graphicsPanel && window.getComputedStyle(graphicsPanel).display !== 'none';
            logResult('Graphics panel opened', isPanelVisible);
            
            if (isPanelVisible) {
                // Check for Height and Width inputs
                const heightInput = document.getElementById('graphicsHeightInput');
                const widthInput = document.getElementById('graphicsWidthInput');
                
                logResult('Height input field exists', !!heightInput, 
                    heightInput ? `(value: ${heightInput.value})` : '');
                logResult('Width input field exists', !!widthInput,
                    widthInput ? `(value: ${widthInput.value})` : '');
                
                // Check if they're visible (not the old single size input)
                if (heightInput && widthInput) {
                    const heightVisible = window.getComputedStyle(heightInput.parentElement).display !== 'none';
                    const widthVisible = window.getComputedStyle(widthInput.parentElement).display !== 'none';
                    
                    logResult('Height input visible', heightVisible);
                    logResult('Width input visible', widthVisible);
                }
                
                // Check panel title
                const panelTitle = document.getElementById('graphicsPanelTitle');
                if (panelTitle) {
                    console.log(`   Panel title: "${panelTitle.textContent}"`);
                }
            }
        }
        
        // 9. Try clicking CZ Marks
        if (czMarksItem) {
            console.log('\n%c9. Opening CZ Marks settings...', 'color: blue; font-weight: bold');
            czMarksItem.click();
            await wait(500);
            
            const graphicsPanel = document.getElementById('graphicsPanel');
            const isPanelVisible = graphicsPanel && window.getComputedStyle(graphicsPanel).display !== 'none';
            logResult('Graphics panel opened for CZ Marks', isPanelVisible);
            
            if (isPanelVisible) {
                const heightInput = document.getElementById('graphicsHeightInput');
                const widthInput = document.getElementById('graphicsWidthInput');
                
                if (heightInput && widthInput) {
                    console.log(`   Height: ${heightInput.value}, Width: ${widthInput.value}`);
                }
            }
        }
    }
    
    // 10. Check console for errors
    console.log('\n%c10. Checking for JavaScript errors...', 'color: blue; font-weight: bold');
    console.log('(Check the Console tab above for any red error messages)');
    
    // 11. Final summary
    console.log('\n%c=== TEST COMPLETE ===', 'color: blue; font-size: 16px; font-weight: bold');
    console.log('%cPlease take a screenshot of this console output and the page.', 'color: orange; font-weight: bold');
    console.log('\n%cKey things to verify visually:', 'color: purple; font-weight: bold');
    console.log('- EAN-13 barcode should be in column 3 (third column from left)');
    console.log('- CZ Marks square should be in column 4 (rightmost column, the fixed width column)');
    console.log('- Both elements should be properly aligned within their columns');
    console.log('- Graphics panel should show separate Height and Width inputs (not a single Size input)');
    
})();
