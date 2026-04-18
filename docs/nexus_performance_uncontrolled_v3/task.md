# タスクリスト: Editor.jsx Uncontrolled 化 v3 (Phase 0)

- [ ] **1. ブランチ作成と初期状態の整理**
    - [ ] `perf/compose-batch-fix` から `feature/uncontrolled-editor-v3` を作成
    - [ ] 現状の計測ログ（Performance Probe）をコミット
- [ ] **2. オートセーブ設定の確認**
    - [ ] `src/hooks/useAutoSave.js` の `AUTO_SAVE_DISABLED` を確認・修正
- [ ] **3. テスト用フィクスチャの作成**
    - [ ] `/test_fixtures/` ディレクトリ作成
    - [ ] `tiny.txt` (1,000字) 作成
    - [ ] `medium.txt` (50,000字) 作成
    - [ ] `large.txt` (150,000字) 作成
    - [ ] `huge.txt` (420,000字) 作成
- [ ] **4. 動作確認と完了報告**
    - [ ] `npm run build` によるビルド確認
    - [ ] `git log --oneline -3` の出力
