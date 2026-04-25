import os
import json
import time
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

    def run_full_audit(self):
        print("🚀 【校正監査モード】大規模監査を開始します...")
        
        # 0. 最新の原稿をDBに同期（お膳立て）
        print("📥 原稿の最新状態をデータベースに同期中...")
        from ingest_novels import ingest_novels
        ingest_novels()
        
        # 1. 最新の物語状態を抽出
        states = self.extractor.extract_all_states()
        print(f"✅ 設定資料から {len(states['characters'])} 名のキャラクター状態を把握しました。")

        homework_list = []
        start_time = time.time()
        file_count = 0

        # 2. 全原稿をスキャン
        for target_dir in self.target_dirs:
            if not os.path.exists(target_dir): continue

            for root, _, files in os.walk(target_dir):
                for file in files:
                    if file.startswith('._') or not file.endswith(('.txt', '.md')):
                        continue
                    
                    file_path = os.path.join(root, file)
                    print(f"🔍 監査中: {file}")
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                            content = f.read()
                        
                        # 校正・監査の実行
                        # 42万字あっても、Layer 1+2のプログラム監査なら数秒で終わる
                        results = self.pr.proofread(content, mode='all', materials_context=states)
                        
                        if results:
                            for res in results:
                                homework_list.append({
                                    "file": file,
                                    "full_path": file_path,
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
        print(f"📝 宿題リストに {len(homework_list)} 件の項目を記録しました。")
        print(f"⏱ 処理時間: {elapsed:.1f} 秒")

if __name__ == "__main__":
    processor = AuditBatchProcessor()
    processor.run_full_audit()
