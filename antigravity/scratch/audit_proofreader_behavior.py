import sys
import os
import json

# パス設定
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(BASE_DIR, "nexus_backend"))

try:
    from proofreader import Proofreader
except ImportError:
    print("Error: proofreader.py not found.")
    sys.exit(1)

def run_regression_test():
    pr = Proofreader()
    
    # 検証用サンプルテキスト
    test_cases = [
        "私は彼に言うふうに、することができると言った。", # 冗長表現
        "「私はは大丈夫」と彼女はは言った。", # 連続助詞（会話文と地の文の混在）
        "畏域での戦闘は激化していた。", # ホワイトリスト対象
        "（カッコの対応がおかしい" # カッコ不整合
    ]
    
    print("--- Current Engine Output Audit ---")
    results = {}
    for i, text in enumerate(test_cases):
        corrections = pr.proofread(text)
        results[f"case_{i}"] = corrections
        print(f"\nTest Case {i}: {text}")
        for c in corrections:
            print(f"  - [{c['suggested']}] {c['reason']}")
            
    # 結果を一時ファイルに保存
    audit_file = os.path.join(os.path.dirname(__file__), "engine_audit_snapshot.json")
    with open(audit_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Audit snapshot saved to {audit_file}")
    print("This snapshot will be used to ensure NO regression during refactoring.")

if __name__ == "__main__":
    run_regression_test()
