# 実装計画: ローカル RAG (ChromaDB + Ollama) 統合

NEXUS エディタに、過去の執筆データを記憶したローカル検索基盤（RAG）を統合します。

## 概要
Python で構築済みのベクトル DB (ChromaDB) を利用するため、Node.js から直接 DB を叩くのではなく、Python で FastAPI サーバーを立ててサイドカーとして運用します。

## 修正・新規作成ファイル

### 1. Python バックエンド (新規)
- **[NEW] `bridge_server.py`**: `/Users/mokutagawa/Documents/nexus_projects/mem0/` に作成。
    - ChromaDB の検索ロジック。
    - Ollama との通信。
    - FastAPI によるストリーミングレスポンスの実装。

### 2. Electron フロントエンド (修正)
- **[MODIFY] `src/utils/ollamaService.js`**: ブリッジサーバーへのリクエスト用メソッド `chatWithRAG` を追加。
- **[MODIFY] `src/components/AIAssistant.jsx`**: 
    - `useRAG` ステートの追加。
    - チャット UI への「過去の全原稿DBから検索」トグルの実装。
    - `handleChatSendMessage` で `useRAG` が ON の場合にブリッジサーバーを呼び出すように変更。

---

## 詳細実装案

### ① Backend: `bridge_server.py`
FastAPI を使用し、既存の `ask_local_with_db` ロジックを API 化します。
Ollama のストリーミング出力をそのままクライアントへ中継します。

### ② Frontend: `ollamaService.js`
`localhost:8000/ask` に対して POST リクエストを送り、レスポンスをストリームとして読み取るメソッドを追加します。

### ③ UI: `AIAssistant.jsx`
チャット入力欄の上に、以下のトグルを追加します。
- `[ ] 過去の全原稿DBから検索`

---

## 期待される挙動
1. ユーザーがチャットで質問を入力。
2. トグルが ON の場合、Python サーバーが起動し、ChromaDB から関連設定や過去のシーンを検索。
3. 検索結果をコンテキストとして Ollama に渡し、回答を生成。
4. 生成された回答が 1 文字ずつチャット画面に表示される。

## 確認事項
- [ ] Python 環境に `fastapi`, `uvicorn`, `chromadb`, `ollama` がインストールされていること。
- [ ] バックエンドサーバーを自動起動するか、手動で起動するか（まずは手動起動から始め、安定したら自動起動を検討）。

---

## 検証プラン
1. Python サーバーを起動し、`curl` で `/ask` エンドポイントが正常に動作するか確認。
2. NEXUS のチャット UI でトグルを ON にし、過去の原稿にしかない情報を質問して、正しく引用されるか確認。
3. ストリーミング表示がスムーズに行われるか確認。
