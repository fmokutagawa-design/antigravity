/**
 * verticalPunctuation.js
 * 
 * 縦書きモード時に、Chromium の <textarea> が正しく回転できない約物を
 * Unicode 縦書き専用字形に置換する表示フィルター。
 * 
 * ■ 無効化したい場合:
 *   Editor.jsx の import をコメントアウトするだけで元に戻せます。
 *   または ENABLED を false にしてください。
 */

// ★ この1行を false にするだけで機能を無効化できます
const ENABLED = true;

// 置換マッピング: 横書き用 → 縦書き専用字形
const VERTICAL_MAP = {
    '…': '︙',  // U+2026 → U+FE19 (PRESENTATION FORM FOR VERTICAL HORIZONTAL ELLIPSIS)
    '―': '︱',  // U+2015 → U+FE31 (PRESENTATION FORM FOR VERTICAL EM DASH)
    '—': '︱',  // U+2014 → U+FE31 (PRESENTATION FORM FOR VERTICAL EM DASH)
    '→': '↑',  // U+2192 → U+2191 (vert機能が↑→↓に変換し、下向き表示になる)
};

// 逆変換マッピングを自動生成
// 注意: '―' と '—' は両方 '︱' に変換されるため、逆変換時は '―' を優先
const HORIZONTAL_MAP = {};
for (const [h, v] of Object.entries(VERTICAL_MAP)) {
    if (!HORIZONTAL_MAP[v]) {
        HORIZONTAL_MAP[v] = h;
    }
}

// 正規表現をキャッシュ（パフォーマンス用）
const toVerticalRegex = new RegExp(`[${Object.keys(VERTICAL_MAP).join('')}]`, 'g');
const toHorizontalRegex = new RegExp(`[${Object.keys(HORIZONTAL_MAP).join('')}]`, 'g');

/**
 * 表示用: 横書き約物 → 縦書き専用字形に変換
 * @param {string} text - 元のテキスト
 * @returns {string} 縦書き表示用テキスト
 */
export function toVerticalDisplay(text) {
    if (!ENABLED || !text) return text;
    return text.replace(toVerticalRegex, (ch) => VERTICAL_MAP[ch] || ch);
}

/**
 * 保存用: 縦書き専用字形 → 横書き約物に逆変換
 * @param {string} text - textarea から受け取ったテキスト
 * @returns {string} 元の約物に復元されたテキスト
 */
export function fromVerticalDisplay(text) {
    if (!ENABLED || !text) return text;
    return text.replace(toHorizontalRegex, (ch) => HORIZONTAL_MAP[ch] || ch);
}
