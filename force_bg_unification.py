
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to replace the `textareaStyle` definition block again.
# We will construct a robust logic that handles all 3 modes + Plain.

# Current:
# const textareaStyle = {
#     ...parityStyle,
#     ...
#     backgroundColor: 'transparent',
#     ...(settings.paperStyle !== 'manuscript' ? { ... } : {}),
# };

# New Logic:
# 1. Padding Vars:
#    const padTop = (settings.paperStyle === 'plain' || settings.paperStyle === 'lined') ? 10 : 0;
#    const padLeft = (settings.paperStyle === 'plain' || settings.paperStyle === 'lined') ? 10 : 0;
#    (We need to sync this with the `padding:` prop in `parityStyle`)

# 2. Background Logic switch:
#    Plain -> None
#    Lined -> Lines (Horizontal/Vertical)
#    Grid -> Crosshatch
#    Manuscript -> Repeating Gradient (Box)

target_start = r"const textareaStyle = \{"
target_end = r"\};"

# We'll use a Regex to match the whole block approximately, 
# but simply replacing the `backgroundColor` and subsequent spread is safer if we can target it.

# Let's verify what `parityStyle` has for padding first.
# In `Editor.jsx` (from memory/reconstruction):
# padding: (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? '0px' : '10px',
# This means: Grid/Manuscript = 0px. Plain/Lined = 10px.

# So for Lined Mode, we have 10px Padding.
# For Manuscript Mode, we have 0px Padding.

# Replacement Logic String:
new_bg_logic = r"""
    backgroundColor: 'transparent',
    // Unified Background Logic (Inline)
    backgroundImage: (() => {
        if (!settings.showGrid && settings.paperStyle !== 'manuscript') return 'none'; // Respect toggle for non-manuscript
        if (settings.paperStyle === 'plain') return 'none'; // Force none for plain

        if (settings.paperStyle === 'lined') {
            return settings.isVertical
                ? `linear-gradient(to right, ${lineColor} 1px, transparent 1px)`
                : `linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`;
        }
        if (settings.paperStyle === 'grid') {
             return `linear-gradient(to right, ${lineColor} 1px, transparent 1px), linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`;
        }
        if (settings.paperStyle === 'manuscript') {
             // Complex Manuscript Gradient
             // Right-to-Left (Vertical)
             if (settings.isVertical) {
                 // Vertical Manuscript: Cols (RowHeight) + Rows (CellPitch)
                 // Note: Gradient syntax for RL might need flip?
                 // Standard grid:
                 return `repeating-linear-gradient(to right, transparent 0, transparent ${pxRowHeight-1}px, ${lineColor} ${pxRowHeight-1}px, ${lineColor} ${pxRowHeight}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${pxCellPitch-1}px, ${lineColor} ${pxCellPitch-1}px, ${lineColor} ${pxCellPitch}px)`;
             } else {
                 // Horizontal Manuscript
                 return `repeating-linear-gradient(to right, transparent 0, transparent ${pxCellPitch-1}px, ${lineColor} ${pxCellPitch-1}px, ${lineColor} ${pxCellPitch}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${pxRowHeight-1}px, ${lineColor} ${pxRowHeight-1}px, ${lineColor} ${pxRowHeight}px)`;
             }
        }
        return 'none';
    })(),
    backgroundSize: (() => {
        if (settings.paperStyle === 'lined') {
            return settings.isVertical ? `${pxRowHeight}px 100%` : `100% ${pxLineHeight}px`;
        }
        if (settings.paperStyle === 'grid') {
            return `${pxCellPitch}px ${pxRowHeight}px`;
        }
        if (settings.paperStyle === 'manuscript') {
             // Repeating Gradient handles size itself, but auto is safe
             return 'auto auto'; 
        }
        return 'auto';
    })(),
    backgroundAttachment: 'local',
    backgroundRepeat: 'repeat',
    // Fix Alignment for Lined/Plain Padding (10px)
    backgroundPosition: (settings.paperStyle === 'lined' || settings.paperStyle === 'plain') ? '10px 10px' : '0 0'
"""

# Pattern to replace:
# matches `backgroundColor: 'transparent',` and everything until the end of the object logic (before `};`).
# We assume the previous code ended with `} : {}),` or similar.

pattern = r"backgroundColor: 'transparent',[\s\S]*?\}\s*:\s*\{\}\),"

# Check if pattern matches
if re.search(pattern, content):
    new_content = re.sub(pattern, new_bg_logic, content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Unified Background Logic Applied successfully.")
else:
    print("Could not find Background Logic block to replace.")
    # Debug: print the area around backgroundColor
    idx = content.find("backgroundColor: 'transparent'")
    if idx != -1:
        print("Context:", content[idx:idx+300])

