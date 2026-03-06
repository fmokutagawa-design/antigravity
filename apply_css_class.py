
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Apply 'force-grid-background' class
# Logic: `className={...}`
# We need to add logic: 
# `(settings.paperStyle === 'manuscript' || settings.paperStyle === 'grid') && settings.showGrid ? 'force-grid-background' : ''`
# And also `settings.isVertical ? 'vertical-grid' : ''`

# Current className:
# className={`${settings.isVertical ? "vertical-editor" : "horizontal-editor"} ${settings.showGrid !== false ? 'grid-mode' : ''} ${(settings.editorSyntaxColors !== false ? 'transparent-force' : '')}`}
# (Note: I simplified the transparent-force logic in step 4133)

pattern_class = r"className=\{`\$\{settings\.isVertical \? \"vertical-editor\" : \"horizontal-editor\"\} \$\{settings\.showGrid !== false \? 'grid-mode' : ''\} \$\{settings\.editorSyntaxColors !== false \? 'transparent-force' : ''\}`\}"
# This regex might be fragile. Let's match by simpler context.

replacement_class = r"className={`${settings.isVertical ? "vertical-editor" : "horizontal-editor"} ${settings.showGrid !== false ? 'grid-mode' : ''} ${settings.editorSyntaxColors !== false ? 'transparent-force' : ''} ${(settings.paperStyle === 'manuscript' || settings.paperStyle === 'grid') && settings.showGrid ? ('force-grid-background ' + (settings.isVertical ? 'vertical-grid' : '')) : ''}`}"

# Find className line
class_regex = r"className=\{`\$\{settings\.isVertical.*"
if re.search(class_regex, content):
    content = re.sub(class_regex, replacement_class, content)
else:
    print("Could not find className to update. Checking simplified match...")
    # Try just replacing the whole `textarea` block Start tag?
    pass

# 2. Prevent Inline Background for Manuscript (to avoid conflict/double drawing, though CSS !important wins)
# In `backgroundImage` IIFE:
# if (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') { ... }
# We can leave it, CSS !important will override.
# But cleaner to return 'none' if we rely on CSS.
# Actually, keeping JS as fallback is okay, but user said JS wasn't working.
# Let's trust CSS.

# Remove the JS logic for Grid/Manuscript to avoid confusion?
# No, let's keep it but maybe comment it out or let CSS win.
# CSS has !important. It will win.

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied CSS Class logic to Editor.jsx")
