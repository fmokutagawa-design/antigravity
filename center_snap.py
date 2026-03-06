
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Task: Update snapResize to CENTER the element.
# We look for `wrapper.style.width = `${snapW}px`;`
# And add `wrapper.style.margin = '0 auto';`
# Also verify if we need `maxWidth` instead of `width`? No, fixed width is requested.

pattern = r"wrapper\.style\.width = `\$\{snapW\}px`;"
replacement = r"wrapper.style.width = `${snapW}px`; wrapper.style.margin = '0 auto';"

new_content = re.sub(pattern, replacement, content)

if new_content != content:
    print("Added centering logic to snapResize.")
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
else:
    print("Could not find width setting to append centering.")

