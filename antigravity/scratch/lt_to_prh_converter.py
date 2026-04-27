import xml.etree.ElementTree as ET
import yaml
import re

def j_to_h(text):
    if not text: return ""
    return "".join([chr(ord(c) - 96) if 'ァ' <= c <= 'ヶ' else c for c in text])

def convert_lt_to_prh(xml_path, output_path):
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        prh_rules = []
        
        for category in root.findall('category'):
            for rule in category.findall('rule'):
                pattern_elem = rule.find('pattern')
                if pattern_elem is None: continue
                
                tokens = pattern_elem.findall('token')
                message = rule.find('message')
                suggestion = message.find('suggestion') if message is not None else None
                
                # Simple case: all tokens are plain text (no postag, no skip, etc.)
                is_simple = True
                pattern_parts = []
                for t in tokens:
                    if t.attrib or t.text is None:
                        is_simple = False
                        break
                    pattern_parts.append(t.text)
                
                if is_simple and suggestion is not None and suggestion.text:
                    pattern_str = "".join(pattern_parts).strip()
                    expected_str = suggestion.text.strip()
                    
                    if pattern_str and expected_str and pattern_str != expected_str:
                        prh_rules.append({
                            'expected': expected_str,
                            'pattern': pattern_str
                        })

        # Load existing prh rules if any
        existing_rules = []
        if os.path.exists(output_path):
            with open(output_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                if data and 'rules' in data:
                    existing_rules = data['rules']

        # Merge and deduplicate
        all_rules = existing_rules + prh_rules
        unique_rules = []
        seen = set()
        for r in all_rules:
            k = (r.get('expected'), r.get('pattern'))
            if k not in seen:
                unique_rules.append(r)
                seen.add(k)

        # Sort by pattern length
        unique_rules.sort(key=lambda x: len(str(x.get('pattern', ''))), reverse=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            yaml.dump({'rules': unique_rules}, f, allow_unicode=True, sort_keys=False)
            
        print(f"Merged {len(prh_rules)} simple LT rules. Total: {len(unique_rules)}")
        
    except Exception as e:
        print(f"Error during LT conversion: {e}")

import os
if __name__ == "__main__":
    convert_lt_to_prh('/Volumes/Black6T/Nexus_Dev/antigravity/textlint/rules/lt_grammar_ja.xml', 
                      '/Volumes/Black6T/Nexus_Dev/antigravity/textlint/prh.yml')
