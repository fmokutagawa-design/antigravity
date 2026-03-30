# 実装計画：パフォーマンス・オーバーホール（大規模原稿の入力ラグ解消）

大規模な原稿（14万字等）の執筆時に発生している入力ラグを解消するため、App.jsx と Editor.jsx の処理を最適化します。

## ユーザーレビューが必要な項目

> [!IMPORTANT]
> - `debouncedText`（入力から300ms遅延）を各自動保存機能のトリガーに使用します。これにより、保存などの重い処理がキー入力ごとではなく、入力の合間に行われるようになります。
> - `Editor.jsx` でのシンタックスハイライト表示に上限（初期値2000件）を設けます。非常に記号が多い文書では、画面外のハイライトが表示されない場合がありますが、パフォーマンスへの影響を優先します。

## 提案される変更点

### 1. App.jsx および関連フックの最適化

エディタの入力（`text`）に同期して走っていた重い処理を、メモ化（`useMemo`）や遅延処理（`debouncedText`）に切り替えます。

#### [MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)
- **editorValue のメモ化**: `parseNote(text).body` を `useMemo` でキャッシュし、`Editor` コンポーネントに渡す値が変更された時のみ再パースされるようにします。
- **保存処理の遅延化**: 
  - `localStorage` への保存を `text` ではなく `debouncedText` 依存にします。
  - `auto-save（ファイル保存）`, `auto-snapshot`, `pendingNavigation` の各効果を `debouncedText` 依存に変更します。
- **コンポーネント接続の修正**: `useSessionStats` や `Editor` に `editorValue` を渡すように調整します。

#### [MODIFY] [useGhostText.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useGhostText.js)
- **クリア処理 and 生成処理の分離**:
  - テキストが変更された瞬間に `ghostText` をクリアする軽量な処理は `text` に依存させます。
  - AIによる続きの生成リクエストは `debouncedText` に依存させ、無駄な生成キャンセル・再発行のループを抑制します。

#### [MODIFY] [useSessionStats.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useSessionStats.js)
- パラメータを `text` から `editorValue` に変更し、内部での `parseNote` 呼び出しを排除します。

---

### 2. Editor.jsx の最適化

#### [MODIFY] [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)
- **ハイライト要素の上限設定**: `highlightElements` の生成時に `MAX_HIGHLIGHT_ELEMENTS (2000)` の上限を設け、大量の記号が含まれる文書での DOM 計算負荷を爆発させないようにします。

## オープンな質問

> [!NOTE]
> - `debouncedText` の遅延時間は現在 300ms ですが、タイピング速度に対して最適かどうか検証が必要です。
> - ハイライトの上限数（2000）を調整可能にする必要はありますか？（現在はハードコードを想定）

## 検証プラン

### 自動テスト / 手動検証
- **入力ラグの確認**: 10万字程度のダミーテキストを流し込み、キー入力時のレスポンスが改善しているか確認。
- **自動保存の動作確認**: 入力を止めた数秒後に「保存されました」の表示が出るか、localStorage にデータが残るかを確認。
- **Ghost Text の挙動**: 入力中はヒントが消え、入力を止めた後に生成が始まるかを確認。
- **ハイライト上限の確認**: 記号を大量に入力し、クラッシュせずに動作し続けることを確認。
