# 指示書 D：章ごと分割機能の実装

> コーディングエージェント（Sonnet 向け推奨）。  
> **1 ターンで実装完了できる粒度**。詰まったら即座に止めて Claude Opus に戻す。

---

## 0. 前提

### 0.1 作業環境

- **リポジトリ**：https://github.com/fmokutagawa-design/antigravity.git
- **派生元ブランチ**：`feature/uncontrolled-editor-v3`
- **派生元コミット**：A・B・C の指示書実装後の最新状態
  - atomic write（`5ac247a`）
  - journal（`00e012a`）
  - tmp cleanup（`fbb2a96`）
  - boundary detector（`e59a7e3`）
  - これら 4 つを含む最新コミットから派生
- **新ブランチ名**：`feature/split-by-chapters`

### 0.2 ブランチ作成手順

```bash
git checkout feature/uncontrolled-editor-v3
git pull
# A・B・C のブランチがまだマージされていない場合は順にマージ
git merge --no-ff feature/journal-log
git merge --no-ff feature/tmp-cleanup
git merge --no-ff feature/boundary-detector
# それから新ブランチを切る
git checkout -b feature/split-by-chapters
```

### 0.3 完了後のコミットメッセージ雛形

```
feat(segmentation): split a large file into chapter files

Adds a "Split by chapters" feature for breaking a single large novel file
into multiple chapter files. Uses the existing boundaryDetector utility
to auto-detect chapter markers (■, 第N章, Markdown headings, aozora tags),
lets the user review each boundary in a modal with 400-char context
preview, and writes the split files atomically with rollback on failure.

- src/components/SplitByChaptersModal.jsx: the review modal UI
- src/utils/splitByChapters.js: pure logic for deriving segment plans
- src/hooks/useSplitByChapters.js: orchestration hook tying UI, IO, and
  backup together
- Integrated into the editor header as a "章ごと分割" button

Safety:
- Original file is backed up to <project>/.backup/<name>_original_<ts>.txt
  before any new file is written
- New files are written one by one via atomic write
- If any write fails, already-written new files are removed (rollback)
- Original file is never deleted; both original and split files coexist

Closes instruction D.
```

---

## 1. 目的

冬之助さんが所有する 42 万字クラスの巨大原稿ファイルを、**章ごとに複数ファイルへ分割する機能**を NEXUS に追加する。

これにより：

1. 1 ファイルあたりの文字数が 3〜5 万字程度に収まり、**打鍵が即時になる**
2. 章ごとにファイルを扱う運用が可能になる
3. 賞応募時は既存の `handleBatchExport`（`src/hooks/useFileOperations.js`）で結合 TXT 出力できる

### 採用する UX

**ボタン → モーダルレビュー → 実行** のハイブリッド方式：

1. エディタ画面上部に「章ごと分割」ボタンを表示（現在開いているファイルに対して操作）
2. ボタン押下で **SplitByChaptersModal** が開く
3. モーダルに自動検出された境界候補が一覧表示される
4. 各候補は前後 400 字のプレビュー付き
5. チェックボックスで個別に除外可能
6. 章タイトルはモーダル内で編集可能
7. 「分割する」ボタンで実行
8. 分割前に自動で元ファイルを `.backup/` にコピー
9. 新ファイル群を atomic write で順次作成
10. 完了後トースト表示、ファイルツリー再読み込み

**重要**：元ファイルは削除しない。両方存在する。

---

## 2. ファイル構成

### 2.1 新規作成するファイル

- `src/utils/splitByChapters.js` — 純粋ロジック（境界候補 → セグメント計画への変換、ファイル名生成）
- `src/utils/splitByChapters.test.cjs` — splitByChapters のテスト
- `src/components/SplitByChaptersModal.jsx` — モーダル UI
- `src/components/SplitByChaptersModal.css` — モーダルのスタイル
- `src/hooks/useSplitByChapters.js` — 分割実行のオーケストレーションフック

### 2.2 変更する既存ファイル

- `src/App.jsx` — モーダル状態の管理と `useSplitByChapters` の呼び出し
  - 最小限の改変。詳細は §3.6
- `src/components/ExportPanel.jsx` — 「章ごと分割」ボタンを追加（なぜ ExportPanel か：§3.6.1 参照）

### 2.3 絶対に触らないファイル

- **`src/components/Editor.jsx`**（絶対禁止）
- `src/hooks/useAutoSave.js`
- `src/hooks/useGhostText.js`
- `electron/` 配下すべて
- 既存の `src/utils/boundaryDetector.js`（読むだけ、書き換えない）
- 既存の `src/utils/atomicWrite.js`（存在する場合、読むだけ）

---

## 3. 実装仕様

### 3.1 `src/utils/splitByChapters.js`

純粋関数ユーティリティ。副作用なし、fs・DOM 非依存。

#### 3.1.1 インターフェース

