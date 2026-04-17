/**
 * positionWorker.js
 * Web Worker: 重い文字座標計算をUIスレッドから切り離す。
 * computeCharPositions / computeTotalLines を別スレッドで実行し、
 * 40万字の大規模テキストでもUIが固まらないようにする。
 */

// --- 禁則処理の文字セット（Editor.jsx と完全に同一） ---
const KINSOKU_ENABLED = false;

const GYOTO_CHARS = new Set([
  '、', '。', '，', '．', '！', '？', '!', '?', '‼', '⁇', '⁈', '⁉',
  '）', ']', '｝', '〉', '》', '｣', '』', '】', '〕', '\u201D', '\u2019', '」',
  'っ', 'ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ',
  'ッ', 'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ',
  'ゝ', 'ゞ', '々', 'ー',
  '︙', '︱',
]);

const GYOMATSU_CHARS = new Set([
  '（', '［', '｛', '〈', '《', '｢', '『', '【', '〔', '\u201C', '\u2018', '「', '[',
]);

const HANGING_CHARS = new Set(['、', '。', '，', '．']);

/**
 * 文字座標計算（Editor.jsx の computeCharPositions と同一ロジック）
 */
function computeCharPositions(charArray, maxPerLine) {
  const positions = new Array(charArray.length);
  let line = 0;
  let pos = 0;
  let allowHanging = false;

  for (let i = 0; i < charArray.length; i++) {
    const char = charArray[i];

    if (char === '\n') {
      positions[i] = null;
      line++;
      pos = 0;
      allowHanging = false;
      continue;
    }

    if (pos >= maxPerLine && !allowHanging) {
      line++;
      pos = 0;
    }

    if (allowHanging && pos >= maxPerLine) {
      positions[i] = { line, pos };
      line++;
      pos = 0;
      allowHanging = false;
      continue;
    }

    allowHanging = false;
    positions[i] = { line, pos };
    pos++;

    if (KINSOKU_ENABLED && pos >= maxPerLine && i + 1 < charArray.length && charArray[i + 1] !== '\n') {
      const nextChar = charArray[i + 1];
      if (HANGING_CHARS.has(nextChar)) {
        allowHanging = true;
        continue;
      }
      if (GYOTO_CHARS.has(nextChar)) {
        pos--;
        line++;
        positions[i] = { line, pos: 0 };
        pos = 1;
        continue;
      }
      if (GYOMATSU_CHARS.has(char)) {
        pos--;
        line++;
        positions[i] = { line, pos: 0 };
        pos = 1;
        continue;
      }
    }
  }

  return { positions, totalLines: line + 1 };
}

/**
 * 軽量版: 行数のみ計算
 */
function computeTotalLines(text, maxPerLine) {
  if (!text || maxPerLine <= 0) return 1;
  let line = 0;
  let pos = 0;
  for (const char of text) {
    if (char === '\n') { line++; pos = 0; continue; }
    if (pos >= maxPerLine) { line++; pos = 0; }
    pos++;
  }
  return line + 1;
}

/**
 * メッセージハンドラ
 * type: 'positions' → charPositionsCache の計算
 * type: 'lineCount'  → computeTotalLines のみ
 */
self.onmessage = (e) => {
  const { type, id, text, maxPerLine } = e.data;

  if (type === 'positions') {
    const charArray = Array.from(text);
    const { positions, totalLines } = computeCharPositions(charArray, maxPerLine);

    // UTF-16インデックス → 文字インデックスのマッピングを事前計算
    const utf16ToCharIdxEntries = [];
    let codeUnitOffset = 0;
    for (let i = 0; i < charArray.length; i++) {
      utf16ToCharIdxEntries.push([codeUnitOffset, i]);
      codeUnitOffset += charArray[i].length;
    }

    self.postMessage({ type: 'positions', id, positions, totalLines, charArray, utf16ToCharIdxEntries });
    return;
  }

  if (type === 'lineCount') {
    const totalLines = computeTotalLines(text, maxPerLine);
    self.postMessage({ type: 'lineCount', id, totalLines });
    return;
  }
};
