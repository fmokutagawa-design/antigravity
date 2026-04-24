import ollama
import chromadb

# 1. 脳（データベース）に接続
client = chromadb.PersistentClient(path="./nexus_db")
# 修正箇所: メソッド名を正しく直しました
collection = client.get_or_create_collection(name="nexus_src")

def ask_brain(query):
    print(f"\n🔍 NEXUSの内部を検索中: {query}")
    
    # 2. 質問をベクトル化
    response = ollama.embeddings(model="nomic-embed-text", prompt=query)
    query_vector = response["embedding"]
    
    # 3. 脳から似ているコードを探す
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=3
    )
    
    print("\n--- 🧠 関連性の高いコード片 ---")
    if not results['ids'][0]:
        print("何も見つかりませんでした。")
    else:
        for i in range(len(results['ids'][0])):
            print(f"\n📄 ファイル名: {results['ids'][0][i]}")
            # プレビューとして先頭を表示
            content = results['documents'][0][i]
            print(f"内容抜粋:\n{content[:500]}...")
            print("-" * 40)

if __name__ == "__main__":
    print("NEXUS副操縦士、起動しました。")
    while True:
        q = input("\n質問を入力してください (qで終了): ")
        if q.lower() == 'q': 
            print("またいつでも呼んでください。")
            break
        if not q.strip(): continue
        ask_brain(q)