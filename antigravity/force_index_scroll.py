
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/index.css'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target Block: The "NUCLEAR GRID FORCE" rule
# We want to change the selector and properties.

# Old Pattern to Match:
# .editor-wrapper[class*="manuscript"],
# .editor-wrapper[class*="grid"] {
#   display: grid !important;
#   /* Debug Grid: Simple Gray Lines */
#   background-image: ...
# }

# We will use a regex that matches the start of the rule and the background-image part.

pattern = r"""\.editor-wrapper\[class\*="manuscript"\],\s*\.editor-wrapper\[class\*="grid"\]\s*\{\s*display:\s*grid\s*!important;\s*/\*\s*Debug Grid: Simple Gray Lines\s*\*/\s*background-image:[\s\S]*?\}"""

# New Content:
# 1. New Rule for Textarea/Overlay (The Scrollers) -> Gets the BG
# 2. Updated Rule for Wrapper -> Logic Only (No BG)

new_css = """/* NUCLEAR GRID FORCE - Moved to Scrolling Elements */
.editor-wrapper[class*="manuscript"] textarea,
.editor-wrapper[class*="manuscript"] .highlight-overlay,
.editor-wrapper[class*="grid"] textarea,
.editor-wrapper[class*="grid"] .highlight-overlay {
  /* No display: grid here */
  background-image:
    repeating-linear-gradient(to right,
      transparent 0,
      transparent var(--editor-cell-pitch-px),
      rgba(0, 0, 0, 0.1) var(--editor-cell-pitch-px),
      rgba(0, 0, 0, 0.1) calc(var(--editor-cell-pitch-px) + 1px)),
    repeating-linear-gradient(to bottom,
      rgba(0, 0, 0, 0.1) 0,
      rgba(0, 0, 0, 0.1) 1px,
      transparent 1px,
      transparent var(--editor-row-height-px)) !important;
  background-size: auto auto !important;
  background-attachment: local !important;
  background-repeat: repeat !important;
}

/* Remove BG from Wrapper to avoid double grid */
.editor-wrapper[class*="manuscript"],
.editor-wrapper[class*="grid"] {
    background-image: none !important;
    display: grid !important; /* Keep layout stack */
}"""

# Attempt Match
match = re.search(pattern, content, re.MULTILINE)
if match:
    print("Found Target CSS Block. Replacing...")
    new_content = content.replace(match.group(0), new_css)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("CSS Updated Successfully.")
else:
    print("Target CSS Block not found via Regex. Falling back to simpler replacement.")
    # Fallback: Just look for the selector line and replace the whole chunk if it looks right
    search_str = '.editor-wrapper[class*="manuscript"],\n.editor-wrapper[class*="grid"] {'
    idx = content.find(search_str)
    if idx != -1:
        # Find closing brace
        end_idx = content.find('}', idx)
        if end_idx != -1:
             original = content[idx:end_idx+1]
             # Double check it contains background-image
             if "background-image" in original:
                 new_content = content.replace(original, new_css)
                 with open(file_path, 'w', encoding='utf-8') as f:
                     f.write(new_content)
                 print("CSS Updated via Substring.")
             else:
                 print("Found block but didn't contain background-image? Safety abort.")
        else:
             print("Could not find closing brace.")
    else:
        print("Could not find selector string.")

