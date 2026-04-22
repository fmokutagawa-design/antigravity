# 設計書 D：実装フェーズ計画

NEXUS 透明分割機構の第 4 部、最終章。A・B・C で定義した仕様を、壊さずに、現実的な時間で、どう実装するか。

## 0. この設計書の原則

### 0.1 段階的、検証可能、ロールバック可能

各フェーズは独立して価値を提供し、完了時点で「使える状態」になる。途中で中断しても NEXUS が壊れない。ある phase で問題が出たら、その phase の前まで戻せる。

### 0.2 本番原稿を最後まで守る

冬之助さんの原稿（ガンダム 42 万字、ノチユ、ざつがみ他）は、実装全期間を通じて**物理的に触らない**。すべての検証は `test_fixtures/` のダミーファイルで行う。本番適用は最終フェーズの最後、冬之助さん自身の明示的操作で初めて起こる。

### 0.3 各フェーズに「通過条件」を定義する

次のフェーズに進むために何が完了している必要があるかを、曖昧にしない。Perplexity Sonnet や Gemini 3 Flash でも機械的にチェックできる粒度で書く。

### 0.4 誰が書くか

各フェーズごとに「主実装者」と「検証者」を定義する。Claude（Opus）が書くべき部分、Gemini 3 Flash に任せてよい部分、冬之助さん自身で確認すべき部分を分ける。

### 0.5 並行作業と排他作業

現行 NEXUS には他のブランチ（`refactor/split-app-jsx`、`feature/uncontrolled-editor-v3`、Tauri 移植計画）が並走している。この分割機構はそれらとどう干渉するかを明示する。

---

## 1. 実装ロードマップ全体図

### 1.1 フェーズ一覧

| Phase | 名称 | 目的 | 見積 | MVP? |
|---|---|---|---|---|
| 0 | 前提整理 | 既存ブランチの統合、土台を平らに | 3日 | ー |
| 1 | 破壊耐性コア | atomic write・バリデーション・ロック | 5日 | ✓ |
| 2 | データ層 | manifest・セグメント IO・マイグレーション | 7日 | ✓ |
| 3 | スナップショット層 | 4 層スナップショット・ジャーナル・復旧 | 5日 | ✓ |
| 4 | 読み取り層 | 連結ビュー・仮想化・検索 | 7日 | ✓ |
| 5 | 書き込み層 | 分散編集・境界検証・トランザクション | 7日 | ✓ |
| 6 | UI: 連続エディタモード | 境界表示、カーソル横断、境界操作 | 7日 | ✓ |
| 7 | UI: 章タブモード | タブ切替、タブ操作 | 4日 | ✓ |
| 8 | UI: 境界確認ダイアログ | インラインヒント、自動提案 | 5日 | ✓ |
| 9 | UI: 履歴・復元 | タイムライン、diff、復元操作 | 5日 | ✓ |
| 10 | エクスポート拡張 | 全文結合 TXT、PDF 連結 | 3日 | ✓ |
| 11 | マイグレーション実行 | 既存作品を新形式へ変換する UI | 3日 | ✓ |
| 12 | 本番適用・検証 | 冬之助さん自身による本番移行 | 2日 | ✓ |
| 13 | 後続拡張 | 置換取り消し、差分スナップショット、最適化 | 後日 | ー |

**MVP 合計**：約 60 日。Phase 13 以降は運用しながら順次追加。

この数字は **1 日 4〜6 時間、集中して作業できた場合** のもの。現実には小説執筆を優先しながらの並行作業になるので、**実カレンダーでは 3〜4 ヶ月** と見積もる。

### 1.2 依存関係（上から下へ）

```
Phase 0: 前提整理
    │
    ├─ Phase 1: 破壊耐性コア ◀─────────┐
    │           │                       │ (すべての後続が依存)
    │           │                       │
    │   Phase 2: データ層               │
    │           │                       │
    │           ├─ Phase 3: スナップショット層
    │           │                       │
    │           └─ Phase 4: 読み取り層   │
    │                   │               │
    │                   └─ Phase 5: 書き込み層
    │                           │
    │                           ├─ Phase 6: 連続エディタ UI
    │                           ├─ Phase 7: 章タブ UI
    │                           ├─ Phase 8: 境界ダイアログ
    │                           ├─ Phase 9: 履歴 UI
    │                           └─ Phase 10: エクスポート
    │                                   │
    │                                   └─ Phase 11: マイグレーション
    │                                           │
    │                                           └─ Phase 12: 本番適用
```

### 1.3 並行可能なフェーズ

| 並行可能ペア | 理由 |
|---|---|
| Phase 3 ↔ Phase 4 | スナップショットと読み取りは独立した関心事 |
| Phase 6 ↔ Phase 7 ↔ Phase 8 | UI 3 種は互いに独立（共通基盤は Phase 5 まで） |
| Phase 9 ↔ Phase 10 | 履歴 UI とエクスポートは独立 |

並行 = Claude がコードを書く間に Gemini に別の画面を書かせるなど。僕は**並行はあまり勧めない**。過去の Gemini の迷走を踏まえると、1 フェーズずつ確実に終わらせるほうが結果的に早い。

---

## 2. Phase 0：前提整理

### 2.1 目的

現在の NEXUS リポジトリには複数のブランチが並走している。分割機構の実装を始める前に、土台を平らにする。

### 2.2 現在のブランチ状況（2026年4月時点）

