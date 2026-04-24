@echo off
chcp 65001 >nul
:: Windows 用のワンクリック自動同期スクリプト

echo === Nexus (Windows) 自動同期を開始します ===
echo.

:: 1. あなたの変更をまとめる（Add & Commit）
echo [1/3] あなたの変更を保存中...
git add .
:: 日付と時刻を取得してコミットメッセージに含める
for /f "tokens=1-3* delims=/ " %%a in ('date /t') do set DAT=%%a-%%b-%%c
for /f "tokens=1-2* delims=: " %%a in ('time /t') do set TIM=%%a:%%b
git commit -m "Auto Sync from Windows: %DAT% %TIM%"

:: 2. サーバーから最新の変更をダウンロード（Pull）
echo [2/3] 最新版を統合中...
git pull --rebase origin main

:: 3. サーバーへアップロード（Push）
echo [3/3] クラウドへアップロード中...
git push origin main

echo.
echo === 同期が完了しました！ ===
echo このウィンドウは数秒後に自動的に閉じます...
timeout /t 3 /nobreak >nul
exit
