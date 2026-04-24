
import chromadb
import os

db_path = "/Users/mokutagawa/Documents/nexus_projects/mem0/nexus_db"
collection_name = "nexus_novels"

if os.path.exists(db_path):
    client = chromadb.PersistentClient(path=db_path)
    try:
        collection = client.get_collection(name=collection_name)
        # 最新の5件を取得
        results = collection.get(limit=10)
        
        metadatas = results['metadatas']
        documents = results['documents']
        
        print(f"--- データベース内の実データ (最新10件) ---")
        seen_files = set()
        count = 0
        for meta, doc in zip(metadatas, documents):
            file_name = meta.get('file')
            if file_name in seen_files: continue
            seen_files.add(file_name)
            
            clean_doc = doc[:100].replace('\n', ' ')
            print(f"【ファイル名】: {file_name}")
            print(f"  - 重要度: {meta.get('importance')}pts")
            print(f"  - AI抽出タグ: {meta.get('entities')}")
            print(f"  - プロジェクト: {meta.get('project')}")
            print(f"  - 内容の一部: {clean_doc}...")
            print("-" * 30)
            count += 1
            if count >= 3: break
            
    except Exception as e:
        print(f"Error accessing collection: {e}")
else:
    print(f"Database not found at {db_path}")