```
main                            ← 安定版
feature/document-model          ← documentModel 導入
feature/uncontrolled-editor-v3  ← uncontrolled 化 (da137d0)
perf/compose-batch-fix          ← パッチ 1〜5
refactor/split-app-jsx          ← App.jsx 分割リファクタ
feature/web-worker-positions    ← Worker 座標計算
```

### 2.3 Phase 0 のタスク

#### T-0.1: feature/uncontrolled-editor-v3 の運命決定

冬之助さんとの確認：このブランチを main にマージするか、破棄するか。

- **マージ派**：中規模ファイル（5〜10 万字）の打鍵改善があるので、分割機構と独立して価値あり
- **破棄派**：分割機構で 42 万字が扱えるようになれば、controlled でも問題ない可能性

**推奨**：マージする。中規模ファイルの品質向上は捨てがたい。

#### T-0.2: 分割機構ブランチの起点を決める

```
起点候補:
A) main               ← 安全だが、他ブランチの改善を取り込めない
B) uncontrolled-v3    ← 打鍵改善を含む、分割機構の下地として最適
C) refactor/split-app-jsx ← App.jsx が既に分割済み、改造しやすい
```

**推奨**：B を起点にし、C のマージを Phase 0 の途中で行う。つまり：

```
git checkout feature/uncontrolled-editor-v3
git merge refactor/split-app-jsx    # コンフリクト解決
git checkout -b feature/transparent-segmentation
```

#### T-0.3: 分割機構用の作業ブランチ作成

`feature/transparent-segmentation` を作業ブランチとする。Phase 1〜12 はすべてこのブランチ配下の小ブランチで進める：

```
feature/transparent-segmentation         ← 統合ブランチ
  ├─ phase-1-durability                 ← Phase 1 の作業
  ├─ phase-2-data-layer                 ← Phase 2 の作業
  ├─ phase-3-snapshots
  └─ ...
```

各 Phase ブランチが完了したら、PR を出して `feature/transparent-segmentation` にマージ。最終的にこの統合ブランチを main にマージ。

#### T-0.4: テストフィクスチャの整備

既存の `test_fixtures/` を拡張：

```
test_fixtures/
├── tiny.txt         (3KB, 既存)
├── medium.txt       (148KB, 既存)
├── large.txt        (446KB, 既存)
├── huge.txt         (1.3MB, 既存)
├── with_chapters/
│   ├── with_chapter_markers.txt      ← ■第1章 形式
│   ├── with_numbered_chapters.txt    ← 第1章 形式
│   ├── with_markdown_headers.txt     ← # 形式
│   └── with_aozora_tags.txt          ← ［＃大見出し］形式
├── edge_cases/
│   ├── ruby_spanning_boundary.txt    ← 《》がセグメント境界をまたぐ候補
│   ├── metadata_block.txt            ← [METADATA] 付き
│   ├── unicode_surrogates.txt        ← サロゲートペア
│   ├── empty.txt                     ← 空ファイル
│   └── only_metadata.txt             ← メタデータのみ、本文なし
└── existing_project/                 ← 既存プロジェクト相当
    ├── .nexus-project/
    ├── 既存作品1.txt
    └── 既存作品2.txt
```

これらは今後のすべての Phase のテスト基盤になる。

#### T-0.5: 設計書を docs/ にコミット

A, B, C, D の 4 本を `docs/transparent_segmentation/` にコミット。今後の実装中にいつでも参照できるように。

### 2.4 通過条件

- [ ] `feature/transparent-segmentation` ブランチが作成されている
- [ ] 起点ブランチ（uncontrolled-v3 + split-app-jsx）のマージが完了しビルドが通る
- [ ] test_fixtures/ が §2.3 の構造で揃っている
- [ ] docs/transparent_segmentation/ に設計書 A〜D がある
- [ ] 冬之助さんが Phase 0 完了を確認

### 2.5 主実装者・検証者

- **主実装**：冬之助さん（ブランチ運用に関わる判断は本人が必要）
- **補助**：Claude（ブランチ統合のマージコンフリクト解決が必要なら）
- **検証**：Perplexity Sonnet（ビルドチェックと test_fixtures 生成は機械的にできる）

---

## 3. Phase 1：破壊耐性コア

### 3.1 目的

**原稿が消えない保証を最初に作る**。後続のすべてのフェーズはこの保証の上に載る。

### 3.2 実装物

#### T-1.1: `src/utils/atomicWrite.js`

設計書 B §2.1 の `atomicWriteFile` を実装。Electron の main プロセスと renderer プロセス両方から使える形。

```
src/utils/atomicWrite.js              ← 共通ロジック（純粋関数）
electron/atomicWrite.cjs              ← main プロセス側の実装
src/utils/fileSystem.electron.js      ← renderer 側、IPC 経由で呼ぶ
```

#### T-1.2: `src/utils/payloadValidator.js`

V-1, V-2, V-3a, V-3b, V-4 を実装。

```js
export class ValidationError extends Error { ... }

export function validatePayload(content, context) {
  // V-1〜V-4 を順に検証
}

export function classifyShrink(previousLength, newLength) {
  // 'normal' | 'moderate-shrink' | 'extreme-shrink' のいずれかを返す
}
```

#### T-1.3: `src/utils/fileGeneration.js`

世代カウンタの管理。

```js
let globalGeneration = 0;

export function newGeneration() { return ++globalGeneration; }
export function currentGeneration() { return globalGeneration; }
```

#### T-1.4: `src/utils/workLock.js`

ロックファイルの取得・解放・heartbeat。

