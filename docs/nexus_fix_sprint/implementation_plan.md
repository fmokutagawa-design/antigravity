# 実装計画：信頼性向上（12件のバグ修正）およびジャーナル切り替え機能

ユーザーから報告された「透明分割（Transparent Segmentation）」の前提となる、エディタの堅牢性を確保するための修正計画です。

## ユーザーレビューが必要な項目

> [!IMPORTANT]
> - **Ref への移行**: 自動保存やメタデータ更新に関わる主要なロジックを、React の State 直接参照から `useRef` を経由した最新値参照へと変更します。これにより、非同期レンダリングによる「古いデータでの上書き」を完全に防止します。
> - **ジャーナル機能の変更**: 現在、すべての保存が `.journal` ログに記録されていますが、これを設定パネルからオフにできるようにします。

## 提案される変更点

### 1. エディタ基本層 (`App.jsx`, `useAutoSave.js`)

#### 🔴 バグA, B, F, G, H の修正
- **[MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)**
    - `textRef`, `debouncedTextRef` に加え、`latestMetadataRef` を追加。
    - `handleTextChange` でこれらを参照し、最新의 メタデータを常に保持。
    - `beforeunload` リスナーを Ref 経由での参照に変更し、再登録を抑制。
- **[MODIFY] [useAutoSave.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useAutoSave.js)**
    - `doSave` 内部で `debouncedTextRef` と `activeFileHandleRef` を使用。
    - `setInterval` によるスナップショットも Ref を参照するように修正し、レンダリング遅延による空保存を防止。

### 2. プロジェクト操作層 (`useProjectActions.js`, `useFileOperations.js`)

#### 🔴 バグC, D, E, K, L の修正
- **[MODIFY] [useProjectActions.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useProjectActions.js)**
    - `serializeNote(metadata, body)` を `serializeNote(body, metadata)` へ修正（Bug C）。
    - フォルダ移動（Auto-Organize）時、保存済みテキストの状態管理 (`lastSavedTextRef`) との同期を強化（Bug D, E）。
- **[MODIFY] [useFileOperations.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useFileOperations.js)**
    - `isSameEntry()` ヘルパーを導入し、ブラウザ版でのファイルハンドル比較を正確に行う（Bug K）。
    - `handleDuplicateFile` で、複製元が現在のエディタ以外の場合でも正しくファイル内容をコピーするよう修正（Bug L）。

### 3. ジャーナリング切り替え機能

- **[MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)**
    - 設定 `settings.enableJournaling` を追加（デフォルト true）。
- **[MODIFY] [electron/main.cjs](file:///Volumes/Black6T/Nexus_Dev/antigravity/electron/main.cjs)**
    - IPC `fs.writeFile` の引数にジャーナリング無効化フラグを渡せるように更新。
- **[MODIFY] [electron/atomicWrite.cjs](file:///Volumes/Black6T/Nexus_Dev/antigravity/electron/atomicWrite.cjs)**
    - `options.disableJournal` が指定された場合、`recordJournal` の呼び出しをスキップ。

## 確認計画

### 自動テスト
- `node electron/atomicWrite.test.cjs` を実行し、既存の堅牢性テストがパスすることを確認。
- `node src/utils/boundaryDetector.test.cjs` および `splitByChapters.test.cjs` で分割機能の健全性を再確認。

### 手動確認
1.  **メタデータ更新**: メタデータを変更した直後（500ms以内）に本文を打鍵し、メタデータが消えないことを確認。
2.  **プロジェクト内作成**: フォルダ内で新規ファイルを作成し、内容が `[object Object]` とならず、正しいメタデータ形式で初期化されるか。
3.  **ジャーナル切り替え**: 設定からログをオフにし、`.journal` ファイルの更新が止まることを確認。
