
import os

css_path = '/Volumes/Black6T/antigravity/src/index.css'

with open(css_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the "ROBUST GRID FORCE" block
# It starts with "/* ROBUST GRID FORCE */"
# and ends at the end of the file or next block.

start_marker = "/* ROBUST GRID FORCE */"
if start_marker in content:
    parts = content.split(start_marker)
    # The first part is good. The second part contains the force rules.
    # We essentially want to drop the second part, but maybe there's something after?
    # View showed it was at the end of file (lines 1768+).
    # Step 4194 view confirmed it at end.
    
    new_content = parts[0]
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Removed ROBUST GRID FORCE from index.css")
else:
    print("Could not find ROBUST GRID FORCE block.")

# Also update Editor.jsx to use Green instead of Blue
jsx_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'
with open(jsx_path, 'r', encoding='utf-8') as f:
    jsx_content = f.read()

# Replace explicit Blue with standard Manuscript Green
# const color = 'rgba(0, 0, 255, 0.3)'; // Explicit Blue...
old_color = "const color = 'rgba(0, 0, 255, 0.3)';"
new_color = "const color = 'rgba(46, 139, 87, 0.4)'; // Manuscript Green"

if old_color in jsx_content:
    jsx_content = jsx_content.replace(old_color, new_color)
    with open(jsx_path, 'w', encoding='utf-8') as f:
        f.write(jsx_content)
    print("Updated Grid Color to Green.")
else:
    # Try loose match
    jsx_content = jsx_content.replace("rgba(0, 0, 255, 0.3)", "rgba(46, 139, 87, 0.4)")
    with open(jsx_path, 'w', encoding='utf-8') as f:
        f.write(jsx_content)
    print("Updated Grid Color (Loose match).")