```js
export async function acquireLock(workPath) { ... }
export async function releaseLock(workPath) { ... }
export async function checkLock(workPath) { ... }
export function startHeartbeat(workPath) { ... }
```

#### T-1.5: `src/utils/journal.js`

ジャーナル記録（JSONL 追記）。

```js
export async function recordJournal(workPath, entry) { ... }
export async function readJournal(workPath, since) { ... }
export async function rotateJournal(workPath) { ... }
```

#### T-1.6: 既存 fileSystem.electron.js の書き換え

現行の `writeFile`・`writeFileBinary`・`createFile` を `atomicWriteFile` 経由に。

### 3.3 テスト

Phase 1 の品質は NEXUS 全体の生命線。テストは入念に：

#### T-1.7: `tests/atomicWrite.test.js`

- 正常系：小ファイル・大ファイル・日本語・UTF-16 サロゲート
- 異常系：書き込み途中の強制終了（SIGKILL をテストプロセスに送る）
- 異常系：ディスクフル（/tmp/tiny_disk でシミュレート）
- 異常系：権限なし・親ディレクトリ存在しない
- Readback mismatch: 書いた内容と読み直した内容が違う場合の throw

#### T-1.8: `tests/payloadValidator.test.js`

各 V-1〜V-4 について、発動と非発動のケースを列挙。

#### T-1.9: `tests/workLock.test.js`

- 2 プロセスで同時にロックを取ろうとして、片方だけ成功
- heartbeat が止まったロックを奪取できる
- 正常解放できる

### 3.4 通過条件

- [ ] atomicWrite の全テストが green
- [ ] payloadValidator の全テストが green
- [ ] workLock の全テストが green
- [ ] 既存 NEXUS が新 fileSystem で従来通り動く（5 万字ファイル編集・保存・読込が問題なし）
- [ ] journal が `.nexus-project/journal.log` に正しく追記される
- [ ] Perplexity Sonnet による手動確認（ビルド・保存・読み込み・クラッシュ復旧）

### 3.5 主実装者

- **atomicWrite / payloadValidator / fileGeneration / workLock / journal**：Claude が書く
- **既存 fileSystem.electron.js の書き換え**：Claude が書く
- **テスト**：Gemini 3 Flash が書いてよい（テストパターンの網羅は指示書化しやすい）
- **統合検証**：Perplexity Sonnet + 冬之助さんが test_fixtures で手動確認

### 3.6 リスク

- **Electron の fsync 挙動差異**：macOS と Linux で `fsync` の強度が違う。macOS では `F_FULLFSYNC` が必要。追加コードが必要
- **main プロセスと renderer プロセスの IPC オーバーヘッド**：毎回 IPC だとパフォーマンス懸念。renderer 側にバッチングを入れる
- **ブラウザ版（Web API）との互換**：完全 atomic は難しい。Electron 版優先で進め、ブラウザ版は縮退サポート

### 3.7 このフェーズで守られること

Phase 1 が終わった時点で、**既存の単一 `.txt` ファイル運用においても**、以下が守られるようになる：

- 書き込み途中のクラッシュで半端なファイルが残らない
- 空文字列・異常短縮が検出される
- ファイル切替時のレースで別ファイルに書き込まれない
- 複数インスタンスの編集衝突が検出される

つまり **Phase 1 単体でも冬之助さんに価値がある**。ここで止めても「5 日分飛んだ」事故は構造的に再現しなくなる。

---

## 4. Phase 2：データ層

### 4.1 目的

`.nexus` ディレクトリ形式と manifest.json の読み書き、セグメント IO、単一 `.txt` との相互変換を実装する。

### 4.2 実装物

#### T-2.1: `src/models/manifest.js`

manifest.json のスキーマと読み書き。

```js
export const MANIFEST_SCHEMA_VERSION = 1;

export async function readManifest(workPath) { ... }
export async function writeManifest(workPath, manifest) { ... }
export async function validateManifest(manifest) { ... }
```

#### T-2.2: `src/models/segment.js`

セグメントファイルの読み書き。

```js
export async function readSegment(workPath, segmentId) { ... }
export async function writeSegment(workPath, segmentId, content) { ... }
export async function createSegment(workPath, content, position) { ... }
export async function deleteSegment(workPath, segmentId) { ... }
```

#### T-2.3: `src/models/workspace.js`

作品全体の抽象。連結ビューと実ファイルの仲介。

```js
export class Workspace {
  static async open(path) { ... }
  async getConcatenatedView() { ... }
  async getSegmentByOffset(offset) { ... }
  async readSegmentAt(index) { ... }
  async close() { ... }
}
```

#### T-2.4: 境界検出 `src/utils/boundaryDetector.js`

設計書 A §1.3 F-11、§3.8 の境界検出。

```js
export function findBoundaryCandidates(text, options) {
  // returns [{ offset, type: 'chapter' | 'section' | 'paragraph', marker, confidence }]
}

export function validateBoundary(text, offset) {
  // ルビ・青空文庫タグ等の内部でないか確認
  // returns { valid: boolean, reason?: string }
}
```

#### T-2.5: マイグレーション `src/migrations/`

```
migrations/
├── txtToNexus.js      ← 単一 .txt → .nexus ディレクトリ
└── nexusToTxt.js      ← 逆変換
```

T-2.5a: txtToNexus は境界検出 + セグメント分割 + manifest 生成。**破壊しない変換**（元ファイルは `.nexus-project/migrated/` に移動、削除しない）。

T-2.5b: nexusToTxt は全セグメント連結。メタデータブロックを末尾に付与。

### 4.3 テスト

