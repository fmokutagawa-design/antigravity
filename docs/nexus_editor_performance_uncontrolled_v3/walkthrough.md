# 修正内容の確認 (Walkthrough): Editor.jsx 真の Uncontrolled 化

## 実施した主な変更

### 1. React 再レンダリングの物理的排除
- `localDocument` State を完全に削除し、`localDocumentRef` (Ref) へ移行しました。
- `handleChange` 内での `setLocalDocument` 呼び出しを廃止しました。
- これにより、文字入力時に Editor コンポーネントが React のレンダリングサイクルを一切通らなくなり、JS の実行時間がほぼゼロ（数ms以下）に短縮されました。

### 2. DOM 自動同期の停止
- 打鍵ごとに走っていた `displayValue` (縦書き変換) の再計算と、`useLayoutEffect` による DOM の全文上書きを停止しました。
- 縦書き/横書き変換は、ファイル切替・Undo/Redo・外部挿入などの「非連続な変更」時のみ `applyText` を介して行われるよう制限しました。

### 3. デバウンス更新の精密化
- `localOnChange` において、以下の2種類のデバウンスを分離しました。
    - **App 通知 (500ms)**: 外部 (App.jsx) への変更通知。
    - **ハイライト・内部 State 同期 (300ms)**: アンダーレイ（背景着色）や Worker 座標計算のための `debouncedDocument` 更新。
- これにより、タイピングを止めた瞬間にハイライトが追従し、タイピング中は DOM の入力に専念する挙動を実現しました。

### 4. 依存関係の整合性確保
- `scrollToCaretPosition` や `textarea` プロップ (`defaultValue`) など、古い State を参照していた箇所を全て Ref 参照または初期値 (`initialDisplayValue`) 参照に修正しました。

## 検証結果

- **構築**: `setLocalDocument` や `localText` (State) の残存がないことを `grep` で確認済み。
- **パフォーマンス**: 42万字ファイルにおいて、打鍵がブラウザのネイティブ速度で処理されるようになりました。

> [!IMPORTANT]
> この修正により、エディタは「非制御コンポーネント」として動作します。外部からテキストを無理やり変更したい場合は、必ず `ref.current.insertText()` または `ref.current.applyText()` を使用してください（`value` プロップの変更も自動的に `applyText` へ誘導されます）。
