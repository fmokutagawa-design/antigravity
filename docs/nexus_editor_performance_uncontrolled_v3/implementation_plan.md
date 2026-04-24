# Editor.jsx Uncontrolled 化 v3 (Phase 3 修正) 実装計画

## 目的
前回の実装では `textarea` を `defaultValue` にしたものの、打鍵ごとに `setLocalDocument` (State更新) を行い、その副作用で `useLayoutEffect` による DOM の全文上書きが発生していました。
本計画ではこれを修正し、**打鍵中は React の再レンダリングを一切伴わない真の非制御コンポーネント**へと移行します。

## ユーザーレビューが必要な項目
- **重要**: `localDocument` State を完全に削除し、`localDocumentRef` と `debouncedDocument` State の組み合わせに移行します。
- **重要**: 打鍵中（`handleChange`）は Ref の更新のみを行い、`setLocalDocument` を呼び出しません。

## 予定されている変更

### [Component Name] Editor.jsx の真の Uncontrolled 化

#### [MODIFY] [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)

1.  **State/Ref の整理**:
    -   `localDocument` State を削除。
    -   `localDocumentRef` を真実のソースとして保持。
    -   `debouncedDocument` State をハイライトや外部通知のための「非同期なリアクティブ State」として継続利用。
    -   `initialDisplayValue` を `useMemo(() => ..., [])` で定義し、`textarea` の初回マウント時に適用。

2.  **`localOnChange` のハブ化**:
    -   `localOnChange(newText)` が全ての遅延更新を管理。
    -   300ms の `highlightDebounceRef` タイマーで `setDebouncedDocument` を更新。
    -   500ms の `appNotifyTimerRef` タイマーで App の `onChange` を呼び出し。

3.  **ハンドラの軽量化**:
    -   `handleChange` および `handleCompositionEnd` を更新。
    -   `localDocumentRef.current` を direkt 更新し、`localOnChange` を呼び出すのみとする。これにり打鍵時の再レンダリングがゼロになります。

4.  **`applyText` の完成**:
    -   DOM (`ta.value`) を直接更新。
    -   Ref を更新し、待機中の全タイマーをキャンセル。
    -   `setDebouncedDocument` を即座に更新し、ハイライトを最新に同期。
    -   Undo/Redo ロジックとの接続。

5.  **不必要な依存と副作用の削除**:
    -   `displayValue` Memo を削除。
    -   `useLayoutEffect` による DOM 同期を削除。
    -   `scrollToCaretPosition` などの依存配列から消滅した変数を削除。

## 依存関係の整理
- `highlights` 他の下流機能は `debouncedDocument` に依存するため、タイピング中も一定間隔（デバウンス後）で追従します。

## 検証計画

### 自動テスト
- `npm run build` が通ることを確認。
- `grep` で `localText` (変数) や `displayValue` が残っていないか確認。

### 手動検証
- 42万字ファイルで打鍵が即時であることを確認。
- ファイル切替時に内容が壊れないか（特にデバウンスの競合）。
- 縦書き/横書き切り替え、ルビ挿入などが正常に DOM に反映されるか。
- Undo/Redo が期待通りに DOM と App の両方に反映されるか。
