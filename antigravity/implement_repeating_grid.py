
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# REWRITE STRATEGY:
# 1. Calc pitch (w, h) inside the IIFE or pass them in?
#    The IIFE has access to scope variables `pxRowHeight`, `pxCellPitch`, `settings`.
# 2. Use `repeating-linear-gradient`.
# 3. Handle Padding Offset via `backgroundPosition`.

new_bg_logic_full = """    // Unified Background Logic with Repeating Gradients
    backgroundImage: (() => {
        const show = settings.showGrid || settings.paperStyle === 'manuscript';
        if (!show && settings.paperStyle !== 'manuscript') return 'none';
        if (settings.paperStyle === 'plain') return 'none';

        // Dimensions
        const w = settings.isVertical ? pxRowHeight : pxCellPitch;
        const h = settings.isVertical ? pxCellPitch : pxRowHeight;
        
        // Safety
        if (!w || !h || w <= 0 || h <= 0) return 'none';

        const color = 'rgba(0, 0, 255, 0.3)'; // Explicit Blue for Debugging Visibility

        if (settings.paperStyle === 'lined') {
             if (settings.isVertical) {
                 // Vertical Lined: Columns.
                 // Lines separate columns (width = w).
                 // Use `to right` (Vertical lines).
                 // Pitch = w.
                 return `repeating-linear-gradient(to right, ${color} 0, ${color} 1px, transparent 1px, transparent ${w}px)`;
             } else {
                 // Horizontal Lined: Rows.
                 // Lines separate rows (height = h).
                 // Use `to bottom` (Horizontal lines).
                 // Line at BOTTOM of row? 
                 //   Start: 0. End: h.
                 //   Draw line at h-1 to h?
                 //   Or line at 0? 
                 //   If text is on baseline, University notebooks usually have line at BOTTOM.
                 //   Let's try line at BOTTOM: `transparent 0, transparent ${h-1}px, ${color} ${h-1}px, ${color} ${h}px`
                 return `repeating-linear-gradient(to bottom, transparent 0, transparent ${h-1}px, ${color} ${h-1}px, ${color} ${h}px)`;
             }
        }

        if (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') {
             // Grid: Crosshatch.
             // Vertical Lines (Spacing w) + Horizontal Lines (Spacing h).
             
             const vertLines = `repeating-linear-gradient(to right, ${color} 0, ${color} 1px, transparent 1px, transparent ${w}px)`;
             const horizLines = `repeating-linear-gradient(to bottom, ${color} 0, ${color} 1px, transparent 1px, transparent ${h}px)`;
             
             return `${vertLines}, ${horizLines}`;
        }
        return 'none';
    })(),
    
    backgroundSize: 'auto', // Handled by repeating-gradient
    backgroundAttachment: 'local',
    backgroundRepeat: 'no-repeat', // Repeating gradient handles repeat
    
    // Position handling for Padding
    // If lined mode has 10px padding, text starts at 10px.
    // Vertical Lined: Line at 0 (Left). Text at 10. OK.
    // Horizontal Lined: Line at Bottom (h). Text baseline around h?
    //   If padding is 10px at TOP. First line should be at 10 + h? 
    //   Or does the first line appear at h (10px gap above it)?
    //   If I set bgPos to `0 ${paddingVal}px`?
    // Grid: text at (0,0) or (0,0) (no padding).
    
    backgroundPosition: (() => {
        const p = (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? 0 : 10;
        if (settings.paperStyle === 'lined' && !settings.isVertical) {
             // Horizontal Lined. Shift down by padding?
             // Actually, `local` attachment + `padding-box` origin (default) means (0,0) is Top-Left of Padding Box.
             // So (0,0) is where text starts.
             // If we want line at bottom of first line of text...
             // Text line height is h.
             // Gradient draws line at h.
             // So it's perfectly aligned with text bottom. 
             // No offset needed if we want line at bottom of row.
             return '0 0';
        }
        return '0 0';
    })(),"""

# Replace the block from `backgroundImage:` down to `backgroundPosition: .*?,`?
# Previous script steps replaced parts.
# Let's replace the whole chunk: `backgroundImage: .... backgroundPosition: ...`
# Start marker: `backgroundImage: (() => {`
# End marker: `backgroundPosition: '0 0', // Force Alignment` (from previous step 4241)

# Wait, regex is tricky if I don't know exact previous state.
# But I know I wrote: `backgroundPosition: '0 0', // Force Alignment` in Step 4241.
# And `backgroundImage` block starts with `const show =`.

# Let's just find `backgroundImage: (() => {` and cut until `zIndex: 1,` ends? 
# No, `backgroundImage` is inside `textareaStyle`.
# Let's replace the whole `backgroundImage` AND `backgroundSize` AND `backgroundPosition` keys.
# They are contiguous usually.

start_marker = "backgroundImage: (() => {"
# The end of the `textareaStyle` object is `  };`.
# But there might be other props? 
# In 4234 view: 
# backgroundImage...
# backgroundSize...
# backgroundRepeat...
# backgroundAttachment...
# backgroundPosition...
# };

# So we can replace from `backgroundImage` to the closing brace of `textareaStyle` (exclusive of brace).

end_marker = "  };"

start_idx = content.find(start_marker)
if start_idx != -1:
    end_idx = content.find(end_marker, start_idx)
    if end_idx != -1:
        # Construct the new block content
        # Note: the new block ends with `backgroundPosition: ... (),` -> comma.
        # We need to make sure we don't syntax error.
        
        replacement = new_bg_logic_full
        
        content = content[:start_idx] + replacement + "\n" + content[end_idx:]
        print("Replaced Full Background Logic with Repeating Gradients.")
    else:
        print("Could not find end of textareaStyle block.")
else:
    print("Could not find start of backgroundImage.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
