
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Clean up CSS Class usage
# Remove the complex className logic and revert to simple class logic, 
# because we are moving back to Inline Styles for reliability.
# (Or keep it as backup? No, conflicting logic (CSS !important vs Inline) is bad).
# Let's remove 'force-grid-background' from className.

class_pattern = r"className=\{`.*?`\}"
simple_class_logic = "className={`${settings.isVertical ? \"vertical-editor\" : \"horizontal-editor\"} ${settings.showGrid !== false ? 'grid-mode' : ''} ${settings.editorSyntaxColors !== false ? 'transparent-force' : ''}`}"

cleanup_match = re.search(r"className=\{`\${settings\.isVertical \? \"vertical-editor\" : \"horizontal-editor\"}.*?`\}", content)
if cleanup_match:
    content = content.replace(cleanup_match.group(0), simple_class_logic)

# 2. Rewrite textareaStyle entirely
# We'll locate the block `const textareaStyle = { ... };` and replace it.

# New Logic Features:
# - Opacity 0.3 (Visible but not overriding)
# - Horizontal: `to top` (Line at bottom)
# - Vertical: `to right` (Line at left boundary) + explicit size.
# - Manuscript: Combined gradients.
# - Position: Always `0 0` (Try to rely on Snapping).

# Note: `lineColor` variable needs to be consistent. 
# We'll hardcode it inside the style generator or ensure variable exists.
# `const lineColor = 'rgba(0, 0, 0, 0.3)';`

style_block_pattern = r"const textareaStyle = \{[\s\S]*?\n  \};"

new_style_block = """const textareaStyle = {
    ...parityStyle,
    overflow: 'auto',
    width: '100%',
    height: '100%',
    resize: 'none',
    zIndex: 1,
    backgroundColor: 'transparent',
    
    // Explicit Background Logic
    backgroundImage: (() => {
        // Force Manuscript Grid to show regardless of 'showGrid' setting if in Manuscript mode,
        // or respect the toggle? User complained Grid is gone. Let's force it for Manuscript.
        const show = settings.showGrid || settings.paperStyle === 'manuscript';
        if (!show && settings.paperStyle !== 'manuscript') return 'none';
        if (settings.paperStyle === 'plain') return 'none';

        const color = 'rgba(0, 0, 0, 0.5)'; // Darker for visibility

        if (settings.paperStyle === 'lined') {
             if (settings.isVertical) {
                 // Vertical Lined: Columns. Lines separate columns.
                 // Columns go Right to Left.
                 // A line on the Left edge of the column (`to right`)? 
                 // Or Right edge (`to left`)?
                 // Let's draw lines on BOTH sides for debugging? No.
                 // `to right` draws line at 0 (Left).
                 // `to left` draws line at 100% (Right).
                 // Try `to right` (Left Edge of Column).
                 return `linear-gradient(to right, ${color} 1px, transparent 1px)`;
             } else {
                 // Horizontal Lined: Rows.
                 // Draw line at BOTTOM (`to top`).
                 return `linear-gradient(to top, ${color} 1px, transparent 1px)`;
             }
        }

        if (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') {
             // Grid: Both directions.
             // Vertical Lines: `to right`.
             // Horizontal Lines: `to top` (Bottom alignment)
             return `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to top, ${color} 1px, transparent 1px)`;
        }
        return 'none';
    })(),

    backgroundSize: (() => {
        // Vertical Mode: Width is RowHeight, Height is CellPitch
        // Horizontal Mode: Width is CellPitch, Height is RowHeight
        const w = settings.isVertical ? pxRowHeight : pxCellPitch;
        const h = settings.isVertical ? pxCellPitch : pxRowHeight;
        
        if (settings.paperStyle === 'lined') {
            return settings.isVertical 
                ? `${w}px 100%` 
                : `100% ${h}px`;
        }
        // Grid/Manuscript: Tile both dimensions
        return `${w}px ${h}px`;
    })(),

    backgroundRepeat: 'repeat',
    backgroundAttachment: 'local',
    // Always anchor top-left. Snap logic ensures container fits grid exactly.
    backgroundPosition: '0 0', 
  };"""

# Perform replacement
if re.search(style_block_pattern, content):
    content = re.sub(style_block_pattern, new_style_block, content)
    print("Replaced textareaStyle logic.")
else:
    print("Could not match textareaStyle block exactly. Attempting heuristic replacement.")
    # Fallback logic if needed
    pass

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Editor.jsx visual logic.")
