# App.jsx のロールバックと安定化、および検索・置換機能の改善

本文内検索・置換機能の改善（UI・ロジック）と、その過程で発生した `App.jsx` のクラッシュ問題を解決しました。

## タスクリスト

- [x] 現状のコードとCSS変数の確認
- [x] 実装計画の作成（検索機能改善）
- [x] UIの修正（背景透過とレイアウトの崩れ）
    - [x] `SearchReplace.css` の全面刷新
- [x] 検索ロジックの改善（リアルタイム化と安全性向上）
    - [x] `SearchReplace.jsx` の修正（useCallback, useEffect追加、grep検索の安定化）
- [x] `App.jsx` のロールバックと安定化
    - [x] 以前の安定したコミット (`f3bbf18e`) へのロールバック
    - [x] 依存関係（TDZ）を考慮したフック・コールバックの再配置
    - [x] `pendingFileSelect` 処理の復旧
    - [x] 重複宣言の解消
- [x] `Editor.jsx` のメモリリーク（wheel listener）の確認と修正
- [x] 最終動作確認とビルド検証
- [x] ドキュメントの整理と保存 (`docs/revert_app_jsx_stabilization`)