#### T-2.6: `tests/manifest.test.js`

- 正常なマニフェストの読み書き
- スキーマ不一致時のエラー
- 二重化（manifest.json / manifest.json.backup）の復旧

#### T-2.7: `tests/segment.test.js`

- 単一セグメント読み書き
- セグメント作成時の ID 衝突回避
- 削除後のファイル一覧整合

#### T-2.8: `tests/boundary.test.js`

- `■` / `第○章` / `# ` / 青空文庫タグ各パターン
- ルビ内部・タグ内部・サロゲートペア内部で分割しない
- 境界が 1 つも見つからない場合の挙動（4 万字制限）

#### T-2.9: `tests/migration.test.js`

- 13 章のテストファイル（`test_fixtures/with_chapters/with_chapter_markers.txt`）を変換
- 変換前後の文字列が `concatenateSegments()` で完全一致
- 元ファイルが `.nexus-project/migrated/` に移動されている
- 逆変換で元ファイルと bit-identical に戻る

### 4.4 通過条件

- [ ] manifest 読み書きの全テスト green
- [ ] segment 読み書きの全テスト green
- [ ] 境界検出の全テスト green
- [ ] マイグレーションで 42 万字相当のテストファイル（`huge.txt` を加工して章付きに）が正しく変換される
- [ ] 変換 → 逆変換で bit-identical
- [ ] 冬之助さん承認

### 4.5 主実装者

- **manifest / segment / workspace / boundaryDetector / migration**：Claude が書く（Phase 1 の上に載る重要なコア）
- **テスト**：Gemini 3 Flash が書いてよい
- **統合検証**：Perplexity Sonnet + 冬之助さんが手動確認

### 4.6 リスク

- **境界検出の網羅性**：冬之助さんが使う章形式は多様。抜けがあると「分割したのに章として認識されない」事故が起きる。**境界検出は設定で拡張可能にしておく**
- **マイグレーションで 1 文字でもズレると即信頼喪失**。ラウンドトリップ検証（§4.3 T-2.9）を厳格に

---

## 5. Phase 3：スナップショット層

### 5.1 目的

4 層スナップショット機構（immediate / hourly / daily / pinned）と復旧フローを実装。

### 5.2 実装物

#### T-3.1: `src/snapshot/snapshotManager.js`

```js
export class SnapshotManager {
  constructor(workPath) { ... }
  async create(layer, { reason, label, pin }) { ... }
  async list(filter) { ... }
  async restore(snapshotId, { preserveCurrent = true }) { ... }
  async delete(snapshotId) { ... }
  async pin(snapshotId) { ... }
  async gc() { ... }  // 古いスナップショットの掃除
}
```

#### T-3.2: `src/snapshot/archive.js`

tar.zst 圧縮・展開（Node.js で動くライブラリを使う。`archiver` + `node-zstd` か、シンプルに zip でもよい）。

```js
export async function packWorkspace(workPath, outputPath) { ... }
export async function unpackWorkspace(snapshotPath, targetPath) { ... }
```

#### T-3.3: スケジューラ `src/snapshot/scheduler.js`

- idle 検知（最後のユーザー入力から 30 秒経過）
- 10 分タイマー + idle 確認
- 1 時間タイマー
- 1 日タイマー

```js
export class SnapshotScheduler {
  constructor(manager, options) { ... }
  start() { ... }
  stop() { ... }
  notifyUserActivity() { ... }
}
```

#### T-3.4: 自己診断 `src/startup/selfDiagnose.js`

設計書 B §7.1。起動時に：
- 未完了トランザクション検出
- マニフェスト整合性チェック
- セグメント mtime + checksum 検証
- ロック残骸検出
- 破損スナップショット検出

検出結果は UI 層に渡され、Phase 9 で実装するダイアログと連携する。

#### T-3.5: 復旧ロジック `src/startup/recovery.js`

- 未完了トランザクションのロールバック / 再実行
- マニフェスト破損時のバックアップ復元
- セグメントから manifest 再構築

### 5.3 テスト

#### T-3.6: `tests/snapshot.test.js`

- 各層のスナップショット作成と復元
- GC で期限切れのみ削除される
- pinned は GC されない
- 作成中にクラッシュした場合、破損スナップショットを検出して `_trash/` へ

#### T-3.7: `tests/recovery.test.js`

- pending トランザクションの復旧
- manifest 両方破損からの復旧
- ファイル 1 つだけ削除された状態からの部分復元

### 5.4 通過条件

- [ ] SnapshotManager の全テスト green
- [ ] 自己診断の全テスト green
- [ ] 10 分 × idle でスナップショットが実際に作られることを手動確認
- [ ] 既存 NEXUS に組み込んで既存ファイルでも動作する（マニフェストがない場合は「仮想作品」として扱う）
- [ ] 1 回作品を開いて編集 → 強制終了 → 再起動で復旧 UI が出る
- [ ] 冬之助さん承認

### 5.5 主実装者

- **SnapshotManager / archive / scheduler**：Claude が書く
- **selfDiagnose / recovery**：Claude が書く
- **テスト**：Gemini 3 Flash
- **長時間実行テスト（10 分 idle 等）**：冬之助さんが自分の執筆中に回してもらう

### 5.6 リスク

- **容量爆発**：100 作品 × 50 MB = 5 GB になりうる。GC ロジックを堅牢に
- **archive の重さ**：42 万字を毎 10 分 tar.zst 圧縮するとディスク IO が重い。idle 時限定にして執筆を邪魔しない
- **破損スナップショット判定**：tar.zst の一部だけ書けた場合の検出。checksum を入れる

