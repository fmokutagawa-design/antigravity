# 実装計画 - プレビュー更新の正常化と依存関係の最適化

タイピング中のプレビューが更新されない問題（useWorkText.js）の修正と、Preview.jsx における依存関係の整理を行います。

## ユーザーレビューが必要な項目

> [!IMPORTANT]
> `useWorkText.js` において、依存配列に `currentText` を戻します。`App.jsx` 側で既に `debouncedText` が渡されているため、これにより「タイピングが終わってから一呼吸置いてプレビューが更新される」という意図通りの挙動になります。

## 修正内容

### 1. [useWorkText.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useWorkText.js) の修正
- `useMemo` の依存配列に `currentText` を追加します。
- 現在は依存から外れているため、`debouncedText` が変化しても連結テキストが再計算されない状態です。これを修正します。

### 2. [Preview.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Preview.jsx) の修正
- `useEffect`（挿絵画像の読み込み）および `useCallback`（行クリック、作品全体クリック）の依存配列を整理します。
- 個別の `text` や `workText` への依存を `displayText` に一本化します。

## 検証計画

### 自動テスト / ブラウザテスト
- ブラウザツールを使用して、エディタに入力した内容が（デバウンス後に）プレビューに反映されるかを確認します。
- 作品全体表示モード（showFullWork）でも同様に反映されるかを確認します。

### 手動確認
- プレビュー画面での挿絵の表示が、テキスト変更後に正しく更新されるか確認します。
- プレビュー内のクリックによる章ジャンプ機能が正常に動作するか確認します。
