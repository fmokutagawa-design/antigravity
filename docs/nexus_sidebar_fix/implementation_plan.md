# 実装計画：サイドバー表示修正 & クラウド同期レジリエンス

## 概要
分割機能によって作成された `.nexus` フォルダがサイドバーに表示されない問題を修正し、さらに OneDrive 等のクラウド同期アプリが未起動の際に発生するファイル読み込みトラブルへの耐性を向上させます。

## ユーザーレビューが必要な項目
- 特になし。

## オープンクエスチョン
- OneDrive 以外（Google Drive, Dropbox等）でも同様のタイムアウト警告を出すべきか。

## 変更内容

### 1. サイドバー・ファイル一覧の改善 [完了済み]
#### [MODIFY] [ManuscriptPanel.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/ManuscriptPanel.jsx)
- `.nexus` フォルダをリストに表示するようにフィルタを修正。

#### [MODIFY] [useMaterials.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useMaterials.js)
- `.nexus` フォルダを除外対象から外し、フラットリストにも含めるように変更。

#### [MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)
- `handleOpenFile` において、`.nexus` フォルダがクリックされた場合にプロジェクトとして開き直すロジックを追加。

### 2. クラウド同期レジリエンスの向上 [新規]
#### [MODIFY] [fileSystem.electron.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/utils/fileSystem.electron.js)
- `readFile` に 5秒のタイムアウト処理を追加。
- タイムアウト発生時に `CloudSyncTimeoutError` をスローするように変更。

#### [MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)
- `handleOpenFile` のエラーハンドリングを強化。
- タイムアウトエラーを検知した場合、「OneDrive などのクラウド同期アプリが起動しているか確認してください」という助言をトーストで表示。

## 確認事項
- [ ] サイドバーに `.nexus` フォルダが表示されること。
- [ ] フォルダクリックでプロジェクトが正常に切り替わること。
- [ ] クラウド同期が遅延している場合に適切な警告が表示されること。
