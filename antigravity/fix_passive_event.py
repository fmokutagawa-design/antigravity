
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove inline onWheel prop
# We added `onWheel={handleWheel}` in previous step.
content = content.replace("onWheel={handleWheel}", "")

# 2. Remove the old handleWheel function definition (to avoid confusion/unused vars)
# It looked like:
# const handleWheel = (e) => {
#     if (settings.isVertical) {
#         if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
#             e.preventDefault(); 
#             textareaRef.current.scrollLeft -= e.deltaY; 
#         }
#     }
# };

# Regex to remove it.
handle_wheel_regex = r"const handleWheel = \(e\) => \{[\s\S]*?\};"
content = re.sub(handle_wheel_regex, "", content)

# 3. Add useEffect for Non-Passive Listener
# We need to insert this useEffect. Best place: after `handleScroll`.
# We also need to be careful about `settings.isVertical` dependency.

use_effect_code = """
  // Non-passive wheel listener for vertical scroll mapping
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (settings.isVertical) {
        // If mostly vertical scroll, remap to horizontal
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          el.scrollLeft -= e.deltaY;
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [settings.isVertical]);
"""

# Insert after handleScroll definition
# Find handleScroll closing brace
idx = content.find("const handleScroll = (e) => {")
if idx != -1:
    end_idx = content.find("};", idx)
    if end_idx != -1:
        # Insert after the closing brace
        insert_pos = end_idx + 2
        content = content[:insert_pos] + use_effect_code + content[insert_pos:]
        print("Injected non-passive wheel listener.")
    else:
        print("Could not find end of handleScroll.")

# 4. Bump Line Color Opacity
# Find the definition `const lineColor = 'rgba(0, 0, 0, 0.25)';`
# Change to 0.5 for visibility check
content = content.replace("rgba(0, 0, 0, 0.25)", "rgba(0, 0, 0, 0.5)")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Passive Event Fix Applied. Opacity Bumped.")
