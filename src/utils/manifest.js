/**
 * manifest.js
 * 
 * 分割された作品（Segmented Work）の管理情報を扱うユーティリティ。
 * [作品名]/manifest.json として保存される。
 */

import { fileSystem } from './fileSystem';

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

/**
 * manifest.json をディレクトリに書き出す。
 * @param {FileSystemDirectoryHandle|Object} dirHandle - .nexus フォルダのハンドル
 * @param {WorkManifest} manifest - マニフェストオブジェクト
 */
export async function writeManifest(dirHandle, manifest) {
    const json = JSON.stringify(manifest, null, 2);
    await fileSystem.createFile(dirHandle, 'manifest.json', json);
}

/**
 * ディレクトリから manifest.json を読み込む。
 * @param {FileSystemDirectoryHandle|Object} dirHandle - .nexus フォルダのハンドル
 * @returns {WorkManifest|null} パース済みマニフェスト。読めなければ null。
 */
export async function readManifest(dirHandle) {
    try {
        const entries = await fileSystem.readDirectory(dirHandle);
        const manifestEntry = entries.find(e => e.name === 'manifest.json' && e.kind === 'file');
        if (!manifestEntry) return null;

        const text = await fileSystem.readFile(manifestEntry.handle || manifestEntry);
        const parsed = JSON.parse(text);
        if (!validateManifest(parsed)) return null;
        return parsed;
    } catch (e) {
        console.warn('[manifest] readManifest failed:', e);
        return null;
    }
}

/**
 * マニフェストの segments 順にファイルを読み込み、テキスト配列を返す。
 * @param {FileSystemDirectoryHandle|Object} dirHandle - .nexus フォルダのハンドル
 * @param {WorkManifest} manifest - マニフェストオブジェクト
 * @returns {Promise<Array<{id: string, file: string, displayName: string, text: string}>>}
 */
export async function loadSegmentTexts(dirHandle, manifest) {
    const results = [];
    
    try {
        // segments/ サブフォルダのエントリを事前に一度だけ取得する
        const rootEntries = await fileSystem.readDirectory(dirHandle);
        const segDir = rootEntries.find(e => e.name === 'segments' && e.kind === 'directory');
        const segDirHandle = segDir ? (segDir.handle || segDir) : dirHandle;
        const segEntries = await fileSystem.readDirectory(segDirHandle);

        const CONCURRENCY = 6; // 制限付き並列処理

        const processSegment = async (seg) => {
            try {
                const entry = segEntries.find(e => e.name === seg.file);
                if (!entry) {
                    console.warn(`[manifest] segment file not found: ${seg.file}`);
                    return { ...seg, text: '' };
                }
                const text = await fileSystem.readFile(entry.handle || entry);
                return { ...seg, text };
            } catch (e) {
                console.warn(`[manifest] failed to read segment ${seg.file}:`, e);
                return { ...seg, text: '' };
            }
        };

        // バッチ処理で読み込みを実行
        for (let i = 0; i < manifest.segments.length; i += CONCURRENCY) {
            const chunk = manifest.segments.slice(i, i + CONCURRENCY);
            const batchResults = await Promise.all(chunk.map(processSegment));
            results.push(...batchResults);
            
            // IPC 通信の合間にわずかな空きを作る
            if (i + CONCURRENCY < manifest.segments.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

    } catch (e) {
        console.error('[manifest] loadSegmentTexts critical failure:', e);
        // フォールバック: 空のテキストで埋める
        return manifest.segments.map(seg => ({ ...seg, text: '' }));
    }

    return results;
}