```js
/**
 * splitByChapters.js
 *
 * 章ごと分割のための純粋ロジック。
 * - 既存 boundaryDetector と組み合わせて、テキストから「分割計画」を作る
 * - ファイル名の衝突チェックとサニタイズ
 * - ロールバック用に計画全体を純粋データとして持つ
 */

import { findBoundaryCandidates } from './boundaryDetector.js';

/**
 * @typedef {Object} SplitSegment
 * @property {number} index          - 0 始まり
 * @property {number} startOffset    - 元テキスト内の開始 offset
 * @property {number} endOffset      - 元テキスト内の終了 offset（exclusive）
 * @property {string} content        - セグメント本文（startOffset〜endOffset のスライス）
 * @property {number} charCount      - content.length
 * @property {string} displayName    - 境界マーカーから抽出した章タイトル（編集可能）
 * @property {string} proposedFileName - 提案される新ファイル名（拡張子込み）
 * @property {string|null} markerType - 'chapter' | 'section' | 'paragraph' | null
 * @property {number} confidence     - 境界の信頼度（先頭セグメントは 1.0 固定）
 */

/**
 * @typedef {Object} SplitPlan
 * @property {string} sourceFileName    - 元ファイル名（拡張子込み）
 * @property {string} baseName          - 元ファイル名の拡張子を除いた部分
 * @property {string} extension         - ファイル拡張子（例: ".txt"）
 * @property {SplitSegment[]} segments  - 分割セグメント配列
 * @property {Object} stats             - 統計情報
 * @property {number} stats.totalChars  - 元テキスト総文字数
 * @property {number} stats.segmentCount- セグメント数
 */

/**
 * テキストから SplitPlan を作成する。
 *
 * @param {string} text - 元ファイルの全文
 * @param {string} sourceFileName - 元ファイル名（拡張子込み）
 * @param {Object} [options]
 * @param {boolean} [options.includeChapter=true]
 * @param {boolean} [options.includeMarkdown=true]
 * @param {boolean} [options.includeAozora=true]
 * @returns {SplitPlan}
 */
export function createSplitPlan(text, sourceFileName, options = {}) {
    const candidates = findBoundaryCandidates(text, options);

    // 境界が1つもない場合、計画は「全文1セグメント」として返す
    // （呼び出し側で「境界なし」UI を出す判断をする）
    const { baseName, extension } = splitFileName(sourceFileName);

    // 境界候補を offset 昇順でソート済み前提（boundaryDetector がやっている）
    // 先頭の擬似境界（offset 0）を追加して、"最初のセグメント" を扱いやすくする
    const effectiveBoundaries = [
        {
            offset: 0,
            type: null,
            marker: '',
            titleCandidate: '',
            confidence: 1.0,
        },
        ...candidates,
    ];

    const segments = [];
    for (let i = 0; i < effectiveBoundaries.length; i++) {
        const b = effectiveBoundaries[i];
        const startOffset = b.offset;
        const endOffset = i + 1 < effectiveBoundaries.length
            ? effectiveBoundaries[i + 1].offset
            : text.length;

        const content = text.slice(startOffset, endOffset);
        const displayName = (b.titleCandidate || '').trim() || (i === 0 ? '冒頭' : `第${i}章`);
        const proposedFileName = buildProposedFileName(baseName, i + 1, displayName, extension);

        segments.push({
            index: i,
            startOffset,
            endOffset,
            content,
            charCount: content.length,
            displayName,
            proposedFileName,
            markerType: b.type,
            confidence: b.confidence,
        });
    }

    return {
        sourceFileName,
        baseName,
        extension,
        segments,
        stats: {
            totalChars: text.length,
            segmentCount: segments.length,
        },
    };
}

/**
 * 計画の特定セグメントを除外した新計画を作る（不変）。
 * 除外されたセグメントは、前のセグメントの末尾に統合される。
 *
 * @param {SplitPlan} plan
 * @param {number} indexToRemove - 除外するセグメントの index
 * @returns {SplitPlan}
 */
export function removeSegment(plan, indexToRemove) {
    if (indexToRemove === 0) {
        // 先頭セグメントは除外できない（=境界を全部消す意味になる）
        // 呼び出し側でブロック推奨。念のため unchanged を返す
        return plan;
    }
    const segments = plan.segments.filter((_, i) => i !== indexToRemove);
    // 除外により前後が連結される必要がある
    // i - 1 のセグメントの endOffset は次のセグメントの startOffset に合わせる
    const adjusted = segments.map((seg, newIdx) => {
        const startOffset = seg.startOffset;
        const endOffset = newIdx + 1 < segments.length
            ? segments[newIdx + 1].startOffset
            : plan.stats.totalChars;
        return {
            ...seg,
            index: newIdx,
            startOffset,
            endOffset,
            // content と charCount は呼び出し側で元テキストを渡して再計算が必要
            // このヘルパーでは offset のみ更新。呼び出し元で rebuildSegmentContent() を呼ぶこと
        };
    });
    return {
        ...plan,
        segments: adjusted,
        stats: {
            ...plan.stats,
            segmentCount: adjusted.length,
        },
    };
}

/**
 * 計画内の全セグメントの content を、元テキストから再構築する。
 * removeSegment や updateDisplayName の後に呼ぶ。
 *
 * @param {SplitPlan} plan
 * @param {string} sourceText
 * @returns {SplitPlan}
 */
export function rebuildSegmentContents(plan, sourceText) {
    const segments = plan.segments.map((seg, i) => {
        const startOffset = seg.startOffset;
        const endOffset = i + 1 < plan.segments.length
            ? plan.segments[i + 1].startOffset
            : sourceText.length;
        const content = sourceText.slice(startOffset, endOffset);
        const proposedFileName = buildProposedFileName(
            plan.baseName,
            i + 1,
            seg.displayName,
            plan.extension
        );
        return {
            ...seg,
            index: i,
            startOffset,
            endOffset,
            content,
            charCount: content.length,
            proposedFileName,
        };
    });
    return {
        ...plan,
        segments,
        stats: {
            ...plan.stats,
            segmentCount: segments.length,
        },
    };
}

/**
 * セグメントの表示名（章タイトル）を更新する。
 *
 * @param {SplitPlan} plan
 * @param {number} index
 * @param {string} newDisplayName
 * @returns {SplitPlan}
 */
export function updateDisplayName(plan, index, newDisplayName) {
    const segments = plan.segments.map((seg, i) => {
        if (i !== index) return seg;
        const trimmed = newDisplayName.trim();
        const proposedFileName = buildProposedFileName(
            plan.baseName,
            i + 1,
            trimmed,
            plan.extension
        );
        return {
            ...seg,
            displayName: trimmed,
            proposedFileName,
        };
    });
    return { ...plan, segments };
}

/**
 * ファイル名を baseName と extension に分ける。
 */
export function splitFileName(fileName) {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot <= 0) {
        return { baseName: fileName, extension: '.txt' };
    }
    return {
        baseName: fileName.slice(0, lastDot),
        extension: fileName.slice(lastDot),
    };
}

/**
 * 提案ファイル名を作る。
 * 例: baseName="虚空の三叉", seq=1, title="第1章 オデッサ", ext=".txt"
 *   -> "虚空の三叉_01_第1章 オデッサ.txt"
 *
 * OS 互換のため、ファイル名に使えない文字はアンダースコアに置換する。
 */
export function buildProposedFileName(baseName, seq, title, extension) {
    const seqStr = String(seq).padStart(2, '0');
    const cleanTitle = sanitizeForFileName(title || '');
    const name = cleanTitle
        ? `${baseName}_${seqStr}_${cleanTitle}`
        : `${baseName}_${seqStr}`;
    return `${name}${extension}`;
}

/**
 * ファイル名に使えない文字をサニタイズする。
 * macOS は : を許可しないため除外。Windows 互換も考慮して < > : " / \ | ? * と制御文字を除外。
 * 全角スペースはそのまま残す（日本語の読みやすさのため）。
 * 先頭末尾のドットと空白は除去。
 */
export function sanitizeForFileName(s) {
    if (!s) return '';
    const forbidden = /[<>:"/\\|?*\x00-\x1f]/g;
    let cleaned = s.replace(forbidden, '_');
    // 半角空白の連続を1個に圧縮
    cleaned = cleaned.replace(/ +/g, ' ');
    // 先頭末尾の . と空白を除去
    cleaned = cleaned.replace(/^[\s.]+|[\s.]+$/g, '');
    // 長すぎる場合は切り詰める（100 字）
    if (cleaned.length > 100) cleaned = cleaned.slice(0, 100);
    return cleaned;
}

/**
 * 既存ファイル名との衝突を検知し、必要なら _2、_3 などを付けて回避する。
 *
 * @param {string} proposedName - 例: "虚空の三叉_01_第1章.txt"
 * @param {string[]} existingNames - 同じディレクトリの既存ファイル名一覧
 * @returns {string} 衝突しないファイル名
 */
export function resolveFileNameCollision(proposedName, existingNames) {
    if (!existingNames.includes(proposedName)) return proposedName;
    const { baseName, extension } = splitFileName(proposedName);
    let n = 2;
    while (true) {
        const candidate = `${baseName}_${n}${extension}`;
        if (!existingNames.includes(candidate)) return candidate;
        n++;
        if (n > 999) throw new Error(`cannot resolve collision for ${proposedName}`);
    }
}

/**
 * 前後 400 字のプレビュー用コンテキストを取る。
 *
 * @param {string} text
 * @param {number} offset
 * @param {number} [windowSize=400]
 * @returns {{ before: string, after: string }}
 */
export function getContextAroundOffset(text, offset, windowSize = 400) {
    const before = text.slice(Math.max(0, offset - windowSize), offset);
    const after = text.slice(offset, Math.min(text.length, offset + windowSize));
    return { before, after };
}
```

