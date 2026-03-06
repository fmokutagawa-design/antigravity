
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject Debug Overlay with specific labels (FS, LH, Pad, DPR)
# We will replace the existing debug overlay (if any) or insert it.
# Search for the specific style block of the overlay (z-index 9999)

debug_regex = r"<div style=\{\{\s*position: 'absolute', bottom: 0, right: 0,[\s\S]*?</div>"
new_debug_overlay = """<div style={{
          position: 'absolute', bottom: 0, right: 0, 
          background: 'rgba(0,0,0,0.85)', color: '#0f0', 
          fontSize: '12px', fontFamily: 'monospace', pointerEvents: 'none', zIndex: 9999, padding: '4px 8px',
          textAlign: 'right', borderTopLeftRadius: '4px'
      }}>
        FS: {pxCellPitch} | LH: {pxRowHeight}<br/>
        Pad: {paddingVal} | DPR: {window.devicePixelRatio}<br/>
        Mode: {settings.paperStyle} ({settings.isVertical ? 'V' : 'H'})
      </div>"""

if re.search(debug_regex, content):
    content = re.sub(debug_regex, new_debug_overlay, content)
    print("Replaced existing debug overlay.")
else:
    # Insert before the last closing div
    last_div_idx = content.rfind("    </div>")
    if last_div_idx != -1:
        content = content[:last_div_idx] + new_debug_overlay + "\n" + content[last_div_idx:]
        print("Inserted new debug overlay.")

# 2. Fix Text Crossing Lines (Lined Mode)
# "Lines cross the text" -> Line rendering position is wrong relative to text.
# Horizontal: text is drawn approx 1em down? 
# If `to top` draws line at bottom (0% from bottom), and text is baseline, it should be fine.
# UNLESS `to top` draws line at TOP?
# MDN: `to top` = Gradient goes upwards. Starts at Bottom. 
# `color 1px, transparent 1px` -> 0px to 1px is Color. So Bottom 1px is Color.
# This should be correct for "Underline" style.
# If it crosses text, maybe the row height is too short? Or padding is shifting text DOWN onto the next line's grid?

# Let's try `backgroundPosition: '0 0'` and ensure padding handles the text offset.
# In `fix_alignment_debug.py` (Step 4220), I set `backgroundPosition: ${paddingVal}px ${paddingVal}px`.
# If padding pushes text IN, and background pushes grid IN... they move together. 
# BUT `background-origin` defaults to padding-box. So background starts at padding edge (0,0) usually means Top-Left of padding box.
# If I add `background-position`, I shift it FURTHER.
# Wait. `background-origin` default is `padding-box`.
# If I have `padding: 10px`. Text starts at (10, 10).
# Background at (0,0) starts at (0,0) of padding box? Or border box?
# Standard: `padding-box`. So (0,0) is top-left of padding area (where content starts).
# So Grid matches Text.
# IF I add `backgroundPosition: 10px 10px`, I shift the grid 10px Right/Down relative to content.
# So Text is at (10,10) (relative to border), Grid starts at (10+10, 10+10)? 
# NO. `background-position` is relative to the `background-origin`.
# If `origin` is padding-box (default), (0,0) is where text *would* start (ignoring text indent/line height offset).
# So `0 0` should align Grid with Text Area.
# Setting it to `paddingVal` might be DOUBLE shifting if I'm not careful.
# Let's revert `backgroundPosition` to `0 0`? 
# Or maybe the user WANTS the frame?
# If I use `padding: 0` for Manuscript, position `0 0` is correct.
# If I use `padding: 10px` for Lined, position `0 0` aligns lines with text content area.
# Let's force `0 0` for Position.

# Updated textareaStyle logic helper (inline replacement for specific keys)
# Find `backgroundPosition: \`.*?\,`
bg_pos_regex = r"backgroundPosition: `.*?`,"
content = re.sub(bg_pos_regex, "backgroundPosition: '0 0', // Force Alignment", content)


# 3. Fix Manuscript Grid Visibility
# Previously I "flipped" dimensions.
# But "Invisible" suggests maybe the gradient string is invalid or color is too faint?
# The user complained about "No lines".
# I will make the color VERY obvious (e.g. `rgba(0, 0, 255, 0.2)` -> Blueish) just to verify it renders.
# And ensure both Horizontal and Vertical logic is sound.

