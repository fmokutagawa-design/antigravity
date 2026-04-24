# 目標 (Goal)
`Editor.jsx` を Uncontrolled Component のアーキテクチャに移行し、ファイル切り替え時に発生していたデータ破壊バグ（v1での問題）を完全に解消する。また、14万字規模のドキュメントにおける入力の遅延を防ぎ、パフォーマンスを最適化する。

> [!IMPORTANT]
> **絶対に守るべきルール**
> 1. `applyText` は `onChange` を絶対に呼ばない。
> 2. `applyText` は必ず最初に pending の debounce タイマーを全て `clearTimeout` する。
> 3. `useAutoSave` は空文字列を保存しない。
> 4. `useAutoSave` は `lastSavedTextRef.current` と同じ内容を保存しない。
> 5. 全ての変更は `feature/uncontrolled-editor` ブランチで行い、テスト完了後に `main` にマージする。
> 6. テストは本番の原稿ではなく、ダミーの `.txt` ファイル（テスト用プロジェクトフォルダ）で行う。

## User Review Required
この計画書の内容が、ご提示いただいた指示書 v2 の要件を過不足なく全て満たしているかご確認ください。
（ファイル破壊の根本原因を断つためのルールについても計画に組み込んでいます）
承認をいただき次第、実際のブランチの作成と実装（Phase 1から順）を開始します。

## 提案する変更 (Proposed Changes)

---

### Phase 1: applyText の導入と insertText の追加
目的: 外部操作の統合窓口を作る。textarea は Controlled のまま。

#### [MODIFY] src/components/Editor.jsx
- `localOnChange` の定義直後に統合窓口となる `applyText` 関数を定義。
    - pending の debounce タイマーを明確に破棄(`clearTimeout(appNotifyTimerRef.current)`)するように実装する。
    - **この関数内では `onChange` を絶対に呼ばない。** 呼び出し元が明示的に呼ぶ形を取る。
- `useImperativeHandle` の `pasteFromHistory` と `insertRuby` を、直接 `localOnChange` を呼ぶ形から `applyText(newValue, pos); onChange(newValue);` 経由に変更する。
- `useImperativeHandle` に `insertText` を新規追加する。
    - 外部からのテキスト挿入（TODO、AI出力など）に対応し、これも `applyText` と `onChange` を経由する。
- コンテキストメニュー（フォント変更、フォント解除、切り取り、貼り付け）による全テキスト操作を、`applyText` 経由に変更。
- `handleDrop`、`handleCut`（縦書き用）、`onKeyDown` の ghost text accept の処理も `applyText` 経由に変更。

---

### Phase 2: localText state の ref 化
目的: `localText` state への依存を消し、Phase 3 の Uncontrolled 化への準備を整える。

#### [MODIFY] src/components/Editor.jsx
- `localText` の読み取り箇所をすべて `localTextRef.current` に書き換える。
    - 該当箇所: `displayValue` の `useMemo` (Phase 2中は残す)、`handleDrop`、`handleCursor`、`scrollToCaretPosition`、`pushHistory` に渡す第一引数等。
- `debouncedValue` および `debouncedLineCount` の更新を行っている `useEffect([localText])` を削除。
- 代わりに、更新ロジックを `localOnChange` 内部のタイマー（`highlightDebounceRef`）と文字数の大幅変更判定を用いた構成に書き換える。

---

### Phase 3: Uncontrolled への切り替え
目的: React による `value` の管理を外し、DOM直接操作によるパフォーマンス向上と、二重更新バグの根絶を図る。

#### [MODIFY] src/components/Editor.jsx
- `textarea` の `value={displayValue}` を `defaultValue={initialDisplayValue}` に変更。
    - `initialDisplayValue` は初回マウント時のみ計算するように `useMemo` (空の依存配列)で定義する。
- 不要になった `localText` state (`useState`) と `displayValue` の `useMemo` を削除。
- `handleChange` をブラウザがDOMを管理する前提で書き換え。
    - IME変換中であっても `ref` の更新のみ行い、手動での state 更新による再描画をなくす。
- `localOnChange` を書き換え。
    - `localTextRef` の更新、Appへの遅延通知（500ms debounce）、ハイライト用の遅延通知（300ms debounce または大幅変更時即時）を集約する。
- `applyText` を本番仕様（DOM直接操作）に変更。
    - `textarea.value` へ直接代入し React の描画ライフサイクルを回避。ハイライト用の即時更新やカーソル復元 (`setSelectionRange`) もここで行う。
- カーソル位置復元のために使っていた `useLayoutEffect` と `nextCursorPos` ref を削除。
- ファイル切替時等に発火する `value` 同期用の `useEffect` を書き換え。
    - 前述のルール通り、外部変更時には `applyText(value)` のみを呼び、`onChange` は呼ばない。
- `useUndoHistory` のコールバック接続を変更。
    - Undo/Redo の結果を正しく `applyText` + `onChange` に反映・通知するよう、TDZを回避した ref 経由の間接呼び出しを設ける。

## オープンな質問 (Open Questions)
- 作業開始前に新規ブランチ `feature/uncontrolled-editor` を作成（あるいは切り替え）して作業を進めます。現在のブランチからの分岐で問題ないでしょうか？
- ダミーファイルを用いたテストが必要なため、テスト時にはワークスペース内に安全なテスト用ディレクトリおよびファイルを作成し、そこで手動/自動の確認を行ってから評価をいただく想定でよろしいでしょうか？

## 検証計画 (Verification Plan)
全て Phase 1, Phase 2, Phase 3 ごとにビルドを行い、以下のテストにて合格してから次のPhaseへ進みます。
【検証環境】本番原稿ではなく、ダミーのテキストファイルを用いたテスト環境

### 1. 入力系の検証
- 横書き/縦書きでの日本語入力（IME変換・確定）、英数字記号の直接入力、Backspace/Delete操作。
- 文中での編集時にカーソルがおかしく飛ばないか。
- 10万文字以上のファイルでの入力遅延の有無。

### 2. ファイル操作系（最重要）
- ファイルAの後にファイルBをクリックし、内容が正しく表示されるか。
- 切替後、以前のファイル（A）の内容でファイルBが上書きされないか。
- これらを5回以上繰り返しテスト。
- 空ファイルを開いた際にエラーが出ないか、他のファイルが0バイトに巻き込まれないか。

### 3. Undo/Redo 及び外部操作系
- Cmd+Z, Cmd+Shift+Z によるUndo/Redoが機能し、なおかつファイルが破壊されないか。
- ルビ挿入、AI出力挿入 (`insertText`) が正しく機能するか。
- コピー/切り取り/貼り付け、画像ドラッグ＆ドロップ動作の確認。

### 4. 保存系
- 自動保存が動作し、ファイルへ正しく書き込まれているか。
- 空文字列が保存されるケースや、別ファイルの内容が書き込まれるケースがないことの確認。
