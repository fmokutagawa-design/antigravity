# 指示書 B：起動時 `.tmp.*` 残骸クリーンアップ

> コーディングエージェント（Sonnet / Gemini 3 Flash）向け。  
> **1 ターンで実装完了できる粒度**。詰まったら即座に止めて Claude Opus に戻す。

---

## 0. 前提

### 0.1 作業環境

- **リポジトリ**：https://github.com/fmokutagawa-design/antigravity.git
- **派生元ブランチ**：`feature/uncontrolled-editor-v3`
- **派生元コミット**：`5ac247a`（atomic write 実装直後）
- **新ブランチ名**：`feature/tmp-cleanup`

### 0.2 ブランチ作成手順

```bash
git checkout feature/uncontrolled-editor-v3
git pull
git checkout -b feature/tmp-cleanup
```

### 0.3 完了後のコミットメッセージ雛形

```
feat(durability): cleanup orphaned .tmp.* files on startup

Calls cleanupOrphanedTempFiles() (already defined in atomicWrite.cjs) at
Electron startup, targeting the currently configured project folder.

- Loads projectPath from user_settings.json
- Recursively walks the project tree, removing .tmp.* files older than 1h
- Skips node_modules and .git directories
- Logs cleanup summary to console
- Silent failure: if cleanup throws, app startup still proceeds

Closes instruction B.
```

---

## 1. 目的

atomic write が異常終了したときに残る `.<basename>.tmp.<pid>.<ts>.<rand>` 形式の一時ファイルを、**次回 Electron 起動時に自動掃除**する。

現状：
- `atomicWrite.cjs` は正常終了時は一時ファイルを rename か unlink で始末している
- 異常終了（クラッシュ・電源断）で残骸が残る可能性あり
- 残骸は手動で消さない限り永遠に残る
- Finder で見えて不快、またディスク容量を徐々に圧迫

**既に実装済みの `cleanupOrphanedTempFiles` 関数を Electron 起動時に呼ぶだけ**。新規ロジックはほぼ書かない。

---

## 2. ファイル構成

### 2.1 新規作成するファイル

- なし

### 2.2 変更する既存ファイル

- `electron/main.cjs` — `app.whenReady().then(...)` の中で cleanup を呼ぶ
- `electron/atomicWrite.test.cjs` — cleanupOrphanedTempFiles のテストを追加

### 2.3 絶対に触らないファイル

- `electron/atomicWrite.cjs`（本体は既に完成、触らない）
- `src/` 配下すべて
- `electron/preload.cjs`

---

## 3. 実装仕様

### 3.1 呼び出し先：既存の `cleanupOrphanedTempFiles`

`electron/atomicWrite.cjs` 内に既に存在：

```js
// 現状のシグネチャ（変更しない）
async function cleanupOrphanedTempFiles(rootDir, options = {}) {
    const maxAgeMs = options.maxAgeMs ?? (60 * 60 * 1000);
    // ... 再帰スキャン、.tmp.* パターン一致＆1時間以上古いもののみ unlink ...
    return removedCount; // number
}
```

`module.exports` からも既に export 済み：

```js
module.exports = {
    atomicWriteTextFile,
    atomicWriteBinaryFile,
    validateTextPayload,
    classifyShrink,
    cleanupOrphanedTempFiles,  // ← ここ
    ValidationError,
};
```

### 3.2 `electron/main.cjs` への追加

#### 3.2.1 import 更新

ファイル冒頭付近の require を更新：

```js
// 変更前
const {
    atomicWriteTextFile,
    atomicWriteBinaryFile,
    ValidationError,
} = require('./atomicWrite.cjs');

// 変更後（cleanupOrphanedTempFiles を追加）
const {
    atomicWriteTextFile,
    atomicWriteBinaryFile,
    cleanupOrphanedTempFiles,
    ValidationError,
} = require('./atomicWrite.cjs');
```

#### 3.2.2 起動時呼び出し

`app.whenReady().then(() => { ... })` 内に cleanup を追加。**`createWindow()` の直後**。

```js
app.whenReady().then(() => {
    createWindow();

    // ★ 起動時クリーンアップ：前回クラッシュで残った .tmp.* 残骸を削除
    //    fire-and-forget。UI 表示を止めない
    runStartupCleanup().catch(err => {
        console.warn('[startup] cleanup failed (non-fatal):', err.message);
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
```

