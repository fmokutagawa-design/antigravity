# NEXUS 校正エンジン統合フェーズ 1 完了報告

## 実施内容
執筆支援アプリ NEXUS に、主要なオープンソース校正ツール（LanguageTool, RedPen, Tomarigi）の知見を統合した、Node.js ベースの「Linguistic Hub」を構築しました。

### 1. 統合校正基盤 (textlint)
- `textlint` をコア・ハブとして採用し、`.textlintrc.js` による柔軟なルール管理を実現しました。
- 日本語標準ルール（`preset-japanese`, `preset-ja-spacing`）を導入し、基本文法チェックを自動化しました。

### 2. 各ツールの機能移植
- **LanguageTool / RedPen 移植**: `textlint/rules/nexus-integrated-rules.js` を作成し、以下のロジックを実装しました。
    - 読点数過多の検知 (RedPen)
    - 二重否定の検知 (LanguageTool)
    - 冗長表現「ことができる」の検知 (LanguageTool)
    - 助詞の誤用（「お」→「を」）の検知 (LanguageTool)
- **Tomarigi 統合**: Tomarigi の XML 辞書を `prh` 形式に変換（100件以上のルール）し、表記ゆれ・変換ミスの検知を可能にしました。

### 3. Electron 統合
- **メインプロセス**: `electron/textlintMain.cjs` を作成し、Vite/Electron 環境下での安定したルールロードと IPC 通信を実現しました。
- **レンダラープロセス**: `textlintService.js` を通じて、フロントエンドから `await textlintService.proofread(text)` で簡単に呼び出せるようにしました。

## 検証結果
テスト文章を用いた検証により、以下のすべての項目が正常に検知されることを確認しました。

```json
[
  { "ruleId": "nexus-integrated-rules", "message": "一文に読点が多すぎます..." },
  { "ruleId": "nexus-integrated-rules", "message": "助詞の「お」は「を」の間違い..." },
  { "ruleId": "nexus-integrated-rules", "message": "二重否定「なくはない」..." },
  { "ruleId": "nexus-integrated-rules", "message": "「ことができる」という表現は冗長..." },
  { "ruleId": "prh", "message": "灰汁 => あく" },
  { "ruleId": "japanese/no-mix-dearu-desumasu", "message": "敬体・常体の混在" }
]
```

## 次のステップ
- フロントエンド UI（`AuditReportWindow.jsx`）への結果表示の統合。
- Python 側の Narrative Engine（文脈・設定矛盾チェック）とのハイブリッド出力の実装。
