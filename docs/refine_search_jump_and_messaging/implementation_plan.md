# 検索ジャンプおよびウィンドウ間通信の最終調整計画

ユーザーからの詳細なフィードバック（ターン3およびその再送）に基づき、スクロール計算の微調整、セキュリティチェックの厳格化、およびメッセージ形式の汎用化を確実に行います。

## ユーザーレビューが必要な項目

> [!IMPORTANT]
> - **App.jsx**: `postMessage` および Electron IPC リスナーにて、`linkTarget`（ファイル名・タグ）だけでなく `{ start, end }`（直接の文字インデックス）によるジャンプもサポートするように拡張します。これにより、別ウィンドウ化した検索パネルなどからの精緻なジャンプが可能になります。

## 提案される変更

### Components

#### [MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)
- `message` リスナーを修正し、`event.data` から `start`, `end` を取得して `editorRef.current.jumpToPosition` を直接呼ぶフローを追加します。
- Electron IPC リスナー (`app:editor-jump`) も同様に `{ start, end }` を処理可能にします。

#### [MODIFY] [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)
- `scrollTop` 計算ロジックが既に実装されていることを再確認し、必要に応じて微調整します。現在の実装は `ta.clientHeight / 2` を引くことでキャレットを中央に寄せようとしており、これはユーザー提案の「確実にスクロールする」目的をより良く達成しています。

### Hooks

#### [MODIFY] [useProjectActions.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useProjectActions.js)
- `handleOpenLink` から送信するメッセージ形式を `{ type: 'EDITOR_JUMP', linkTarget }` とし、将来的な拡張性を確保します。

## オープン質問

- 今回の修正で、検索パネル自体を別ウィンドウで開く機能の実装は含まれませんが、将来的な対応を見越して `start`/`end` を解釈できるようにしておきます。これでよろしいでしょうか？

## 確認計画

### 手動確認
1.  **新ウィンドウ（プレビュー）**: プレビュー内のWikiリンクをクリックし、メインウィンドウのエディタが正しくジャンプすることを確認。
2.  **セキュリティ**: `origin` ガードが正しく機能しているか、コードレベルで再検証。
3.  **IME保持**: スクロール時に日本語入力が途切れないことを再確認。
