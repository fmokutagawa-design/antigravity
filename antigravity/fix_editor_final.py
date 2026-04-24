
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Implement handleWheel
# Add this function before return or inside handlers.
# We'll insert it after `handleScroll`.

handle_scroll_pattern = r"const handleScroll = \(e\) => \{[\s\S]*?\};"
handle_wheel_code = """
  const handleScroll = (e) => {
      // Sync Scroll logic
      if (rulerRef.current) {
          if (settings.isVertical) rulerRef.current.scrollLeft = e.target.scrollLeft;
          else rulerRef.current.scrollTop = e.target.scrollTop;
      }
      if (overlayRef.current) {
          overlayRef.current.scrollTop = e.target.scrollTop;
          overlayRef.current.scrollLeft = e.target.scrollLeft;
      }
  };

  const handleWheel = (e) => {
      if (settings.isVertical) {
          // Remap Vertical Scroll (deltaY) to Horizontal Scroll (scrollLeft)
          // In vertical-rl:
          // Scroll Down (Positive deltaY) -> Go to the Left (Negative scrollLeft change? Or Positive?)
          // Text starts at Right (scrollLeft = 0 or Max depending on browser).
          // Usually in Chrome vertical-rl: scrollLeft is negative or starts at 0 and goes negative?
          // Actually, let's just use simple mapping.
          
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              e.preventDefault(); // Prevent Browser History Nav or native vertical scroll if any
              textareaRef.current.scrollLeft -= e.deltaY; 
          }
      }
  };
"""

# Replace handleScroll with handleScroll + handleWheel
# Note: Regex match must be accurate.
# In Step 4181 view:
# 169:   // Common Style for Textarea Parity
# ...
# 191:
# ...
# It didn't show handleScroll definition in the snippet 150-260!
# Wait, Step 4052 wrote handleScroll.
# Let's search for `const handleScroll`.

if "const handleScroll" in content:
    # Use simple string replacement if strict regex is too hard without seeing full file
    # We will search for the function body close.
    # The function probably ends with `  };`.
    # Let's do a safe insertion before `const observer` or similar? 
    # Or just replace `const handleScroll ... };` if we can assume the code from 4052 is intact.
    # Code in 4052:
    # const handleScroll = (e) => {
    #     // Sync Scroll logic
    #     if (rulerRef.current) {
    #         if (settings.isVertical) rulerRef.current.scrollLeft = e.target.scrollLeft;
    #         else rulerRef.current.scrollTop = e.target.scrollTop;
    #     }
    #     if (overlayRef.current) {
    #         overlayRef.current.scrollTop = e.target.scrollTop;
    #         overlayRef.current.scrollLeft = e.target.scrollLeft;
    #     }
    # };
    
    # Let's try to match it.
    match = re.search(r"const handleScroll = \(e\) => \{[\s\S]*?\n  \};", content)
    if match:
        content = content.replace(match.group(0), handle_wheel_code)
        print("Injected handleWheel logic.")
    else:
        # Fallback: Insert before `useLayoutEffect`?
        print("Could not match handleScroll exactly trying simple find.")
        idx = content.find("const handleScroll = (e) => {")
        if idx != -1:
            end_idx = content.find("};", idx)
            if end_idx != -1:
                # Replace that chunk
                orig = content[idx:end_idx+2]
                content = content.replace(orig, handle_wheel_code)
                print("Injected handleWheel logic (Simple).")

# 2. Add onWheel to Textarea
# Pattern: onKeyDown={handleKeyDown}
# Replace with: onKeyDown={handleKeyDown} onWheel={handleWheel}

content = content.replace("onKeyDown={handleKeyDown}", "onKeyDown={handleKeyDown}\n        onWheel={handleWheel}")

# 3. Update ClassName logic (Robust)
# Search for `className={` inside the `textarea` block.
# We know it contains `vertical-editor`.

class_pattern = r"className=\{`\$\{settings\.isVertical \? \"vertical-editor\" : \"horizontal-editor\"\}[\s\S]*?`\}"
# New logic:
# Include 'force-grid-background' if manuscript + showGrid.
# Include 'vertical-grid' if vertical.

new_class_logic = "className={`${settings.isVertical ? \"vertical-editor\" : \"horizontal-editor\"} ${settings.showGrid !== false ? 'grid-mode' : ''} ${settings.editorSyntaxColors !== false ? 'transparent-force' : ''} ${(settings.paperStyle === 'manuscript' || settings.paperStyle === 'grid') && settings.showGrid ? ('force-grid-background ' + (settings.isVertical ? 'vertical-grid' : '')) : ''}`}"

if re.search(class_pattern, content):
    content = re.sub(class_pattern, new_class_logic, content)
    print("Updated className logic.")
else:
    print("Could not match className pattern. Attempting loose match.")
    # Loose match: `className={...}` inside textarea? 
    # Just look for the string we know exists from previous steps.
    # `${settings.isVertical ? "vertical-editor" : "horizontal-editor"}`
    
    loose_pattern = r"className=\{`\${settings\.isVertical \? \"vertical-editor\" : \"horizontal-editor\"\}.*?`\}"
    if re.search(loose_pattern, content):
        content = re.sub(loose_pattern, new_class_logic, content)
        print("Updated className logic (Loose).")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Finished updates.")
