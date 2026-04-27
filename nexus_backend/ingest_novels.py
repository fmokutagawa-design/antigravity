import os
import ollama
import chromadb
import time

# 1. 設定：保存先と読み込み元
DB_PATH = "./nexus_db"
BASE_PATH = "/Users/mokutagawa/Library/CloudStorage/OneDrive-個人用"
TARGET_DIRS = [
    os.path.join(BASE_PATH, "ドキュメント/原稿"),
    os.path.join(BASE_PATH, "NEXUS　プロジェクトフォルダ")
]

# 2. データベースの準備
client = chromadb.PersistentClient(path=DB_PATH)
collection = client.get_or_create_collection(name="nexus_novels")

# 文字コードを自動判別して読み込む（安全重視）
def safe_read(file_path):
    encodings = ['utf-8', 'cp932', 'shift_jis', 'euc_jp']
    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        return f.read()

def ingest_novels(target_paths=None):
    print("🚀 【住所認識モード】インジェクションを開始します...")
    file_count = 0
    chunk_count = 0

    from knowledge_processor import KnowledgeProcessor
    kp = KnowledgeProcessor()

    # スキャン対象の決定
    current_targets = TARGET_DIRS.copy()
    if target_paths:
        if isinstance(target_paths, list):
            current_targets.extend(target_paths)
        else:
            current_targets.append(target_paths)
    
    # 重複排除と実在確認
    current_targets = list(set([os.path.abspath(t) for t in current_targets if os.path.exists(t)]))

    for target_dir in current_targets:
        print(f"📂 スキャン中: {target_dir}")
        for root, _, files in os.walk(target_dir):
            rel_path = os.path.relpath(root, BASE_PATH)
            
            for file in files:
                if file.startswith('._') or not file.endswith(('.txt', '.md')):
                    continue
                
                file_path = os.path.join(root, file)
                content = safe_read(file_path)
                if not content.strip(): continue

                # 解析 (process_fileを使用)
                file_info = kp.process_file(file_path, content)
                entities_str = file_info.get("entities", "")

                chunks = [content[i:i+1000] for i in range(0, len(content), 1000)]
                
                for i, chunk in enumerate(chunks):
                    chunk_id = f"{file}_p{i}"
                    
                    success = False
                    for attempt in range(3):
                        try:
                            response = ollama.embeddings(model="nomic-embed-text", prompt=chunk)
                            vector = response["embedding"]
                            
                            collection.upsert(
                                ids=[chunk_id],
                                embeddings=[vector],
                                metadatas={
                                    "file": file,
                                    "path": rel_path,
                                    "full_path": file_path,
                                    "importance": file_info.get("importance", 50),
                                    "entities": entities_str,
                                    "is_setting": 1 if file_info.get("doc_type") == "SETTING" else 0,
                                    "project": file_info.get("project", "Unknown"),
                                    "doc_type": file_info.get("doc_type", "OTHER")
                                },
                                documents=[chunk]
                            )
                            success = True
                            break
                        except Exception:
                            time.sleep(2)
                    
                    if success:
                        chunk_count += 1
                
                print(f"✅ 解析完了 ({file_info.get('importance')}pts) [{rel_path}]: {file}")
                file_count += 1
                time.sleep(0.05)

    # 3. 削除されたファイルのクリーンアップ (Task 8)
    print("\n🧹 クリーンアップ開始...")
    try:
        results = collection.get(include=["metadatas"])
        db_full_paths = {meta["full_path"] for meta in results["metadatas"] if "full_path" in meta}
        deleted_paths = [p for p in db_full_paths if not os.path.exists(p)]
        
        if deleted_paths:
            print(f"🗑️ {len(deleted_paths)} 件の削除済みファイルをDBから除去中...")
            for path in deleted_paths:
                collection.delete(where={"full_path": path})
    except Exception as e:
        print(f"⚠️ Cleanup error: {e}")

    print(f"\n🎉 完了！ {file_count} ファイル記憶しました。")

if __name__ == "__main__":
    ingest_novels()