#### 3.1.2 設計ポイント

- **純粋関数のみ**。fs・DOM・window を触らない
- ステートフルな変更（`removeSegment`、`updateDisplayName`）は**新オブジェクトを返す**不変更新
- `rebuildSegmentContents` は **呼び出し側の責務で呼ぶ**。内部で勝手に sourceText を保持しない
- エラーは例外で、戻り値では不整合を返さない

### 3.2 テスト：`src/utils/splitByChapters.test.cjs`

```js
#!/usr/bin/env node
// node src/utils/splitByChapters.test.cjs

async function main() {
    const mod = await import('./splitByChapters.js');
    const {
        createSplitPlan,
        removeSegment,
        rebuildSegmentContents,
        updateDisplayName,
        splitFileName,
        buildProposedFileName,
        sanitizeForFileName,
        resolveFileNameCollision,
        getContextAroundOffset,
    } = mod;

    let passed = 0, failed = 0;
    function expect(name, cond, detail) {
        if (cond) { passed++; console.log(`  ✓ ${name}`); }
        else { failed++; console.error(`  ✗ ${name}${detail ? ': ' + String(detail).slice(0, 200) : ''}`); }
    }

    // ... テスト関数定義（下記を実装）...

    const tests = [
        testSplitFileName,
        testSanitizeForFileName,
        testBuildProposedFileName,
        testResolveFileNameCollision,
        testGetContextAroundOffset,
        testCreateSplitPlanBasic,
        testCreateSplitPlanNoBoundary,
        testCreateSplitPlanMultipleChapters,
        testRemoveSegment,
        testRemoveFirstSegmentIsNoop,
        testRebuildSegmentContents,
        testUpdateDisplayName,
        testSplitPlanRoundTrip,
        testRemoveThenRebuild,
    ];

    for (const t of tests) {
        try { await t(); }
        catch (e) { failed++; console.error(`  ✗ ${t.name} threw:`, e.message); }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
```

