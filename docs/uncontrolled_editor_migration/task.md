# タスクリスト - Editor.jsx Uncontrolled 移行

## Phase 1: `applyText` の導入と外部操作の統合
- [ ] `applyText` 関数の定義
- [ ] `useImperativeHandle` 内の既存関数を `applyText` に置換
- [ ] `insertText` メソッドの追加
- [ ] コンテキストメニュー・ドロップ処理等の `localOnChange` を `applyText` に置換
- [ ] Phase 1 動作確認

## Phase 2: localText state 依存の排除準備
- [ ] `handleDrop`, `scrollToCaretPosition` 等の `localText` 参照を `localTextRef.current` に変更
- [ ] `debouncedValue` / `debouncedLineCount` の更新トリガーを state 依存からタイマー制御に変更
- [ ] Phase 2 動作確認

## Phase 3: Uncontrolled への完全切り替え
- [ ] `localText` state と `setLocalText` の削除
- [ ] textarea を `defaultValue` 形式に変更
- [ ] `handleChange` / `handleCompositionEnd` から state 更新を削除
- [ ] カーソル復元用 `useLayoutEffect` の削除
- [ ] `applyText` 本番仕様切り替えとファイル同期 `useEffect` の追加
- [ ] Phase 3 最終動作確認

## 完了処理
- [ ] Walkthrough 作成
- [ ] `docs/uncontrolled_editor_migration` へのドキュメントバックアップ
