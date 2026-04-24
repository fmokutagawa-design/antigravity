# App.jsx 初期化エラー (ReferenceError) 修正計画

ブラウザコンソールのデバッグにより、`ReferenceError: Cannot access 'showMetadata' before initialization` が `src/App.jsx:131` で発生していることが特定されました。これは、131行目の `useMemo` 内で `showMetadata` を参照しているにもかかわらず、その宣言（`useState`）が455行目にあることが原因（Temporal Dead Zone）です。

## ユーザーレビューが必要な項目

- **状態宣言の移動**: `showMetadata` および関連するいくつかの状態宣言を、それらが最初に使用される `useMemo` や `useEffect` よりも前（Appコンポーネントの冒頭付近）に移動します。

## 提案される変更

### Components

#### [MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)
- 455行目付近にある `const [showMetadata, setShowMetadata] = useState(false);` を 75行目付近（`text` 状態の直後）に移動します。
- 必要に応じて、他の状態（`isSidebarVisible` など）も整理のために上部に集約します。

## 修正後の構成イメージ

```jsx
function App() {
  const [text, setText] = useState('');
  const [debouncedText, setDebouncedText] = useState('');
  const [showMetadata, setShowMetadata] = useState(false); // <--- ここに移動
  // ... 他の状態 ...

  // 131行目付近: これで安全にアクセス可能
  const editorValue = useMemo(() => {
    if (showMetadata) return text;
    return parseNote(text).body;
  }, [text, showMetadata]);
  
  // ...
}
```

## 確認計画

### 自動確認
- `npm run dev` 起動中のブラウザコンソールを確認し、`ReferenceError` が消失してアプリが正常にロードされることを確認します。

### 手動確認
- リーダーモードの起動、メタデータの表示切り替えなどの機能が正しく動作することを確認します。
