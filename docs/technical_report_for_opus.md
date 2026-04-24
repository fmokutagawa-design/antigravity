# テクニカル・レポート：NEXUS 大規模長編支援システムの進化

本レポートは、NEXUS プロジェクトにおける「章分割機能」の実装から現在（物語監査エンジン実装）までの技術的変更点をまとめたものである。

## 0. プロジェクト管理情報
*   **開発ブランチ (Editor Core)**: `perf/fix-large-file-freeze`
*   **プロジェクト全体 (Root)**: `main` (Initial Commit: 2026-04-24)
*   **主要ディレクトリ**: 
    *   フロントエンド: `/Volumes/Black6T/Nexus_Dev/antigravity`
    *   バックエンド: `/Users/mokutagawa/Documents/nexus_projects/mem0/`

---

## 1. 大規模原稿の分割・統治（Chapter Management）
42万字という単一ファイルの巨大化によるパフォーマンス低下と管理の困難さを解決するため、章単位での物理分割と仮想的な統合管理を実装。

### 修正ソースコード
*   **`SplitByChaptersModal.jsx`**: 正規表現（「第◯章」など）を用いて、単一ファイルを物理的な複数ファイルへ分割する UI とロジック。
*   **`ImportChaptersModal.jsx`**: 分識されたファイルを一括でエディタのワークスペースへ再登録。
*   **`useSplitByChapters.js`**: 分割・統合のビジネスロジックをカプセル化したカスタムフック。

---

## 2. エディタの「聖域化」とパフォーマンス改善
大規模原稿（14万字〜）でもタイピング遅延を 0ms に抑えるため、React のレンダリングサイクルからテキスト入力を完全に分離。

### 修正ソースコード
*   **`ManuscriptPanel.jsx`**: 非制御コンポーネント (Uncontrolled Component) への移行。`useRef` による直接的な DOM 操作により、State 更新に伴う再レンダリングを回避。
*   **`ReaderView.jsx`**: ウィンドウ仮想化 (Window Virtualization) の実装。可視範囲内の行のみをレンダリングし、大規模文書でも軽快な動作を実現。

---

## 3. 物語監査エンジン（Story Integrity Engine）
執筆パフォーマンスを犠牲にせず、バックグラウンドで物語の論理的整合性を検証する「校正監査モード」の実装。

### 修正ソースコード
*   **`proofreader.py`**: Layer 1（文法）に加え、Layer 2（物語論理チェック）を搭載。
*   **`story_state_extractor.py`**: 設定資料から人物の生死、所属、IF設定（作者の意図）を抽出するステートマシン。
*   **`audit_batch_processor.py`**: 昼休みバッチ処理の心臓部。全原稿を一括監査。
*   **`AuditReportWindow.jsx`**: 矛盾箇所を表示するフローティング UI。該当箇所へのダイレクトジャンプ機能を搭載。

---

## 4. スマート・ナレッジ・エンジン（自動整理 DB）
資料管理のコストを最小化するための深層タグ付けと UI 連携。

### 修正ソースコード
*   **`knowledge_processor.py`**: 人物・場所・組織・アイテムの自動抽出ロジック強化。
*   **`AIKnowledgeManager.jsx`**: カテゴリ別タブ表示（Settings/Plot/Manuscript）の実装。
*   **`bridge_server.py`**: 監査開始、レポート取得、ナレッジ抽出のためのエンドポイント群を実装。
*   **`ollamaService.js`**: フロントエンドからバックエンド機能へアクセスするための通信クラス。

---

## 5. 設計思想の要諦
1.  **Non-Intrusive (非干渉)**: AI や監査は常に「手動起動」または「バッチ処理」であり、クリエイティブな執筆体験を絶対に妨げない。
2.  **IF-Setting Priority**: 一般的な知識よりも、作者が用意した「設定資料」を絶対的な「物語の法」として扱う。
3.  **Context Harmony**: 42万字の中に混在する「理想（プロット）」と「現実（原稿）」のズレを許容し、相互に参照可能な構造を維持する。
