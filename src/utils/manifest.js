/**
 * manifest.js
 * 
 * 分割された作品（Segmented Work）の管理情報を扱うユーティリティ。
 * [作品名]/manifest.json として保存される。
 */

/**
 * @typedef {Object} WorkSegment
 * @property {string} id          - 固有ID（順序を入れ替えても不変）
 * @property {string} file        - ファイル名（manifest.json からの相対パス）
 * @property {string} displayName - 表示名（章タイトルなど）
 */

/**
 * @typedef {Object} WorkManifest
 * @property {number} version     - フォーマットバージョン
 * @property {string} title       - 作品タイトル
 * @property {string} lastModified- 最終更新日時
 * @property {WorkSegment[]} segments - セグメントのリスト（この順序で連結される）
 */

export const MANIFEST_VERSION = 1;

/**
 * 空のマニフェストを作成する。
 */
export function createEmptyManifest(title = 'Untitled') {
    return {
        version: MANIFEST_VERSION,
        title,
        lastModified: new Date().toISOString(),
        segments: []
    };
}

/**
 * SplitPlan からマニフェストを生成する。
 */
export function createManifestFromSplitPlan(plan) {
    return {
        version: MANIFEST_VERSION,
        title: plan.baseName,
        lastModified: new Date().toISOString(),
        segments: plan.segments.map((seg, i) => ({
            id: `seg-${Date.now()}-${i}`,
            file: seg.proposedFileName, // 衝突解決済みの名前が望ましい
            displayName: seg.displayName
        }))
    };
}

/**
 * セグメントを結合するためのテキストを取得する（シミュレーション）。
 * 実際には各ファイルを読み込む必要がある。
 */
export function getConcatenatedFileName(manifest) {
    return manifest.segments.map(s => s.file);
}

/**
 * マニフェストのバリデーション。
 */
export function validateManifest(json) {
    if (!json || typeof json !== 'object') return false;
    if (json.version !== MANIFEST_VERSION) return false;
    if (!Array.isArray(json.segments)) return false;
    return true;
}