テストケース実装例：

```js
async function testCreateSplitPlanMultipleChapters() {
    console.log('testCreateSplitPlanMultipleChapters');
    const text = '序文。\n■第1章 始まり\n本文1\n■第2章 中盤\n本文2\n■第3章 終章\n本文3';
    const plan = createSplitPlan(text, '虚空の三叉.txt');
    expect('4 segments (prologue + 3 chapters)', plan.segments.length === 4);
    expect('first is "冒頭"', plan.segments[0].displayName === '冒頭');
    expect('second matches chapter 1', plan.segments[1].displayName === '第1章 始まり');
    expect('third matches chapter 2', plan.segments[2].displayName === '第2章 中盤');
    expect('last matches chapter 3', plan.segments[3].displayName === '第3章 終章');
}

async function testSplitPlanRoundTrip() {
    console.log('testSplitPlanRoundTrip');
    // 分割した各セグメントを結合すれば元テキストに戻る
    const text = '序文。\n■第1章 始まり\n本文1\n■第2章 中盤\n本文2';
    const plan = createSplitPlan(text, 'sample.txt');
    const reconstructed = plan.segments.map(s => s.content).join('');
    expect('round-trip matches', reconstructed === text);
}

async function testRemoveThenRebuild() {
    console.log('testRemoveThenRebuild');
    const text = '序文。\n■第1章 A\n本文1\n■第2章 B\n本文2\n■第3章 C\n本文3';
    let plan = createSplitPlan(text, 'sample.txt');
    expect('initial 4 segments', plan.segments.length === 4);
    // 第2章（index 2）を除外 → 第1章と第3章だけ残る（3 セグメント）
    plan = removeSegment(plan, 2);
    plan = rebuildSegmentContents(plan, text);
    expect('3 segments after removal', plan.segments.length === 3);
    // 除外された中身は前のセグメント（第1章）に統合される
    expect('chapter 1 absorbed chapter 2',
        plan.segments[1].content.includes('第1章 A') && plan.segments[1].content.includes('第2章 B'));
    // 結合するとテキスト全体が復元される
    const reconstructed = plan.segments.map(s => s.content).join('');
    expect('round-trip after removal', reconstructed === text);
}

async function testSanitizeForFileName() {
    console.log('testSanitizeForFileName');
    expect('removes slash', sanitizeForFileName('a/b') === 'a_b');
    expect('removes backslash', sanitizeForFileName('a\\b') === 'a_b');
    expect('removes colon', sanitizeForFileName('a:b') === 'a_b');
    expect('keeps japanese spaces', sanitizeForFileName('第1章 始まり') === '第1章 始まり');
    expect('trims whitespace', sanitizeForFileName('  hello  ') === 'hello');
    expect('empty stays empty', sanitizeForFileName('') === '');
    expect('truncates long', sanitizeForFileName('a'.repeat(200)).length === 100);
}

async function testResolveFileNameCollision() {
    console.log('testResolveFileNameCollision');
    expect('no collision', resolveFileNameCollision('foo.txt', ['bar.txt']) === 'foo.txt');
    expect('one collision', resolveFileNameCollision('foo.txt', ['foo.txt']) === 'foo_2.txt');
    expect('two collisions',
        resolveFileNameCollision('foo.txt', ['foo.txt', 'foo_2.txt']) === 'foo_3.txt');
}

// 他のテストも同様のパターンで書く
```

