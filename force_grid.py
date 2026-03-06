
import os

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
injected = False

for line in lines:
    new_lines.append(line)
    # Target: '--editor-line-height': effectiveLineHeight,
    # We use strip() to ignore indentation differences.
    if "'--editor-line-height': effectiveLineHeight," in line and not injected:
        # Check if next line already has it to avoid dupes (though previous check said missing)
        # We blindly inject because we know it's missing from my view_file
        new_lines.append("        '--editor-row-height-px': `${pxRowHeight}px`,\n")
        new_lines.append("        '--editor-cell-pitch-px': `${pxCellPitch}px`,\n")
        injected = True
        print("Injected Grid Vars at line", len(new_lines))

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

if not injected:
    print("Warning: Target line not found!")
