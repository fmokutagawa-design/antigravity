# 指示書 C：章境界検出ユーティリティ

> コーディングエージェント（Sonnet 向け推奨）。  
> **1 ターンで実装完了できる粒度**。純粋関数なので副作用なし、テスト書きやすい。  
> 詰まったら即座に止めて Claude Opus に戻す。

---

## 0. 前提

### 0.1 作業環境

- **リポジトリ**：https://github.com/fmokutagawa-design/antigravity.git
- **派生元ブランチ**：`feature/uncontrolled-editor-v3`
- **派生元コミット**：`5ac247a`（atomic write 実装直後）
- **新ブランチ名**：`feature/boundary-detector`

### 0.2 ブランチ作成手順

```bash
git checkout feature/uncontrolled-editor-v3
git pull
git checkout -b feature/boundary-detector
```

### 0.3 完了後のコミットメッセージ雛形

```
feat(segmentation): add pure boundary detection utility

Adds src/utils/boundaryDetector.js as a pure, side-effect-free module for
detecting chapter/section boundaries in novel manuscripts.

- findBoundaryCandidates(text, options): returns sorted boundary candidates
- validateBoundary(text, offset): checks boundary is safe (not inside
  ruby, aozora-tag, font-tag, emphasis, link, or surrogate pair)
- Supports patterns: ■, 第N章/話/幕, Markdown headings (#),
  aozora headings (［＃大見出し］), page breaks (［＃改ページ］),
  and optionally 3+ blank lines
- No Editor/App integration; this commit only adds the utility and tests.
  Integration into UI is deferred to future work.

Closes instruction C.
```

---

## 1. 目的

NEXUS 原稿テキストから**章境界の候補位置**を検出する純粋関数ユーティリティを作る。

この関数は：

- **副作用なし**（DOM も fs も触らない）
- **入出力のみ**（テスト書きやすい）
- **Renderer 側・Main 側どちらからも使える**
- 将来の分割機構・境界表示・手動分割 UI の**コアユーティリティ**になる

### なぜ組み込みしないのか

**現時点では Editor や App には一切組み込まない**。関数を用意してテストだけ通る状態で止める。理由：

1. Editor.jsx は uncontrolled 化の echo suppression で繊細。触ればリスクが跳ね上がる
2. 純粋関数だけなら既存機能を**絶対に壊さない**
3. 関数の正しさをテストで担保した状態で、将来いつでも組み込める
4. 指示書を小さく保てる（1 ターンで完了）

---

## 2. ファイル構成

### 2.1 新規作成するファイル

- `src/utils/boundaryDetector.js` — 本体（ESM、renderer 側で import 可能）
- `src/utils/boundaryDetector.test.cjs` — 単体テスト（CommonJS、node で直接実行）

### 2.2 変更する既存ファイル

- **なし**（組み込み一切なし）

### 2.3 絶対に触らないファイル

- **`src/components/Editor.jsx`**（絶対禁止）
- `src/App.jsx`
- `src/hooks/` 配下すべて
- `electron/` 配下すべて
- `vite.config.js` 等のビルド設定

---

## 3. 実装仕様

### 3.1 モジュール形式の判断

`src/utils/` 配下の既存ファイルを見て書き方を合わせる。例えば `src/utils/atomicWrite.js`（存在しない可能性あり、`electron/atomicWrite.cjs` は CJS）があればその形式、なければ他の `src/utils/*.js` に準拠する。

**このプロジェクトは Vite + React なので ESM が普通**。`src/utils/boundaryDetector.js` は `export function ...` 形式で書く。

テストファイル `boundaryDetector.test.cjs` は**CommonJS**。理由：node 単独実行時の ESM import の手間を避けるため。ESM の本体を CJS から読むには dynamic import が必要なので、それを使う：

```js
// boundaryDetector.test.cjs
async function main() {
    const mod = await import('./boundaryDetector.js');
    const { findBoundaryCandidates, validateBoundary } = mod;
    // ... テスト ...
}
main().catch(e => { console.error(e); process.exit(1); });
```

**もし dynamic import が動かない環境なら**、boundaryDetector.js も CJS にしてよい（`module.exports = {...}`）。その場合 renderer 側から使う際は Vite が CJS を解決してくれる。**プロジェクトの既存 src/utils/ の主流に合わせる**のが最終判断。

### 3.2 型定義（JSDoc）

TypeScript でなく JavaScript + JSDoc で型を書く（既存プロジェクトが JS）：

