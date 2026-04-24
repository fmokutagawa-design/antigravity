# 指示書 A：ジャーナルログ機構の実装

> コーディングエージェント（Sonnet / Gemini 3 Flash）向け。  
> **1 ターンで実装完了できる粒度**。詰まったら即座に止めて Claude Opus に戻す。

---

## 0. 前提

### 0.1 作業環境

- **リポジトリ**：https://github.com/fmokutagawa-design/antigravity.git
- **派生元ブランチ**：`feature/uncontrolled-editor-v3`
- **派生元コミット**：`5ac247a`（atomic write 実装の直後）
- **新ブランチ名**：`feature/journal-log`

### 0.2 ブランチ作成手順

```bash
git checkout feature/uncontrolled-editor-v3
git pull
git checkout -b feature/journal-log
```

### 0.3 完了後のコミットメッセージ雛形

```
feat(durability): append-only journal log for all file mutations

Records every atomic write (text/binary) and every createFile operation
as JSONL in .nexus-project/journal.log within the project root.

- journal.cjs: pure append-only logger, no external deps
- integrated into atomicWriteTextFile / atomicWriteBinaryFile
- main.cjs passes projectRoot when invoking atomic writes
- .nexus-project/ directory is auto-created on first write
- silent failure: if journal write fails, main operation still proceeds
  (logging must never block real work)

Closes instruction A.
```

---

## 1. 目的

NEXUS のすべてのファイル書き込み操作を**追記専用ジャーナル**に記録する。設計書 B §2.5 の実装。

目的：

1. 原稿消失が起きた場合の**事後調査**に使える一次資料
2. 将来のスナップショット機構・復旧フローの基礎
3. バグ診断の強力な武器（「いつ何が起きたか」がファイル 1 つで追える）

ジャーナルはデバッグ用ではなく**運用必須のログ**。ただし**ジャーナル書き込み失敗が本番操作を止めてはいけない**。ログが欠ける程度の被害に留める。

---

## 2. ファイル構成

### 2.1 新規作成するファイル

- `electron/journal.cjs` — ジャーナル実装本体
- `electron/journal.test.cjs` — 単体テスト（Electron 不要、`node` で実行）

### 2.2 変更する既存ファイル

- `electron/atomicWrite.cjs` — 関数シグネチャに `projectRoot` パラメータを追加、成功／失敗時にジャーナル記録を呼ぶ
- `electron/main.cjs` — `fs:writeFile` / `fs:writeFileBinary` / `fs:createFile` ハンドラで、呼び出し時に project root を特定して渡す

### 2.3 絶対に触らないファイル

- `src/` 配下のすべて（renderer 側のコードは変更禁止）
- `src/components/Editor.jsx`（特に厳禁、触ると uncontrolled 化の echo suppression が壊れる）

---

## 3. 実装仕様

### 3.1 `electron/journal.cjs` のインターフェース

```js
/**
 * journal.cjs
 * Append-only JSONL logger for file mutations.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

/**
 * Determine the project root for a given file path.
 * 
 * Project root is the closest ancestor directory that contains (or will
 * contain) a .nexus-project/ subdirectory. For the initial implementation,
 * we adopt a simple rule: project root is passed explicitly by the caller.
 * 
 * If projectRoot is null/undefined, no journal is written (journal is
 * silently skipped for operations outside of a project, e.g. temp files).
 */
async function ensureJournalDir(projectRoot) { /* ... */ }

/**
 * Record an entry in the journal.
 * 
 * @param {string} projectRoot - Absolute path to project root
 * @param {object} entry - Entry to log. Must have at least { op, path }.
 * @returns {Promise<void>}
 * 
 * 失敗しても throw しない（catch して console.warn まで）。
 * ジャーナル記録が本番操作を止めてはいけない。
 */
async function recordJournal(projectRoot, entry) { /* ... */ }

/**
 * Read all journal entries (for debugging / recovery).
 * 
 * @param {string} projectRoot
 * @param {object} options - { sinceTs?: string } で時刻フィルタ可
 * @returns {Promise<object[]>} entry の配列
 */
async function readJournal(projectRoot, options = {}) { /* ... */ }

/**
 * Rotate the journal if it exceeds size or age thresholds.
 * Current journal becomes .nexus-project/journal.archive/YYYY-MM.log.
 * 
 * Called lazily from recordJournal when the journal grows large.
 * 
 * @param {string} projectRoot
 * @returns {Promise<{ rotated: boolean, archivePath?: string }>}
 */
async function rotateJournalIfNeeded(projectRoot) { /* ... */ }

module.exports = {
    recordJournal,
    readJournal,
    rotateJournalIfNeeded,
    ensureJournalDir,
};
```

