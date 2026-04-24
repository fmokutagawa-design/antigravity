import re
import json
import os

class Proofreader:
    """
    データ駆動型の高度な日本語校正エンジン
    LanguageTool (700+ルール), textlint, Tomarigi の知見を統合
    """
    
    def __init__(self, rules_path="/Volumes/Black6T/Nexus_Dev/nexus_proof_rules.json"):
        self.rules = []
        self.compiled_rules = []
        
        # 1. 外部辞書の読み込み (LanguageTool 700+項目)
        if os.path.exists(rules_path):
            try:
                with open(rules_path, "r", encoding="utf-8") as f:
                    self.rules = json.load(f)
                
                # 正規表現を高速化のためにプリコンパイル
                for rule in self.rules:
                    try:
                        self.compiled_rules.append({
                            "pattern": re.compile(rule["pattern"]),
                            "suggestion": rule["suggestion"],
                            "message": rule["message"],
                            "id": rule["id"]
                        })
                    except Exception:
                        continue # 不正な正規表現はスキップ
            except Exception as e:
                print(f"Error loading rules: {e}")

        # 2. 小説特化型の追加ルール (textlint / Tomarigi セオリー)
        self.novel_specific_rules = [
            (re.compile(r'というふうに'), 'と', '冗長な表現です'),
            (re.compile(r'することができる'), 'できる', '冗長な表現です'),
            (re.compile(r'([^\s]+)を行う'), r'\1する', '「〜する」で簡潔に表現できます'),
        ]

    def check_stylistic_consistency(self, sentences):
        """敬体(ですます)と常体(だである)の混在をチェック"""
        desu_masu = 0
        da_dearu = 0
        for s in sentences:
            s = s.strip()
            if not s: continue
            if re.search(r'(です|ます|でした|ました|ませ|ましょう)[。？！]?$', s):
                desu_masu += 1
            elif re.search(r'(だ|である|した|だった|のだ|る|ない)[。？！]?$', s):
                da_dearu += 1
        
        if desu_masu > 0 and da_dearu > 0:
            dominant = "敬体" if desu_masu > da_dearu else "常体"
            minority = da_dearu if desu_masu > da_dearu else desu_masu
            if minority > 0:
                return {
                    "original": "テキスト全体",
                    "suggested": f"{dominant}に統一",
                    "reason": f"文体が混在しています（敬体:{desu_masu}、常体:{da_dearu}）。意図的でない場合は統一を推奨します。"
                }
        return None

    def check_successive_words(self, text):
        """「私はは」のような連続した同じ単語を検知"""
        # 助詞や短い単語の連続を検知
        pattern = re.compile(r'([ぁ-んァ-ヶー]{1,2})\1')
        matches = pattern.finditer(text)
        results = []
        for m in matches:
            # 「たた」「ここ」などは日常語なので除外するフィルタが必要
            word = m.group(1)
            if word in ['た', 'こ', 'て', 'に', 'は', 'を', 'が', 'の']:
                results.append({
                    "original": m.group(0),
                    "suggested": word,
                    "reason": f"助詞「{word}」が連続しています。タイポの可能性があります。"
                })
        return results

    def audit_narrative(self, text, materials_context=None):
        """
        物語の整合性を監査する (Layer 2)
        materials_context: 設定資料から抽出された状態データ (dict)
        """
        audit_results = []
        if not materials_context:
            return audit_results

        # 1. キャラクターの生存チェック
        # materials_context['characters'] = {'ガトー': {'status': 'dead', 'source': '史実'}, ...}
        for char_name, info in materials_context.get('characters', {}).items():
            if info.get('status') == 'dead':
                # 死亡しているはずのキャラが登場していないかスキャン
                # ただし「回想」「墓」「死んだ」などの文脈は除外したい（簡易版）
                pattern = re.compile(rf'{char_name}(?!.*(回想|死|遺影|墓|供養))')
                for m in pattern.finditer(text):
                    audit_results.append({
                        "original": m.group(0),
                        "suggested": "登場の整合性確認",
                        "reason": f"設定資料では【{char_name}】は死亡していますが、このシーンに登場しています。回想等の意図的な描写ですか？（ソース: {info.get('source', '不明')}）"
                    })

        # 2. IF設定の優先適用
        # 設定資料に「ガトー：生存（IF）」という記述があれば、上記の死者リストから除外される設計にする
        
        return audit_results

    def proofread(self, text, mode='all', materials_context=None):
        """
        校正監査を実行
        mode: 'proof' (校正のみ), 'audit' (監査のみ), 'all' (両方)
        """
        corrections = []
        sentences = re.split(r'(?<=[。？！])\s*', text)
        
        # --- Layer 1: 校正 (瞬時) ---
        if mode in ['proof', 'all']:
            # 漢字含有率
            ratio = self.calculate_kanji_ratio(text)
            if ratio > 40:
                corrections.append({"original": "全体", "suggested": "ひらがな増", "reason": f"漢字率 {ratio:.1f}%: 小説としては堅苦しすぎます。"})
            elif ratio < 15:
                corrections.append({"original": "全体", "suggested": "漢字増", "reason": f"漢字率 {ratio:.1f}%: 小説としては幼すぎます。"})

            # 文体チェック
            style_issue = self.check_stylistic_consistency(sentences)
            if style_issue: corrections.append(style_issue)

            # タイポ・連続単語
            corrections.extend(self.check_successive_words(text))

            # 個別文診断
            for s in sentences:
                if len(s) > 100:
                    corrections.append({"original": s[:15]+"...", "suggested": "分割", "reason": "一文が長すぎます。"})
                
                kosoado = len(re.findall(r'これ|それ|あれ|この|その|あの', s))
                if kosoado >= 3:
                    corrections.append({"original": s[:20]+"...", "suggested": "名詞化", "reason": "指示詞が多用されています。"})

            # 文末重複
            for i in range(len(sentences) - 2):
                s1_end = re.sub(r'[。？！]', '', sentences[i].strip())[-2:]
                s2_end = re.sub(r'[。？！]', '', sentences[i+1].strip())[-2:]
                s3_end = re.sub(r'[。？！]', '', sentences[i+2].strip())[-2:]
                if len(s1_end) >= 2 and s1_end == s2_end == s3_end:
                    corrections.append({"original": f"「{s1_end}」の連続", "suggested": "変更", "reason": "文末表現が3回連続しています。"})

            # 外部辞書スキャン
            for rule in self.compiled_rules:
                for m in rule["pattern"].finditer(text):
                    corrections.append({
                        "original": m.group(0),
                        "suggested": rule["suggestion"],
                        "reason": rule["message"]
                    })

        # --- Layer 2: 監査 (物語整合性) ---
        if mode in ['audit', 'all']:
            audit_results = self.audit_narrative(text, materials_context)
            corrections.extend(audit_results)

        # カッコの整合性 (最後)
        for ob, cb in {'「': '」', '（': '）', '『': '』'}.items():
            if text.count(ob) != text.count(cb):
                corrections.append({"original": f"{ob}{cb}", "suggested": "修正", "reason": "カッコの対応が取れていません。"})

        return corrections

    def to_xml(self, corrections):
        xml = ""
        for c in corrections:
            xml += f"<correction>\n  <original>{c['original']}</original>\n"
            xml += f"  <suggested>{c['suggested']}</suggested>\n"
            xml += f"  <reason>{c['reason']}</reason>\n</correction>\n"
        return xml
