
import sys
import os

project_path = '/Users/mokutagawa/Documents/nexus_projects/mem0'
sys.path.append(project_path)

from knowledge_processor import KnowledgeProcessor

processor = KnowledgeProcessor()

files_to_test = [
    "/Users/mokutagawa/Library/CloudStorage/OneDrive-個人用(2)/ドキュメント/原稿/2026/joplin/Ciphered Forsaken – 噛み砕く夜/キャラ設定/黒鐘陽明/黒鐘 陽明（こくしょう ようめい）.md",
    "/Users/mokutagawa/Library/CloudStorage/OneDrive-個人用(2)/ドキュメント/原稿/2026/joplin/Ciphered Forsaken – 噛み砕く夜/キャラ設定/モデル一覧.md"
]

for file_path in files_to_test:
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            metadata = processor.process_file(file_path, content)
            print(f"### ファイル: {os.path.basename(file_path)}")
            print(f"- **プロジェクト**: {metadata['project']}")
            print(f"- **重要度**: {metadata['importance']}pts")
            print(f"- **AI自動タグ**: {', '.join([f'#{e}' for e in metadata['entities'].split(',') if e.strip()])}")
            print("\n")
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
    else:
        print(f"File not found: {file_path}")