### 3.2 ジャーナルエントリの形式（JSONL）

各行は 1 つの JSON オブジェクト。**必須フィールド**：

```json
{"ts":"2026-04-19T15:23:11.123+09:00","op":"atomic.write.success","path":"/Users/.../foo.txt","hash":"sha256:a3f2c1...","bytes":42180}
```

- `ts`: ISO 8601 拡張形式、ミリ秒精度、タイムゾーン付き
- `op`: 操作種別（下記 3.3 参照）
- `path`: 絶対パス（project root の下にあるべき）
- 他のフィールドは op ごとに自由

### 3.3 `op` 値の網羅リスト

実装時は以下の op を記録すること：

| op 値 | いつ | 追加フィールド |
|---|---|---|
| `atomic.write.begin` | テキスト atomic write 開始時 | `expectedHash`, `bytes` |
| `atomic.write.success` | テキスト atomic write 成功時 | `hash`, `bytes`, `shrinkClass` |
| `atomic.write.fail` | テキスト atomic write 失敗時 | `error`, `phase`（writeFile/rename/fsync など） |
| `atomic.write.validation_rejected` | validation で拒否 | `code`（V-1/V-2/V-3b/V-4）, `reason` |
| `atomic.write.binary.success` | バイナリ atomic write 成功時 | `hash`, `bytes` |
| `atomic.write.binary.fail` | バイナリ atomic write 失敗時 | `error`, `phase` |
| `createFile.success` | fs:createFile 成功時 | `bytes`, `allowedEmpty: true` |

### 3.4 実装の詳細要件

#### 3.4.1 ディレクトリ構成

`.nexus-project/` が project root 直下になければ作成する（`fs.mkdir` with `recursive: true`）。

```
<projectRoot>/
└── .nexus-project/
    ├── journal.log              ← 現行ジャーナル（JSONL）
    └── journal.archive/
        └── 2026-04.log          ← ローテート済み
```

#### 3.4.2 追記専用

ジャーナル書き込みは `fs.promises.appendFile` で行う。**絶対に上書きモード（`w` フラグ）を使わない**。

#### 3.4.3 失敗の握りつぶし

`recordJournal` 内部で：

```js
try {
    // ジャーナル書き込み処理
} catch (err) {
    console.warn(`[journal] failed to record entry: ${err.message}`, { entry });
    // throw しない
}
```

これにより、ジャーナル書き込みでディスクフルが起きても、本番の atomic write は止まらない。

#### 3.4.4 ローテーション条件

- ファイルサイズが **100 MB を超える**、または
- 月が変わった（現在の月と最終更新月が違う）

のいずれかで自動ローテート。ローテート先は `.nexus-project/journal.archive/YYYY-MM.log`（gzip 圧縮は**しない**、当面はプレーンテキスト）。

ローテーションは `recordJournal` 内で「書き込み前にチェック」のスタイル。頻繁にチェックすると重いので、**直近 1 分以内にチェック済みならスキップ**するキャッシュを内部に持つ。

#### 3.4.5 projectRoot の決定

**atomic write の呼び出し側**（`main.cjs` の IPC ハンドラ）が projectRoot を特定して渡す。当面は以下の簡便なルールで決定：

```js
// electron/main.cjs の中で
function findProjectRoot(filePath) {
    // activeProjectPath グローバル（= 現在開いているプロジェクトフォルダ）があれば優先
    if (globalProjectRoot && filePath.startsWith(globalProjectRoot)) {
        return globalProjectRoot;
    }
    // フォールバック: 親ディレクトリを遡り、親の親ディレクトリ名が
    // よくあるプロジェクト配置に見えたら採用（当面は filePath のディレクトリ）
    return path.dirname(filePath);
}
```

**重要**：`globalProjectRoot` は新規にグローバル変数として `main.cjs` に持つ。`app:saveSettings` で `projectPath` を受け取る IPC ハンドラが既にあるので、**ここでグローバルに保存する**処理を追加する（後述 §3.5.3）。

