
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to locate the backgroundImage IIFE
# We look for "const show =" inside the IIFE or "backgroundImage: (() => {"

# We will replace the entire IIFE body content related to Lined/Grid.
# Current code check (from Step 4216 view):
#         if (settings.paperStyle === 'lined') {
#              if (settings.isVertical) {
#                  return `linear-gradient(to right, ${color} 1px, transparent 1px)`;
#              } else {
#                  return `linear-gradient(to top, ${color} 1px, transparent 1px)`;
#              }
#         }

# Proposed Logic (Flipped for Vertical):
# Vertical Lined: Needs Vertical Lines. 
#   If `to right` gave Horizontal, then `to bottom` (or `to top`) should give Vertical.
#   Let's try: `linear-gradient(to bottom, ${color} 1px, transparent 1px)` for Vertical Lined.
# Horizontal Lined: `to top` gave Horizontal lines (at bottom). Correct.

# Manuscript/Grid:
#   Currently: `to right` + `to top` (using combined logic from lined).
#   If `to right` is Horizontal in Vertical Mode, then we need `to bottom` for vertical lines.
#   And `to right` for horizontal lines?
#   So: `linear-gradient(to bottom, ...), linear-gradient(to right, ...)`

new_bg_logic = """    backgroundImage: (() => {
        const show = settings.showGrid || settings.paperStyle === 'manuscript';
        if (!show && settings.paperStyle !== 'manuscript') return 'none';
        if (settings.paperStyle === 'plain') return 'none';

        const color = 'rgba(0, 0, 0, 0.5)';

        if (settings.paperStyle === 'lined') {
             if (settings.isVertical) {
                 // Vertical Mode: 'to bottom' seems to be required for Vertical Lines if context is rotated
                 // adjusting to 'to bottom' to test rotation hypothesis.
                 return `linear-gradient(to bottom, ${color} 1px, transparent 1px)`; 
             } else {
                 // Horizontal Mode: 'to top' for baseline emphasis
                 return `linear-gradient(to top, ${color} 1px, transparent 1px)`;
             }
        }

        if (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') {
             if (settings.isVertical) {
                 // Vertical Mode: Grid
                 // Vertical Lines (Cols) -> `to bottom` (?)
                 // Horizontal Lines (Rows) -> `to right` (?)
                 return `linear-gradient(to bottom, ${color} 1px, transparent 1px), linear-gradient(to right, ${color} 1px, transparent 1px)`;
             } else {
                 // Horizontal Mode: Grid
                 // Vertical Lines -> `to right`
                 // Horizontal Lines -> `to top`
                 return `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to top, ${color} 1px, transparent 1px)`;
             }
        }
        return 'none';
    })(),"""

# Locate the block to replace.
# We can search for `backgroundImage: (() => {` ... up to `})(),`.
# But regex matching potentially nested braces is hard.
# We'll use the unique start string and a known end string inside the block.

# Start: `backgroundImage: (() => {`
# End: `})(),`
# Inside: `const show = settings.showGrid`

start_marker = "backgroundImage: (() => {"
end_marker = "})(),"

start_idx = content.find(start_marker)
if start_idx != -1:
    # Find the matching closing `})(),` after start
    end_idx = content.find(end_marker, start_idx)
    if end_idx != -1:
        # Check if "const show =" is inside to be sure
        segment = content[start_idx:end_idx]
        if "const show =" in segment:
            # Replace
            content = content[:start_idx] + new_bg_logic + content[end_idx + len(end_marker):]
            print("Swapped Gradient Directions for Vertical Mode.")
        else:
            print("Found block but content mismatch.")
    else:
        print("End marker not found.")
else:
    print("Start marker not found.")

# Update file
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
