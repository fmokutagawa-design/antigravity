# タスクリスト: ローカル RAG 統合

- [x] bridge_server.py の作成 (FastAPI)
    - [x] ChromaDB 読み込みの実装
    - [x] Ollama 検索 & 生成ロジックの実装
    - [x] ストリーミングレスポンスの実装
- [x] ollamaService.js の拡張
    - [x] chatWithRAG メソッドの追加
- [x] AIAssistant.jsx の修正
    - [x] useRAG ステートとトグルの追加
    - [x] チャット送信時の分岐処理の実装
- [x] 動作確認・検証
    - [x] バックエンド疎通確認
    - [x] ストリーミング表示確認
    - [x] RAG 検索精度確認
