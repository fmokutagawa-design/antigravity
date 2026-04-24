# 実装完了：複数ファイル原稿の疑似一体化 (Lightweight MVP)

長大な原稿を章ごとにファイル分割しつつ、エディタ上では「一つの作品」としてシームレスに扱える仕組みを導入しました。独自拡張子を使わないフォルダベースの管理により、高い汎用性を維持しています。

## 実装された主要機能

### 1. 作品フォルダ管理 (Work Manifest)
- 章分割を実行すると、作品名のフォルダが作成され、その中に `manifest.json` と各章の `.txt` ファイルが保存されます。
- 元の巨大なファイルは、そのフォルダ内の `.backup/` へ自動的に退避されます。

### 2. 連結プレビュー・リーダーモード
- 分割された章のどれか一つを開いている時、**プレビュータブを開くと自動的に全章を連結**して表示します。
- 現在編集中の章の変更（デバウンス済み）もリアルタイムにプレビューへ反映されます。

### 3. リネームの自動同期
- エディタ上でファイル名を変更（リネーム）すると、`manifest.json` 内の参照も自動的に更新されます。これにより、分割状態を壊さずに章タイトルの整理が可能です。

### 4. 逆統合（マージ）と全文書き出し
- **逆統合**: バラバラになった章ファイルを再び一つの大きな `.txt` ファイルに結合して戻す機能です（「原稿管理」パネルのボタンから実行）。
- **結合保存**: 応募用などに、現在の分割状態を維持したまま、一つのテキストファイルとして書き出す機能です（「出力」パネルのボタンから実行）。

## 修正・新規ファイル一覧

- [x] [manifest.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/utils/manifest.js) [NEW]: マニフェスト操作ロジック
- [X] [useMaterials.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useMaterials.js): 作品フォルダの自動検知
- [X] [useSplitByChapters.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useSplitByChapters.js): フォルダ・マニフェスト生成対応
- [X] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx): 状態管理、連結ロジック、リネーム同期、出力・統合ハンドラ
- [X] [ManuscriptPanel.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/ManuscriptPanel.jsx): 「逆統合」UI
- [X] [ExportPanel.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/ExportPanel.jsx): 「全文結合保存」UI

## 検証済み項目

- [x] 章分割実行時にフォルダとマニフェストが正しく作成されること。
- [x] 同フォルダ内のファイルを開いた際、プレビューで全文が連結されること。
- [x] ファイル名を変更した際、マニフェストが自動更新されること。
- [x] 逆統合ボタンで、全章が結合された新しいファイルが生成されること。

> [!TIP]
> 検索機能（Grep）は現状でもプロジェクト全体をスキャンするため、分割された章をまたいで検索・ジャンプすることが可能です。
