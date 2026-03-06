
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix Wrapper ClassName to include 'manuscript'
# Current: ${settings.paperStyle === 'grid' ? 'grid-mode' : ''} ${settings.paperStyle === 'lined' ? 'lined-mode' : ''}
# Need to add: ${settings.paperStyle === 'manuscript' ? 'manuscript-mode' : ''}

wrapper_pattern = r"(className=\{`editor-wrapper \$\{settings.isVertical \? 'vertical' : 'horizontal'\} \$\{settings.paperStyle === 'grid' \? 'grid-mode' : ''\} \$\{settings.paperStyle === 'lined' \? 'lined-mode' : ''\})"
wrapper_replacement = r"\1 ${settings.paperStyle === 'manuscript' ? 'manuscript-mode' : ''}"

# 2. Fix Textarea ClassName (Condition transparent-force)
# Current: ${settings.editorSyntaxColors !== false ? 'transparent-force' : ''}
# New: ${(settings.editorSyntaxColors !== false && (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript')) ? 'transparent-force' : ''}

textarea_pattern = r"\${settings.editorSyntaxColors !== false \? 'transparent-force' : ''}"
textarea_replacement = r"${(settings.editorSyntaxColors !== false && (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript')) ? 'transparent-force' : ''}"

# 3. Also fix HighlightOverlay rendering condition
# Encapsulate Overlay rendering to include 'manuscript'
overlay_render_pattern = r"\{settings.paperStyle === 'grid' && \("
overlay_render_replacement = r"{(settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') && ("

# Apply
new_content = content
new_content = re.sub(wrapper_pattern, wrapper_replacement, new_content)
new_content = re.sub(textarea_pattern, textarea_replacement, new_content)
new_content = re.sub(overlay_render_pattern, overlay_render_replacement, new_content)

if new_content != content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed Mode & Visibility Logic in Editor.jsx")
else:
    print("Regex match failed.")
    print("Wrapper Match:", bool(re.search(wrapper_pattern, content)))
    print("Textarea Match:", bool(re.search(textarea_pattern, content)))

