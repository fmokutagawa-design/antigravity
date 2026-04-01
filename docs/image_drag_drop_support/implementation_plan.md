# App.jsx 初期化順序エラーの修正計画

`ReferenceError: Cannot access 'showMetadata' before initialization` が発生している問題を修正するため、`App.jsx` 内のフックと状態定義の順序を再編成します。

## 発生している問題
- `editorValue` (line 130) が `showMetadata` (line 500) に依存している。
- `handleImageDrop` (line 297) が `isProjectMode`, `projectHandle` (line 509, 513) に依存している。
- React のフック（`useMemo`, `useCallback`）や副作用（`useEffect`）は、それらが参照する変数が定義された**後**に記述する必要があります。現在の `App.jsx` は大規模化に伴い、定義が分散してしまっています。

## 修正方針
1. **状態定義（`useState`）の集約**:
   ファイル後半（line 500付近）にある `showMetadata`, `isProjectMode`, `projectHandle` などの基本的な状態定義を、`App` コンポーネントの冒頭（`text` や `settings` の直後）に移動します。
2. **フックの整理**:
   すべての `useState` を定義した後、それらに依存する `useMemo` や `useCallback` を記述します。
3. **副作用（`useEffect`）の配置**:
   最後に `useEffect` を配置し、全ての状態とメモ化された関数が利用可能な状態にします。

## 修正内容

### [MODIFY] [epubExporter.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/utils/epubExporter.js)

- `textToHtml` 関数を拡張し、`［＃挿絵（.+?）入る］` を `<img src="images/...">` に変換。
- `generateEpub` 関数に `projectHandle` を渡せるようにし、テキスト内で使用されている画像を `images/` フォルダから読み込んで ZIP に追加する処理を実装。
- `content.opf` のマニフェストに画像ファイル（MIME type: image/jpeg, image/png等）を自動追加。
- `style.css` に挿絵表示用のスタイル（`.illustration { text-align: center; }` 等）を追加。

### [MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)

- `handleEpubExport` 内で `projectHandle` を `generateEpub` に渡すように変更。

## 検証計画

### 自動テスト
- `npm run dev` で起動し、ブラウザコンソールに `ReferenceError` が表示されないことを確認。
- 開発者ツールで `Editor` にテキストが正常に表示されるか（`editorValue` が正しく機能しているか）を確認。

### 手動検証
- 画像のドラッグ＆ドロップが機能し、トースト通知（`showToast`）が出るか再度確認。
- サイドバーの表示切り替えやファイルツリーの操作が壊れていないか確認。