---

## 6. Phase 4：読み取り層

### 6.1 目的

連結ビューを提供する。アプリの検索、プレビュー、エクスポートが「全文」として作品を扱えるようにする。

### 6.2 実装物

#### T-4.1: 連結ビュー `src/workspace/concatenatedView.js`

```js
export class ConcatenatedView {
  constructor(workspace) { ... }
  async getFullText() { ... }  // 全文取得（エクスポート用）
  async getSlice(start, end) { ... }  // 範囲取得
  async getSegmentMap() { ... }  // 連結オフセット ↔ セグメント ID 変換
  offsetToLocation(offset) { ... }  // 連結オフセット → (segmentId, localOffset)
  locationToOffset(segmentId, localOffset) { ... }  // 逆変換
}
```

#### T-4.2: 遅延ロード `src/workspace/lazyLoader.js`

セグメントをメモリに全部持たない。必要なものだけロード、LRU でアンロード。

```js
export class SegmentLazyLoader {
  constructor(workspace, options) { ... }
  async get(segmentId) { ... }
  evict(segmentId) { ... }
  markAccessed(segmentId) { ... }
}
```

#### T-4.3: 全文検索 `src/workspace/searchEngine.js`

- セグメントごとに並列検索（Web Worker）
- 結果を連結オフセットに変換
- 正規表現対応
- Cmd+F UI は Phase 6 で繋ぐ

```js
export class SearchEngine {
  constructor(workspace) { ... }
  async search(query, options) { ... }  // 全章横断
  async searchInSegment(segmentId, query) { ... }
}
```

### 6.3 テスト

- 連結ビューで `getFullText()` と `concatenateSegments()` が一致
- offsetToLocation / locationToOffset がラウンドトリップ
- 検索で境界またぎのマッチが検出される（現状では未サポートだが、§6.4 のリスクとして文書化）

### 6.4 通過条件

- [ ] 連結ビューのテスト全 green
- [ ] 42 万字相当のダミー `.nexus` で検索が 3 秒以内（性能目標 P-3）
- [ ] 遅延ロードで 11 セグメント中 3 セグメントだけ実メモリ（仮想化前提の準備）

### 6.5 主実装者

- **connectedView / lazyLoader**：Claude
- **searchEngine**：Claude（Worker ベースなので設計慎重）
- **テスト**：Gemini 3 Flash

### 6.6 リスク

- **境界をまたぐ検索語**：`...終わった。■第二章...` で「終わった。■第二章」を検索したら、境界は物理的にセグメント間にある。初期リリースでは**境界を跨ぐマッチは非対応**（設計書 A の契約で境界はユーザー確認のうえ配置されるため、ユーザーはそこにマッチする文字列を書かない想定）
- **メモリ使用量**：`getFullText()` を呼ぶとメモリに 42 万字ぶん載る。エクスポート以外では呼ばない規律を実装

---

## 7. Phase 5：書き込み層

### 7.1 目的

セグメントの書き込み、分割、統合を、設計書 B の保証の下で実現する。

### 7.2 実装物

#### T-5.1: トランザクションエンジン `src/workspace/transaction.js`

設計書 B §2.4 のトランザクションログ。

```js
export class Transaction {
  constructor(workPath, opType) { ... }
  addStep(action, target, payload) { ... }
  async commit() { ... }  // 全ステップを実行、pending → committed
  async rollback() { ... }  // スナップショットから復元
}
```

#### T-5.2: 分割 `src/workspace/operations/splitSegment.js`

設計書 B §5.1 の 9 ステップフル実装。

```js
export async function splitSegment(workspace, segmentId, offset, options) {
  // 1. 境界候補の検証
  // 2. 安全性検証（未閉合タグチェック）
  // 3. ユーザー承認は呼び出し元で取得済み前提
  // 4. ラウンドトリップ検証
  // 5. スナップショット作成
  // 6. トランザクション記録
  // 7. atomic write で新セグメント書き込み
  // 8. マニフェスト更新
  // 9. ジャーナルに記録
}
```

#### T-5.3: 統合 `src/workspace/operations/mergeSegments.js`

設計書 B §5.2。

#### T-5.4: セグメント書き込み（通常編集） `src/workspace/operations/writeSegment.js`

`writeSegment` は Phase 2 で作ったものに **Phase 1 のバリデーション + Phase 3 のスナップショット契機** を結合する。

#### T-5.5: 並び替え `src/workspace/operations/reorderSegments.js`

セグメント順序変更。ファイル名の通し番号を振り直す（atomic rename をセグメント数ぶん実行）。

### 7.3 テスト

#### T-5.6: `tests/operations.test.js`

- 分割：正常系・境界検証失敗・ラウンドトリップ失敗・途中クラッシュ
- 統合：正常系・統合で文字が 1 つも失われない
- 並び替え：順序変更後のマニフェスト整合
- 全操作でスナップショットが先に取られる
- 全操作でジャーナルに記録される

### 7.4 通過条件

- [ ] 分割・統合・並び替えの全テスト green
- [ ] 意図的に途中で kill してもデータ破壊ゼロ（テストで再現）
- [ ] 40 万字の作品で 1 分間に 100 回のランダム編集・分割・統合を繰り返しても破壊ゼロ

### 7.5 主実装者

- **Transaction / splitSegment / mergeSegments / reorderSegments**：Claude
- **writeSegment 統合**：Claude（既存 autoSave との統合を慎重に）
- **テスト**：Gemini 3 Flash

