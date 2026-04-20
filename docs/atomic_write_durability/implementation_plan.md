# 実装計画 - アトミック書き込みによるデータ耐久性の向上

2026年4月に発生した「原稿消失事故」を再発させないため、メインプロセスのファイル書き込みを「アトミック書き込み（Write-to-Temp, Fsync, Verify, Rename）」パターンに移行します。

## ユーザーレビューが必要な項目

> [!IMPORTANT]
> - `fs:writeFile` は空文字列の書き込みを拒否するようになります（V-1 検証）。
> - 空ファイルを作成したい場合は、明示的に `fs:createFile` （`allowEmpty: true` を内部で使用）を呼び出す必要があります。
> - NULL 文字（`\u0000`）が含まれるコンテンツも書き込みを拒否します（V-4 検証）。

## 提案される変更

### 1. 新規ユーティリティ・テストの作成

#### [NEW] [atomicWrite.cjs](file:///Volumes/Black6T/Nexus_Dev/antigravity/electron/atomicWrite.cjs)
- アトミック書き込みのコアロジックを実装。
- ペイロード検証（空文字、NULL、サイズ激減チェック）を含む。

#### [NEW] [atomicWrite.test.cjs](file:///Volumes/Black6T/Nexus_Dev/antigravity/electron/atomicWrite.test.cjs)
- `atomicWrite.cjs` のユニットテスト（全39件）。

### 2. メインプロセスの統合

#### [MODIFY] [main.cjs](file:///Volumes/Black6T/Nexus_Dev/antigravity/electron/main.cjs)
- `fs:writeFile`, `fs:writeFileBinary`, `fs:createFile` の各ハンドラを `atomicWrite` 経由に差し替え。
- `ValidationError` 発生時に `VALIDATION_FAILED:<code>:<message>` 形式のエラーをスロー。

### 3. レンダラープロセスの調整

#### [MODIFY] [fileSystem.electron.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/utils/fileSystem.electron.js)
- `getOrCreateFile` における空ファイル作成コードを `writeFile` から `createFile` に変更。

---

## 検証計画

### 自動テスト
- `node electron/atomicWrite.test.cjs` を実行し、全39件のテストがパスすることを確認。

### 手動検証
- エディタでテキストを保存し、正常に書き込まれることを確認。
- 空ファイルを新規作成（ファイルシステムツリーから）し、エラーなく作成されることを確認。
