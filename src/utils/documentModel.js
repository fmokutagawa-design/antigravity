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
  if (text == null || text === '') return [{ id: newId(), text: '' }];
  return text.split('\n').map(t => ({ id: newId(), text: t }));
}

/**
 * 段落配列 → 文字列
 * @param {{ id: number, text: string }[]} doc
 * @returns {string}
 */
export function documentToText(doc) {
  if (!doc || doc.length === 0) return '';
  return doc.map(p => p.text).join('\n');
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
  const newLines = newFullText.split('\n');
  const oldLines = prevDoc;

  // --- 段落数が同じ：変更された段落だけ差し替え ---
  if (newLines.length === oldLines.length) {
    // カーソルがある段落を特定して、その段落だけ更新する
    const pos = globalOffsetToPosition(prevDoc, cursorPos);
    const paraIndex = pos.paraIndex;

    // 念のため前後1段落も確認（IMEや一括置換で複数段落が変わる場合に対応）
    let changed = false;
    const newDoc = [...prevDoc];
    for (let i = 0; i < newLines.length; i++) {
      if (newLines[i] !== oldLines[i].text) {
        newDoc[i] = { id: oldLines[i].id, text: newLines[i] };
        changed = true;
      }
    }
    return changed ? newDoc : prevDoc;
  }

  // --- 段落数が変わった：既存 id を再利用しながら再構築 ---
  // 先頭から一致する段落は id を引き継ぐ（Workerキャッシュを活かす）
  const newDoc = [];
  for (let i = 0; i < newLines.length; i++) {
    if (i < oldLines.length && newLines[i] === oldLines[i].text) {
      // 内容が同じ → id を引き継ぐ
      newDoc.push(oldLines[i]);
    } else if (i < oldLines.length && newLines[i] !== oldLines[i].text) {
      // 内容が変わった → 新しい id（Workerに再計算させる）
      newDoc.push({ id: newId(), text: newLines[i] });
    } else {
      // 新規に追加された段落
      newDoc.push({ id: newId(), text: newLines[i] });
    }
  }
  return newDoc;
}
