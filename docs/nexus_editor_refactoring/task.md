# タスクリスト: Step 8.5 統合修復フェーズ (完了)

- [x] `Editor.jsx` に不足しているインポート (`toVerticalDisplay`, `useUndoHistory` 等) を追加
- [x] 必要な Ref (`isComposingRef`, `highlightDebounceRef` 等) を定義
- [x] 必要な State (`debouncedValue`, `scrollForce` 等) を定義
- [x] `useUndoHistory` フックを初期化し、既存の操作と接続
- [x] アンダーレイ計算ロジック (`charPositionsCache` 等) を復元・窓内テキスト用に最適化
- [x] `handleCursor` (旧 `handleScrollAndCursor`) を修正し、全文ベースの文字数カウントを実装
- [x] JSX 構造を更新し、アンダーレイ描画層を textarea の背後に配置
- [x] `applyText` と `slideWindow` を更新して履歴とアンダーレイを同期
- [x] ビルドエラーの解消と基本動作の確認

# タスクリスト: Step 9 最終確認と最適化 (完了)

- [x] 無限ループ防止ガード (`isProcessingPropValueRef`) の実装
- [x] `slideWindow` の精度向上（ジャンプ時の位置調整とフォーカス）
- [x] アンダーレイ描画のチラつき防止（同期タイミングの微調整）
- [x] コードのクリーンアップ（未使用変数の削除、ロジックの整理）
