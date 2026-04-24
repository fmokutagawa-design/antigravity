# NEXUS パフォーマンス根治計画

原稿用紙700枚（14万字）で文字入力が不可能になる問題の根本的な解決。

## 問題の根本原因

**キー入力のたびに App.jsx（2486行）全体が再レンダリングされる。**

```
キー入力
→ Editor.handleChange → onChange(newText)
→ App.setText(newText) → App全体が再レンダリング
  → editorValue = parseNote(text).body ← 14万字パース（毎回！）
  → debouncedText effect（timer生成/破棄）
  → useAutoSave の effect 評価
  → useGhostText の effect 評価
  → サイドバー useMemo 依存チェック
  → 40+ state変数の参照・比較
→ Editor に新しい value が渡される → Editor 再レンダリング
  → toVerticalDisplay(14万字)
  → computeTotalLines(14万字)
  → 画面更新
```

**結果: 1回のキー入力 → 数十ミリ秒〜数百ミリ秒の遅延**

## 実装方針: Editor のローカル状態分離

Editor が自分でテキスト状態を持ち、App には遅延通知するだけにする。

```
キー入力（修正後）
→ Editor.handleChange
  → setLocalText(newText)  ← Editor内部のstate（高速！）
  → 画面更新（Editor だけ！App は再レンダリングしない）
  → 500ms後 → onChange(newText) → App.setText → App再レンダリング
```

## 変更ファイル

### [MODIFY] Editor.jsx

1. **ローカルテキスト状態を追加**
   - `const [localText, setLocalText] = useState(value)`
   - タイピング時は `localText` を即座に更新、`onChange` は 500ms デバウンス
   - 外部から `value` が変わった場合（ファイル切替、フォーマット等）のみ同期

2. **displayValue を localText ベースに変更**
   - `const displayValue = useMemo(() => isVertical ? toVerticalDisplay(localText) : localText, [localText, isVertical])`

3. **undo/redo もローカル状態で動作**

### [MODIFY] App.jsx

1. **editorValue の parseNote をデバウンス化**
   - 現在: `useMemo(() => parseNote(text).body, [text])` — 毎回14万字パース
   - 修正: `debouncedText` で計算 + text直接使用時はスキップ

2. **textRef を追加**
   - `const textRef = useRef(text)` — 最新テキストへの即時アクセス用
   - save 操作は `textRef.current` を使用

3. **handleTextChange をデバウンス対応に**

## 検証プラン

1. 14万字程度のテキストファイルをエディタで開く
2. キー入力のレスポンスが改善されていることを確認
3. ファイル切替、フォーマット適用、保存が正常動作することを確認
4. undo/redo が正常動作することを確認
