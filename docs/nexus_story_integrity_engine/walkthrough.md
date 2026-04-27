# 物語整合性エンジン & 言語ハブ統合 ウォークスルー

## 1. 最強の言語ハブ (Linguistic Hub)
textlint ベースの 1,300 以上の校正ルールを `AuditReportWindow` に統合しました。

- **「校正」カテゴリの追加**: Python 側の物語監査とは別に、青色のタグで校正結果を表示。
- **高速フィードバック**: 開いている原稿を即座にスキャンし、文法ミスや冗長表現を指摘。
- **エディタ連携**: 指摘箇所への正確なスクロール・選択機能を実装。

## 2. 物語整合性エンジン (Narrative Integrity)
設定資料を「マスター（正解）」とし、本編との矛盾を検知する Layer 2 監査の基盤を実装しました。

- **プロジェクト隔離**: `project_utils.py` により、ファイルパスから作品を識別し、別作品の知識を混同しない仕組みを導入。
- **詳細属性の抽出**: キャラクターの「瞳の色」「出身」「武器」などを設定資料から自動抽出し、プログラム的に本文と比較。
- **AI ハイブリッド監査**: プログラムによる決定論的チェックと、Ollama による論理矛盾チェックのハイブリッド構成。

## 3. 対話型ナレッジ確定 (Human-in-the-Loop)
AI が推測し、ユーザーが確定する「間違いのない知識管理」を実現しました。

- **提案バナー**: 未タグのファイルを開いた際、AI が「作品名」や「文書タイプ」を提案。
- **Frontmatter 自動注入**: ユーザーが承認すると、即座に適切な YAML メタデータがファイルに書き込まれます。

---
### 変更された主なファイル
- [AuditReportWindow.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/AuditReportWindow.jsx): 校正結果の表示とジャンプ機能。
- [proofreader.py](file:///Users/mokutagawa/Documents/nexus_projects/mem0/proofreader.py): 物語矛盾検知ロジックの拡張。
- [story_state_extractor.py](file:///Users/mokutagawa/Documents/nexus_projects/mem0/story_state_extractor.py): 設定資料からの属性抽出。
- [KnowledgeSuggestionBanner.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/KnowledgeSuggestionBanner.jsx): AI 提案バナー UI。