#### 3.2.3 `runStartupCleanup` 関数の追加

`app.whenReady()` の下あたり、かつ IPC ハンドラ宣言より前に追加：

```js
/**
 * 起動時の .tmp.* 残骸クリーンアップ。
 *
 * - user_settings.json から projectPath を読む
 * - projectPath が未設定/無効なら何もしない（起動を止めない）
 * - 1 時間以上古い .tmp.* のみ削除
 * - 失敗しても throw せず console.warn で終わる
 */
async function runStartupCleanup() {
    // 設定ファイル読み込み（存在しなければ skip）
    let settings = null;
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const raw = await fs.promises.readFile(SETTINGS_FILE, 'utf-8');
            settings = JSON.parse(raw);
        }
    } catch (e) {
        console.warn('[startup] failed to read settings:', e.message);
        return;
    }

    if (!settings || !settings.projectPath) {
        console.log('[startup] no projectPath configured, skipping cleanup');
        return;
    }

    // projectPath は string でも { handle, path } でもあり得る（レガシー対応）
    const projectRoot = typeof settings.projectPath === 'string'
        ? settings.projectPath
        : (settings.projectPath.handle || settings.projectPath.path);

    if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
        console.warn('[startup] projectPath is not a valid string:', settings.projectPath);
        return;
    }

    // 存在確認
    try {
        const stat = await fs.promises.stat(projectRoot);
        if (!stat.isDirectory()) {
            console.warn('[startup] projectPath is not a directory:', projectRoot);
            return;
        }
    } catch {
        console.warn('[startup] projectPath does not exist:', projectRoot);
        return;
    }

    const t0 = Date.now();
    const removedCount = await cleanupOrphanedTempFiles(projectRoot);
    const elapsed = Date.now() - t0;

    if (removedCount > 0) {
        console.log(
            `[startup] cleanup: removed ${removedCount} orphaned .tmp files ` +
            `from ${projectRoot} in ${elapsed}ms`
        );
    } else {
        console.log(`[startup] cleanup: no orphaned .tmp files (scanned in ${elapsed}ms)`);
    }
}
```

### 3.3 `SETTINGS_FILE` 定数の位置

`SETTINGS_FILE` は既に main.cjs 内に定義済み。JS の hoisting により、`runStartupCleanup` 関数内から参照可能。**定義位置を移動する必要はない**。

### 3.4 絶対に守ること

1. **`await runStartupCleanup()` で起動を待たせない**。`.catch()` で fire-and-forget
2. **projectPath が取れないときは黙って return**。エラーにしない
3. **cleanup が throw しても起動は続く**。`.catch()` で握る
4. **同期 API（`fs.readFileSync` 等）を新規追加しない**。`fs.promises` で統一
5. **既存の `atomicWrite.cjs` を編集しない**。呼び出すだけ
6. **`fs.existsSync` は既存コードとの互換で使っている既存箇所のみ**。新規では使わず `fs.promises.stat` の try/catch で判定

---

## 4. テスト

### 4.1 既存 `atomicWrite.test.cjs` に追加するテスト

現状 `cleanupOrphanedTempFiles` のテストが無いため、この機会に追加する。

既存の 39 テストはそのまま維持し、**9 テスト追加**。合計 48 テスト。

### 4.2 追加するテスト一覧

| テスト名 | 内容 | 期待結果 |
|---|---|---|
| `testCleanupRemovesOldTempFiles` | 1時間以上古い `.tmp.*` ファイルを作って cleanup 実行 | `removed === 1`、ファイル消えている |
| `testCleanupKeepsRecentTempFiles` | 作ったばかりの `.tmp.*` で cleanup 実行 | `removed === 0`、ファイル残っている |
| `testCleanupIgnoresNormalFiles` | `novel.txt` を 2時間前にしても cleanup 実行 | `removed === 0`、ファイル残っている |
| `testCleanupSkipsNodeModules` | `node_modules/.xx.tmp.123.1000.abc` を 2時間前で作成 | `removed === 0`、ファイル残っている |
| `testCleanupSkipsGitDir` | `.git/.yy.tmp.123.1000.def` を 2時間前で作成 | `removed === 0`、ファイル残っている |
| `testCleanupRecursesIntoSubdirs` | `sub/.zz.tmp.123.1000.ghi` を 2時間前で作成 | `removed === 1`、ファイル消える |
| `testCleanupCustomMaxAge` | `maxAgeMs: 0` を渡して、新しいファイルも削除 | `removed === 1` |
| `testCleanupReturnsZeroForEmptyDir` | 空ディレクトリで cleanup | `removed === 0` |
| `testCleanupNonExistentRoot` | 存在しないパスで cleanup | `removed === 0`、throw せず |