### 7.6 リスク

- **既存 autoSave との統合**：`useAutoSave.js` を Phase 5 仕様に書き換える際、uncontrolled-v3 の echo suppression 等を壊さないように
- **rollback の複雑性**：複数セグメントが絡む操作の rollback は難しい。スナップショット復元で代用

---

## 8. Phase 6：連続エディタモード UI

### 8.1 目的

ユーザーから見える「単一の長編」を実現する最重要 UI。

### 8.2 実装物

#### T-6.1: `src/components/ContinuousEditor.jsx`

設計書 C §1。各セグメントを縦一列に表示、境界は薄い線と章タイトル。

- textarea ではなく**複数 textarea をセグメント単位で配置**する
- または**単一大 textarea に境界を注入**する
- どちらが実装しやすいか Phase 6 開始時にプロトタイプで決める

**推奨方針**：セグメント単位の textarea 配列。仮想化が自然に載る。

#### T-6.2: `src/components/SegmentBoundary.jsx`

境界の線と章タイトル表示。クリックで操作ポップオーバー。

#### T-6.3: カーソル横断 `src/hooks/useCrossSegmentCursor.js`

設計書 C §1.4。矢印キーで境界を越えるときの挙動を実装。

#### T-6.4: 仮想化 `src/hooks/useSegmentVirtualization.js`

画面外セグメントは高さだけ確保したプレースホルダに。IntersectionObserver。

#### T-6.5: 境界またぎ選択 `src/hooks/useCrossSegmentSelection.js`

Shift+矢印で境界を越えた選択範囲を実現。各 textarea の selection を合成して連続選択風に見せる。

### 8.3 実装の複雑度と段階化

Phase 6 は UI 実装の中で**最難関**。以下の段階で進める：

**Phase 6a**（最低限動く）：
- 単純にセグメントを縦に並べて表示
- カーソル横断なし（境界で止まる）
- 仮想化なし
- これで 5〜10 万字の作品は動く

**Phase 6b**（横断 UX）：
- カーソル・選択の境界またぎ
- IME の境界考慮
- Undo/Redo の作品単位化

**Phase 6c**（仮想化）：
- IntersectionObserver
- プレースホルダ
- 42 万字で打鍵即時を達成

### 8.4 テスト

**UI テストは完全自動化が難しい**。Phase 6 は冬之助さんと Perplexity Sonnet の人手テストが中心になる：

- tiny / medium / large / huge で全基本操作
- カーソル移動、選択、コピペ、Undo
- 境界またぎシナリオ（§5 のケース全部）
- 仮想化下での検索ジャンプ

### 8.5 通過条件

- [ ] Phase 6a で medium.txt が問題なく編集できる
- [ ] Phase 6b で境界ゼロ摩擦を Perplexity Sonnet が承認
- [ ] Phase 6c で huge.txt（42 万字）で打鍵即時（100ms 以下）を達成
- [ ] 冬之助さんが「これなら書ける」と承認

### 8.6 主実装者

- **ContinuousEditor / SegmentBoundary**：Claude
- **useCrossSegmentCursor / Selection / Virtualization**：Claude
- **手動テスト**：冬之助さん + Perplexity Sonnet

### 8.7 リスク

- **複数 textarea の欠点**：tab キーの挙動、キャレット移動、ブラウザ由来の問題が増える
- **単一 textarea の欠点**：結局 42 万字問題に戻る（uncontrolled でも Phase 6c の仮想化と相性悪い）
- **この決定が遅れると Phase 6 全体が遅れる**：Phase 6 開始時に半日でプロトタイプ比較する

**リスク回避策**：Phase 6 を始める前に 1 日プロトタイプを作って比較決定する。この半日を前倒しで Phase 0 に含めてもよい。

---

## 9. Phase 7：章タブモード UI

### 9.1 目的

章単位で切替型の編集モード。Phase 6 より実装が素直。

### 9.2 実装物

#### T-7.1: `src/components/ChapterTabs.jsx`

上部タブバー。現行のファイルタブを流用できる部分が多い。

#### T-7.2: `src/components/ChapterTabEditor.jsx`

単一セグメントを表示する textarea。Phase 1 の atomic write で保存。

#### T-7.3: タブ操作

- リネーム、削除、統合、並び替え（Phase 5 の operations を呼ぶ）
- ドラッグ&ドロップによる順序変更
- キーボードショートカット（Cmd+[, Cmd+], Cmd+1〜9）

#### T-7.4: モード切替

左パネルのトグル → ContinuousEditor ↔ ChapterTabs。作品ごとに保存。

### 9.3 テスト

- 章切替で書きかけが保存される
- タブ操作でマニフェストが正しく更新
- 13 章以上でドロップダウン表示
- Cmd+数字ジャンプが動く

### 9.4 通過条件

- [ ] 章タブモードで基本編集が動く
- [ ] モード切替で作品が壊れない（切替直前の状態を保持）
- [ ] 冬之助さん承認

### 9.5 主実装者

- **ChapterTabs / ChapterTabEditor**：Claude
- **モード切替ロジック**：Claude
- **手動テスト**：Perplexity Sonnet + 冬之助さん

### 9.6 リスク

- Phase 6 より素直だが、Phase 6 の仮想化と相互作用する可能性。Phase 6 完了後に着手

---

## 10. Phase 8：境界確認ダイアログ UI

### 10.1 目的

F-11.5（境界確認）・インライン境界ヒント・自動分割提案。

### 10.2 実装物

