# タスクリスト: Editor.jsx Uncontrolled 化 v3 (Phase 2)

- [ ] **1. 変数・State の整理**
    - [ ] `localText` useMemo の削除
    - [ ] `localTextRef` の同期 useEffect の追加
    - [ ] `debouncedValue` state とその useEffect の削除
    - [ ] `debouncedText` useMemo の追加
- [ ] **2. 参照箇所の置換 (localText -> localTextRef.current)**
    - [ ] `handleDrop`
    - [ ] `handleCursor`
    - [ ] `scrollToCaretPosition`
    - [ ] `displayValue`
    - [ ] その他（`handleCut`, `debouncedLineCount` 等）
- [ ] **3. 参照箇所の置換 (debouncedValue -> debouncedText)**
    - [ ] `highlights`
    - [ ] `correctionHighlights`
- [ ] **4. 動作確認と完了報告**
    - [ ] `npm run build` によるビルド確認
    - [ ] 手動検証（中規模・大規模ファイルでの動作確認）