**目標**：14 テスト全 pass。

### 3.3 `src/hooks/useSplitByChapters.js`

分割実行のオーケストレーション。純粋ロジック + IO + ユーザーフィードバックを繋ぐ。

#### 3.3.1 インターフェース

```js
import { useState, useCallback } from 'react';
import { fileSystem } from '../utils/fileSystem';
import {
    createSplitPlan,
    removeSegment,
    rebuildSegmentContents,
    updateDisplayName,
    resolveFileNameCollision,
} from '../utils/splitByChapters';

/**
 * useSplitByChapters
 *
 * 章ごと分割機能のフック。
 * - モーダルの開閉管理
 * - 現在の計画 (SplitPlan) を保持
 * - 分割実行（バックアップ → 新ファイル作成 → ロールバック）
 */
export function useSplitByChapters({
    activeFileHandle,   // 現在開いているファイル
    text,               // そのファイルの本文
    projectHandle,      // プロジェクトルート
    refreshMaterials,   // 再読み込み
    showToast,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [plan, setPlan] = useState(null);
    const [sourceText, setSourceText] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);

    const openModal = useCallback(() => {
        if (!activeFileHandle || !text) {
            showToast('ファイルが開かれていません');
            return;
        }
        const fileName = typeof activeFileHandle === 'string'
            ? activeFileHandle.split(/[/\\]/).pop()
            : (activeFileHandle.name || 'untitled.txt');
        const newPlan = createSplitPlan(text, fileName);
        setSourceText(text);
        setPlan(newPlan);
        setIsOpen(true);
    }, [activeFileHandle, text, showToast]);

    const closeModal = useCallback(() => {
        setIsOpen(false);
        setPlan(null);
        setSourceText('');
    }, []);

    const handleRemoveSegment = useCallback((index) => {
        if (!plan) return;
        let next = removeSegment(plan, index);
        next = rebuildSegmentContents(next, sourceText);
        setPlan(next);
    }, [plan, sourceText]);

    const handleRenameSegment = useCallback((index, newName) => {
        if (!plan) return;
        setPlan(updateDisplayName(plan, index, newName));
    }, [plan]);

    const executeSplit = useCallback(async () => {
        if (!plan || !activeFileHandle || !projectHandle) return;
        setIsExecuting(true);

        // 実装は §3.3.2 参照
        try {
            await performSplit({ plan, activeFileHandle, projectHandle, sourceText });
            showToast(`${plan.segments.length} ファイルに分割しました`);
            await refreshMaterials();
            closeModal();
        } catch (e) {
            console.error('[split] failed:', e);
            showToast(`分割に失敗しました: ${e.message}`);
        } finally {
            setIsExecuting(false);
        }
    }, [plan, activeFileHandle, projectHandle, sourceText, showToast, refreshMaterials, closeModal]);

    return {
        isOpen,
        plan,
        isExecuting,
        openModal,
        closeModal,
        handleRemoveSegment,
        handleRenameSegment,
        executeSplit,
    };
}
```

#### 3.3.2 `performSplit` の詳細

このフックの核心。バックアップ → 新ファイル作成 → ロールバック を行う。

```js
/**
 * 分割を実行する。
 *
 * 1. 元ファイルのディレクトリと基本情報を特定
 * 2. 元ファイルを <dir>/.backup/<name>_original_<ts>.txt にコピー（atomic）
 * 3. 新ファイル群を atomic write で順次作成
 *    - 既存ファイル名と衝突したら自動回避（resolveFileNameCollision）
 * 4. 途中で失敗したら、これまで作った新ファイルを削除（ロールバック）
 *    - バックアップは残す（ユーザーが手動で復元可能）
 * 5. 全部成功したら resolve
 *
 * 元ファイルは削除しない。両方存在する。
 */
async function performSplit({ plan, activeFileHandle, projectHandle, sourceText }) {
    // Step 1: ディレクトリ特定
    const filePath = typeof activeFileHandle === 'string'
        ? activeFileHandle
        : (activeFileHandle.handle || activeFileHandle.path);
    if (typeof filePath !== 'string') {
        throw new Error('cannot determine file path');
    }
    const sep = filePath.includes('\\') ? '\\' : '/';
    const parentDir = filePath.substring(0, filePath.lastIndexOf(sep));

    // Step 2: バックアップ作成
    //   .backup/ ディレクトリが無ければ作る
    const backupDirPath = `${parentDir}${sep}.backup`;
    try {
        await fileSystem.createFolder(
            { handle: parentDir, name: parentDir.split(sep).pop(), kind: 'directory' },
            '.backup'
        );
    } catch (e) {
        // 既にある場合は無視
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `${plan.baseName}_original_${ts}${plan.extension}`;
    const backupPath = `${backupDirPath}${sep}${backupFileName}`;
    await fileSystem.writeFile(
        { handle: backupPath, name: backupFileName, kind: 'file' },
        sourceText
    );

    // Step 3: 既存ファイル一覧を取得して衝突チェック
    const parentDirHandle = { handle: parentDir, name: parentDir.split(sep).pop(), kind: 'directory' };
    const existingEntries = await fileSystem.readDirectory(parentDirHandle);
    const existingNames = (existingEntries || [])
        .filter(e => e.kind === 'file')
        .map(e => e.name);

    // Step 4: 新ファイル群を atomic write で作成
    const createdPaths = [];
    try {
        for (const segment of plan.segments) {
            const targetName = resolveFileNameCollision(segment.proposedFileName, existingNames);
            const targetPath = `${parentDir}${sep}${targetName}`;
            await fileSystem.writeFile(
                { handle: targetPath, name: targetName, kind: 'file' },
                segment.content
            );
            createdPaths.push(targetPath);
            existingNames.push(targetName);  // 次の衝突チェックに反映
        }
    } catch (err) {
        // Step 5: ロールバック
        console.error('[split] error, rolling back:', err);
        for (const p of createdPaths) {
            try {
                await fileSystem.deleteEntry({ handle: p, name: p.split(sep).pop(), kind: 'file' });
            } catch (e) {
                console.warn('[split] rollback delete failed for', p, e);
            }
        }
        // バックアップは残す（復元の手がかり）
        throw err;
    }

    // Step 6: 成功。元ファイルは削除せずそのまま。
    return { createdCount: createdPaths.length, backupPath };
}
```