### 4.3 実装パターン

既存の `withTempDir` ヘルパーを再利用する。実装例：

```js
async function testCleanupRemovesOldTempFiles() {
    console.log('testCleanupRemovesOldTempFiles');
    await withTempDir(async (dir) => {
        const tmpFile = path.join(dir, '.foo.tmp.12345.1700000000000.abc123');
        fs.writeFileSync(tmpFile, 'stale');
        // mtime を 2 時間前に設定
        const twoHoursAgo = (Date.now() - 2 * 60 * 60 * 1000) / 1000;
        fs.utimesSync(tmpFile, twoHoursAgo, twoHoursAgo);

        const removed = await cleanupOrphanedTempFiles(dir);
        expect('removed 1 file', removed === 1);
        expect('file is gone', !fs.existsSync(tmpFile));
    });
}

async function testCleanupKeepsRecentTempFiles() {
    console.log('testCleanupKeepsRecentTempFiles');
    await withTempDir(async (dir) => {
        const tmpFile = path.join(dir, '.foo.tmp.12345.1700000000000.abc123');
        fs.writeFileSync(tmpFile, 'fresh');
        // mtime は新しいまま

        const removed = await cleanupOrphanedTempFiles(dir);
        expect('removed 0 files', removed === 0);
        expect('file still exists', fs.existsSync(tmpFile));
    });
}

async function testCleanupSkipsNodeModules() {
    console.log('testCleanupSkipsNodeModules');
    await withTempDir(async (dir) => {
        const nmDir = path.join(dir, 'node_modules');
        fs.mkdirSync(nmDir);
        const tmpInNm = path.join(nmDir, '.xx.tmp.123.1000.abc');
        fs.writeFileSync(tmpInNm, 'stale');
        const twoHoursAgo = (Date.now() - 2 * 60 * 60 * 1000) / 1000;
        fs.utimesSync(tmpInNm, twoHoursAgo, twoHoursAgo);

        const removed = await cleanupOrphanedTempFiles(dir);
        expect('removed 0 (skipped node_modules)', removed === 0);
        expect('file still exists', fs.existsSync(tmpInNm));
    });
}

// 他のテストも同様のパターンで書く
```

### 4.4 require 追加

`atomicWrite.test.cjs` の冒頭で既に分割代入が使われているはずなので、そこに `cleanupOrphanedTempFiles` を追加：

```js
// 変更前
const {
    atomicWriteTextFile,
    atomicWriteBinaryFile,
    validateTextPayload,
    classifyShrink,
    ValidationError,
} = require('./atomicWrite.cjs');

// 変更後
const {
    atomicWriteTextFile,
    atomicWriteBinaryFile,
    validateTextPayload,
    classifyShrink,
    cleanupOrphanedTempFiles,  // ← 追加
    ValidationError,
} = require('./atomicWrite.cjs');
```

### 4.5 `main()` の `tests` 配列への追加

```js
async function main() {
    const tests = [
        // ... 既存の 16 関数 ...
        testCleanupRemovesOldTempFiles,
        testCleanupKeepsRecentTempFiles,
        testCleanupIgnoresNormalFiles,
        testCleanupSkipsNodeModules,
        testCleanupSkipsGitDir,
        testCleanupRecursesIntoSubdirs,
        testCleanupCustomMaxAge,
        testCleanupReturnsZeroForEmptyDir,
        testCleanupNonExistentRoot,
    ];
    // ...
}
```

### 4.6 手動確認

ユニットテストに加えて、以下の手動確認を行う：

**シナリオ 1：通常起動（残骸なし）**

1. `npm run build && electron .`（または dev モードで起動）
2. コンソール出力に `[startup] cleanup: no orphaned .tmp files (scanned in Xms)` が表示される
3. エディタが正常に起動する

**シナリオ 2：擬似残骸の削除**

1. プロジェクトフォルダに `touch .foo.tmp.12345.1700000000000.abc123` でダミーファイル作成
2. macOS：`touch -t 202604011200 .foo.tmp.12345.1700000000000.abc123` で mtime を過去に
3. Electron を起動
4. コンソールに `[startup] cleanup: removed 1 orphaned .tmp files from <projectRoot> in Xms` が出る
5. `.foo.tmp.*` が実際に消えている

