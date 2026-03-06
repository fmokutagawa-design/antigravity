
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Metric Calculation Logic (approx lines 1380-1390)
# We want to maintain specific precision.
# Old: const fSizePx = fSizePt * 1.33333;
# New: Ensure we have explicit vars for everything.

# We'll rely on the existing logic but ensure it's exposed correctly.
# The previous snap logic replacement might have made this tricky to grep, so we'll look for the `const pxRowHeight` block.

# Logic to inject:
# const fSizePt = (typeof settings.fontSize === 'number') ? settings.fontSize : 16;
# const fSizePx = fSizePt * 1.333333333; // Higher precision
# const lhMultiplier = Number(settings.lineHeight) || 1.65;
# const pxLineHeight = fSizePx * lhMultiplier;
# const pxRowHeight = (settings.isVertical ? pxLineHeight : pxLineHeight); // Logic differs?
# // Vertical: RowHeight = Width of line = pxLineHeight. CellPitch = Height of char = fSizePx.
# // Horizontal: RowHeight = Height of line = pxLineHeight. CellPitch = Width of char = fSizePx.

# Actually, let's keep it simple:
# wrapper style touches lines 1395-1399 approx.

# Replacement for Wrapper Style Injection
# We need to find the `style={{` block of the `div className="editor-wrapper..."`

wrapper_regex = r"(<div[^>]*className=[^>]*editor-wrapper[^>]*style=\{\{)([\s\S]*?)(\}\})"

def wrapper_style_replacer(match):
    prefix = match.group(1)
    # inner = match.group(2) # We discard old styles to enforce new ones
    suffix = match.group(3)
    
    # New Style Body
    new_style = """
        '--editor-font-size': `${settings.fontSize}pt`,
        '--editor-font-size-px': `${fSizePx}px`, /* New Strict Var */
        '--editor-line-height-px': `${pxRowHeight}px`, /* Reusing RowHeight as LineHeight for parity? No. */
        '--strict-line-height': `${fSizePx * lhMultiplier}px`,
        '--editor-row-height-px': `${pxRowHeight}px`,
        '--editor-cell-pitch-px': `${pxCellPitch}px`,
        
        display: 'grid',
        /* Grid Structure */
        gridTemplateRows: settings.isVertical ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto',
        gridTemplateColumns: '100%',
        flex: 1,
        
        /* Force Centering & Sizing (Snap Logic applied via width, but here are defaults) */
        height: '100%',
        width: '100%',
        margin: '0 auto', /* Center it */
        
        /* Font Parity Defaults */
        fontKerning: 'none',
        fontVariantLigatures: 'none',
        minHeight: 0,
        overflow: 'hidden'
    """
    return prefix + new_style + suffix

# We also need to update the calculation variables BEFORE the return statement.
# Search for `const pxRowHeight = ...`

calc_regex = r"(const fSizePt =[\s\S]*?console\.log\('Editor Settings Render:.*?\);)"

def calc_replacer(match):
    # original = match.group(1)
    # We redefine strictly.
    return """
  const fSizePt = (typeof settings.fontSize === 'number') ? settings.fontSize : 16;
  // Use high precision conversion (1pt = 1.333333px)
  const fSizePx = fSizePt * (96 / 72); 
  const lhMultiplier = Number(settings.lineHeight) || 1.65;
  
  // Strict Metrics
  const pxLineHeight = fSizePx * lhMultiplier;
  const pxRowHeight = pxLineHeight; 
  const pxCellPitch = fSizePx;

  // Verify alignment in log
  console.log('DEBUG Strict Metrics:', { fSizePt, fSizePx, pxLineHeight });
  console.log('Editor Settings Render:', settings, 'isVertical:', settings.isVertical);
    """

# 2. Update Element Styles (HighlightOverlay and Textarea) to use PX variables
# AND Conditional Padding.

# We locate `// Padding Parity: Match Textarea exactly` ...
# Textarea Style Block
textarea_regex = r"(<textarea[^>]*style=\{\{)([\s\S]*?)(\}\})"

