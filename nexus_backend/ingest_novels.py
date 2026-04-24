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

def ingest_novels():
    print("🚀 【住所認識モード】インジェクションを開始します...")
    file_count = 0
    chunk_count = 0

    from knowledge_processor import KnowledgeProcessor
    kp = KnowledgeProcessor()

    for target_dir in TARGET_DIRS:
        if not os.path.exists(target_dir):
            print(f"⚠️ スキップ（未検出）: {target_dir}")
            continue

        for root, _, files in os.walk(target_dir):
            # フォルダ構造（相対パス）を計算
            # 例: 「ドキュメント/原稿/2026/最新」のような住所を抽出
            rel_path = os.path.relpath(root, BASE_PATH)
            
            for file in files:
                if file.startswith('._') or not file.endswith(('.txt', '.md')):
                    continue
                
                file_path = os.path.join(root, file)
                content = safe_read(file_path)
                if not content.strip(): continue

                # 「お膳立て」のための解析
                file_info = kp.analyze_file(file_path, content)
                entities_str = ",".join(file_info["entities"])

                # 文章を1000文字ずつの断片（チャンク）にする
                chunks = [content[i:i+1000] for i in range(0, len(content), 1000)]
                
                for i, chunk in enumerate(chunks):
                    chunk_id = f"{file}_p{i}"
                    
                    # タイムアウト対策：3回までリトライ
                    success = False
                    for attempt in range(3):
                        try:
                            # AIに意味を抽出させる
                            response = ollama.embeddings(model="nomic-embed-text", prompt=chunk)
                            vector = response["embedding"]
                            
                            # データベースに保存（お膳立て済みメタデータを記録）
                            collection.upsert(
                                ids=[chunk_id],
                                embeddings=[vector],
                                metadatas={
                                    "file": file,
                                    "path": rel_path,
                                    "full_path": file_path,
                                    "importance": file_info["importance"],
                                    "entities": entities_str,
                                    "is_setting": 1 if file_info["is_setting"] else 0,
                                    "project": file_info["project"]
                                },
                                documents=[chunk]
                            )
                            success = True
                            break
                        except Exception:
                            time.sleep(2) # 2秒待ってリトライ
                    
                    if success:
                        chunk_count += 1
                    else:
                        print(f"❌ 失敗: {file} (ブロック {i})")
                
                print(f"✅ 解析完了 ({file_info['importance']}pts) [{rel_path}]: {file}")
                file_count += 1
                time.sleep(0.05) # Ollamaへの負荷調整

    print(f"\n🎉 完了！")
    print(f"あなたの全歴史 {file_count} ファイル（{chunk_count} ブロック）を住所付きで記憶しました。")

if __name__ == "__main__":
    ingest_novels()