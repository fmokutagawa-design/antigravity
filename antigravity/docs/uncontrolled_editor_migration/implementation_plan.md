# Editor.jsx Uncontrolled 移行 実装計画

14万字を超えるような大規模な文書におけるタイピング遅延（ReactのControlled Componentによる再レンダリングコスト）を解消するため、`Editor.jsx` を Uncontrolled Component 構成へ移行します。

## ユーザーレビューが必要な事項

> [!IMPORTANT]
> この修正はエディタのコアロジックを大幅に変更します。特に入力処理、IME変換、Undo/Redo、外部からのテキスト変更（ファイル切替やAI挿入）の挙動に影響します。

> [!NOTE]
> 指示書に基づき、`insertText` メソッドが不足していたため、`useImperativeHandle` に追加します。

## 提案される変更

### `src/components/Editor.jsx` の移行

移行は以下の3つのフェーズに分けて実施し、各段階で安定性を確認します。

---

### Phase 1: `applyText` の導入と外部操作の統合

外部からのテキスト変更（ルビ挿入、貼り付け、画像ドロップ等）をDOM直接操作で反映するための `applyText` 関数を導入します。

#### [MODIFY] [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)

1.  **`applyText` の定義**: `useCallback` で定義。DOMの `value` 更新、`localTextRef` の更新、ハイライト計算用の `debouncedValue` 即時更新、Appへの `onChange` 通知を統合します。
2.  **既存操作の置換**: `useImperativeHandle` 内の `pasteFromHistory`, `insertRuby`, およびコンテキストメニュー、`handleDrop` 等での `localOnChange` 呼び出しを `applyText` に置き換えます。
3.  **`insertText` の追加**: `useImperativeHandle` に `insertText` を追加し、`applyText` を使用するようにします。

---

### Phase 2: React State (`localText`) 依存の排除準備

UIの状態計算を `localText` state から `localTextRef.current` ベースに切り替えます。

#### [MODIFY] [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)

1.  **参照の変更**: `handleDrop`, `scrollToCaretPosition`, `pushHistory` 等で `localText` を参照している箇所を `localTextRef.current` に変更します。
2.  **デバウンス処理の分離**: `debouncedValue` および `debouncedLineCount` の `useEffect` を、`localText` 依存から `handleChange` 内でのタイマー制御に変更します。

---

### Phase 3: Uncontrolled への完全切り替え

React state を削除し、textarea を完全に Uncontrolled にします。

#### [MODIFY] [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)

1.  **Stateの削除**: `const [localText, setLocalText] = useState(value)` を削除します。
2.  **textareaプロパティの変更**: `value={displayValue}` を削除し、`defaultValue`（初回マウント時のみ設定）に変更します。
3.  **`handleChange` / `handleCompositionEnd`**: state 更新を排除し、ref更新とデバウンス通知のみに簡略化します。
4.  **不要なロジックの削除**: `nextCursorPos` によるカーソル復元ロジック（`useLayoutEffect`）を削除します（ブラウザのデフォルト挙動に任せます）。
5.  **ファイル切替の同期**: `useEffect([value])` で `applyText(value)` を呼び出し、DOMを直接更新するようにします。

---

## 検証計画

### 自動テスト / ツールによる検証
- ビルドエラーがないことを確認。

### 手動確認 (指示書のテスト項目)
1.  **入力性能**: 10万字以上のテキストでタイピング遅延がないこと。
2.  **基本入力**: 縦書き・横書き両方で日本語/英数入力、IME変換・確定が正常であること。
3.  **Undo/Redo**: Cmd+Z / Cmd+Shift+Z で正常に戻ること、IME確定後も正しく動作すること。
4.  **外部連携**: ファイル切替、AI補完（Tab）、ルビ挿入、画像ドロップ、コピー・カット・ペーストが正常であること。
5.  **ハイライト**: シンタックスハイライト、校正ハイライト、ゴーストテキストが正しく表示・更新されること。
