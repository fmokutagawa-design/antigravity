import os
import re
import json
import chromadb

class CharacterTimeline:
    """キャラクターの章ごとの状態を追跡"""
    def __init__(self, name):
        self.name = name
        self.events = []  # [{ chapter: int, status: str, source: str }]
        self.is_if = False
    
    def add_event(self, chapter, status, source=None, is_if=False):
        self.events.append({
            "chapter": chapter,
            "status": status,
            "source": source,
            "is_if": is_if
        })
        self.events.sort(key=lambda x: x["chapter"])
        if is_if:
            self.is_if = True
    
    def get_status_at(self, chapter):
        """指定章の時点での最新状態を返す"""
        # デフォルトは生存
        latest = {"status": "alive", "chapter": 0}
        for event in self.events:
            if event["chapter"] <= chapter:
                latest = event
            else:
                break
        return latest

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
        self.aliases = {}
        self.reverse_aliases = {}
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
        results = self.collection.get(
            where={"is_setting": 1},
            include=["metadatas", "documents"]
        )

        # 内部管理用のタイムライン
        self.timelines = {} # { name: CharacterTimeline }
        
        states = {
            "characters": {},
            "terms": {},
            "locations": {},
            "timeline": []
        }

        if not results["ids"]:
            self.all_states = states
            return states

        # 章番号の抽出パターン (本文中)
        chapter_desc_pattern = re.compile(r'(?:第|chapter_?)(\d+)', re.IGNORECASE)

        for doc, meta in zip(results["documents"], results["metadatas"]):
            file_name = meta.get("file", "")
            # ファイル名から章番号を推測 (デフォルトの有効章)
            file_chapter = 0
            match = re.search(r'(?:第|chapter_?)(\d+)', file_name, re.IGNORECASE)
            if match:
                file_chapter = int(match.group(1))

            death_keywords = ["死亡", "戦死", "亡くなった", "故人", "殺された"]
            alive_keywords = ["生存", "生きている", "健在"]
            if_keywords = ["IF", "if", "設定変更", "独自"]

            lines = doc.split("\n")
            for line in lines:
                if "：" in line or ":" in line:
                    parts = re.split(r'[：:]', line, 1)
                    name = parts[0].strip()
                    desc = parts[1].strip()

                    if name in meta.get("entities", "").split(","):
                        canonical_name = self.reverse_aliases.get(name, name)
                        
                        if canonical_name not in self.timelines:
                            self.timelines[canonical_name] = CharacterTimeline(canonical_name)

                        # 本文中の章番号を優先、なければファイル名から
                        ch_match = chapter_desc_pattern.search(desc)
                        effective_chapter = int(ch_match.group(1)) if ch_match else file_chapter
                        
                        # 状態判定
                        status = "alive"
                        is_dead = any(k in desc for k in death_keywords)
                        is_alive = any(k in desc for k in alive_keywords)
                        is_if = any(k in desc for k in if_keywords)

                        if is_dead: status = "dead"
                        elif is_alive: status = "alive"

                        self.timelines[canonical_name].add_event(
                            effective_chapter, 
                            status, 
                            source=file_name,
                            is_if=is_if
                        )

        # states 構造に変換 (互換性のため)
        for name, tl in self.timelines.items():
            states["characters"][name] = tl.events

        self.all_states = states
        return states

    def get_state_at_chapter(self, entity_name, category, chapter_num):
        """
        指定された章時点でのエンティティの状態を取得する
        """
        if not hasattr(self, 'timelines') or not self.timelines:
            self.extract_all_states()
            
        if category == "characters" and entity_name in self.timelines:
            return self.timelines[entity_name].get_status_at(chapter_num)
        
        # フォールバック (過去のリスト形式)
        states = self.all_states.get(category, {}).get(entity_name, [])
        current_state = None
        max_from = -1
        for s in states:
            eff = s.get("effective_from", s.get("chapter", 0))
            if eff <= chapter_num and eff > max_from:
                max_from = eff
                current_state = s
        return current_state

if __name__ == "__main__":
    extractor = StoryStateExtractor()
    states = extractor.extract_all_states()
    print(json.dumps(states, ensure_ascii=False, indent=2))
