# パフォーマンス・オーバーホール（タスクリスト）

- [x] フックの最適化
    - [x] `useGhostText.js`: テキストクリアと生成の分離
    - [x] `useSessionStats.js`: `editorValue` への依存切り替え
- [x] App.jsx の最適化
    - [x] `editorValue` の `useMemo` によるキャッシュ
    - [x] `useGhostText` への `debouncedText` 渡し
    - [x] `useSessionStats` への `editorValue` 渡し
    - [x] LocalStorage 保存を `debouncedText` に変更
    - [x] `useAutoSave` (auto-save/auto-snapshot) を `debouncedText` に変更
    - [x] `useProjectActions` (pendingNavigation) を `debouncedText` に変更
    - [x] `Editor` コンポーネントの `value` プロップを `editorValue` に変更
- [x] Editor.jsx の最適化
    - [x] `MAX_HIGHLIGHT_ELEMENTS (2000)` の導入
    - [x] `localText` によるエディタ内状態の完結
- [x] 動作確認・検証 (コード整合性確認)
- [x] ビルド・プッシュ
    - [x] `npm run build` による検証
    - [x] リモートリポジトリへの push
