import { parseNote, serializeNote } from './metadataParser';
import { convertToFullWidth, convertQuotesToJapanese, convertMarkdownToNovel } from './typesetting';

/**
 * テキストに対して指定された整形処理を適用する。
 * メタデータ部分を保護し、本文のみを変換する。
 * @param {string} text - 元のテキスト（メタデータ付き可）
 * @param {string} type - 整形タイプ
 * @returns {string|null} 変更があった場合は新テキスト、なければnull
 */
export function applyFormat(text, type) {
  const { metadata, body } = parseNote(text);
  let newBody = body;
  let changed = false;

  if (type === 'fullwidth') {
    newBody = convertToFullWidth(newBody);
    changed = true;
  } else if (type === 'quotes') {
    newBody = convertQuotesToJapanese(newBody);
    changed = true;
  } else if (type === 'markdown') {
    newBody = convertMarkdownToNovel(newBody);
    changed = true;
  } else if (type === 'double-space-to-newline') {
    newBody = newBody.replace(/[ 　]{2,}/g, '　\n');
    changed = true;
  } else if (type === 'break-before-dialogue') {
    newBody = newBody.replace(/[ 　]+([「『])/g, '\n$1');
    changed = true;
  } else if (type === 'ellipsis') {
    newBody = newBody.replace(/\.{3,}/g, '……').replace(/…{1,}/g, (m) => '……'.repeat(Math.max(1, Math.round(m.length / 2))));
    changed = true;
  } else if (type === 'dash') {
    newBody = newBody.replace(/--+/g, '――')
      .replace(/—+/g, '――')
      .replace(/─+/g, '――')
      .replace(/―{3,}/g, '――');
    changed = true;
  } else if (type === 'exclamation-space') {
    newBody = newBody.replace(/([！？])(?![！？\s\n　」』）])/g, '$1　');
    changed = true;
  } else if (type === 'remove-blank-lines') {
    // 1. 3行以上の空行を1行空きに圧縮
    newBody = newBody.replace(/\n{3,}/g, '\n\n');
    // 2. 「」『』会話行の直前の空行を除去
    newBody = newBody.replace(/\n\n([ 　]*[「『])/g, '\n$1');
    // 3. 会話行の閉じ（」』）の直後 → 地の文（全角スペース始まり）への空行を除去
    newBody = newBody.replace(/([」』])\n\n([ 　])/g, '$1\n$2');
    changed = true;
  } else if (type === 'indent') {
    newBody = newBody.split('\n').map(line => {
      if (line.trim() === '') return line;
      if (/^[「『（]/.test(line)) return line;
      if (/^[　\s]/.test(line)) return line;
      return '　' + line;
    }).join('\n');
    changed = true;
  } else if (type === 'ruby') {
    // 漢字(読み) または 漢字（読み） を 漢字《読み》 に変換
    // 漢字の範囲に加え、全角英数字（ＡＭＢＡＣなど）も対象に含める
    newBody = newBody.replace(/([一-龠々〆ヵヶＡ-Ｚａ-ｚ０-９]+)[（(]([ぁ-んァ-ヶー]+)[）)]/g, '$1《$2》');
    changed = true;
  }

  if (changed && newBody !== body) {
    return serializeNote(newBody, metadata);
  }
  return null;
}
