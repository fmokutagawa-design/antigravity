import { perfNow, perfMeasure } from './perfProbe';

/**
 * documentModel.js
 *
 * テキストを「段落配列」として管理するモデル層。
 * Editor.jsx の内部状態として使用し、編集時に変更された段落だけを
 * 再計算することで、40万字規模でも全文走査を避ける。
 *
 * 段落の型: { id: number, text: string }
 * 空行は { id: N, text: "" } として保持する（\n は段落の区切りであり、段落内には含まない）。
 */

let _nextId = 1;

/** ユニークな段落IDを発行する */
function newId() {
  return _nextId++;
}

/**
 * 文字列 → 段落配列
 * @param {string} text
 * @returns {{ id: number, text: string }[]}
 */
export function textToDocument(text) {
  const t0 = perfNow();
  if (text == null || text === '') return [{ id: newId(), text: '' }];
  const out = text.split('\n').map(t => ({ id: newId(), text: t }));
  perfMeasure('documentModel.textToDocument', t0, {
    paras: out.length,
    len: text.length,
  });
  return out;
}

/**
 * 段落配列 → 文字列
 * @param {{ id: number, text: string }[]} doc
 * @returns {string}
 */
export function documentToText(doc) {
  const t0 = perfNow();
  if (!doc || doc.length === 0) return '';
  const out = doc.map(p => p.text).join('\n');
  perfMeasure('documentModel.documentToText', t0, {
    paras: doc.length,
    len: out.length,
  });
  return out;
}

/**
 * 全文 offset → { paraIndex, offset }
 * textarea の selectionStart/End をモデル上の位置に変換する。
 * @param {{ id: number, text: string }[]} doc
 * @param {number} globalOffset
 * @returns {{ paraIndex: number, offset: number }}
 */
export function globalOffsetToPosition(doc, globalOffset) {
  let remaining = globalOffset;
  for (let i = 0; i < doc.length; i++) {
    const len = doc[i].text.length;
    if (remaining <= len) {
      return { paraIndex: i, offset: remaining };
    }
    remaining -= len + 1; // +1 は \n の分
  }
  // 末尾を超えた場合は最終段落の末尾
  const last = doc.length - 1;
  return { paraIndex: last, offset: doc[last].text.length };
}

/**
 * { paraIndex, offset } → 全文 offset
 * @param {{ id: number, text: string }[]} doc
 * @param {number} paraIndex
 * @param {number} offset
 * @returns {number}
 */
export function positionToGlobalOffset(doc, paraIndex, offset) {
  let total = 0;
  for (let i = 0; i < paraIndex; i++) {
    total += doc[i].text.length + 1; // +1 は \n
  }
  return total + offset;
}

/**
 * textarea の新しい全文テキストから文書モデルを差分更新する。
 *
 * 段落数が変わらない場合（通常の文字入力・削除）は変更された段落だけ
 * 新しいオブジェクトに差し替える。段落数が変わった場合（Enter/BackSpace）は
 * 全文から再構築するが、変化していない段落は既存の id を再利用して
 * Worker キャッシュの無効化を最小限にする。
 *
 * @param {{ id: number, text: string }[]} prevDoc 現在の文書モデル
 * @param {string} newFullText textarea の新しい値
 * @param {number} cursorPos textarea の selectionStart
 * @returns {{ id: number, text: string }[]} 更新後の文書モデル
 */
export function updateDocument(prevDoc, newFullText, cursorPos) {
  const t0 = perfNow();
  const newLines = newFullText.split('\n');
  const oldLines = prevDoc;

  if (newLines.length === oldLines.length) {
    let changed = false;
    const newDoc = [...prevDoc];
    for (let i = 0; i < newLines.length; i++) {
      if (newLines[i] !== oldLines[i].text) {
        newDoc[i] = { id: oldLines[i].id, text: newLines[i] };
        changed = true;
      }
    }
    const result = changed ? newDoc : prevDoc;
    perfMeasure('documentModel.updateDocument.sameLineCount', t0, {
      prevParas: prevDoc.length,
      nextParas: result.length,
      textLength: newFullText.length,
      cursorPos,
      changed,
    });
    return result;
  }

  const newDoc = [];
  for (let i = 0; i < newLines.length; i++) {
    if (i < oldLines.length && newLines[i] === oldLines[i].text) {
      newDoc.push(oldLines[i]);
    } else if (i < oldLines.length && newLines[i] !== oldLines[i].text) {
      newDoc.push({ id: newId(), text: newLines[i] });
    } else {
      newDoc.push({ id: newId(), text: newLines[i] });
    }
  }

  perfMeasure('documentModel.updateDocument.rebuild', t0, {
    prevParas: prevDoc.length,
    nextParas: newDoc.length,
    textLength: newFullText.length,
    cursorPos,
  });
  return newDoc;
}