```js
/**
 * @typedef {Object} BoundaryCandidate
 * @property {number} offset
 *     テキスト先頭からの文字オフセット（UTF-16 code unit、
 *     String.prototype.length と一致。サロゲートペアは 2 カウント）。
 *     境界はこの offset の直前で切る想定
 *     （= offset 位置の文字が「新しいセグメントの先頭」になる）
 * @property {'chapter' | 'section' | 'paragraph' | 'aozora-pagebreak'} type
 * @property {string} marker
 *     検出された境界マーカーそのもの（例: "■", "第一章", "## ", "［＃大見出し］"）
 * @property {string} titleCandidate
 *     境界直後の行から抽出した章タイトル候補（なければ空文字列）。
 *     マーカー部分は除外、前後空白は trim
 * @property {number} confidence - 0.0〜1.0 の信頼度
 */

/**
 * @typedef {Object} BoundaryDetectOptions
 * @property {boolean} [includeChapter=true]     - ■ / 第N章 を検出するか
 * @property {boolean} [includeMarkdown=true]    - Markdown 見出しを検出するか
 * @property {boolean} [includeAozora=true]      - 青空文庫タグを検出するか
 * @property {boolean} [includeBlankLines=false] - 空行 3 連を検出するか（デフォルト off）
 */
```

### 3.3 `findBoundaryCandidates(text, options)` の仕様

```js
/**
 * @param {string} text
 * @param {BoundaryDetectOptions} [options]
 * @returns {BoundaryCandidate[]}  offset の昇順ソート済み、重複なし
 */
export function findBoundaryCandidates(text, options = {}) {
    // 1. 各パターンで全マッチ取得
    // 2. 各マッチを BoundaryCandidate に変換
    // 3. offset でソート
    // 4. 同じ offset で重複する場合は confidence が高い方を優先
    // 5. return
}
```

### 3.4 パターン検出の詳細

#### 3.4.1 `■` の行頭検出

- 行頭に `■`（U+25A0）
- その行全体（改行まで）をマッチ範囲とする
- 正規表現例: `/^■.*/gm`
  - `^` は `m` フラグで行頭
  - `.*` は改行を含まないので行末まで取れる
- marker: `"■"`
- titleCandidate: マッチ行から先頭 `■` を除いた残り（trim 済み）
- type: `'chapter'`, confidence: `0.95`

#### 3.4.2 `第N章` / `第N話` / `第N幕` の行頭検出

- 行頭に `第` + 数字 + `章`/`話`/`幕`
- 数字：半角 `0-9`、全角 `０-９`、漢数字 `一二三四五六七八九十百千万零`
- 正規表現例: `/^第[0-9０-９一二三四五六七八九十百千万零]+[章話幕].*/gm`
- marker: マッチ冒頭部分（`第X章` など）
- titleCandidate: マッチ行から marker 部分を除いた残り（trim）
- type: `'chapter'`, confidence: `0.9`

#### 3.4.3 Markdown 見出し

- 行頭に `#` / `＃` が 1 個以上、その後にスペース + タイトル
- 正規表現例: `/^[#＃]+\s.*/gm`
- marker: 先頭の `#` 群 + 最初の空白まで（例: `"## "`）
- titleCandidate: 残り（trim）
- type: `'section'`, confidence: `0.85`

#### 3.4.4 青空文庫見出し

- `［＃大見出し］` / `［＃中見出し］` / `［＃小見出し］`
- 半角版 `[＃大見出し]` / `[＃中見出し]` / `[＃小見出し]` も受ける
- 行頭限定ではない（行中にあることも多い）
- 正規表現例: `/[［\[]＃(大|中|小)見出し[］\]]/g`
- marker: マッチそのもの
- titleCandidate: 同じ行で、マッチ直後から改行まで（trim）
- type:
  - 大見出し → `'chapter'`, confidence `0.95`
  - 中見出し → `'section'`, confidence `0.85`
  - 小見出し → `'section'`, confidence `0.75`

#### 3.4.5 青空文庫改ページタグ

- `［＃改ページ］` / `[＃改ページ]`
- 正規表現例: `/[［\[]＃改ページ[］\]]/g`
- marker: マッチそのもの
- titleCandidate: `""`
- type: `'aozora-pagebreak'`, confidence `0.9`

#### 3.4.6 空行 3 連以上（オプション）

- `\n\n\n` 以上（実体は `\n{3,}`）
- オプション `includeBlankLines: true` のときのみ検出
- 正規表現例: `/\n{3,}/g`
- marker: `"\n\n\n"`（長さは可変だが、3 で代表）
- titleCandidate: `""`
- type: `'paragraph'`, confidence `0.4`
- offset はマッチの**最後の改行の直後**（新しいセグメントの先頭位置）

### 3.5 重複処理

