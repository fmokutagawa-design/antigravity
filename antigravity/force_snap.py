
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the NEW snapResize logic
# We use fstrings in python but need to escape braces for JS
# This logic strictly sets WIDTH and HEIGHT to match grid multiples.

new_logic = r"""    const snapResize = () => {
      if (settings.paperStyle !== 'grid' && settings.paperStyle !== 'manuscript') return;

      const wrapper = wrapperRef.current;
      if (!wrapper || !wrapper.parentElement) return;

      requestAnimationFrame(() => {
        const parent = wrapper.parentElement;
        const parentRect = parent.getBoundingClientRect();
        const availW = parentRect.width;
        const availH = parentRect.height;

        const fSizePt = (typeof settings.fontSize === 'number') ? settings.fontSize : 16;
        const fSizePx = fSizePt * 1.33333; 
        const lhMultiplier = Number(settings.lineHeight) || 1.65;
        
        const pxRowHeight = (fSizePx * lhMultiplier) || 40;
        const pxCellPitch = fSizePx || 20;

        if (settings.isVertical) {
          // Vertical Mode: Snap WIDTH to multiple of pxRowHeight (Column Width)
          if (pxRowHeight <= 0) return;
          const cols = Math.floor(availW / pxRowHeight);
          const snapW = cols * pxRowHeight;
          wrapper.style.width = `${snapW}px`;
          wrapper.style.height = '100%'; 
        } else {
          // Horizontal Mode: Snap WIDTH to multiple of pxCellPitch (Char Width)
          if (pxCellPitch <= 0) return;
          const cols = Math.floor(availW / pxCellPitch);
          const snapW = cols * pxCellPitch;
          wrapper.style.width = `${snapW}px`;
          wrapper.style.height = '100%';
        }
      });
    };

    const observer = new ResizeObserver(snapResize);
    if (wrapperRef.current && wrapperRef.current.parentElement) {
       observer.observe(wrapperRef.current.parentElement);
    } else if (wrapperRef.current) {
       observer.observe(wrapperRef.current); // Fallback
    }"""

# Target Block to Replace
# We match from `const snapResize = () => {` down to `observer.observe(wrapper);` 
# This roughly covers lines 150 to 200.
# Since regex across many lines is risky with indentation, we'll try to match start and end markers.

start_marker = "const snapResize = () => {"
end_marker = "observer.observe(wrapper);"

# We need to capture everything between start and end inclusive
# pattern = r"const snapResize = \(\) => \{[\s\S]*?observer\.observe\(wrapper\);"
# Let's be slightly more specific to avoid over-matching.

pattern = re.compile(r"const snapResize = \(\) => \{[\s\S]*?observer\.observe\(wrapper\);", re.MULTILINE)

# Check if target exists
if pattern.search(content):
    new_content = pattern.sub(new_logic, content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully replaced snapResize logic.")
else:
    print("Could not find target block for snapResize replacement.")
    # Debug: Print a snippet where it should be
    idx = content.find("const snapResize = () => {")
    if idx != -1:
        print("Found start marker at index", idx)
        print("Snippet:", content[idx:idx+200])
    
