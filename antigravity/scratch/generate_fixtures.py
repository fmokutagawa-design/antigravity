import os

dir_path = '/Volumes/Black6T/Nexus_Dev/antigravity/test_fixtures'
if not os.path.exists(dir_path):
    os.makedirs(dir_path)

metadata = '\n［METADATA］\ntags: [test]\n［/METADATA］'

def generate_text(chars):
    base = 'これはテスト用のダミーテキストです。富士山の上でルビ《ふじさん》を振ったり、会話「おはよう」をしたりします。一行あたりの文字数は適当に調整されます。'
    text = ''
    while len(text) < chars:
        text += base + '\n'
    return text[:chars] + metadata

fixtures = [
    ('tiny.txt', 1000),
    ('medium.txt', 50000),
    ('large.txt', 150000),
    ('huge.txt', 450000),
]

for name, size in fixtures:
    content = generate_text(size)
    with open(os.path.join(dir_path, name), 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Created {name} with {len(content)} characters.')
