#!/bin/bash
# Mac 用のワンクリック自動同期スクリプト
# フォルダの場所を取得
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Nexus (Mac) 自動同期を開始します ==="
echo ""

# 1. あなたの変更をまとめる（Add & Commit）
echo "[1/3] あなたの変更を保存中..."
git add .
git commit -m "Auto Sync from Mac: $(date +'%Y-%m-%d %H:%M:%S')"

# 2. サーバーから最新の変更をダウンロード（Pull）
echo "[2/3] 最新版を統合中..."
git pull --rebase origin main

# 3. サーバーへアップロード（Push）
echo "[3/3] クラウドへアップロード中..."
git push origin main

echo ""
echo "=== 同期が完了しました！ ==="
echo "このウィンドウは数秒後に自動的に閉じます..."
sleep 3
exit 0
