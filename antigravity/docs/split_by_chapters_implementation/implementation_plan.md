# 実装計画：指示書 D（章ごと分割機能の実装）

## 目的

冬之助さんが所有する42万字クラスの巨大原稿ファイルを、あらかじめ実装された境界検出ロジック（`boundaryDetector`）を活用して章ファイル群に分割する機能を実装します。

## 対象ファイルと役割

### 1. 新規ファイル
- **`src/utils/splitByChapters.js`**: 分割のための純粋ロジック（DOM/fs非依存）。
- **`src/utils/splitByChapters.test.cjs`**: 上記純粋ロジック用の14件のテスト。
- **`src/components/SplitByChaptersModal.jsx`**: 章境界をプレビューし、タイトルや分割有無をチェックするモーダルUI。
- **`src/components/SplitByChaptersModal.css`**: モーダルのスタイリング。
- **`src/hooks/useSplitByChapters.js`**: UIと各種入出力（バックアップ、ファイル保存、ロールバック）を繋ぐフック。

### 2. 既存ファイルの更新
- **`src/components/ExportPanel.jsx`**: 「出力」の上に「編集ツール」セクションを追加し、「章ごとにファイル分割」ボタンを配置。
- **`src/App.jsx`**: 追加フック `useSplitByChapters` を登録し、末尾にモーダルを追加。`ExportPanel` へハンドラーを渡す。

## 分割実行フローの設計（安全性重視）

1. ユーザーが「章ごと分割」ボタンを押下
2. バックグラウンドで境界をパースし、レビューモーダルを表示
3. 「実行」押下時、以下の順序で処理を実行:
   1. 元のファイルを `.backup/` フォルダへ `*_original_<timestamp>.txt` として退避（失敗時は即座に中止）
   2. 各分割セグメントごとに `Atomic Write` を駆使して新ファイルを順次書き込み
   3. 名前衝突時は `_2` のようにサフィックスを付与
   4. 書き込み中のいずれかで失敗した場合、今回作成した新ファイルだけを削除する（ロールバック）。バックアップと元のファイルは残す。

## ユーザー手動確認・前提タスク

*   `docs/split_by_chapters_implementation/` ディレクトリ配下にタスク・進捗等を残しつつ実装を進めます。
*   ファイルシステム側への `fs.writeFile` 呼び出し時は、必ず既存の `fileSystem` インターフェース（`src/utils/fileSystem.js`）を経由してTauri/Electron/Webのラップを利用します。
