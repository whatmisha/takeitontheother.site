#!/bin/bash

# Quick script to update presets manifest
# Usage: ./UPDATE_PRESETS.sh

echo "🔄 Updating presets manifest..."

# Check if Python is available
if command -v python3 &> /dev/null; then
    python3 generate-presets-manifest.py
    echo "✅ Done! Refresh your browser to see updated presets."
elif command -v node &> /dev/null; then
    node generate-presets-manifest.js
    echo "✅ Done! Refresh your browser to see updated presets."
else
    echo "❌ Error: Neither Python nor Node.js found"
    echo "Please install Python 3 or Node.js to use this script"
    exit 1
fi
