# Re-evaluating Gradient Logic for Vertical Manuscript:
# Vertical Text: Characters go Top->Bottom. Lines go Right->Left.
# We want a Grid.
# Horizontal Lines (separating characters in a column):
#   - Spaced by `pxCellPitch`.
#   - Direction: `to bottom` (repeats vertically).
# Vertical Lines (separating columns):
#   - Spaced by `pxRowHeight`.
#   - Direction: `to right` (repeats horizontally) OR `to left`.
#   - Since columns stack Right-to-Left, maybe `to left`? 
#   - `background-repeat` doesn't care about R-L. It just tiles. 
#   - Layout is handled by `backgroundSize`.

# Update `backgroundImage` logic block
# We will use explicit logic again.

bg_image_block = """    backgroundImage: (() => {
        const show = settings.showGrid || settings.paperStyle === 'manuscript';
        if (!show && settings.paperStyle !== 'manuscript') return 'none';
        if (settings.paperStyle === 'plain') return 'none';

        const color = 'rgba(0, 0, 0, 0.4)'; // Explicit Visibility

        if (settings.paperStyle === 'lined') {
             if (settings.isVertical) {
                 // Vertical Lined: Columns. Lines separate columns.
                 // Draw line on LEFT of column (to right 1px) or RIGHT (to left 1px)?
                 // For Vertical-RL, columns flow right to left.
                 // A line on the 'right' (start) or 'left' (end) of the column?
                 // Standard Japanese paper: Lines between columns.
                 // Let's use `to right` (Left side of 1px) with repeat. 
                 // If backgroundSize width matches column width, it draws a line every column.
                 return `linear-gradient(to right, ${color} 1px, transparent 1px)`;
             } else {
                 // Horizontal Lined: Rows. Line at bottom.
                 return `linear-gradient(to top, ${color} 1px, transparent 1px)`;
             }
        }

        if (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') {
             // Grid: Crosshatch.
             // We need lines in both directions.
             // Direction 1: Vertical Lines (separating columns). Spacing = RowHeight (Width).
             // Direction 2: Horizontal Lines (separating chars). Spacing = CellPitch (Height).
             
             // In CSS Gradient:
             // `linear-gradient(to right...)` creates Vertical lines.
             // `linear-gradient(to bottom...)` creates Horizontal lines.
             
             // This logic applies regardless of Writing Mode IF keying off screen X/Y.
             // Backgrounds are screen coordinates.
             // So: `to right` = Vertical Lines. `to bottom` = Horizontal Lines.
             
             return `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`;
        }
        return 'none';
    })(),"""

# Replace the backgroundImage block using the same markers as before
start_marker = "backgroundImage: (() => {"
end_marker = "})(),"
start_idx = content.find(start_marker)
if start_idx != -1:
    end_idx = content.find(end_marker, start_idx)
    if end_idx != -1:
        # Check integrity
        segment = content[start_idx:end_idx]
        if "const show =" in segment:
             content = content[:start_idx] + bg_image_block + content[end_idx + len(end_marker):]
             print("Reset Background Gradient Logic to Standard Screen Coordinates.")

# 4. Fix Background Size Logic
# Vertical Mode: 
#   - Width (Horizontal) = `pxRowHeight` (Column Width)
#   - Height (Vertical) = `pxCellPitch` (Char Height)
# Horizontal Mode:
#   - Width = `pxCellPitch` (Char Width)
#   - Height = `pxRowHeight` (Line Height)

bg_size_block = """    backgroundSize: (() => {
        // SCALING
        const w = settings.isVertical ? pxRowHeight : pxCellPitch;
        const h = settings.isVertical ? pxCellPitch : pxRowHeight;
        
        // Ensure valid pixels
        if (!w || !h) return 'auto auto';

        if (settings.paperStyle === 'lined') {
            return settings.isVertical 
                ? `${w}px 100%` 
                : `100% ${h}px`;
        }
        return `${w}px ${h}px`;
    })(),"""

# Replace backgroundSize block
size_start = "backgroundSize: (() => {"
size_end = "})(),"
start_idx_mb = content.find(size_start)
if start_idx_mb != -1:
    end_idx_mb = content.find(size_end, start_idx_mb)
    if end_idx_mb != -1:
         content = content[:start_idx_mb] + bg_size_block + content[end_idx_mb + len(size_end):]
         print("Reset Background Size Logic.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
