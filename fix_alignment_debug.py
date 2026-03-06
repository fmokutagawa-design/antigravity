
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Padding Logic for clarity (It's already there in parityStyle, let's reuse it or extract it)
# In text area, we access parityStyle.padding directly?
# parityStyle.padding is defined as expression.
# Let's extract `paddingVal` into a const before parityStyle.

# Pattern: `const parityStyle = {`
# We want to insert `const paddingVal = (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? 0 : 10;` before it.
# And update `parityStyle` to use `paddingVal + 'px'`.

if "const paddingVal =" not in content:
    parity_start = content.find("const parityStyle = {")
    if parity_start != -1:
        padding_logic = "  const paddingVal = (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? 0 : 10;\n"
        content = content[:parity_start] + padding_logic + content[parity_start:]
        
        # Replace padding line in parityStyle
        # padding: (settings.paperStyle === 'grid' || settings.paperStyle === 'manuscript') ? '0px' : '10px',
        content = re.sub(r"padding: \(settings\.paperStyle.*?,", "padding: `${paddingVal}px`,", content)

# 2. Update backgroundPosition
# Old: backgroundPosition: '0 0',
# New: backgroundPosition: `${paddingVal}px ${paddingVal}px`,

bg_pos_pattern = r"backgroundPosition: '0 0',"
if re.search(bg_pos_pattern, content):
    content = re.sub(bg_pos_pattern, "backgroundPosition: `${paddingVal}px ${paddingVal}px`,", content)
else:
    # Try loose match
    content = re.sub(r"backgroundPosition:.*?,", "backgroundPosition: `${paddingVal}px ${paddingVal}px`,", content)

# 3. Inject Debug Overlay
# Insert before closing `</div>` of the wrapper.
# Wrapper ends with `    </div>\n  );\n};`.
# We'll search for `    </div>` at the end of return.

debug_overlay = """
      {/* DEBUG OVERLAY */}
      <div style={{
          position: 'absolute', bottom: 0, right: 0, 
          background: 'rgba(0,0,0,0.8)', color: 'lime', 
          fontSize: '10px', pointerEvents: 'none', zIndex: 9999, padding: '4px'
      }}>
        Style: {settings.paperStyle} | Vert: {settings.isVertical ? 'Y' : 'N'} <br/>
        Pad: {paddingVal}px | RH: {pxRowHeight} | CP: {pxCellPitch} <br/>
        LH: {parityStyle.lineHeight} | Grid: {settings.showGrid ? 'On' : 'Off'}
      </div>
"""

# Insert before `    </div>` inside return.
# A bit risky with regex, let's use the unique `className` of wrapper or just search from end.
last_div_idx = content.rfind("    </div>")
if last_div_idx != -1:
    content = content[:last_div_idx] + debug_overlay + content[last_div_idx:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Padding and Position. Injected Debug Overlay.")
