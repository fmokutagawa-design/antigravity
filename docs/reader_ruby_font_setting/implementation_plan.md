# リーダーモードのルビフォント個別設定機能の実装

リーダーモードにおいて、本文とルビで異なるフォントを使用したいという要望（特に明朝体本文に対してゴシック体ルビが当たってしまう現状の解消）に対応するため、ルビ専用のフォント設定を追加します。

## ユーザーレビューが必要な項目
- ルビフォントのデフォルト値を「本文と同じ (inherit)」にするか、特定のフォントにするか。
- 設定場所は「リーダーモード内ツールバー」と「サイドバー全般設定」の両方に追加する予定です。

## 変更内容

### [MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)
- `settings` の初期状態に `rubyFontFamily: 'inherit'` を追加。

### [MODIFY] [Toolbar.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Toolbar.jsx)
- 「執筆・配色」セクションの「書体」項目の下に「ルビ書体」を追加。
- メインフォントと同様のプリセット選択、またはシステムフォント選択を可能にする（コードの共通化を検討）。

### [MODIFY] [ReaderView.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/ReaderView.jsx)
- `readerRubyFont` ステートを追加（初期値は `settings.rubyFontFamily`）。
- ツールバーにルビフォント選択の `<select>` を追加。
- 本文レンダリング部分の `style` オブジェクト生成時、または CSS 変数を介して `rt` 要素にフォントを適用。

### [MODIFY] [ReaderView.css](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/ReaderView.css)
- `.reader-body rt` に固定で指定されている `'Hiragino Sans', sans-serif` を削除し、親からの継承または変数による指定を優先するように変更。

## 検証プラン
1. リーダーモードを開き、ツールバーからルビフォントを変更して、リアルタイムでルビの書体が変わることを確認する。
2. サイドバーの設定でルビフォントを変更し、保存・再起動後も設定が維持されていることを確認する。
3. 縦書き・横書きの両方でルビの表示が崩れないことを確認する。
