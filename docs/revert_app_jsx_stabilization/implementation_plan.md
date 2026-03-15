# App.jsx の安定化と検索・置換機能の改善

本文内検索・置換機能の改善と、それに伴う `App.jsx` のクラッシュ問題を解決するための実装計画です。

## ユーザーレビューが必要な項目
- `App.jsx` のコード順序を変更しました。これは製品版ビルドでの `ReferenceError` (TDZ) を防ぐための必須の変更です。

## 提案される変更

### 1. App.jsx の安定化
- [MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)
    - 以前の安定した状態 (`f3bbf18e`) への復元
    - `useMaterials` と `handleOpenFile` の宣言位置を `useEffect` より前に移動 (TDZ対策)
    - `pendingFileSelect` 処理の復旧
    - 重複宣言の解消

### 2. 検索・置換機能の改善
- [MODIFY] [SearchReplace.css](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/SearchReplace.css)
    - 背景の不透明化、レイアウトの固定、ダークモード対応
- [MODIFY] [SearchReplace.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/SearchReplace.jsx)
    - リアルタイム検索の導入、grep検索の安定化

### 3. メモリリーク対策
- [MODIFY] [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)
    - `handleWheel` の `useCallback` 化とリスナーのクリーンアップ

## 検証プラン
- プロジェクトフォルダの正常な読み込み確認
- 検索UIの不透明度とダークモード対応の確認
- リアルタイム検索の動作確認
- 製品版ビルド環境を想定した初期化順序の検証