### 3.4 `src/components/SplitByChaptersModal.jsx`

モーダル UI。既存の NEXUS のダイアログスタイルを踏襲する。

#### 3.4.1 骨格

```jsx
import React from 'react';
import { getContextAroundOffset } from '../utils/splitByChapters';
import './SplitByChaptersModal.css';

/**
 * SplitByChaptersModal
 *
 * 分割計画の確認モーダル。
 */
export default function SplitByChaptersModal({
    isOpen,
    plan,
    sourceText,
    isExecuting,
    onClose,
    onRemoveSegment,
    onRenameSegment,
    onExecute,
}) {
    if (!isOpen || !plan) return null;

    const noBoundaryFound = plan.segments.length <= 1;

    return (
        <div className="split-modal-overlay" onClick={isExecuting ? undefined : onClose}>
            <div className="split-modal" onClick={e => e.stopPropagation()}>
                <div className="split-modal-header">
                    <h2>章ごとに分割</h2>
                    <button
                        className="split-modal-close"
                        onClick={onClose}
                        disabled={isExecuting}
                    >✕</button>
                </div>

                <div className="split-modal-body">
                    {noBoundaryFound ? (
                        <div className="split-empty">
                            章境界（■、第N章、Markdown見出し、青空文庫タグ）が
                            見つかりませんでした。分割できません。
                        </div>
                    ) : (
                        <>
                            <div className="split-summary">
                                元ファイル: <strong>{plan.sourceFileName}</strong> ({plan.stats.totalChars.toLocaleString()} 字)
                                → <strong>{plan.segments.length}</strong> ファイルに分割予定
                            </div>

                            <div className="split-segments">
                                {plan.segments.map((seg, i) => (
                                    <SegmentCard
                                        key={i}
                                        segment={seg}
                                        sourceText={sourceText}
                                        onRemove={() => onRemoveSegment(i)}
                                        onRename={(name) => onRenameSegment(i, name)}
                                        canRemove={i > 0}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="split-modal-footer">
                    <button
                        className="btn-cancel"
                        onClick={onClose}
                        disabled={isExecuting}
                    >キャンセル</button>
                    <button
                        className="btn-execute"
                        onClick={onExecute}
                        disabled={isExecuting || noBoundaryFound}
                    >
                        {isExecuting ? '分割中…' : '分割する'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SegmentCard({ segment, sourceText, onRemove, onRename, canRemove }) {
    const { before, after } = getContextAroundOffset(sourceText, segment.startOffset, 400);
    // 先頭セグメント（index 0）は境界がないので before 表示不要
    const showBefore = segment.index > 0;

    return (
        <div className="split-segment-card">
            <div className="split-segment-head">
                <span className="seg-index">#{segment.index + 1}</span>
                <input
                    className="seg-title"
                    type="text"
                    value={segment.displayName}
                    onChange={(e) => onRename(e.target.value)}
                    placeholder="章タイトル"
                />
                <span className="seg-charcount">
                    {segment.charCount.toLocaleString()} 字
                </span>
                {canRemove && (
                    <button
                        className="seg-remove"
                        onClick={onRemove}
                        title="この境界を削除（前の章と結合）"
                    >除外</button>
                )}
            </div>
            {showBefore && (
                <div className="seg-context">
                    <div className="seg-context-label">境界直前（前の章の末尾）</div>
                    <pre className="seg-context-text before">{before.slice(-400)}</pre>
                </div>
            )}
            <div className="seg-context">
                <div className="seg-context-label">
                    {showBefore ? 'この章の冒頭' : '冒頭'}
                </div>
                <pre className="seg-context-text after">{after.slice(0, 400)}</pre>
            </div>
            <div className="seg-filename">
                → <code>{segment.proposedFileName}</code>
            </div>
        </div>
    );
}
```

