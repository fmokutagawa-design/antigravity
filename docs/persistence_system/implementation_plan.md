# 環境設定・キャッシュ永続化システムの実装計画

ユーザーの執筆環境（色、フォント、カーソル位置、開いているファイル）を完全に記憶・復元し、かつ「フォント和名」を高速に表示するための永続化基盤を構築します。

## ユーザーレビューが必要な項目

> [!IMPORTANT]
> フォントの和名取得は初回のみ数分かかる可能性があります。アプリの操作は妨げませんが、スキャン完了までは英字名のままとなります。一度スキャンが終われば、次回以降は起動した瞬間に和名で表示されます。

## 変更内容

### 基盤: 永続化ストレージ

- **[MODIFY] [main.cjs](file:///Volumes/Black6T/Nexus_Dev/antigravity/electron/main.cjs)**
  - `electron.app.getPath('userData')` 内に `user_settings.json` を管理するIPCハンドラを追加。
  - アプリの設定情報（settings）、最後に開いたファイルのパス、カーソル位置などを読み書きできるようにします。

### フォント: 和名キャッシュ

- **[MODIFY] [main.cjs](file:///Volumes/Black6T/Nexus_Dev/antigravity/electron/main.cjs)**
  - `font_cache.json` を作成。
  - 起動時にキャッシュがあればそれを即座に返し、裏側で最新のフォント情報をスキャンしてキャッシュを更新する仕組みを導入します。

### UI: 復元ロジック

- **[MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)**
  - 起動時に `user_settings.json` から情報を取得し、各State（settings, activeFileHandle等）に流し込みます。
  - テキスト変更や設定変更のたびに、適度な頻度で自動保存を実行します。

- **[MODIFY] [Toolbar.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Toolbar.jsx)**
  - キャッシュされたフォントリストを優先的に表示し、バックグラウンドでのスキャン完了を待ってリストを更新します。

## 検証プラン

### 自動テスト
- コンソールログにて保存・読み込みの成否を確認します。

### 手動検証
1. アプリを起動し、文字色やフォントを「マティス」などに変更する。
2. 何かテキストを書き、適当な位置にカーソルを置く。
3. アプリを完全に終了し、再起動する。
4. **結果確認**: 前回の色、フォント、カーソル位置、開いていたファイルが再現されていること。
5. フォントリストを開き、和名が表示されていることを確認。
