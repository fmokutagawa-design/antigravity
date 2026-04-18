/**
 * verticalPunctuation.js
 *
 * 縦書きモード時に、Chromium の <textarea> が正しく回転できない約物を
 * Unicode 縦書き専用字形に置換する表示フィルター。
 *
 * ■ 無効化したい場合:
 *   Editor.jsx の import をコメントアウトするだけで元に戻せます。
 *   または ENABLED を false にしてください。
 *
 * ■ 三点リーダー（…）とダッシュ（―/—）について:
 *   これらはフォントの vert/vrt2 OpenType feature と
 *   CSS text-orientation: upright により正しく縦書き表示されるため、
 *   手動変換しない。変換すると ︙（縦三点）や ︱（縦線）という
 *   別の文字になり、原稿として不正確になる。
 */

// ★ この1行を false にするだけで機能を無効化できます
const ENABLED = true;

// 置換マッピング: 横書き用 → 縦書き専用字形
// 矢印だけ変換（textarea の vert feature では対応できないため）
const VERTICAL_MAP = {
    '→': '↓',  // 縦書きでは「右」が「下」に対応
    '←': '↑',  // 縦書きでは「左」が「上」に対応
    '…': '︙',
    '―': '︱',
    '—': '︱',
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
const toVerticalTest = new RegExp(`[${Object.keys(VERTICAL_MAP).join('')}]`);
const toHorizontalTest = new RegExp(`[${Object.keys(HORIZONTAL_MAP).join('')}]`);

/**
 * 表示用: 横書き約物 → 縦書き専用字形に変換
 * @param {string} text - 元のテキスト
 * @returns {string} 縦書き表示用テキスト
 */
export function toVerticalDisplay(text) {
    if (!ENABLED || !text) return text;
    if (!toVerticalTest.test(text)) return text;
    return text.replace(toVerticalRegex, (ch) => VERTICAL_MAP[ch] || ch);
}

/**
 * 保存用: 縦書き専用字形 → 横書き約物に逆変換
 * @param {string} text - textarea から受け取ったテキスト
 * @returns {string} 元の約物に復元されたテキスト
 */
export function fromVerticalDisplay(text) {
    if (!ENABLED || !text) return text;
    if (!toHorizontalTest.test(text)) return text;
    return text.replace(toHorizontalRegex, (ch) => HORIZONTAL_MAP[ch] || ch);
}
