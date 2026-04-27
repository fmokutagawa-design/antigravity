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

    def extract_all_states(self, project_id="Unknown"):
        """
        特定のプロジェクトに関連するすべての設定資料から状態を抽出する
        """
        where_clause = {"is_setting": 1}
        if project_id != "Unknown":
            where_clause["project"] = project_id

        results = self.collection.get(
            where=where_clause,
            include=["metadatas", "documents"]
        )

        self.timelines = {} # { name: CharacterTimeline }
        states = {"characters": {}, "terms": {}, "locations": {}, "timeline": []}

        if not results["ids"]:
            self.all_states = states
            return states

        chapter_desc_pattern = re.compile(r'(?:第|chapter_?)(\d+)', re.IGNORECASE)
        death_keywords = ["死亡", "戦死", "亡くなった", "故人", "殺された"]
        alive_keywords = ["生存", "生きている", "健在"]
        if_keywords = ["IF", "if", "設定変更", "独自"]

        for doc, meta in zip(results["documents"], results["metadatas"]):
            file_name = meta.get("file", "")
            file_chapter = 0
            match = re.search(r'(?:第|chapter_?)(\d+)', file_name, re.IGNORECASE)
            if match: file_chapter = int(match.group(1))

            current_entity = None
            lines = doc.split("\n")
            for line in lines:
                line = line.strip()
                if not line: continue

                # 1. エンティティの特定
                entity_match = re.match(r'^([#■・]*)?\s*([^：:\[\(\s]{1,20})\s*[：:]', line)
                if entity_match:
                    current_entity = entity_match.group(2).strip()
                    desc = line[entity_match.end():].strip()
                elif current_entity and line.startswith(('-', '・', '*', ' ')):
                    desc = line.lstrip('-・* ').strip()
                else:
                    matched_entities = [e.strip() for e in meta.get("entities", "").split(",") if e.strip() and e.strip() in line[:30]]
                    if matched_entities:
                        current_entity = matched_entities[0]
                        desc = line
                    else:
                        if not current_entity: continue
                        desc = line

                canonical_name = self.reverse_aliases.get(current_entity, current_entity)
                if canonical_name not in self.timelines:
                    self.timelines[canonical_name] = CharacterTimeline(canonical_name)
                    # 初期属性辞書
                    states["characters"][canonical_name] = {"status": "alive", "attributes": {}, "source": file_name}

                # 章番号の特定
                ch_match = chapter_desc_pattern.search(desc)
                effective_chapter = int(ch_match.group(1)) if ch_match else file_chapter

                # 状態判定
                status = "alive"
                if any(k in desc for k in death_keywords): status = "dead"
                elif any(k in desc for k in alive_keywords): status = "alive"
                is_if = any(k in desc for k in if_keywords)

                self.timelines[canonical_name].add_event(effective_chapter, status, source=file_name, is_if=is_if)

                # 属性抽出 (瞳の色、出身、武器など)
                attr_keywords = {
                    "eye_color": ["瞳", "目", "眼"],
                    "hair": ["髪"],
                    "origin": ["出身", "故郷"],
                    "weapon": ["武器", "装備", "剣", "銃"]
                }
                for attr_key, keywords in attr_keywords.items():
                    if any(k in desc for k in keywords):
                        # 属性値の抽出 (「瞳：青」などの形式)
                        val_match = re.search(rf'({"|".join(keywords)})[：:\s]*([^\s,，。、]+)', desc)
                        if val_match:
                            states["characters"][canonical_name]["attributes"][attr_key] = val_match.group(2)

        self.all_states = states
        return states

    def get_state_at_chapter(self, entity_name, category, chapter_num):
        if not hasattr(self, 'timelines') or not self.timelines:
            return None
            
        canonical_name = self.reverse_aliases.get(entity_name, entity_name)
        if category == "characters" and canonical_name in self.timelines:
            tl_status = self.timelines[canonical_name].get_status_at(chapter_num)
            # 基本属性とマージ
            base_info = self.all_states["characters"].get(canonical_name, {})
            merged = base_info.copy()
            merged.update(tl_status)
            return merged
        return None

if __name__ == "__main__":
    extractor = StoryStateExtractor()
    states = extractor.extract_all_states()
    print(json.dumps(states, ensure_ascii=False, indent=2))
