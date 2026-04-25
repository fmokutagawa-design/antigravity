import re
import json
import os

class Proofreader:
    """
    データ駆動型の高度な日本語校正エンジン
    LanguageTool (700+ルール), textlint, Tomarigi の知見を統合
    """
    
    def __init__(self, rules_path=None, whitelist_path=None):
        if rules_path is None:
            from config_loader import get_rules_path
            rules_path = get_rules_path()
        self.rules = []
        self.compiled_rules = []
        
        # ホワイトリスト読み込み
        self.whitelist = set()
        if whitelist_path is None:
            whitelist_path = os.path.join(os.path.dirname(__file__), "nexus_whitelist.json")
        if os.path.exists(whitelist_path):
            try:
                with open(whitelist_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.whitelist = set(data.get("whitelist", []))
            except Exception as e:
                print(f"Warning: failed to load whitelist: {e}")

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

    def _get_aliases(self, char_name):
        """エイリアスリストを取得"""
        aliases_path = os.path.join(os.path.dirname(__file__), "nexus_aliases.json")
        if os.path.exists(aliases_path):
            try:
                with open(aliases_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return data.get("aliases", {}).get(char_name, [])
            except:
                pass
        return []

    def audit_narrative(self, text, materials_context=None, chapter_number=None):
        """
        物語の整合性を監査する (Layer 2)
        """
        audit_results = []
        if not materials_context:
            return audit_results

        # 1. キャラクターの生存チェック
        for char_name, info_list in materials_context.get('characters', {}).items():
            # materials_context['characters'][char_name] はイベントのリスト
            
            # 現在の章の状態を取得
            if chapter_number is not None:
                # リストから最適な状態を探す（extractorのロジックと同様のものをここで再現するか、contextに単一状態が入っていることを期待するか）
                # extractor.get_state_at_chapter が返す形式を想定
                # もし info_list が単一の dict だった場合のフォールバックも考慮
                if isinstance(info_list, list):
                    state = {"status": "alive", "chapter": 0}
                    for event in info_list:
                        eff = event.get("chapter", event.get("effective_from", 0))
                        if eff <= chapter_number:
                            state = event
                        else:
                            break
                else:
                    state = info_list
            else:
                # 章指定がない場合は最新（リストの最後）または単一状態
                state = info_list[-1] if isinstance(info_list, list) else info_list

            if state.get('status') == 'dead':
                # 正式名 + 全エイリアスで検索
                search_names = [char_name] + self._get_aliases(char_name)
                for name in search_names:
                    pattern = re.compile(rf'{re.escape(name)}(?!.*(回想|死|遺影|墓|供養))')
                    for m in pattern.finditer(text):
                        reason = f"設定資料では【{char_name}】は死亡していますが、このシーンに「{name}」として登場しています。"
                        if chapter_number is not None:
                            reason = f"第{chapter_number}章の時点では【{char_name}】は死亡しているはずです。（第{state.get('chapter', '?')}章で死亡）"
                        
                        audit_results.append({
                            "original": m.group(0),
                            "suggested": "時系列の確認",
                            "reason": reason + f"（ソース: {state.get('source', '不明')}）"
                        })

        return audit_results

    def split_dialogue_and_narration(self, text):
        """
        テキストを会話文と地の文に分離する。
        """
        dialogue_ranges = []
        result = list(text)
        i = 0
        while i < len(text):
            if text[i] in '「『':
                close_char = '」' if text[i] == '「' else '』'
                depth = 1
                j = i + 1
                while j < len(text) and depth > 0:
                    if text[j] == text[i]:
                        depth += 1
                    elif text[j] == close_char:
                        depth -= 1
                    j += 1
                dialogue_ranges.append((i, j))
                for k in range(i, min(j, len(text))):
                    result[k] = ' '
                i = j
            else:
                i += 1
        
        narration_text = ''.join(result)
        return narration_text, dialogue_ranges

    def _is_whitelisted(self, matched_text):
        """マッチしたテキストにホワイトリストの語が含まれていたら True"""
        for word in self.whitelist:
            if word in matched_text:
                return True
        return False

    def calculate_kanji_ratio(self, text):
        """漢字の含有率を計算"""
        if not text: return 0
        kanji_count = len(re.findall(r'[一-龠々]', text))
        return (kanji_count / len(text)) * 100

    def proofread(self, text, mode='all', materials_context=None, chapter_number=None):
        """
        校正監査を実行
        """
        corrections = []
        
        # 会話文と地の文を分離
        narration_text, dialogue_ranges = self.split_dialogue_and_narration(text)
        
        def is_in_dialogue(pos):
            for start, end in dialogue_ranges:
                if start <= pos < end:
                    return True
            return False
        
        # --- Layer 1: 校正 (瞬時) ---
        if mode in ['proof', 'all']:
            # 文体チェック（地の文のみ）
            narration_sentences = re.split(r'(?<=[。？！])\s*', narration_text)
            narration_sentences = [s for s in narration_sentences if s.strip()]
            style_issue = self.check_stylistic_consistency(narration_sentences)
            if style_issue:
                corrections.append(style_issue)
            
            # 小説特化ルール（地の文のみ）
            for pattern, suggestion, message in self.novel_specific_rules:
                for m in pattern.finditer(narration_text):
                    corrections.append({
                        "original": m.group(0),
                        "suggested": suggestion,
                        "reason": message + "（地の文）"
                    })

            # 一文長すぎ、指示詞多用（地の文のみ）
            for s in narration_sentences:
                if len(s) > 100:
                    corrections.append({"original": s[:15]+"...", "suggested": "分割", "reason": "一文が長すぎます（地の文）。"})
                
                kosoado = len(re.findall(r'これ|それ|あれ|この|その|あの', s))
                if kosoado >= 3:
                    corrections.append({"original": s[:20]+"...", "suggested": "名詞化", "reason": "指示詞が多用されています（地の文）。"})

            # 文末重複（地の文のみ）
            for i in range(len(narration_sentences) - 2):
                s1_end = re.sub(r'[。？！]', '', narration_sentences[i].strip())[-2:]
                s2_end = re.sub(r'[。？！]', '', narration_sentences[i+1].strip())[-2:]
                s3_end = re.sub(r'[。？！]', '', narration_sentences[i+2].strip())[-2:]
                if len(s1_end) >= 2 and s1_end == s2_end == s3_end:
                    corrections.append({"original": f"「{s1_end}」の連続", "suggested": "変更", "reason": "地の文で文末表現が3回連続しています。"})

            # 外部辞書スキャン（地の文のみ）
            for rule in self.compiled_rules:
                for m in rule["pattern"].finditer(text):
                    if not is_in_dialogue(m.start()) and not self._is_whitelisted(m.group(0)):
                        corrections.append({
                            "original": m.group(0),
                            "suggested": rule["suggestion"],
                            "reason": rule["message"]
                        })

            # 2. 全文に適用するルール
            ratio = self.calculate_kanji_ratio(text)
            if ratio > 40:
                corrections.append({"original": "全体", "suggested": "ひらがな増", "reason": f"漢字率 {ratio:.1f}%: 小説としては堅苦しすぎます。"})
            elif ratio < 15:
                corrections.append({"original": "全体", "suggested": "漢字増", "reason": f"漢字率 {ratio:.1f}%: 小説としては幼すぎます。"})

            corrections.extend(self.check_successive_words(text))

            for ob, cb in {'「': '」', '（': '）', '『': '』'}.items():
                if text.count(ob) != text.count(cb):
                    corrections.append({"original": f"{ob}{cb}", "suggested": "修正", "reason": "カッコの対応が取れていません。"})

        # --- Layer 2: 監査 (物語整合性) ---
        if mode in ['audit', 'all']:
            audit_results = self.audit_narrative(text, materials_context, chapter_number)
            corrections.extend(audit_results)

        return corrections

    def to_xml(self, corrections):
        xml = ""
        for c in corrections:
            xml += f"<correction>\n  <original>{c['original']}</original>\n"
            xml += f"  <suggested>{c['suggested']}</suggested>\n"
            xml += f"  <reason>{c['reason']}</reason>\n</correction>\n"
        return xml
