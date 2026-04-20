# Editor.jsx Uncontrolled 化 v3 実装計画 (Phase 2)

## 目的
Phase 3 (Uncontrolled) への準備として、計算ロジックから React の state (`localText` 等) への依存を排除します。
具体的には：
- `localText` を `useMemo` から `Ref` (`localTextRef.current`) に切り替え。
- `debouncedValue` state を廃止し、`debouncedDocument` から派生する `debouncedText` memo に置き換え。

これにより、タイピング時の React 再レンダリング負荷を軽減し、大規模ファイルでの安定性を高めます。

## ユーザーレビューが必要な項目
- **特記事項なし**: 指示書通りのリファクタリングを行います。

## 予定されている変更

### [Component Name] Editor.jsx の State 整理

#### [MODIFY] [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)

1. **`localText` の Ref 化**:
   - `useMemo` による `localText` の定義を削除。
   - `localTextRef.current` を `useEffect([localDocument])` 内で同期するように修正。

2. **`debouncedValue` の廃止と `debouncedText` の導入**:
   - `const [debouncedValue, setDebouncedValue] = useState(...)` を削除。
   - `useEffect([localText])` によるデバウンス更新ロジックを削除。
   - 代わりに `const debouncedText = useMemo(() => documentToText(debouncedDocument), [debouncedDocument])` を導入。

3. **参照箇所の置換**:
   - `Editor.jsx` 内の `localText` 参照をすべて `localTextRef.current` に置換（`displayValue`, `handleCursor`, `scrollToCaretPosition` 等）。
   - `debouncedValue` 参照をすべて `debouncedText` に置換（`highlights`, `correctionHighlights` 等）。

4. **`displayValue` の依存整理**:
   - `displayValue` の `useMemo` 依存配列から `localText` を削除し、`localDocument` のみに依存させます。

5. **`isMassiveText` の reactive 化**:
   - レンダリングで使用される `isMassiveText` が `localDocument` の変更を正しく反映するように修正。

## オープンな質問
- なし

## 検証計画

### 自動テスト
- `npm run build` が正常に終了することを確認します。

### 手動検証
- `medium.txt` (5万字) で以下の動作を確認：
  - 打鍵のレスポンス（劣化していないこと）。
  - シンタックスハイライト（着色）が 300-800ms 遅延して正しく更新されること。
  - Undo / Redo が正常に動作すること。
  - ファイル切替でデータ不整合やクラッシュが発生しないこと。
- `huge.txt` (42万字) でクラッシュしないことを確認します。
