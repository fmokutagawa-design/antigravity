
import os

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We need to insert code before `return (` which is around line 178.
# Let's find the line index.

target_idx = -1
for i, line in enumerate(lines):
    if "return (" in line and "<div" in lines[i+1]:
        target_idx = i
        break

if target_idx == -1:
    print("Could not find return statement context.")
else:
    # Logic to inject
    injection = [
        "      });\n",
        "    };\n",
        "\n",
        "    const observer = new ResizeObserver(snapResize);\n",
        "    if (wrapperRef.current && wrapperRef.current.parentElement) {\n",
        "       observer.observe(wrapperRef.current.parentElement);\n",
        "    }\n",
        "    return () => observer.disconnect();\n",
        "  });\n",
        "\n",
        "  // --- RECOVERY BLOCK ---\n",
        "  // CRITICAL: Logic was accidentally deleted. Restoring basics to allow render.\n",
        "  const fSizePt = (typeof settings.fontSize === 'number') ? settings.fontSize : 16;\n",
        "  const fSizePx = fSizePt * (96 / 72);\n",
        "  const lhMultiplier = Number(settings.lineHeight) || 1.65;\n",
        "  const pxLineHeight = fSizePx * lhMultiplier;\n",
        "  const pxRowHeight = pxLineHeight;\n",
        "  const pxCellPitch = fSizePx;\n",
        "\n",
        "  // Dummy Handlers to prevent crash\n",
        "  const handleScroll = () => {};\n",
        "  const dimStyle = { fontSize: '?', lineHeight: '?', padding: '?' };\n",
        "  const style = {};\n",
        "  const lineColor = '#ccc';\n",
        "  const pxLineHeightStr = `${pxLineHeight}px`;\n",
        "  const roundedFontSize = Math.round(fSizePx);\n",
        "\n"
    ]
    
    # Insert
    lines[target_idx:target_idx] = injection
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Emergency syntax fix applied.")
