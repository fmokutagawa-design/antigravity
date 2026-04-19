# Editor.jsx Uncontrolled 化 v3 実装計画 (Phase 1)

## 目的
非制御コンポーネント化（Phase 3）の準備として、外部（Undo/Redo、ルビ挿入、AI補完等）からテキストを変更する全ての経路を `applyText` 関数に集約します。
このフェーズでは、データフローの整理のみを行い、`textarea` はまだ React の state (`displayValue`) に同期された制御コンポーネントのまま維持します。

## ユーザーレビューが必要な項目
- **特記事項なし**: 指示書通りの集約を行います。

## 予定されている変更

### [Component Name] Editor.jsx の集約化

#### [MODIFY] [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)

1. **`applyText` の定義**:
   `localOnChange` の直後に `applyText` を追加します。この関数は以下の役割を担います。
   - 進行中の `appNotifyTimerRef`（Appへの onChange 通知タイマー）のクリア
   - `documentModel` の差分更新 (`updateDocument`)
   - カーソル位置の保存 (`nextCursorPos`)

2. **既存メソッドの置換**:
   以下のメソッド内のテキスト更新ロジックを `applyText` 呼び出しに置き換えます。
   - `insertText` / `pasteFromHistory` / `insertRuby` (useImperativeHandle)
   - `handleDrop` (画像挿絵)
   - `onKeyDown` (Ghost Text Tab 確定)
   - `handleCut` (切り取り)
   - 右クリックコンテキストメニュー（フォント変更、フォント解除、切り取り、貼り付け）

3. **onChange の明示的スケジュール**:
   各呼び出し元で、`applyText` の後に 500ms デバウンスの `onChange` 通知を明示的に記述します。

## オープンな質問
- なし

## 検証計画

### 自動テスト
- `npm run build` が正常に終了することを確認します。

### 手動検証
- `tiny.txt` を開き、以下の機能が正常に動作することを確認します。
  - 通常入力
  - Undo / Redo (`Cmd+Z` / `Cmd+Shift+Z`)
  - ルビ挿入 (`Cmd+R`)
  - AI出力を挿入するコンテキストメニュー操作
- 各操作後に App 側への state 同期（メニューの文字数カウント更新など）が正しく行われることを確認します。
