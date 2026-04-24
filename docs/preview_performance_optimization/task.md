# タスクリスト - プレビュー更新の正常化

- [x] `useWorkText.js` の `useMemo` 依存関係を修正 (currentText を追加)
- [x] `Preview.jsx` の `useEffect` (画像ロード) の依存関係を整理
- [x] `Preview.jsx` の `useCallback` (クリックハンドラ) の依存関係を整理
- [x] `useMaterials.js` のファイルツリーから .nexus フォルダを除外
- [x] `manifest.js` の loadSegmentTexts を最適化 (Batch処理 & readDirectory 削減)
- [x] `useMaterials.js` の並列度調整 (CONCURRENCY=6 & 遅延挿入)
- [x] `fileSystem.electron.js` に readFile リトライを追加
- [x] 動作確認 (ETIMEDOUT の解消確認)
