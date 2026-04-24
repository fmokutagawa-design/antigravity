import fs from 'fs';
import path from 'path';

const dir = '/Volumes/Black6T/Nexus_Dev/antigravity/test_fixtures';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const metadata = '\n［METADATA］\ntags: [test]\n［/METADATA］';

function generateText(chars) {
  const base = 'これはテスト用のダミーテキストです。富士山の上でルビ《ふじさん》を振ったり、会話「おはよう」をしたりします。一行あたりの文字数は適当に調整されます。';
  let text = '';
  while (text.length < chars) {
    text += base + '\n';
  }
  return text.substring(0, chars) + metadata;
}

const fixtures = [
  { name: 'tiny.txt', size: 1000 },
  { name: 'medium.txt', size: 50000 },
  { name: 'large.txt', size: 150000 },
  { name: 'huge.txt', size: 450000 },
];

fixtures.forEach(f => {
  const content = generateText(f.size);
  fs.writeFileSync(path.join(dir, f.name), content);
  console.log(`Created ${f.name} with ${content.length} characters.`);
});