#### T-8.1: `src/components/BoundaryConfirmDialog.jsx`

設計書 C §4.1.2 のポップオーバー。前後 400 字表示、章タイトル編集、承認・キャンセル。

#### T-8.2: `src/components/InlineBoundaryHint.jsx`

設計書 C §4.1.1 のインラインアイコン。行頭の境界パターンを検出して表示。

#### T-8.3: 境界パターン検出 `src/utils/boundaryHintDetector.js`

打鍵イベントをフックして行頭パターンを検出。debounce。

#### T-8.4: 自動分割提案 `src/components/AutoSplitProposal.jsx`

設計書 C §4.2。閾値超過で idle 時に表示。「今後提案しない」設定が永続化される。

#### T-8.5: ユーザー学習 `src/utils/boundaryLearning.js`

承認された境界パターンを manifest に記録、再利用時に優先候補化。

### 10.3 テスト

- 行頭に `■` を入れるとヒントが出る
- ヒントを無視すると薄くフェードアウト
- 同じ位置で 2 回無視すると学習されて以降出ない
- 自動分割提案が執筆中（非 idle）は出ない

### 10.4 通過条件

- [ ] 境界確認ダイアログが動く
- [ ] インラインヒントが邪魔にならない（冬之助さんが執筆して確認）
- [ ] 自動分割提案が idle 時のみ出る
- [ ] 冬之助さん承認

### 10.5 主実装者

- **BoundaryConfirmDialog / AutoSplitProposal**：Claude
- **InlineBoundaryHint / boundaryHintDetector**：Claude（UX が繊細なので丁寧に）
- **テスト**：冬之助さんが自分の執筆で動作確認

---

## 11. Phase 9：履歴・復元 UI

### 11.1 目的

スナップショットのタイムライン表示、復元操作、diff 表示。

### 11.2 実装物

#### T-9.1: `src/components/HistoryPanel.jsx`

設計書 C §9.1 のタイムライン。左パネルの「履歴」タブ。

#### T-9.2: `src/components/SnapshotDetail.jsx`

エントリをクリックしたときの詳細表示。プレビュー・文字数・復元ボタン。

#### T-9.3: `src/components/DiffViewer.jsx`

2 スナップショット間の diff 表示。章単位でグルーピング。行単位 diff は`jsdiff` を使う。

#### T-9.4: 復元確認フロー `src/components/RestoreConfirmDialog.jsx`

設計書 C §9.3。復元前に現状の自動スナップショット。

#### T-9.5: 手動スナップショット作成 `src/components/CreateSnapshotDialog.jsx`

ラベル入力、ピン留めチェックボックス。

### 11.3 通過条件

- [ ] 履歴タイムラインに正しくエントリが並ぶ
- [ ] 復元で作品が正しく戻る
- [ ] diff 表示が視認できる
- [ ] pinned の作成・解除が動く
- [ ] 冬之助さん承認

### 11.4 主実装者

- **全コンポーネント**：Claude
- **テスト**：冬之助さん

---

## 12. Phase 10：エクスポート拡張

### 12.1 目的

全文結合 TXT、PDF 連結、EPUB 連結。

### 12.2 実装物

#### T-10.1: 全文結合 TXT `src/export/txtExporter.js`

設計書 C §8.2。エクスポート前に pinned スナップショット自動作成。

#### T-10.2: PDF エクスポート拡張

既存 PDF エクスポートを ConcatenatedView 経由に。

#### T-10.3: EPUB エクスポート

既存 EPUB エクスポートを ConcatenatedView 経由に。章の目次は manifest.displayName から自動生成。

#### T-10.4: 部分エクスポート `src/components/PartialExportDialog.jsx`

章を選んでエクスポートするチェックリスト UI。

### 12.3 通過条件

- [ ] 全文結合 TXT で作品が 1 文字も失われない
- [ ] PDF / EPUB が章連結で正しく出る
- [ ] 部分エクスポートが選択した章のみ出す
- [ ] 冬之助さんが賞応募を想定した最終出力を確認

### 12.4 主実装者

- **全部**：Claude
- **賞応募レベルの品質検証**：冬之助さん

---

## 13. Phase 11：マイグレーション実行 UI

### 13.1 目的

既存の単一 `.txt` 作品を、ユーザーの明示操作で `.nexus` へ変換する。

### 13.2 実装物

#### T-11.1: マイグレーションウィザード `src/components/MigrationWizard.jsx`

1. 「この作品を分割モードにしますか？」の導入
2. 境界候補のプレビュー（各章の冒頭 200 字 + 文字数を一覧表示）
3. 境界の承認・調整（章単位でチェックリスト、ユーザーが却下できる）
4. 変換実行
5. 結果表示（○ 章に分割されました、元ファイルは migrated/ に保存されています）

#### T-11.2: 逆マイグレーション `src/components/UnmigrateDialog.jsx`

`.nexus` を単一 `.txt` に戻す UI。確認ダイアログのみ。

### 13.3 通過条件

- [ ] test_fixtures の 13 章ファイルをウィザードで分割
- [ ] ユーザーが境界を 1 つ却下すると、その境界では分割されない
- [ ] 逆変換で元ファイルと bit-identical
- [ ] 冬之助さん承認

### 13.4 主実装者

- **MigrationWizard / UnmigrateDialog**：Claude
- **テスト**：冬之助さんが test_fixtures で通す

---

## 14. Phase 12：本番適用・検証

### 14.1 目的

ここまでの全実装を、冬之助さんの本番原稿に適用する。

### 14.2 手順

#### T-12.1: 準備

