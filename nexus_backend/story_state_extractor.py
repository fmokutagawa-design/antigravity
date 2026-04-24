import os
import re
import json
import chromadb

class StoryStateExtractor:
    """
    設定資料（Materials）から物語の「不変の事実」を抽出するクラス
    """
    def __init__(self, db_path="/Users/mokutagawa/Documents/nexus_projects/mem0/nexus_db"):
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_or_create_collection(name="nexus_novels")

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
            return states

        for doc, meta in zip(results["documents"], results["metadatas"]):
            # キャラクター情報の抽出 (簡易的な正規表現パース)
            # 例: 「ガトー：戦死したはずだが生存（IF）」
            
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
                        if name not in states["characters"]:
                            states["characters"][name] = {"status": "alive", "source": meta.get("file")}

                        # 状態判定
                        is_dead = any(k in desc for k in death_keywords)
                        is_alive = any(k in desc for k in alive_keywords)
                        is_if = any(k in desc for k in if_keywords)

                        if is_if:
                            # IF設定がある場合は最優先
                            if is_alive: states["characters"][name]["status"] = "alive"
                            elif is_dead: states["characters"][name]["status"] = "dead"
                            states["characters"][name]["is_if"] = True
                        else:
                            # 通常設定
                            if is_dead: states["characters"][name]["status"] = "dead"
                            elif is_alive: states["characters"][name]["status"] = "alive"

        return states

if __name__ == "__main__":
    extractor = StoryStateExtractor()
    states = extractor.extract_all_states()
    print(json.dumps(states, ensure_ascii=False, indent=2))
