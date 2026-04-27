import os
import json
import time
import re
from proofreader import Proofreader
from story_state_extractor import StoryStateExtractor

class AuditBatchProcessor:
    """
    全原稿を一括で監査し、宿題リストを作成する
    """
    def __init__(self, target_dirs=None):
        self.pr = Proofreader()
        self.extractor = StoryStateExtractor()
        from config_loader import get_manuscript_dirs
        self.target_dirs = target_dirs or get_manuscript_dirs()
        self.report_path = os.path.join(os.path.dirname(__file__), "homework_list.json")

    def _extract_chapter_number(self, filename):
        """
        ファイル名から章番号（整数）を抽出する
        例: "第05章_遭遇.txt" -> 5
        例: "chapter_12.md" -> 12
        """
        match = re.search(r'(?:第|chapter_?)(\d+)', filename, re.IGNORECASE)
        if match:
            return int(match.group(1))
        # 数字のみのパターンも試行
        m = re.search(r'(\d+)', filename)
        if m:
            return int(m.group(1))
        return None

    def run_full_audit(self):
        print("🚀 【校正監査モード】大規模監査を開始します...")
        
        from ingest_novels import ingest_novels
        ingest_novels()
        
        homework_list = []
        start_time = time.time()
        file_count = 0

        # プロジェクトごとに処理
        for target_dir in self.target_dirs:
            if not os.path.exists(target_dir): continue

            # ディレクトリからプロジェクトIDを推測
            from knowledge_processor import KnowledgeProcessor
            kp = KnowledgeProcessor()
            # サンプルのファイルパスを作成してプロジェクトを判定
            project_id = kp._determine_project(os.path.join(target_dir, "dummy.txt"))
            
            print(f"📁 プロジェクト [{project_id}] の監査を開始...")
            states = self.extractor.extract_all_states(project_id=project_id)
            print(f"✅ 設定資料から {len(states['characters'])} 名のキャラクター状態を把握しました。")

            for root, _, files in os.walk(target_dir):
                for file in files:
                    if file.startswith('._') or not file.endswith(('.txt', '.md')):
                        continue
                    
                    file_path = os.path.join(root, file)
                    print(f"🔍 監査中: {file}")
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                            content = f.read()
                        
                        chapter_num = self._extract_chapter_number(file)
                        
                        # その時点でのコンテキストを作成
                        current_materials_context = {
                            "characters": {
                                name: self.extractor.get_state_at_chapter(name, "characters", chapter_num or 999)
                                for name in states["characters"]
                            }
                        }

                        results = self.pr.proofread(
                            content, 
                            mode='all', 
                            materials_context=current_materials_context,
                            chapter_number=chapter_num
                        )
                        
                        if results:
                            for res in results:
                                homework_list.append({
                                    "file": file,
                                    "full_path": file_path,
                                    "project": project_id,
                                    "original": res["original"],
                                    "suggested": res["suggested"],
                                    "reason": res["reason"],
                                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
                                })
                        
                        file_count += 1
                    except Exception as e:
                        print(f"❌ エラー ({file}): {e}")

        # 3. 結果の保存
        with open(self.report_path, "w", encoding="utf-8") as f:
            json.dump(homework_list, f, ensure_ascii=False, indent=2)

        elapsed = time.time() - start_time
        print(f"🎉 監査完了！ {file_count} ファイルを精査しました。")
        print(f"⏱ 処理時間: {elapsed:.1f} 秒")

if __name__ == "__main__":
    processor = AuditBatchProcessor()
    processor.run_full_audit()
