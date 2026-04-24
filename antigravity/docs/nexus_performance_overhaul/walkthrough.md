# NEXUS パフォーマンス・オーバーホール (Walkthrough)

10万文字を超える大規模な原稿でも快適に執筆できるよう、エディタのレスポンス性能を大幅に改善しました。

## 実施した主な修正

今回の修正では、**「毎回のキー入力で行う処理の最小化」**と**「重い処理の遅延実行（Debounce）」**を徹底しました。

### 1. メモ化による再レンダリングの最適化 (`App.jsx`)
- `parseNote(text).body` を `useMemo` でキャッシュした `editorValue` を導入しました。
- これにより、エディタに渡される `value` が毎入力ごとに新規生成されなくなり、不要なコンポーネント再レンダリングが抑制されます。

### 2. 重い I/O と非同期処理の遅延実行 (`debouncedText` の導入)
以下の処理を、入力が止まってから 300ms 後に実行される `debouncedText` に切り替えました：
- **自動保存 (Auto-save)**: 毎入力ごとのファイル書き込みを回避。
- **自動スナップショット (Auto-snapshot)**: 履歴保存の負荷を軽減。
- **LocalStorage 同期**: ブラウザ側キャッシュ更新の頻度を最適化。
- **タグ・リンク走査 (pendingNavigation)**: 全文検索を伴うジャンプ処理を遅延。

### 3. Ghost Text (AI生成) の即時レスポンス改善 (`useGhostText.js`)
- 入力が始まった瞬間にゴーストテキストを**即時クリア**しつつ、新しい生成リクエストは **Debounce された後**に開始するように分離しました。これにより、入力中の「詰まり」が解消されました。

### 4. エディタ内状態の独立管理 (`Editor.jsx`)
- `localText` というエディタ内限定のステートを導入しました。
- タイピング時は `App.jsx` を介さず、`Editor.jsx` 内だけで再描画が完結するため、14万字を超える文書でも極めてスムーズな入力が可能です。
- アプリ全体への通知（`App.jsx` の更新）は、入力が止まってから **500ms** 後に行うよう強化しました。

### 5. DOM 要素数の制限と画像ドロップの最適化
- シンタックスハイライトに使用する DOM 要素数に上限（2,000件）を設けました。
- 画像のドロップやコンテキストメニューからの操作もすべて `localText` を経由するよう統一し、一貫性を保ちつつパフォーマンスを向上させました。

## 検証結果

- **大規模ファイルでのタイピング**: 10万文字以上のファイルを開いた状態でも、入力遅延（入力した文字が遅れて表示される現象）が発生しないことを確認しました。
- **自動保存の動作**: 入力を止めた後に正しく保存が実行されることを確認。
- **AI補完**: 入力中は邪魔をせず、一息ついたタイミングで補完が表示される挙動を維持。

> [!TIP]
> もしさらに高速化が必要な場合は、`src/App.jsx` の巨大なコンポーネントを `Context API` を使って分割し、エディタ部分だけを完全に独立させるリファクタリングが有効です。

---
**修正されたファイル:**
- [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)
- [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)
- [useGhostText.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useGhostText.js)
- [useSessionStats.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useSessionStats.js)
- [useAutoSave.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useAutoSave.js)
- [useProjectActions.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useProjectActions.js)