### 3.5 `src/components/SplitByChaptersModal.css`

最低限のスタイル。既存テーマと馴染むよう、CSS 変数（`--bg-paper`、`--text-color`、`--accent-color`、`--border-color`）があればそれを流用。

```css
.split-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.split-modal {
    background: var(--bg-paper, #fff);
    color: var(--text-color, #333);
    border-radius: 8px;
    width: 90vw;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.split-modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #ddd);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.split-modal-header h2 {
    margin: 0;
    font-size: 1.1rem;
}

.split-modal-close {
    background: none;
    border: none;
    font-size: 1.3rem;
    cursor: pointer;
    color: var(--text-color, #666);
}

.split-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
}

.split-summary {
    padding: 12px;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 0.9rem;
}

.split-empty {
    padding: 40px;
    text-align: center;
    color: #888;
}

.split-segments {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.split-segment-card {
    border: 1px solid var(--border-color, #ddd);
    border-radius: 6px;
    padding: 12px;
    background: #fafafa;
}

.split-segment-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.seg-index {
    font-weight: bold;
    color: var(--accent-color, #8e44ad);
    min-width: 30px;
}

.seg-title {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.95rem;
}

.seg-charcount {
    font-size: 0.8rem;
    color: #666;
    white-space: nowrap;
}

.seg-remove {
    padding: 4px 10px;
    background: #eee;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
}

.seg-remove:hover {
    background: #fdd;
}

.seg-context {
    margin-top: 6px;
}

.seg-context-label {
    font-size: 0.75rem;
    color: #888;
    margin-bottom: 2px;
}

.seg-context-text {
    font-size: 0.85rem;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 8px;
    margin: 0;
    max-height: 120px;
    overflow-y: auto;
    white-space: pre-wrap;
    font-family: inherit;
}

.seg-context-text.before {
    border-left: 3px solid #ffa;
}

.seg-context-text.after {
    border-left: 3px solid #afa;
}

.seg-filename {
    margin-top: 8px;
    font-size: 0.85rem;
    color: #555;
}

.seg-filename code {
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: ui-monospace, monospace;
}

.split-modal-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border-color, #ddd);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.btn-cancel, .btn-execute {
    padding: 8px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.95rem;
    border: 1px solid #ccc;
}

.btn-cancel {
    background: #f0f0f0;
}

.btn-execute {
    background: var(--accent-color, #8e44ad);
    color: white;
    border-color: var(--accent-color, #8e44ad);
}

.btn-execute:disabled {
    background: #aaa;
    border-color: #aaa;
    cursor: not-allowed;
}
```

### 3.6 `src/App.jsx` への統合

#### 3.6.1 フックと状態追加

App.jsx で `useSplitByChapters` を呼び、モーダルをレンダー：

```jsx
// 既存の import に追加
import { useSplitByChapters } from './hooks/useSplitByChapters';
import SplitByChaptersModal from './components/SplitByChaptersModal';

// App コンポーネント内、既存のフック呼び出しの近く
const splitChapters = useSplitByChapters({
    activeFileHandle,
    text,
    projectHandle,
    refreshMaterials,
    showToast,
});
```

#### 3.6.2 ボタン追加（ExportPanel へ）

`src/components/ExportPanel.jsx` の「出力」セクションの上か下に、「編集ツール」セクションを追加する。**理由**：ExportPanel は既に「文字整形」「出力」のようなユーティリティ操作の集約場所で、ここに「章ごと分割」を置くのが自然。Editor header は既に機能が多くて混雑している。

```jsx
// ExportPanel.jsx の props に onSplitByChapters を追加
const ExportPanel = ({
    onFormat,
    onPrint,
    onEpubExport,
    onDocxExport,
    onBatchExport,
    onSplitByChapters,  // 新規追加
    colorTheme
}) => {
    // ... 既存コード ...

    return (
        <div style={{ height: '100%', overflowY: 'auto', fontFamily: 'var(--font-gothic)' }}>
            {/* 文字整形セクション（既存） */}
            <div style={sectionStyle}>
                {/* ... */}
            </div>

            {/* 編集ツールセクション（新規） */}
            {onSplitByChapters && (
                <div style={sectionStyle}>
                    <div style={headingStyle}>編集ツール</div>
                    <button
                        onClick={onSplitByChapters}
                        style={btnStyle}
                        onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                        onMouseLeave={e => e.target.style.background = 'none'}
                    >
                        ✂️ 章ごとにファイル分割
                    </button>
                </div>
            )}

            {/* 出力セクション（既存） */}
            <div style={sectionStyle}>
                {/* ... */}
            </div>
        </div>
    );
};
```

App.jsx で ExportPanel を使っている箇所に、`onSplitByChapters={splitChapters.openModal}` を渡す。

