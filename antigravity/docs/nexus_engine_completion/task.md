# NEXUS エンジン修復・完成タスク

- [x] Task 1: `bridge_server.py` の欠落エンドポイント実装
- [x] Task 2: `ingest_novels.py` のクラッシュ修正 (`analyze_file` -> `process_file`)
- [x] Task 3: ライブ監査パス (`/analyze/proofread`) のバイパス修正
- [x] Task 4: ルール ID の重複解消と重複ルールの剪定
- [x] Task 5: 誤検知の多い 2 文字以下ルールの削除 (103件)
- [x] Task 6: 属性照合ロジック (瞳の色等) の `Proofreader` への完全接続
- [x] Task 7: ChromaDB `where` フィルタによるプロジェクト隔離の実装
- [x] Task 8: 存在しないファイルの自動削除ロジックの実装
- [x] Task 9: `propose_metadata` のルールベース判定化 (AI 分離)
- [x] Task 10: 監査レポートウィンドウへの進捗報告と安定化