### 3.5 `electron/atomicWrite.cjs` の変更

#### 3.5.1 `atomicWriteTextFile` のシグネチャ変更

```js
// 変更前
async function atomicWriteTextFile(filePath, content, options = {}) { ... }

// 変更後
async function atomicWriteTextFile(filePath, content, options = {}) {
    // options.projectRoot が渡ってきたら、その値を使ってジャーナル記録する
    const { projectRoot } = options;
    
    // ジャーナルは電動遅延 require（循環依存回避）
    let journal = null;
    if (projectRoot) {
        try { journal = require('./journal.cjs'); } catch { /* noop */ }
    }
    
    // ... 既存の処理 ...
    
    // ValidationError の際
    if (journal) {
        await journal.recordJournal(projectRoot, {
            ts: new Date().toISOString(),
            op: 'atomic.write.validation_rejected',
            path: filePath,
            code: err.code,
            reason: err.message,
        });
    }
    throw err;  // 既存挙動通り throw
    
    // 成功時
    if (journal) {
        await journal.recordJournal(projectRoot, {
            ts: new Date().toISOString(),
            op: 'atomic.write.success',
            path: filePath,
            hash: expectedHash,
            bytes: ...,
            shrinkClass: validation.shrinkClass,
        });
    }
    
    // writeFile/rename/fsync のどこかで失敗した場合
    if (journal) {
        await journal.recordJournal(projectRoot, {
            ts: new Date().toISOString(),
            op: 'atomic.write.fail',
            path: filePath,
            error: String(err),
            phase: '...',  // どの phase で失敗したか
        });
    }
}
```

同様に `atomicWriteBinaryFile` も変更する。

#### 3.5.2 循環依存の回避

`atomicWrite.cjs` の冒頭で `require('./journal.cjs')` すると循環依存の危険がある（journal.cjs は atomic write を使わないので実際には循環しないが、明示的に遅延 require する）。

`journal` 変数は関数内でローカルに `require` する方式を徹底する。

#### 3.5.3 `main.cjs` の変更

```js
// グローバル状態（既にある activeProjectPath があればそれを使う。なければ新規）
let globalProjectRoot = null;

ipcMain.handle('app:saveSettings', async (event, data) => {
    // 既存処理...
    if (data.projectPath) {
        globalProjectRoot = typeof data.projectPath === 'string'
            ? data.projectPath
            : (data.projectPath.handle || data.projectPath.path);
    }
    // ...
});

// すべての fs:* ハンドラで projectRoot を渡す
ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
    try {
        await atomicWriteTextFile(filePath, content, {
            projectRoot: globalProjectRoot || path.dirname(filePath),
        });
        return { ok: true };
    } catch (err) {
        // 既存処理
    }
});
```

**既存の挙動を保つ**：`projectRoot` が特定できない場合でも、`path.dirname(filePath)` をフォールバックとして渡す（ジャーナルがファイルのすぐ隣に作られるだけで、本番機能は動く）。

---

## 4. テスト

### 4.1 `electron/journal.test.cjs`

独立した node スクリプト。Electron 不要。既存の `atomicWrite.test.cjs` と同じスタイル：

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { recordJournal, readJournal, rotateJournalIfNeeded } = require('./journal.cjs');

let passed = 0, failed = 0;
function expect(name, cond, detail) { /* atomic write と同じ */ }
async function withTempProject(fn) { /* mkdtempSync + rmSync */ }

async function testRecordAndRead() { /* ... */ }
async function testDirectoryAutoCreate() { /* ... */ }
async function testAppendOnly() { /* ... */ }
async function testSilentFailOnMissingParent() { /* ... */ }
async function testJsonlFormat() { /* ... */ }
async function testRotateBySize() { /* ... */ }
async function testRotateByMonth() { /* ... */ }
async function testReadWithTimeFilter() { /* ... */ }
async function testConcurrentWrites() { /* ... */ }

