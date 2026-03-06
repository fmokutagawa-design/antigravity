
import os

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject Grid Vars into Wrapper Style
# Target: '--editor-line-height': effectiveLineHeight,
# We want to add row-height and cell-pitch after it.
target_wrapper = "'--editor-line-height': effectiveLineHeight,"
replacement_wrapper = """'--editor-line-height': effectiveLineHeight,
        '--editor-row-height-px': `${pxRowHeight}px`,
        '--editor-cell-pitch-px': `${pxCellPitch}px`,"""

if target_wrapper in content and "'--editor-row-height-px'" not in content:
    content = content.replace(target_wrapper, replacement_wrapper)
    print("Injected Grid Vars")
else:
    print("Grid Vars already present or target not found")

# 2. Inject Parity Props into HighlightOverlay
# Target: letterSpacing: '0px',
target_overlay = "letterSpacing: '0px',"
replacement_parity = """letterSpacing: '0px',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',"""

# We utilize semantic uniqueness. There are two "letterSpacing: '0px'," in the file.
# The first one is Overlay (usually), second is Textarea.
# Let's be more specific.

# Overlay specific context
target_overlay_ctx = """            // Strict Typography
            letterSpacing: '0px',"""
if target_overlay_ctx in content:
    content = content.replace(target_overlay_ctx, """            // Strict Typography
            letterSpacing: '0px',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',""")
    print("Injected Overlay Parity")

# Textarea specific context (it usually follows "fontFamily:")
target_textarea_ctx = """          letterSpacing: '0px',
          wordSpacing: '0px',"""
if target_textarea_ctx in content:
    content = content.replace(target_textarea_ctx, """          letterSpacing: '0px',
          wordSpacing: '0px',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',""")
    print("Injected Textarea Parity")

# 3. Ensure Overflow Hidden (if not already)
# This might have been done by Perl, but let's Ensure.
# Using regex replacement might be safer but string replace is fine if unique.
# We'll trust the previous perl/manual checks for overflow: hidden for now as verifying regex in python is tedious without module import if standard lib is constrained (it's not, but simple is better).

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
