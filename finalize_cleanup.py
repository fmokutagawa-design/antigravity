
import os
import re

# 1. Clean up index.css
css_path = '/Volumes/Black6T/antigravity/src/index.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

# Remove the NUCLEAR GRID FORCE block entirely.
# Matches from /* NUCLEAR GRID FORCE */ down to before /* SCROLLBAR PARITY ENFORCEMENT */ or end of block.
# We'll just remove the specific rules we added.

# Pattern 1: The big block with background-image !important
# Pattern 2: The wrapper removal block
# We'll try to match by comment landmarks.

nuclear_start = "/* NUCLEAR GRID FORCE */"
scroll_parity_start = "/* SCROLLBAR PARITY ENFORCEMENT */"

start_idx = css_content.find(nuclear_start)
end_idx = css_content.find(scroll_parity_start)

if start_idx != -1 and end_idx != -1:
    new_css = css_content[:start_idx] + "\n\n" + css_content[end_idx:]
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(new_css)
    print("Changes applied to index.css: Removed NUCLEAR GRID FORCE.")
else:
    print("Could not find CSS blocks to remove. Checking regex fallback.")
    # Fallback: remove lines containing 'repeating-linear-gradient' AND '!important' inside the wrapper rules?
    # Simpler: The user complained about scroll. The CSS forces layout.
    # Let's try to just blank out the problematic section if found.
    if start_idx != -1:
         # Just cut until end of file? No. 
         pass

# 2. Bump Line Color in Editor.jsx
jsx_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'
with open(jsx_path, 'r', encoding='utf-8') as f:
    jsx_content = f.read()

# Replace alpha 0.1 with 0.25 for better visibility
old_color = "const lineColor = 'rgba(0, 0, 0, 0.1)';"
new_color = "const lineColor = 'rgba(0, 0, 0, 0.25)';"

if old_color in jsx_content:
    new_jsx = jsx_content.replace(old_color, new_color)
    with open(jsx_path, 'w', encoding='utf-8') as f:
        f.write(new_jsx)
    print("Bumped Grid Intensity in Editor.jsx")
else:
    print("Could not find lineColor definition to update.")