#### 3.6.3 モーダルのレンダー

App.jsx の JSX 末尾（他のモーダルがレンダーされているあたり）に：

```jsx
<SplitByChaptersModal
    isOpen={splitChapters.isOpen}
    plan={splitChapters.plan}
    sourceText={text}
    isExecuting={splitChapters.isExecuting}
    onClose={splitChapters.closeModal}
    onRemoveSegment={splitChapters.handleRemoveSegment}
    onRenameSegment={splitChapters.handleRenameSegment}
    onExecute={splitChapters.executeSplit}
/>
```

### 3.7 絶対に守ること

1. **Editor.jsx を触らない**（分割機能は Editor 本体と無関係）
2. **本番原稿を壊さない**。テストは常にフィクスチャで
3. **元ファイルを絶対に削除しない**。分割実行後も両方残す
4. **バックアップを必ず先に取る**。バックアップ作成失敗したら分割を中止
5. **ファイル名サニタイズ**を忘れない（`:`, `/`, `\` などを含む章タイトルが実在しうる）
6. **既存の 39＋α 件のテストを維持**
7. **純粋関数の部分は必ずテストを書く**（splitByChapters.js）
8. **コミット 3 回書き直したら Opus に戻す**

---

## 4. 完了条件

以下全部 [x] で完了：

- [ ] `feature/split-by-chapters` ブランチが作成されている
- [ ] `src/utils/splitByChapters.js` が作成され、§3.1 のインターフェースを実装している
- [ ] `src/utils/splitByChapters.test.cjs` が作成されている
- [ ] `node src/utils/splitByChapters.test.cjs` が **14 passed, 0 failed**
- [ ] `src/hooks/useSplitByChapters.js` が作成されている
- [ ] `src/components/SplitByChaptersModal.jsx` が作成されている
- [ ] `src/components/SplitByChaptersModal.css` が作成されている
- [ ] `src/App.jsx` に §3.6.1 と §3.6.3 の変更が入っている
- [ ] `src/components/ExportPanel.jsx` に §3.6.2 の変更が入っている
- [ ] `npm run build` が成功
- [ ] 既存の atomic write テスト（39+ 件）が全 pass
- [ ] 既存の boundaryDetector テスト（22+ 件）が全 pass
- [ ] 手動確認：小さいテストファイル（`■第1章\n本文\n■第2章\n本文`）を開いてボタン → モーダル表示 → 分割実行 で 2 ファイル作成される
- [ ] 手動確認：分割後、元ファイルが残っている
- [ ] 手動確認：`.backup/<name>_original_<ts>.txt` が作られている
- [ ] 手動確認：境界が 1 つもないファイルだと「見つかりません」メッセージが出る
- [ ] 手動確認：既存ファイル名と衝突する場合、自動で `_2` が付く
- [ ] §0.3 のコミットメッセージ雛形でコミット、push

---

## 5. 詰まったら

以下のいずれかで**即座に作業を止めて** Claude Opus に相談。

- コミット 3 回書き直しても §4 を満たせない
- 既存テストが 1 つでも fail する
- 分割実行で既存ファイルが壊れる
- モーダルが開かない、閉じない、レンダリングされない
- `fileSystem.readDirectory` の戻り値形式が違って衝突チェックが動かない
- `fileSystem.writeFile` のハンドル形式で迷う
- プロジェクトハンドルの型が想定と違う

相談時に貼るもの：
1. `git log --oneline -8`
2. 失敗しているテストの出力
3. 手動確認で発生した具体的事象（スクリーンショットの代わりにコンソールログと再現手順）
4. 変更した App.jsx / ExportPanel.jsx の該当行

---

## 6. この指示書の範囲外（やらないこと）

- FileTree.jsx への右クリックメニュー統合（将来、本文が分かれば別指示書で追加）
- 章タブモード・連続エディタモード（透明分割機構の話、やらない）
- 自動分割の提案（将来、閾値超過時に提案する機能）
- 境界のマニュアル追加 UI（今は自動検出のみで十分）
- 全章横断検索・置換（別指示書）
- 分割後の自動ソート（ファイル名の連番で自然に並ぶ）

1 指示書 1 責務。

---

## 7. 補足

この指示書で冬之助さんが得るもの：

- 42 万字ファイルをワンクリック + 確認で 13 章ファイルに分割できる
- 元ファイルは残るので、分割に失敗したり気に入らなければやり直せる
- 他の巨大ファイル（他作品）にも同じ機能を使える
- 分割された各ファイルは 3〜5 万字なので、NEXUS で打鍵即時になる
- 賞応募時は既存の `handleBatchExport` で全部結合して 1 ファイル出力できる

この 1 機能で、冬之助さんが「章ごとに分けたい他の巨大ファイル」にも同じ操作が効く。汎用性があり、投資対効果が高い。

Sonnet が迷走する最大のリスクは `fileSystem` アダプタの型。既存の `useFileOperations.js` を参考にしながら、同じ形でハンドルを扱うことを徹底すること。
