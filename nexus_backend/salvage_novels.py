import os
import chardet

TARGET_DIRS = [
    "/Users/mokutagawa/Library/CloudStorage/OneDrive-個人用/ドキュメント/原稿",
    "/Users/mokutagawa/Library/CloudStorage/OneDrive-個人用/NEXUS　プロジェクトフォルダ"
]

def salvage_file(file_path):
    # 1. まずバイナリで読み込んで文字コードを「判定」する
    with open(file_path, 'rb') as f:
        raw_data = f.read()
    
    if not raw_data: return
    
    # 統計的に解析
    result = chardet.detect(raw_data)
    encoding = result['encoding']
    
    # 2. すでにUTF-8なら何もしない（安全策）
    if encoding and encoding.lower() == 'utf-8':
        return f"SKIP (Already UTF-8): {encoding}"

    # 3. 判定されたコード（または候補）で読み直し、UTF-8で書き出す
    # UTF-8以外（Shift-JISなど）をターゲットにする
    for enc in [encoding, 'cp932', 'shift_jis', 'euc_jp']:
        if not enc: continue
        try:
            content = raw_data.decode(enc)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"FIXED ({enc} -> UTF-8)"
        except:
            continue
    
    return "FAILED (Unknown Encoding)"

if __name__ == "__main__":
    print("🛠️  文字化け救出作戦（サルベージ）を開始します...")
    for target in TARGET_DIRS:
        for root, _, files in os.walk(target):
            for file in files:
                if file.endswith(('.txt', '.md')) and not file.startswith('._'):
                    path = os.path.join(root, file)
                    result = salvage_file(path)
                    print(f"📄 {file.ljust(30)} : {result}")