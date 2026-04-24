import re
import os
import json

class KnowledgeProcessor:
    """
    小説の執筆資料から構造化された文脈（コンテキスト）を抽出するクラス
    """
    
    # カテゴリ別パターン
    CHAR_PATTERN = re.compile(r'^([^\n｜]+)（[^）]+）｜|([^\n｜]+)｜')
    LOC_PATTERN = re.compile(r'#+\s*([◤【■◆]([^◢】]+)[◢】]|場所|地点|施設)：([^\n]+)')
    ORG_PATTERN = re.compile(r'(組織|勢力|陣営|会社)：([^\n]+)')
    ITEM_PATTERN = re.compile(r'(アイテム|武器|機体|艦船)：([^\n]+)')
    
    DEF_PATTERN = re.compile(r'^([^：\n\s]{2,15})[：＝]')
    HEADER_PATTERN = re.compile(r'#+\s*([◤【■◆]([^◢】]+)[◢】]|([^ \n]+))')

    def process_file(self, file_path, content):
        """
        ファイルを解析して構造化されたメタデータを抽出する
        """
        file_name = os.path.basename(file_path)
        project = self._determine_project(file_path)
        doc_type = self._determine_doc_type(file_path, content)
        
        # エンティティ抽出の強化
        entities = self._extract_entities(file_name, content)
        
        # 関係性抽出
        relationships = self._extract_relationships(content)
        
        # タグの生成 (エンティティをベースにカテゴリを付与)
        tags = list(entities)
        if doc_type == "SETTING": tags.append("設定")
        if doc_type == "PLOT": tags.append("プロット")
        if doc_type == "MANUSCRIPT": tags.append("原稿")
        
        importance = self._calculate_importance(file_path, content, doc_type)
        
        return {
            "project": project,
            "doc_type": doc_type,
            "entities": ",".join(entities),
            "tags": ",".join(tags),
            "relationships": json.dumps(relationships, ensure_ascii=False),
            "importance": importance,
            "file": file_name,
            "path": file_path
        }

    def _determine_project(self, file_path):
        path_parts = file_path.split(os.sep)
        try:
            if "原稿" in path_parts:
                idx = path_parts.index("原稿")
                if len(path_parts) > idx + 2: return path_parts[idx + 2]
                elif len(path_parts) > idx + 1: return path_parts[idx + 1]
        except: pass
        return "Unknown"

    def _determine_doc_type(self, file_path, content):
        path_lower = file_path.lower()
        if any(x in path_lower for x in ["原稿", "本編", "novel", "manuscript"]): return "MANUSCRIPT"
        if any(x in path_lower for x in ["プロット", "plot", "構成", "章", "展開"]): return "PLOT"
        if any(x in path_lower for x in ["設定", "用語", "キャラ", "世界観", "setting"]): return "SETTING"
        return "OTHER"

    def _extract_entities(self, file_name, content):
        entities = set()
        clean_name = re.sub(r'[◤◢#\.txt|\.md|（[^）]+）]', '', file_name).strip()
        if len(clean_name) >= 2: entities.add(clean_name)
        
        lines = content.split('\n')
        for line in lines[:100]:
            # キャラクター
            char_match = self.CHAR_PATTERN.match(line)
            if char_match: entities.add((char_match.group(1) or char_match.group(2)).strip())
            
            # 場所・組織・アイテム
            for pattern in [self.LOC_PATTERN, self.ORG_PATTERN, self.ITEM_PATTERN]:
                match = pattern.search(line)
                if match: entities.add(match.group(2).strip() if pattern == self.LOC_PATTERN else match.group(2).strip())

            head_match = self.HEADER_PATTERN.match(line)
            if head_match: entities.add((head_match.group(2) or head_match.group(3)).strip())
            
        return {e for e in entities if len(e) >= 2 and len(e) <= 15}

    def _extract_relationships(self, content):
        relationships = []
        pattern = re.compile(r"^([^：:\n]{2,20})[：:]([^\n]{1,100})", re.MULTILINE)
        for match in pattern.finditer(content):
            relationships.append({
                "subject": match.group(1).strip(),
                "predicate": match.group(2).strip(),
                "type": "definition"
            })
        return relationships[:20]

    def _calculate_importance(self, file_path, content, doc_type):
        score = 50
        file_name = os.path.basename(file_path)
        if any(x in file_name for x in ["決定稿", "最新", "統合"]): score += 30
        if doc_type == "PLOT": score += 20
        if doc_type == "SETTING": score += 10
        return min(score, 100)

    @staticmethod
    def extract_keywords(query):
        # 漢字・カタカナ・英数字を抽出
        jp_terms = re.findall(r'[\u4e00-\u9faf]{2,}|[\u30a1-\u30f6]{2,}', query)
        en_terms = re.findall(r'[a-zA-Z0-9-]{3,}', query)
        return list(set(jp_terms + en_terms))
