# タスクリスト：信頼性向上スプリント（バグ修正 A-L & ジャーナル切り替え）

## 1. 準備と基本構造の強化
- [x] `App.jsx` に `textRef`, `debouncedTextRef`, `latestMetadataRef` を追加
- [x] `useAutoSave.js` に最新値を参照するための Ref ポインタを渡すように修正

## 2. 自動保存の安全性確保（優先1: バグF, G, H）
- [x] `useAutoSave.js` の `doSave` を Ref 参照に修正
- [x] スナップショット作成ロジックを Ref 参照に修正

## 3. プロジェクト操作の修正（優先2, 3: バグC, A, D）
- [x] `useProjectActions.js`: `serializeNote` の引数順序を修正 (Bug C)
- [x] `useProjectActions.js`: `autoOrganizeFile` の競合対策と `latestMetadataRef` の更新 (Bug A+D)
- [x] `App.jsx`: `handleTextChange` で最新メタデータ Ref を使用するように修正

## 4. ファイル操作と表示の同期（優先4, 5, 6: バグK, L, E, B）
- [x] `useFileOperations.js`: `isSameEntry` によるハンドル比較の実装 (Bug K)
- [x] `useFileOperations.js`: `handleDuplicateFile` のブラウザ版修正 (Bug L)
- [x] `App.jsx`: `beforeunload` リスナーを Ref 参照にして再登録を抑制 (Bug B)
- [x] 置換操作後の画面同期修正 (Bug E)

## 5. ジャーナリング切り替え機能の実装
- [x] `App.jsx`: 設定パネルへの `enableJournaling` トグルの追加
- [x] `electron/main.cjs`: IPC 経由でオプションを渡すよう修正
- [x] `electron/atomicWrite.cjs`: ジャーナル記録を条件付きにする

## 6. 検証
- [x] 各コードの論理整合性チェック
- [x] UI Toggle の配置と prop 伝搬の確認
