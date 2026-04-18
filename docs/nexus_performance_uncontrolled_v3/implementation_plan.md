# Editor.jsx Uncontrolled 化 v3 実装計画 (Phase 0)

この計画では、42万字超の大規模ドキュメントにおける打鍵ラグを解消するため、`Editor.jsx` の `textarea` を非制御コンポーネント（Uncontrolled Component）へ移行する準備作業（Phase 0）を行います。

## ユーザーレビューが必要な項目

- **ベースコミットの疑義**: 指示書には `perf/compose-batch-fix` の最新が `19c66bf` とありますが、現在の環境では `b4d848d` が最新です。そのまま `b4d848d` から分岐して作業を進めます。
- **AUTO_SAVE_DISABLED フラグ**: `src/hooks/useAutoSave.js` 内に該当のフラグが見当たりません。既に削除されているか、別の名前になっている可能性があります。このステップはスキップするか、新規に追加が必要か確認します。

## 予定されている変更

### [Component Name] 設定および環境構築

#### [NEW] [feature/uncontrolled-editor-v3](branch)
`perf/compose-batch-fix` から分岐し、既存のパフォーマンスログ（Performance Probe）をコミットした状態で作業を開始します。

#### [MODIFY] [useAutoSave.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useAutoSave.js)
`AUTO_SAVE_DISABLED` フラグを `false` に設定します（ファイル内に存在する場合）。

#### [NEW] [test_fixtures/](directory)
テスト用の日本語ダミーテキストを作成します。
- `tiny.txt` (1,000字)
- `medium.txt` (50,000字)
- `large.txt` (150,000字)
- `huge.txt` (420,000字以上)
各ファイル末尾に指定されたメターデータを付与します。

## オープンな質問

> [!IMPORTANT]
> `src/hooks/useAutoSave.js` に `AUTO_SAVE_DISABLED` という定数が見当たりません。
> もしこれが別の定数名（例: `perfEnabled` 内部など）や、過去のコミットで一時的に導入されたものであれば詳細を教えてください。

## 検証計画

### 自動テスト
- `npm run build` が正常に終了することを確認します。

### 手動検証
- `git log --oneline -3` を出力し、ブランチ作成と初期設定が正しく行われていることを確認します。
- `/test_fixtures/` 内のファイルが正しく作成されているか確認します。