def textarea_style_replacer(match):
    prefix = match.group(1)
    body = match.group(2)
    suffix = match.group(3)
    
    # We replace specific lines in the body, or reconstruct. Reconstructing is safer given the mess.
    # But we need to preserve `...style` and `...dimStyle` and `zIndex`.
    
    # Let's use string replace on the body for keys.
    
    # 1. Font Size -> Strict
    body = re.sub(r"fontSize:\s*'var\(--editor-font-size\)',", "fontSize: 'var(--editor-font-size-px)',", body)
    
    # 2. Line Height -> Strict
    body = re.sub(r"lineHeight:\s*'var\(--editor-line-height\)',", "lineHeight: 'var(--strict-line-height)',", body)
    
    # 3. Padding -> Conditional
    # Logic: isGrid ? '0px' : undefined (or '10px' default?)
    # We can inject expression: padding: (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? '0px' : undefined,
    
    # Remove existing explicit padding lines
    body = re.sub(r"padding(Top|Bottom|Left|Right):\s*'0px',", "", body)
    body = re.sub(r"overflow:\s*'hidden',", "", body) # Remove to re-add cleanly
    
    # Append new unified layout props
    new_props = """
          // --- Layout Overrides (Strict Pixel Mode) ---
          fontSize: 'var(--editor-font-size-px)',
          lineHeight: 'var(--strict-line-height)',
          fontFamily: 'var(--editor-font-family)',
          
          letterSpacing: '0px',
          wordSpacing: '0px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'geometricPrecision',
          fontKerning: 'none',
          fontVariantLigatures: 'none',
          
          boxSizing: 'border-box',
          border: 'none',
          margin: '0',
          
          // Conditional Padding: 0px for Grid/Manuscript, Default (undefined) for Lined/Plain
          paddingTop: (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? '0px' : '10px',
          paddingBottom: (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? '0px' : '10px',
          paddingLeft: (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? '0px' : '10px',
          paddingRight: (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? '0px' : '10px',
          
          overflow: 'hidden',
    """
    
    # To avoid dupes, we might want to strip old metrics.
    # But regex replace above handled fontSize/lineHeight.
    # Just appending might shadow earlier props (JS object: last wins).
    
    return prefix + body + new_props + suffix

# HighlightOverlay Style Replacer (Logic is idential to Textarea basically)
overlay_regex = r"(// Strict Typography[\s\S]*?overflow:\s*'hidden', // DEBUG: FORCE PARITY)"

def overlay_replacer(match):
    # This matches the block inside the style={{ of HighlightOverlay
    # We replace it with the new strict props
    return """
            // Strict Typography & Layout
            fontSize: 'var(--editor-font-size-px)',
            lineHeight: 'var(--strict-line-height)',
            
            letterSpacing: '0px',
            wordSpacing: '0px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'geometricPrecision',
            fontKerning: 'none',
            fontVariantLigatures: 'none',

            boxSizing: 'border-box',
            border: 'none',
            margin: '0',
            
            paddingTop: (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? '0px' : '10px',
            paddingBottom: (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? '0px' : '10px',
            paddingLeft: (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? '0px' : '10px',
            paddingRight: (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? '0px' : '10px',
            
            overflow: 'hidden',
    """

# Execute Replacements
new_content = re.sub(calc_regex, calc_replacer, content, count=1)
new_content = re.sub(wrapper_regex, wrapper_style_replacer, new_content, count=1)
new_content = re.sub(textarea_regex, textarea_style_replacer, new_content, count=1)
# Note: Textarea replacement is 'last wins' strategy, appending to existing style body.
# For Overlay, we target a block to replace directly.
new_content = re.sub(overlay_regex, overlay_replacer, new_content, count=1)

if new_content != content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Editor.jsx Strict Metrics Refactor Applied.")
else:
    print("Regex matching failed. No changes applied.")
    # Debug info
    print("Match Calc:", bool(re.search(calc_regex, content)))
    print("Match Wrapper:", bool(re.search(wrapper_regex, content)))
    print("Match Textarea:", bool(re.search(textarea_regex, content)))

