import chromadb
import ollama
import sys

# --- 設定 ---
DB_PATH = "./nexus_db"
# デフォルトモデル（起動時に使われるモデル）
current_model = "qwen3.5:9b" 

# ChromaDBのセットアップ
client = chromadb.PersistentClient(path=DB_PATH)
collection = client.get_or_create_collection(name="nexus_novels")

def ask_local_with_db(query, model_name):
    # 1. 質問をベクトル化してDBから関連情報を抜く
    # embeddingは常に高速なnomic-embed-textを使用
    try:
        response_vector = ollama.embeddings(model="nomic-embed-text", prompt=query)
        results = collection.query(query_embeddings=[response_vector["embedding"]], n_results=10)
        
        # どのフォルダ（住所）から見つかったかも含めてコンテキスト化
        context_parts = []
        for doc, meta in zip(results['documents'][0], results['metadatas'][0]):
            context_parts.append(f"【住所: {meta['path']} / ファイル: {meta['file']}】\n{doc}")
        
        context = "\n---\n".join(context_parts)
        
        # 2. プロンプト作成
        prompt = f"""
あなたは私の小説執筆を支える最高の副操縦士です。
以下の【私の創作資料】の内容を「絶対的な事実」として扱い、質問に答えてください。
資料にない推測をする場合は、必ずその旨を伝えてください。

【私の創作資料】
{context}

【質問】
{query}
"""
        
        print(f"\n🧠 {model_name} が思考中...")
        
        # 3. 生成（ストリーミング表示で「書いてる感」を出す）
        response = ollama.chat(model=model_name, messages=[
            {'role': 'user', 'content': prompt},
        ], stream=True)

        print(f"\n🤖 {model_name} の回答:")
        print("-" * 30)
        for chunk in response:
            print(chunk['message']['content'], end='', flush=True)
        print("\n" + "-" * 30)

    except Exception as e:
        print(f"\n❌ エラー発生: {e}")
        print("指定したモデルが 'ollama run' で起動できるか確認してください。")

if __name__ == "__main__":
    print(f"🚀 NEXUS AI 起動 (現在: {current_model})")
    print("・質問を打つとDBから関連設定を探して回答します")
    print("・'/model モデル名' でAIを変更できます (例: /model gemma4:31b)")
    print("・'q' で終了します")

    while True:
        user_input = input(f"\n[{current_model}] > ")
        
        if user_input.lower() == 'q':
            break
        
        # モデル切り替えコマンドの処理
        if user_input.startswith('/model '):
            new_model = user_input.split(' ')[1].strip()
            print(f"🔄 モデルを {current_model} から {new_model} に変更します...")
            current_model = new_model
            continue

        if not user_input.strip():
            continue

        ask_local_with_db(user_input, current_model)