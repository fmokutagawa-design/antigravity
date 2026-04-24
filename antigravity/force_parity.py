
import os

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Props to inject for Strict Parity
parity_props = """
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'geometricPrecision',
            fontKerning: 'none',
            fontVariantLigatures: 'none',
"""

# Injection Targets:
# We look for "wordBreak: 'break-all'," in HighlightOverlay and Textarea and append props after it.
# We trust they are there because we just verified it.

if "wordBreak: 'break-all'," in content:
    new_content = content.replace("wordBreak: 'break-all',", "wordBreak: 'break-all'," + parity_props)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Injected Font Rendering Parity props to both occurrences.")
    else:
        print("Replacement failed somehow (string match issue?)")
else:
    print("Target 'wordBreak: break-all' not found! (Did previous step fail?)")