同一 offset に複数候補が出た場合（例: 行頭に `■` があり、さらに同じ行に `［＃大見出し］` がある場合）、

- **confidence が高い方を残す**
- confidence が同じなら先に見つかった方を残す

### 3.6 `validateBoundary(text, offset)` の仕様

指定 offset で分割した場合、ペア構造を壊さないかをチェックする。

#### 3.6.1 チェック対象の構造

| 構造 | 開始 | 終了 | 入れ子許可 |
|---|---|---|---|
| ルビ | `《` | `》` | 不可（素朴にカウント） |
| 青空文庫タグ | `［＃` | `］` | 不可 |
| フォントタグ | `{font:...}` | `{/font}` | 可 |
| 強調 | `**` | `**` | 不可（トグル方式） |
| リンク（半角） | `[[` | `]]` | 不可 |
| リンク（全角） | `［［` | `］］` | 不可 |

#### 3.6.2 アルゴリズム（シンプル版）

テキストを先頭から offset まで走査し、各構造の深さを数える：

```js
export function validateBoundary(text, offset) {
    // 範囲外チェック
    if (offset < 0 || offset > text.length) {
        return { valid: false, reason: 'offset out of range', brokenStructure: 'none' };
    }

    // サロゲートペアの真ん中チェック
    if (offset > 0 && offset < text.length) {
        const prev = text.charCodeAt(offset - 1);
        if (prev >= 0xD800 && prev <= 0xDBFF) {
            return {
                valid: false,
                reason: 'offset splits a surrogate pair',
                brokenStructure: 'surrogate',
            };
        }
    }

    // 各構造の開閉をカウント
    let rubyOpen = 0;
    let aozoraOpen = 0;
    let fontOpen = 0;
    let emphasisOpen = false;
    let linkHalfOpen = 0;
    let linkFullOpen = 0;

    let i = 0;
    while (i < offset) {
        // 長いリテラルから優先的にマッチさせる
        if (text.startsWith('{font:', i)) {
            // {font:...} を探す
            const end = text.indexOf('}', i + 6);
            if (end !== -1 && end < offset) {
                fontOpen++;
                i = end + 1;
                continue;
            }
            // 閉じていない {font: は壊れたタグ、スキップ
            i++;
            continue;
        }
        if (text.startsWith('{/font}', i)) {
            fontOpen = Math.max(0, fontOpen - 1);
            i += 7;
            continue;
        }
        if (text.startsWith('**', i)) {
            emphasisOpen = !emphasisOpen;
            i += 2;
            continue;
        }
        if (text.startsWith('［［', i)) {
            linkFullOpen++;
            i += 2;
            continue;
        }
        if (text.startsWith('］］', i)) {
            linkFullOpen = Math.max(0, linkFullOpen - 1);
            i += 2;
            continue;
        }
        if (text.startsWith('[[', i)) {
            linkHalfOpen++;
            i += 2;
            continue;
        }
        if (text.startsWith(']]', i)) {
            linkHalfOpen = Math.max(0, linkHalfOpen - 1);
            i += 2;
            continue;
        }
        const ch = text[i];
        if (ch === '《') { rubyOpen++; i++; continue; }
        if (ch === '》') { rubyOpen = Math.max(0, rubyOpen - 1); i++; continue; }
        if (text.startsWith('［＃', i)) { aozoraOpen++; i += 2; continue; }
        if (ch === '］' && aozoraOpen > 0) { aozoraOpen--; i++; continue; }
        i++;
    }

    if (rubyOpen > 0) return { valid: false, reason: 'inside ruby', brokenStructure: 'ruby' };
    if (aozoraOpen > 0) return { valid: false, reason: 'inside aozora tag', brokenStructure: 'aozora-tag' };
    if (fontOpen > 0) return { valid: false, reason: 'inside font tag', brokenStructure: 'font-tag' };
    if (emphasisOpen) return { valid: false, reason: 'inside emphasis', brokenStructure: 'emphasis' };
    if (linkHalfOpen > 0) return { valid: false, reason: 'inside half-width link', brokenStructure: 'link-half' };
    if (linkFullOpen > 0) return { valid: false, reason: 'inside full-width link', brokenStructure: 'link-full' };

    return { valid: true };
}
```

**注意**：このアルゴリズムは O(offset) で、42 万字の末尾近くを validate するのは遅い可能性がある。**オプションの高速化**として、パターン全マッチを 1 回だけ事前計算して bisect で検索する方法があるが、初期実装では上記の単純版で十分（42 万字で 100ms 以下）。

### 3.7 パフォーマンス目標

