import JSZip from 'jszip';

/**
 * EPUB Exporter for Antigravity
 * テキストファイル群をEPUB 3.0形式にエクスポートする
 */

// EPUB必須: MIMETYPEファイル
const MIMETYPE = 'application/epub+zip';

// container.xml
const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

// ルビ記法を<ruby>タグに変換
function convertRuby(text) {
    // ｜漢字《かな》 → <ruby>漢字<rt>かな</rt></ruby>
    return text.replace(/[｜|]([^《\n]+)《([^》\n]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
}

// テキストをEPUB用HTMLに変換
function textToHtml(text) {
    let html = text;
    // HTMLエスケープ（ルビ変換前に&だけ先にやる）
    html = html.replace(/&/g, '&amp;');
    html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // エスケープ後にルビ記法を復元して変換
    // ｜ と 《》 はエスケープされないのでそのまま
    html = html.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // やり直し: もっとシンプルに
    html = text;
    html = convertRuby(html);
    // 傍点: ﹅ は対応しない（複雑なため）
    // リンク記法 [[target]] や [[target|label]] を除去してテキストだけ残す
    html = html.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
    html = html.replace(/\[\[([^\]]+)\]\]/g, '$1');
    // 強調 『...』 → <em>...</em>
    html = html.replace(/『([^』]+)』/g, '<em>$1</em>');
    // HTMLエスケープ（タグ以外）
    // 行ごとに処理
    const lines = html.split('\n');
    const paragraphs = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '') {
            paragraphs.push('<p class="blank"><br/></p>');
        } else if (trimmed.startsWith('#')) {
            // 見出し
            const match = trimmed.match(/^(#{1,6})\s+(.+)/);
            if (match) {
                const level = Math.min(match[1].length, 6);
                paragraphs.push(`<h${level}>${match[2]}</h${level}>`);
            } else {
                paragraphs.push(`<p>${trimmed}</p>`);
            }
        } else {
            paragraphs.push(`<p>${trimmed}</p>`);
        }
    }
    return paragraphs.join('\n');
}

// XHTML テンプレート
function createChapterXhtml(title, bodyHtml, isVertical = true) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"
      xml:lang="ja" lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body class="${isVertical ? 'vertical' : 'horizontal'}">
  <section epub:type="bodymatter">
    ${bodyHtml}
  </section>
</body>
</html>`;
}

// スタイルシート
function createStyleCss(isVertical = true) {
    return `@charset "UTF-8";

body {
  margin: 0;
  padding: 0;
  font-family: "游明朝", "YuMincho", "Hiragino Mincho ProN", serif;
  font-size: 1em;
  line-height: 1.8;
}

body.vertical {
  writing-mode: vertical-rl;
  -webkit-writing-mode: vertical-rl;
  -epub-writing-mode: vertical-rl;
  text-orientation: upright;
  -webkit-text-orientation: upright;
}

body.horizontal {
  writing-mode: horizontal-tb;
}

p {
  margin: 0;
  text-indent: 1em;
}

p.blank {
  text-indent: 0;
  line-height: 1.8;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: bold;
  text-indent: 0;
  margin: 1.5em 0 0.5em 0;
}

h1 { font-size: 1.6em; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.2em; }

em {
  font-style: normal;
  font-weight: bold;
}

ruby rt {
  font-size: 0.5em;
}
`;
}

// content.opf 生成
function createContentOpf(bookTitle, author, chapters, isVertical = true) {
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const uuid = 'urn:uuid:' + crypto.randomUUID();
    const direction = isVertical ? 'rtl' : 'ltr';

    const manifestItems = chapters.map((ch, i) =>
        `    <item id="chapter${i}" href="${ch.filename}" media-type="application/xhtml+xml"/>`
    ).join('\n');

    const spineItems = chapters.map((_, i) =>
        `    <itemref idref="chapter${i}"/>`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="ja"
         prefix="rendition: http://www.idpf.org/vocab/rendition/#">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${uuid}</dc:identifier>
    <dc:title>${bookTitle}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>ja</dc:language>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${manifestItems}
  </manifest>
  <spine page-progression-direction="${direction}">
${spineItems}
  </spine>
</package>`;
}

// nav.xhtml (EPUB3の目次)
function createNavXhtml(bookTitle, chapters, isVertical = true) {
    const items = chapters.map(ch =>
        `      <li><a href="${ch.filename}">${ch.title}</a></li>`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"
      xml:lang="ja" lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>${bookTitle} - 目次</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body class="${isVertical ? 'vertical' : 'horizontal'}">
  <nav epub:type="toc">
    <h1>目次</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`;
}

/**
 * EPUB生成メイン関数
 * @param {Object} options
 * @param {string} options.title - 書籍タイトル
 * @param {string} options.author - 著者名
 * @param {Array} options.files - [{name, content}] ファイル配列
 * @param {boolean} options.isVertical - 縦書きかどうか
 * @returns {Promise<Blob>} EPUBファイルのBlob
 */
export async function generateEpub({ title = '無題', author = '著者不明', files = [], isVertical = true }) {
    const zip = new JSZip();

    // 1. mimetype (圧縮なし、最初に追加)
    zip.file('mimetype', MIMETYPE, { compression: 'STORE' });

    // 2. META-INF/container.xml
    zip.file('META-INF/container.xml', CONTAINER_XML);

    // 3. チャプター生成
    const chapters = files.map((file, index) => {
        const chTitle = file.name.replace(/\.[^/.]+$/, '');
        const filename = `chapter\${index.toString().padStart(3, '0')}.xhtml`;
    const bodyHtml = textToHtml(file.content || '');
    const xhtml = createChapterXhtml(chTitle, bodyHtml, isVertical);
    return { title: chTitle, filename, xhtml };
  });

  // 4. OEBPS 内にファイル配置
  zip.file('OEBPS/style.css', createStyleCss(isVertical));
  zip.file('OEBPS/content.opf', createContentOpf(title, author, chapters, isVertical));
  zip.file('OEBPS/nav.xhtml', createNavXhtml(title, chapters, isVertical));

  chapters.forEach(ch => {
    zip.file(`OEBPS/\${ch.filename}`, ch.xhtml);
  });

  // 5. ZIP生成
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return blob;
}

/**
 * Blobをファイルとしてダウンロードするヘルパー
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
