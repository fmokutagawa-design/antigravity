import os
import ollama
import chromadb

# 1. データベースの準備（iMacの中にファイルを直接作ります）
client = chromadb.PersistentClient(path="./nexus_db")
collection = client.get_or_create_collection(name="nexus_src")

# 2. ソースコードの場所
TARGET_DIR = "/Volumes/Black6T/Nexus_Dev/antigravity/src"

def ingest():
    print(f"🚀 インジェクション開始 (ChromaDB版): {TARGET_DIR}")
    count = 0
    for root, _, files in os.walk(TARGET_DIR):
        for file in files:
            if file.startswith('._') or not file.endswith(('.jsx', '.js', '.md')):
                continue
            
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read(3000)
                    
                    # 3. Ollamaでベクトル化（768次元）
                    response = ollama.embeddings(model="nomic-embed-text", prompt=content)
                    vector = response["embedding"]
                    
                    # 4. データベースに保存（add から upsert に変更）
                    collection.upsert(
                        ids=[file],
                        embeddings=[vector],
                        metadatas=[{"path": file}],
                        documents=[content]
                    )
                    print(f"✅ {file} を最新の状態に更新しました")
                    count += 1
            except Exception as e:
                print(f"❌ {file} でエラー: {e}")

    print(f"🎉 完了！ {count} 個のファイルをあなたのiMacが完全に把握しました。")

if __name__ == "__main__":
    ingest()