- `findBoundaryCandidates(text)`: 42 万字で **200ms 以内**
- `validateBoundary(text, offset)`: 42 万字で **100ms 以内**

達成できない場合は Claude Opus に相談。

---

## 4. テスト

### 4.1 `src/utils/boundaryDetector.test.cjs`

```js
#!/usr/bin/env node
// 実行: node src/utils/boundaryDetector.test.cjs

async function main() {
    const { findBoundaryCandidates, validateBoundary } = await import('./boundaryDetector.js');

    let passed = 0, failed = 0;
    function expect(name, cond, detail) {
        if (cond) { passed++; console.log(`  ✓ ${name}`); }
        else { failed++; console.error(`  ✗ ${name}${detail ? ': ' + String(detail).slice(0, 200) : ''}`); }
    }

    // ここにテスト関数を書く

    // main の最後で実行
    const tests = [
        testBasicSquareBlock,
        testDaiNShoBasic,
        testDaiNShoVariants,
        testMarkdownHeading,
        testAozoraHeadings,
        testAozoraPageBreak,
        testBlankLinesOptional,
        testSortedByOffset,
        testNoDuplicateSameOffset,
        testTitleTrimming,
        testEmptyText,
        testValidateValid,
        testValidateInRuby,
        testValidateInAozoraTag,
        testValidateInFontTag,
        testValidateInEmphasis,
        testValidateInLinkHalf,
        testValidateInLinkFull,
        testValidateValidBetweenPairs,
        testValidateSurrogateSplit,
        testValidateOutOfRange,
        testPerformanceLargeText,
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

### 4.2 テストケース一覧（22 件）

| 番号 | テスト名 | 内容 |
|---|---|---|
| 1 | testBasicSquareBlock | `"本文\n■第二章\n続き"` → 1 候補、marker `■`、title `"第二章"` |
| 2 | testDaiNShoBasic | `"前文\n第一章 運命\n後文"` → marker `第一章`、title `"運命"` |
| 3 | testDaiNShoVariants | 半角数字・全角数字・漢数字、章/話/幕 全部検出 |
| 4 | testMarkdownHeading | `# 序章`, `## サブ` で 2 候補、marker それぞれ `# `, `## ` |
| 5 | testAozoraHeadings | 大見出し・中見出し・小見出しをそれぞれ検出、confidence 降順 |
| 6 | testAozoraPageBreak | `［＃改ページ］` → type `'aozora-pagebreak'`, title `""` |
| 7 | testBlankLinesOptional | デフォルトでは空行 3 連を検出しない、オプション ON で検出 |
| 8 | testSortedByOffset | 複数マーカー混在で offset 昇順 |
| 9 | testNoDuplicateSameOffset | 同 offset に複数候補 → 1 件に集約（confidence 高い方） |
| 10 | testTitleTrimming | `"■　　空白付き章名　　"` → title trim された結果 |
| 11 | testEmptyText | `""` → `[]` |
| 12 | testValidateValid | 普通の文字間で valid |
| 13 | testValidateInRuby | `"漢字《ふりがな》"` の 3〜7 文字目で invalid (ruby) |
| 14 | testValidateInAozoraTag | `"［＃大見出し］"` の中間 invalid |
| 15 | testValidateInFontTag | `"{font:serif}テキスト{/font}"` の中間 invalid |
| 16 | testValidateInEmphasis | `"前**強調**後"` の `**` 内部 invalid |
| 17 | testValidateInLinkHalf | `"[[リンク]]"` 内部 invalid |
| 18 | testValidateInLinkFull | `"［［リンク］］"` 内部 invalid |
| 19 | testValidateValidBetweenPairs | `"《a》普通《b》"` の「普通」範囲 valid |
| 20 | testValidateSurrogateSplit | `"a🍣b"` で寿司絵文字の真ん中 invalid (surrogate) |
| 21 | testValidateOutOfRange | offset < 0 または > text.length で invalid |
| 22 | testPerformanceLargeText | 42 万字で findBoundaryCandidates が 200ms 以内 |

### 4.3 実装例