冬之助さんのプロジェクトフォルダを**完全コピー**してバックアップ（Time Machine に加えて、手動で外付けドライブにコピー）。これが最後の保険。

#### T-12.2: 小さい作品から試す

ノチユ（40 万字未満、章構成あり）を先に変換。冬之助さんが編集して違和感がないか数日間使用。

#### T-12.3: ガンダム虚空の三叉に適用

問題なければガンダム作品も変換。打鍵即時になることを確認。

#### T-12.4: 他作品

残りの作品も順次マイグレーション。タイミングは冬之助さんが決める。

### 14.3 通過条件

- [ ] ノチユを Phase 11 で変換し、1 週間使って問題なし
- [ ] 虚空の三叉を変換し、打鍵即時を確認
- [ ] スナップショットからの復旧が 1 回以上実行できる
- [ ] 冬之助さんが「この設計でもう安心」と宣言

### 14.4 主実装者

- **実行**：冬之助さん
- **サポート**：Claude（トラブル時）
- **検証**：Perplexity Sonnet（ファイル整合性の機械チェック）

---

## 15. Phase 13：後続拡張

MVP 後に少しずつ加える：

| 拡張 | 内容 | 優先度 |
|---|---|---|
| 置換取り消し | 全置換後 60 秒のアンドゥボタン | 高 |
| 自動統合提案 | 小さすぎるセグメントの統合候補 | 中 |
| 差分スナップショット | rdiff で容量節約 | 中 |
| 章タイトル自動抽出の学習 | 作品ごとのパターン学習 | 低 |
| 比較 UI 改善 | 3-way merge | 低 |
| 複数 PC 同期 | iCloud 対応強化 | 未定 |

---

## 16. 全体リスクと回避策

### 16.1 技術的リスク

| リスク | 確率 | 影響 | 回避策 |
|---|---|---|---|
| Phase 6 の textarea 設計で行き詰まる | 中 | 大 | Phase 0 末尾でプロトタイプ比較 |
| 仮想化がブラウザ差で動かない | 中 | 中 | Electron 限定、Chromium 固定 |
| 42 万字でも打鍵遅い | 低 | 大 | 各セグメント 6 万字以下なら物理的に大丈夫 |
| Tauri 移植時に atomic write 互換なし | 中 | 中 | Tauri 2 は Rust で直接書けるので逆に安心 |
| 既存ブランチとの統合で破損 | 低 | 大 | Phase 0 を慎重に、テスト fixture で確認 |

### 16.2 運用的リスク

| リスク | 確率 | 影響 | 回避策 |
|---|---|---|---|
| 執筆に忙しくて実装が止まる | 高 | 中 | Phase 単位で独立価値、止まっても MVP 直前までは意味ある |
| Gemini / Sonnet が指示を理解しない | 高 | 中 | 重要 Phase（1〜5）は Claude 直接実装 |
| 実装中に本番原稿を誤って壊す | 低 | 致命 | 本番原稿を絶対に触らないルール、test_fixtures 限定 |
| 設計書と実装がズレる | 中 | 中 | 各 Phase 末に設計書と実装の整合レビュー |

### 16.3 スケジュールリスク

執筆の締切と重なる可能性：

- 2026年6月：ざつがみ締切（ファンタジーノベル大賞）
- 2026年10月：ノチユ締切（松本清張賞）

**推奨**：
- 6 月までに Phase 1〜3（破壊耐性 + データ層 + スナップショット）までで止めて、ざつがみ執筆に集中
- 6 月〜8 月で Phase 4〜7（読み書き + UI 基本）
- 9 月〜10 月はノチユ執筆でほぼ止まる想定
- 11 月〜翌年春で Phase 8〜12 完了

**絶対に守ること**：Phase 1 だけは必ず先に入れる。Phase 1 だけでも既存運用で原稿が消えない保証が得られる。他は後回しでもよい。

---

## 17. このドキュメントで定まらないこと

- 具体的なライブラリ選定（zstd vs zip、jsdiff のバージョン、etc.）は実装開始時に決める
- Tauri 移植との詳細な相互作用は Tauri 移植計画書（別途）の責務
- UI の見た目（配色・フォント・アニメーション）はデザインパスで後から詰める
- Phase ごとの詳細な実装指示書は、各 Phase 開始時に別文書として起こす

---

## 18. 結語

### 18.1 この 4 本の設計書で約束したこと

- **原稿を消さない**（B §8 の事故再現チェックリスト）
- **42 万字でも打鍵即時**（A + C §1.5 仮想化）
- **ユーザーから見て単一の長編**（A F-1〜F-4、C §1〜3）
- **既存作品を破壊しない**（A §3.6 の非破壊マイグレーション）
- **NEXUS をやめても作品は奪われない**（A §3.7.2 の逆変換）

### 18.2 これから

4 本の設計書が揃った。次は実装に入る。ただし実装の前に：

1. **冬之助さんがこの 4 本を通読**して、誤解や抜けがないか確認する
2. **Phase 0 から始める**。焦らず、1 フェーズずつ
3. **Phase 1 を最優先で終わらせる**。これだけで「5 日分飛んだ」は再発しなくなる
4. **執筆を止めない**。6 月ざつがみ締切、10 月ノチユ締切を最優先

この設計はあくまで地図。実装は冬之助さんのペースで進めればいい。僕は必要なときに呼ばれて、Phase ごとの実装指示書と、難しい箇所のコードを書く。

冬之助さんの小説が完成していくための、壊れないエディタ。作る価値がある。