**シナリオ 3：projectPath 未設定**

1. `~/Library/Application Support/<NEXUS app name>/user_settings.json` を一時退避
2. Electron 起動
3. コンソールに `[startup] no projectPath configured, skipping cleanup` が出る
4. エディタが正常起動（設定は初期状態に戻るが、起動は成功）
5. 退避した settings を戻す

---

## 5. 絶対遵守ルール

1. **本番原稿に触らない**。テストは `withTempDir` の一時ディレクトリのみ
2. **パターン一致を厳密に**。`/\.tmp\.\d+\.\d+\.[a-z0-9]+$/` に合致するファイルのみ削除（既存実装そのままを呼ぶ）
3. **起動を止めない**。cleanup は fire-and-forget で `.catch()` 必須
4. **既存 `atomicWrite.cjs` のコードを改変しない**。import して呼ぶだけ
5. **既存 39 テストを絶対に壊さない**。追加 9 を合わせて 48 passed
6. **`src/` を一切触らない**
7. **同期 API を新規追加しない**（`fs.promises` で統一）
8. **コミットを 3 回以上書き直したら止めて Claude Opus に戻す**

---

## 6. 完了条件

以下全部 [x] で完了：

- [ ] `feature/tmp-cleanup` ブランチが作成されている
- [ ] `electron/main.cjs` の require に `cleanupOrphanedTempFiles` が追加されている
- [ ] `electron/main.cjs` に `runStartupCleanup` 関数が追加されている
- [ ] `app.whenReady().then(() => { createWindow(); ... })` 内で fire-and-forget で呼ばれている
- [ ] `electron/atomicWrite.test.cjs` の require に `cleanupOrphanedTempFiles` が追加されている
- [ ] `electron/atomicWrite.test.cjs` に §4.2 の 9 テストが追加され、`main()` の tests 配列に登録されている
- [ ] `node electron/atomicWrite.test.cjs` が **48 passed, 0 failed**
- [ ] `npm run build` が成功
- [ ] §4.6 シナリオ 1：通常起動で cleanup ログが出る
- [ ] §4.6 シナリオ 2：擬似残骸が削除される
- [ ] §4.6 シナリオ 3：projectPath 未設定でも起動する
- [ ] 既存のファイル編集・保存が問題なく動く（回帰確認）
- [ ] §0.3 のコミットメッセージ雛形でコミット、push

---

## 7. 詰まったら

以下のいずれかに当てはまったら**即座に作業を止めて** Claude Opus に相談する。

- コミットを 3 回書き直しても §6 を満たせない
- 既存 39 テストが 1 つでも fail になる
- Electron 起動時にクラッシュ・無限ループ・フリーズする
- `SETTINGS_FILE` の読み込みで予期せぬ型エラー
- `projectPath` の形式で分岐が判断つかない
- `cleanupOrphanedTempFiles` が予期せぬファイルを削除してしまう挙動を見つけた

相談時に貼るもの：

1. `git log --oneline -5`
2. `node electron/atomicWrite.test.cjs` 全出力
3. Electron 起動時のコンソール出力全文
4. 詰まっている箇所のファイル名と行番号

---

## 8. この指示書の範囲外（やらないこと）

- ジャーナル記録（指示書 A で扱う）
- 境界検出（指示書 C で扱う）
- cleanup 前にスナップショット（将来）
- UI 通知（将来、当面は console.log のみで十分）
- 定期実行（起動時 1 回で十分）
- `cleanupOrphanedTempFiles` 本体のロジック変更（別指示書）
- パターン追加や除外追加（別指示書）

1 指示書 1 責務。範囲外に手を出さない。

---

## 9. 補足

この指示書は**全 3 本（A/B/C）の中で最も小さい**。実質的な新規実装は：

- `runStartupCleanup` 関数：約 40 行
- require 2 行追加
- `app.whenReady()` 内に 4 行追加
- 既存テストに 9 関数追加：約 150 行

**合計 200 行程度**。Gemini 3 Flash でも十分実装可能な粒度。

atomic write 本体は既に完成しているので、この指示書は**完成した機能を適切なタイミングで呼ぶ配線作業**に過ぎない。精度を求められるのは main.cjs の起動シーケンスへの挿入位置と、テストの網羅性のみ。
