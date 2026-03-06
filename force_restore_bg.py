
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to add background logic to `textareaStyle`.
# Current:
#   const textareaStyle = {
#     ...parityStyle,
#     overflow: 'auto', // Allow scroll
#     ...
#     background: 'transparent', 
#     ...
#   };

# We want to replace `background: 'transparent',` with logic that generates the gradient if needed.
# But `textareaStyle` is defined OUTSIDE the return? 
# Wait, in my reconstruction, `textareaStyle` is defined using `settings` and `pxLineHeight`?
# Yes, because `Editor` is a functional component, these variables are in scope.

# Logic to inject:
# const lineColor = settings.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
# ...
# And inside textareaStyle:
# ...(settings.paperStyle !== 'manuscript' ? {
#     backgroundImage: settings.showGrid
#       ? (settings.paperStyle === 'lined'
#          // Lined Mode: Horizontal lines only (or Vertical columns in vertical mode)
#          ? (settings.isVertical 
#               ? `linear-gradient(to right, ${lineColor} 1px, transparent 1px)` // Vertical: Columns
#               : `linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)` // Horizontal: Rows
#            )
#          // Grid Mode (Simple): Crosshatch
#          : `linear-gradient(to right, ${lineColor} 1px, transparent 1px), linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`
#       )
#       : 'none',
#     backgroundSize: (settings.paperStyle === 'lined'
#         ? (settings.isVertical
#             ? `${pxRowHeight}px 100%` // Vertical Cols
#             : `100% ${pxLineHeight}px` // Horizontal Rows
#           )
#         : `${pxCellPitch}px ${pxRowHeight}px` // Grid
#     ),
#     backgroundAttachment: 'local',
#     backgroundRepeat: 'repeat',
#     backgroundPosition: 'top left' // Standardize
# } : {}),

# Let's locate `const textareaStyle = {`
# And inject `const lineColor` before it.

pattern_start = r"const textareaStyle = \{"

# Helper vars
helper_vars = """
  const lineColor = 'rgba(0, 0, 0, 0.1)'; // Simple default, or check dark mode settings if available?
  // User didn't specify dark mode logic in recent checks, assume light or transparent overlay.
  // Original code had `lineColor`, let's define it safely.
"""

# Injection into the object
# We'll replace the `background: 'transparent',` line with the complex spread.
# But wait, `background` logic usually overrides `backgroundColor`.
# We should set `backgroundColor: 'transparent'` explicitly and then spread BG Image.

target_bg = r"background: 'transparent', // Grid is on textarea background via CSS now\? Or Wrapper\?"

replacement_bg = r"""
    backgroundColor: 'transparent',
    ...(settings.paperStyle !== 'manuscript' ? {
        backgroundImage: settings.showGrid
          ? (settings.paperStyle === 'lined'
             ? (settings.isVertical 
                 ? `linear-gradient(to right, ${lineColor} 1px, transparent 1px)`
                 : `linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`
               )
             : `linear-gradient(to right, ${lineColor} 1px, transparent 1px), linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`
          )
          : 'none',
        backgroundSize: (settings.paperStyle === 'lined'
            ? (settings.isVertical
                ? `${pxRowHeight}px 100%`
                : `100% ${pxLineHeight}px`
              )
            : `${pxCellPitch}px ${pxRowHeight}px` 
        ),
        backgroundAttachment: 'local',
        backgroundRepeat: 'repeat',
        backgroundPosition: '0 0'
    } : {}),
"""

# Apply
# 1. Insert lineColor definition
content = re.sub(pattern_start, helper_vars + "\n" + pattern_start, content)

# 2. Replace background property
# Note: Regex might fail if comments or spacing differ. Capture strictly.
# The previous `view_file` showed:
# 200:     background: 'transparent', // Grid is on textarea background via CSS now? Or Wrapper?
# We'll use a relaxed match.

bg_regex = r"background: 'transparent',.*"
content = re.sub(bg_regex, replacement_bg, content)

if "backgroundImage" in content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Restored Background Logic for Lined/Grid modes.")
else:
    print("Failed to inject Background Logic.")

