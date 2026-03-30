# クリーンモードおよび新ウィンドウでの検索ジャンプ修正計画

クリーンモード（横書き）でのキャレット位置への自動スクロール機能の不足、および新ウィンドウ（プレビュー）からメインウィンドウのエディタ操作ができない問題を修正します。

## ユーザーレビューが必要な項目

> [!IMPORTANT]
> - 新ウィンドウからメインウィンドウへの通信に `window.postMessage` を使用します。これにより、別ウィンドウのプレビューや目次をクリックした際に、メインウィンドウのエディタが該当箇所へジャンプできるようになります。
> - クリーンモード（横書き）では、標準の `textarea` の挙動を補完するために、フォーカス制御による強制スクロールを導入します。

## 提案される変更

### Components

#### [MODIFY] [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)
- `scrollToCaretPosition` (543行目付近) と `jumpToPosition` (706行目付近) を修正します。
- 横書きクリーンモードにおいて、`setSelectionRange` の後に `ta.blur()` と `ta.focus()` を組み合わせるか、一時的に `ta.scrollTop` を調整して、選択位置が確実に表示されるようにします。

#### [MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)
- `useEffect` を追加し、`window.addEventListener('message', ...)` で子ウィンドウからのジャンプ要求（`type: 'EDITOR_JUMP'` 等）を待機します。
- メッセージを受信したら、`editorRef.current.jumpToPosition(start, end)` を呼び出します。

### Hooks

#### [MODIFY] [useProjectActions.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useProjectActions.js)
- `handleOpenLink` を修正します。
- `isWindowMode` が真、かつ `window.opener` が存在する場合、自画面でファイルを開くのではなく、`window.opener.postMessage` を通じて親画面にターゲット情報を送信するように変更します。

## オープン質問

- 他のパネル（SearchPanel等）も新ウィンドウで開く可能性がありますか？
  - 今回はプレビュー窓（Preview）からのジャンプを主な対象としますが、汎用的なメッセージング構造にしておきます。

## 確認計画

### 手動確認
1.  **クリーンモード（横書き）**:
    - 長い文章を書き、下方のワードを「検索」してジャンプした際、スクロールが追随することを確認。
2.  **新ウィンドウ（プレビュー）**:
    - プレビューを新ウィンドウで開き、そこにあるWikiリンクをクリックした際、メインウィンドウのエディタが該当箇所にジャンプすることを確認。