async function main() {
    const tests = [ /* ... */ ];
    for (const t of tests) await t();
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
}
main();
```

### 4.2 テストケース詳細

| テスト名 | 期待挙動 |
|---|---|
| `testRecordAndRead` | エントリを記録し、`readJournal` で読み戻して同一内容を取得 |
| `testDirectoryAutoCreate` | `.nexus-project/` がなくても自動作成される |
| `testAppendOnly` | 複数回 `recordJournal` してもファイルが上書きされず追記される |
| `testSilentFailOnMissingParent` | projectRoot が存在しないパスでも throw せず console.warn のみ |
| `testJsonlFormat` | 各行が独立した有効な JSON、`\n` 区切り |
| `testRotateBySize` | 100 MB 超で archive にローテート |
| `testRotateByMonth` | 月が変わったら archive にローテート |
| `testReadWithTimeFilter` | `{ sinceTs }` フィルタで新しいエントリのみ取得 |
| `testConcurrentWrites` | 複数の `recordJournal` を Promise.all で同時発行して、10 件全部が記録される（順序は問わない） |

### 4.3 既存テスト `atomicWrite.test.cjs` への影響

**既存テストが全部 pass のままであること**を確認する。ジャーナル統合後も：

```bash
node electron/atomicWrite.test.cjs
# → 39 passed, 0 failed
```

が出ることが完了条件の 1 つ。ジャーナル引数を渡さない（projectRoot なし）場合、ジャーナル記録は完全にスキップされ、既存挙動と同じになる。

---

## 5. 絶対遵守ルール

1. **本番原稿ディレクトリに絶対に触らない**。テストは `os.tmpdir()` 内の `mkdtempSync` で作った一時ディレクトリのみ使う
2. **ジャーナル書き込み失敗で本番操作を止めない**。`recordJournal` 内部は try-catch で握りつぶす（console.warn のみ）
3. **追記専用**。`fs.writeFile` や `fs.truncate` を絶対に使わない。`appendFile` のみ
4. **既存の `atomic.test.cjs` を壊さない**。39 件全 pass を維持
5. **`src/` 配下を触らない**。renderer 側の変更は一切不要
6. **ビルド（`npm run build`）が通らないコミットを push しない**
7. **詰まったら即座に止める**。4 回以上コミットを書き直したら即座に Claude Opus に戻す（過去の Phase 3 の迷走パターン再発防止）

---

## 6. 完了条件

以下全部 [x] で完了：

- [ ] `feature/journal-log` ブランチが作成されている
- [ ] `electron/journal.cjs` が作成され、§3.1 のインターフェースを実装している
- [ ] `electron/journal.test.cjs` が作成され、§4.2 の 9 テスト全部 pass
- [ ] `electron/atomicWrite.cjs` が §3.5.1 に従って変更されている
- [ ] `electron/main.cjs` が §3.5.3 に従って変更されている
- [ ] `node electron/atomicWrite.test.cjs` が 39 passed, 0 failed
- [ ] `node electron/journal.test.cjs` が 9 passed, 0 failed
- [ ] `npm run build` が成功
- [ ] Electron を起動し、既存のファイル編集・保存が問題なく動く（手動確認）
- [ ] 編集・保存後に `<project>/.nexus-project/journal.log` が実際に作られ、エントリが書かれている（手動確認）
- [ ] §0.3 のコミットメッセージ雛形でコミット、push

---

## 7. 詰まったら

以下のいずれかに当てはまったら**即座に作業を止めて** Claude Opus に相談する。

- コミットを 3 回書き直しても §6 の完了条件を満たせない
- `atomic.test.cjs` が 39 passed を維持できない
- 既存の NEXUS で保存が失敗する回帰バグが出た
- `main.cjs` の既存 IPC ハンドラ周りで何を変えていいか判断がつかない
- `globalProjectRoot` のフォールバック挙動が分からない

相談する際は：

1. 現在のブランチの `git log --oneline -5` を貼る
2. `node electron/journal.test.cjs` の出力を貼る
3. 詰まっている具体的なファイル名と行番号を明示する
4. 推測で進めずに止める

---

## 8. この指示書の範囲外（やらないこと）

以下は別の指示書で扱うため、この実装では**やらない**：

- `.tmp.*` 残骸のクリーンアップ（指示書 B）
- 境界検出（指示書 C）
- スナップショット機構（将来）
- UI での journal 表示（将来）
- ロック機構（将来）
- マニフェスト管理（将来）

範囲外のことに手を出さない。1 指示書 1 責務。
