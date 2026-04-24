
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Enable HighlightOverlay Globally (Remove condition)
# Pattern: {(settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') && (
# Replacement: {(true) && (   ... or just remove the check wrapper.
# Easier to replace the check with `{(true || settings.editorSyntaxColors !== false) && (`
# Actually, let's just make it render always (conditionally hidden by opacity if needed, but we want it visible).
# Existing code checks paperStyle.

overlay_pattern = r"\{\(settings.paperStyle === 'grid' \|\| settings.paperStyle === 'manuscript'\) && \("
overlay_replacement = r"{true && ("

content = re.sub(overlay_pattern, overlay_replacement, content)

# 2. Fix Textarea transparent-force (Global if colors enabled)
# Pattern: ${(settings.editorSyntaxColors !== false && (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript')) ? 'transparent-force' : ''}
# Replacement: ${settings.editorSyntaxColors !== false ? 'transparent-force' : ''}

textarea_pattern = r"\$\{\(settings\.editorSyntaxColors !== false && \(settings\.paperStyle === 'grid' \|\| settings\.paperStyle === 'manuscript'\)\) \? 'transparent-force' : ''\}"
textarea_replacement = r"${settings.editorSyntaxColors !== false ? 'transparent-force' : ''}"

content = re.sub(textarea_pattern, textarea_replacement, content)

# 3. Refine Background Logic for Manuscript and Vertical
# Manuscript: Use simple linear-gradient tiling like Grid. It is robust.
# Why did I use repeating? To avoid subpixel gaps?
# If pxCellPitch is 20.5, bgSize 20.5 40.
# Chrome handles this well usually.

# Target the `backgroundImage` IIFE block.
# We will rewrite the returned strings.

bg_logic_match = r"backgroundImage: \(\(\) => \{[\s\S]*?\}\)\(\),"

new_bg_logic = """backgroundImage: (() => {
        if (!settings.showGrid && settings.paperStyle !== 'manuscript') return 'none';
        if (settings.paperStyle === 'plain') return 'none';

        // Lined (University Notebook)
        if (settings.paperStyle === 'lined') {
            return settings.isVertical
                ? `linear-gradient(to left, ${lineColor} 1px, transparent 1px)` /* Vertical: Line on Right edge? or Left? "to left" starts right. */
                : `linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`;
        }
        
        // Grid & Manuscript (Unified Robust Logic)
        if (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') {
             // Standard Crosshatch
             // Vertical writers often want lines to align Top-Right.
             // But 'backgroundPosition' handles the start point.
             // Using simple gradients + repeat is safest.
             return `linear-gradient(to right, ${lineColor} 1px, transparent 1px), linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`;
        }
        
        return 'none';
    })(),"""

content = re.sub(bg_logic_match, new_bg_logic, content)

# 4. Refine Background Position & Size
# bgSize: Manuscript needs explicit size.
# bgPosition: Vertical needs 'right top'?
# Note: In `vertical-rl` mode, overflow expands to the LEFT. 
# But the element's origin (0,0) depends on browser.
# If we center the container (`margin: 0 auto`), we need to be careful.
# But for background inside the element, 0 0 is strictly top-left (usually).
# If writing-mode is vertical-rl, does 0 0 become top-right?
# In Chrome: No, `background-position: 0 0` is still top-left.
# BUT text starts at Top-Right.
# So we need `background-position: right top` (100% 0) for Vertical Lined to align with text start?
# Or we rely on `width` snapping? If width is snapped, Top-Left and Top-Right are integer multiples away.
# So Top-Left alignment SHOULD work if Width is exact multiple.
# User said "Vertical Lined" is invisible. 
# Maybe `linear-gradient(to right)` was drawing white on white? 
# I changed it to `to left` above.
# Also let's set `backgroundPosition` explicitly.

bg_size_match = r"backgroundSize: \(\(\) => \{[\s\S]*?\}\)\(\),"
new_bg_size = """backgroundSize: (() => {
        if (settings.paperStyle === 'lined') {
            return settings.isVertical ? `${pxRowHeight}px 100%` : `100% ${pxLineHeight}px`;
        }
        // Grid & Manuscript
        return `${pxCellPitch}px ${pxRowHeight}px`;
    })(),"""

content = re.sub(bg_size_match, new_bg_size, content)

# Position:
# backgroundPosition: (settings.paperStyle === 'lined' || settings.paperStyle === 'plain') ? (settings.isVertical ? 'right top' : '10px 10px') : '0 0'
# Let's try 'right top' for vertical lined validation.

bg_pos_match = r"backgroundPosition: \(settings.paperStyle === 'lined' \|\| settings.paperStyle === 'plain'\) \? '10px 10px' : '0 0'"
new_bg_pos = r"backgroundPosition: (settings.paperStyle === 'lined' || settings.paperStyle === 'plain') ? (settings.isVertical ? 'right top' : '10px 10px') : ((settings.isVertical && settings.paperStyle === 'manuscript') ? 'right 0' : '0 0')"
# Note: Manuscript Vertical also needs Right alignment if width is snapped? 
# If width is perfect multiple, Right=Left alignment.
# But let's anchor to Right just in case.

content = re.sub(bg_pos_match, new_bg_pos, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Visual Logic: Global Colors, Robust Manuscript Grid, Vertical Lined Fix.")