```js
async function testBasicSquareBlock() {
    console.log('testBasicSquareBlock');
    const text = '本文の最後。\n■第二章 嵐の前触れ\n雪が降っていた。';
    const candidates = findBoundaryCandidates(text);
    expect('one candidate', candidates.length === 1);
    expect('type chapter', candidates[0].type === 'chapter');
    expect('marker ■', candidates[0].marker === '■');
    expect('title extracted', candidates[0].titleCandidate === '第二章 嵐の前触れ');
    expect('offset at ■', text[candidates[0].offset] === '■');
}

async function testValidateInRuby() {
    console.log('testValidateInRuby');
    const text = '漢字《ふりがな》の後';
    // 《 は offset 2、》 は offset 8
    // offset 4（「ふ」）は《》の内部
    const result = validateBoundary(text, 4);
    expect('invalid', result.valid === false);
    expect('ruby', result.brokenStructure === 'ruby');
}

async function testPerformanceLargeText() {
    console.log('testPerformanceLargeText');
    // 42 万字のダミーテキスト
    const chunks = [];
    for (let i = 0; i < 100; i++) {
        chunks.push(`■第${i}章 ダミー\n`);
        chunks.push('あ'.repeat(4200)); // 各章約 4200 字
        chunks.push('\n');
    }
    const text = chunks.join('');
    expect('text size check', text.length >= 400000);

    const t0 = Date.now();
    const candidates = findBoundaryCandidates(text);
    const elapsed = Date.now() - t0;

    expect('under 200ms', elapsed < 200, `elapsed=${elapsed}ms`);
    expect('100 candidates', candidates.length === 100);
}
```

---

## 5. 絶対遵守ルール

1. **Editor.jsx・App.jsx・hooks/ を一切触らない**（組み込みは完全後回し）
2. **純粋関数として実装**。fs・DOM・window・setTimeout・console.log 以外の副作用なし
3. **既存の atomic write テスト（39 件）を壊さない**
4. **正規表現の greedy / lazy に注意**。特に青空文庫タグのようなマッチは lazy で
5. **offset は必ず String.length 準拠**（UTF-16 code unit）
6. **パフォーマンス目標を満たす**（42 万字で 200ms / 100ms）
7. **ビルドが通らないコミットを push しない**
8. **既存 `src/utils/` のコーディングスタイル（インデント、セミコロン、アロー関数の使い方）に合わせる**
9. **コミットを 3 回以上書き直したら止めて Claude Opus に戻す**

---

## 6. 完了条件

以下全部 [x] で完了：

- [ ] `feature/boundary-detector` ブランチが作成されている
- [ ] `src/utils/boundaryDetector.js` が作成され、§3.1 のインターフェースを実装している
- [ ] `src/utils/boundaryDetector.test.cjs` が作成されている
- [ ] `node src/utils/boundaryDetector.test.cjs` が **22 passed, 0 failed**
- [ ] `npm run build` が成功
- [ ] 既存の atomic write テスト 39 件が全 pass
- [ ] Electron を起動し、既存機能（ファイルを開く・編集・保存）が問題なく動く
- [ ] §0.3 のコミットメッセージ雛形でコミット、push

---

## 7. 詰まったら

以下のいずれかに当てはまったら**即座に作業を止めて** Claude Opus に相談する。

- コミットを 3 回書き直しても §6 を満たせない
- 正規表現の greedy マッチで複数タグが 1 件にまとめられてしまう
- ESM / CommonJS の相互運用で Vite ビルドが壊れる
- 42 万字パフォーマンステストが 200ms を超える
- サロゲートペアの扱いで挙動が読めない
- 青空文庫タグや `**` の入れ子で挙動判定がつかない

相談時に貼るもの：

1. `git log --oneline -5`
2. `node src/utils/boundaryDetector.test.cjs` の全出力
3. 失敗しているテストケースのコードと期待値・実際の値
4. ビルド失敗時は `npm run build` の全エラー出力

---

## 8. この指示書の範囲外（やらないこと）

- Editor.jsx への境界表示の組み込み（将来）
- 自動分割の実行（将来）
- ユーザー確認ダイアログ UI（将来）
- 境界に基づくファイル分割（将来）
- 設定 UI で検出パターンを ON/OFF（将来）
- 境界の永続保存（manifest.json、将来）
- atomic write との連携（将来）

**この指示書の産物は「2 関数 + テスト」だけ**。組み込みは完全後回し。

---

## 9. 補足

この指示書は**全 3 本の中で最も「新規ロジック」を含む**が、純粋関数なので**副作用が起きない**ことで実装の安全性を担保している。境界検出ロジックに多少のバグがあっても、呼ばれていないので NEXUS は無傷。

Sonnet に任せる想定。正規表現・パターン分岐・テスト網羅はもっとも AI が得意な領域で、かつ独立モジュールなので指示が守りやすい。Sonnet が詰まった場合は即座に Opus に戻すこと。迷走が最大のリスク。

完成すると、将来の実装で：

- 「章境界を画面上で示す」UI 追加が容易
- 「手動分割」UI の境界提案部分が即書ける
- 「自動分割」の境界選定部分が完成品として使える

つまり**投資対効果が高い 1 コミット**。1 ターンで出て、長く使える。
