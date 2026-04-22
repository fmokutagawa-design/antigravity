# App.jsx 信頼性向上パッチ（第2弾）

ユーザーより指摘のあった `App.jsx` および周辺コードの6つの潜在的バグを修正します。

## ユーザーレビューが必要な項目

> [!IMPORTANT]
> **Bug 6 (splitChapters 未接続)** について：
> 現在のコード（L.1146, L.1983, L.2634-2641）を確認したところ、`splitChapters` は既に適切に宣言され、エクスポートパネルおよびモーダルコンポーネントに接続されていました。そのため、本計画では修正対象外としています。

## 提案される変更点

### 1. App.jsx (コアロジックの修正)

#### [MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)

- **Bug 1: activeFileHandle 定義前参照の解消**
  - `activeFileHandleRef` を同期させている `useEffect`（L.87付近）を、`activeFileHandle` の `useState` 宣言（L.164付近）よりも後に移動します。これにより、TDZ (Temporal Dead Zone) によるエラーを回避します。

- **Bug 2: handleTextChange の堅牢性向上**
  - 指摘の通り deps は `[showMetadata]` ですが、リファレンスが常に最新であることを保証するため、コメントを追加します。また、`handleOpenFile` での `latestMetadataRef` 更新が既存であることを再確認しました。

- **Bug 3: isTauri のインポート漏れ修正**
  - `isTauri` がインポートされていないため、L.45 のインポートリストに追加します。

- **Bug 4: localStorage 二重保存競合の防止**
  - L.1210 のガード条件を強化します。`activeFileHandle` が存在する場合（プロジェクトファイルが開いている場合）は、`isProjectMode` の状態に関わらず localStorage への自動保存をスキップするようにします。

- **Bug 5: usageKey の末尾スペース削除**
  - L.622 のテンプレートリテラルに含まれる不要な末尾スペースを削除します。

---

## オープンな質問

> [!NOTE]
> Bug 6 について、もし意図していた「未接続」が別の箇所（例：サイドバー以外の場所での使用など）を指している場合は教えてください。現状では `ExportPanel` と `SplitByChaptersModal` に正しく紐付いています。

## 検証計画

### 自動テスト / コードチェック
- 修正後に `App.jsx` をロードし、`ReferenceError: activeFileHandle is not defined` が発生しないことを確認します。
- `localStorage` のキーにスペースが含まれていないことを確認します。

### 手動検証
- ファイルを開いた状態で少し待機し、`localStorage` に (`novel-editor-text` キー等で) 重複して書き込みが発生していないことをブラウザの DevTools で確認します。
- エクスポートパネルから「章ごとに分割」ボタンが反応し、モーダルが開くことを確認します。
