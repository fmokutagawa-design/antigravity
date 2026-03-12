import JSZip from 'jszip';
import { downloadBlob } from './epubExporter';

/**
 * DOCX Exporter for Antigravity
 * JSZipのみで .docx を生成（追加ライブラリ不要）
 *
 * DOCX = ZIP containing XML files (Open XML format)
 */

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * テキスト行をOpenXMLのパラグラフに変換
 */
function textToDocxParagraphs(text, fontName) {
  const lines = text.split('\n');
  const paragraphs = [];

  for (const line of lines) {
    if (line.trim() === '') {
      paragraphs.push(
        `<w:p><w:pPr><w:rPr><w:rFonts w:eastAsia="${fontName}"/></w:rPr></w:pPr></w:p>`
      );
      continue;
    }

    let processedLine = line;
    // リンク記法 [[target|label]] または [[target]] を除去
    processedLine = processedLine.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
    processedLine = processedLine.replace(/\[\[([^\]]+)\]\]/g, '$1');
    processedLine = processedLine.replace(/［［([^］]+)］］/g, '$1');
    // 青空文庫タグ除去
    processedLine = processedLine.replace(/［＃[^］]*］/g, '');
    // フォントタグ除去
    processedLine = processedLine.replace(/\{font[:：][^}]*\}/g, '').replace(/\{\/font\}/g, '');
    // Markdown太字除去
    processedLine = processedLine.replace(/\*\*([^*]+)\*\*/g, '$1');

    // ルビ処理 — ルビがある場合はOpenXMLのrubyマークアップを使用
    const hasRuby = /《[^》]+》/.test(processedLine);

    if (hasRuby) {
      const parts = [];
      let cursor = 0;
      const rubyRegex = /[｜|]?([^｜|\n《]+)《([^》\n]+)》/g;
      let m;

      while ((m = rubyRegex.exec(processedLine)) !== null) {
        // ルビ前のテキスト
        if (m.index > cursor) {
          const before = processedLine.slice(cursor, m.index);
          parts.push(
            `<w:r><w:rPr><w:rFonts w:eastAsia="${fontName}"/></w:rPr>` +
            `<w:t xml:space="preserve">${escapeXml(before)}</w:t></w:r>`
          );
        }
        // ルビ付きテキスト
        const base = m[1];
        const ruby = m[2];
        parts.push(
          `<w:r><w:rPr><w:rFonts w:eastAsia="${fontName}"/></w:rPr>` +
          `<w:ruby>` +
          `<w:rubyPr><w:rubyAlign w:val="distributeSpace"/>` +
          `<w:hps w:val="12"/><w:hpsRaise w:val="22"/><w:hpsBaseText w:val="24"/></w:rubyPr>` +
          `<w:rubyBase><w:r><w:rPr><w:rFonts w:eastAsia="${fontName}"/></w:rPr>` +
          `<w:t>${escapeXml(base)}</w:t></w:r></w:rubyBase>` +
          `<w:rt><w:r><w:rPr><w:rFonts w:eastAsia="${fontName}"/><w:sz w:val="12"/></w:rPr>` +
          `<w:t>${escapeXml(ruby)}</w:t></w:r></w:rt>` +
          `</w:ruby></w:r>`
        );
        cursor = m.index + m[0].length;
      }
      // 残り
      if (cursor < processedLine.length) {
        const after = processedLine.slice(cursor);
        parts.push(
          `<w:r><w:rPr><w:rFonts w:eastAsia="${fontName}"/></w:rPr>` +
          `<w:t xml:space="preserve">${escapeXml(after)}</w:t></w:r>`
        );
      }

      paragraphs.push(
        `<w:p><w:pPr>` +
        `<w:ind w:firstLineChars="100" w:firstLine="240"/>` +
        `<w:rPr><w:rFonts w:eastAsia="${fontName}"/></w:rPr></w:pPr>` +
        parts.join('') +
        `</w:p>`
      );
    } else {
      // 通常テキスト行
      const indent = processedLine.startsWith('　')
        ? `<w:ind w:firstLineChars="100" w:firstLine="240"/>`
        : '';
      paragraphs.push(
        `<w:p><w:pPr>${indent}<w:rPr><w:rFonts w:eastAsia="${fontName}"/></w:rPr></w:pPr>` +
        `<w:r><w:rPr><w:rFonts w:eastAsia="${fontName}"/></w:rPr>` +
        `<w:t xml:space="preserve">${escapeXml(processedLine)}</w:t></w:r></w:p>`
      );
    }
  }

  return paragraphs.join('\n');
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;
}

function relsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;
}

function stylesXml(fontName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="${fontName}" w:eastAsia="${fontName}" w:hAnsi="${fontName}"/>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
      <w:lang w:val="en-US" w:eastAsia="ja-JP"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:spacing w:line="360" w:lineRule="auto"/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr>
  </w:style>
</w:styles>`;
}

function settingsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:compat>
    <w:useFELayout/>
  </w:compat>
  <w:defaultTabStop w:val="840"/>
</w:settings>`;
}

function documentXml(bodyContent, isVertical, pageSize = 'A4', orientation = 'portrait') {
  const pageDims = {
    'A4': { w: 11906, h: 16838 },
    'B5': { w: 9979, h: 14175 },
    'A5': { w: 8392, h: 11906 },
  }[pageSize] || { w: 11906, h: 16838 };

  const isLandscape = orientation === 'landscape';
  const pgW = isLandscape ? pageDims.h : pageDims.w;
  const pgH = isLandscape ? pageDims.w : pageDims.h;
  const orientAttr = isLandscape ? ' w:orient="landscape"' : '';

  // 縦書き: textDirection="tbRl"
  const textDir = isVertical ? '<w:textDirection w:val="tbRl"/>' : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="${pgW}" w:h="${pgH}"${orientAttr}/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
               w:header="720" w:footer="720"/>
      ${textDir}
    </w:sectPr>
  </w:body>
</w:document>`;
}

/**
 * DOCX生成メイン関数
 */
export async function generateDocx({
  title = '無題',
  content = '',
  isVertical = true,
  fontName = '游明朝',
  pageSize = 'A4',
  orientation = 'portrait',
}) {
  const zip = new JSZip();

  const bodyParagraphs = textToDocxParagraphs(content, fontName);

  zip.file('[Content_Types].xml', contentTypesXml());
  zip.file('_rels/.rels', relsXml());
  zip.file('word/_rels/document.xml.rels', documentRelsXml());
  zip.file('word/document.xml', documentXml(bodyParagraphs, isVertical, pageSize, orientation));
  zip.file('word/styles.xml', stylesXml(fontName));
  zip.file('word/settings.xml', settingsXml());

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return blob;
}

export { downloadBlob };
