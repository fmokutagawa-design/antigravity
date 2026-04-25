import os
import re
import json
import chromadb

class StoryStateExtractor:
    """
    設定資料（Materials）から物語の「不変の事実」を抽出するクラス
    """
    def __init__(self, db_path=None):
        if db_path is None:
            import os
            db_path = os.path.join(os.path.dirname(__file__), "nexus_db")
        self.db_path = db_path
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_or_create_collection(name="nexus_novels")

        # エイリアス読み込み
        self.aliases = {}  # { "正式名": ["別名1", "別名2", ...] }
        self.reverse_aliases = {}  # { "別名": "正式名" }
        aliases_path = os.path.join(os.path.dirname(__file__), "nexus_aliases.json")
        if os.path.exists(aliases_path):
            try:
                with open(aliases_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.aliases = data.get("aliases", {})
                for canonical, names in self.aliases.items():
                    for name in names:
                        self.reverse_aliases[name] = canonical
            except Exception:
                pass

    def extract_all_states(self, project_name="Unknown"):
        """
        特定のプロジェクトに関連するすべての設定資料から状態を抽出する
        """
        # 1. 設定資料(SETTING)とプロット(PLOT)を全取得
        results = self.collection.get(
            where={"is_setting": 1}, # KnowledgeProcessorが付与したタグを利用
            include=["metadatas", "documents"]
        )

        states = {
            "characters": {},
            "terms": {},
            "locations": {},
            "timeline": []
        }

        if not results["ids"]:
            self.all_states = states
            return states

        for doc, meta in zip(results["documents"], results["metadatas"]):
            file_name = meta.get("file", "")
            # 章番号を推測 (effective_from)
            chapter_num = 0
            match = re.search(r'(?:第|chapter_?)(\d+)', file_name, re.IGNORECASE)
            if match:
                chapter_num = int(match.group(1))

            # 生死チェック
            death_keywords = ["死亡", "戦死", "亡くなった", "故人", "殺された"]
            alive_keywords = ["生存", "生きている", "健在"]
            if_keywords = ["IF", "if", "設定変更", "独自"]

            # 名前：説明 の形式をパース
            lines = doc.split("\n")
            for line in lines:
                if "：" in line or ":" in line:
                    parts = re.split(r'[：:]', line, 1)
                    name = parts[0].strip()
                    desc = parts[1].strip()

                    # キャラクター名らしいものを判定 (KnowledgeProcessorのエンティティを利用)
                    if name in meta.get("entities", "").split(","):
                        # 名前を正式名に統一
                        canonical_name = self.reverse_aliases.get(name, name)
                        if canonical_name not in states["characters"]:
                            states["characters"][canonical_name] = []

                        current_entry = {
                            "status": "alive",
                            "effective_from": chapter_num,
                            "source": file_name
                        }

                        # 状態判定
                        is_dead = any(k in desc for k in death_keywords)
                        is_alive = any(k in desc for k in alive_keywords)
                        is_if = any(k in desc for k in if_keywords)

                        if is_if:
                            if is_alive: current_entry["status"] = "alive"
                            elif is_dead: current_entry["status"] = "dead"
                            current_entry["is_if"] = True
                        else:
                            if is_dead: current_entry["status"] = "dead"
                            elif is_alive: current_entry["status"] = "alive"
                        
                        states["characters"][canonical_name].append(current_entry)

        self.all_states = states
        return states

    def get_state_at_chapter(self, entity_name, category, chapter_num):
        """
        指定された章時点でのエンティティの状態を取得する
        """
        # all_states が未ロードの場合はロードする
        if not hasattr(self, 'all_states'):
            self.extract_all_states()
            
        states = self.all_states.get(category, {}).get(entity_name, [])
        # effective_from が chapter_num 以下のもののうち、最大のものを探す
        current_state = None
        max_from = -1
        for s in states:
            eff = s.get("effective_from", 0)
            if eff <= chapter_num and eff > max_from:
                max_from = eff
                current_state = s
        return current_state

if __name__ == "__main__":
    extractor = StoryStateExtractor()
    states = extractor.extract_all_states()
    print(json.dumps(states, ensure_ascii=False, indent=2))
