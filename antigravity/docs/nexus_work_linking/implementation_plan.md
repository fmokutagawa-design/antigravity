# .nexus 作品連結・パッケージング機能の実装計画

## 概要
NEXUS エディタにおいて、章ごとに分割されたファイルを「作品」として管理・プレビュー・エクスポートするための基盤を構築する。

## 実装内容
### 1. パッケージング機能 (Instruction E)
- 分割実行時に `.nexus` フォルダを生成し、`manifest.json` で構成を管理する。
- `src/utils/manifest.js` の拡張（読み書き機能）。

### 2. 既存ファイル救済機能 (Instruction F)
- 既存のバラバラなファイルを `.nexus` 構造にまとめ直す `ImportChaptersModal` の実装。

### 3. 連結表示機能 (Instruction G)
- `useWorkText` フックによる全章連結テキストの生成。
- `Preview` および `ReaderView` での「作品全体表示」トグルの追加。

### 4. 結合エクスポート (Instruction H)
- `manifest.json` の順序に基づいた一括テキストエクスポート機能。

### 5. 双方向ジャンプ機能 (Instruction I)
- 連結表示上の位置から、対応する章ファイルおよびエディタ内の行位置へのジャンプ機能。

## 検証計画
- `npm run dev` による UI 動作確認。
- 既存のロジックテスト（`splitByChapters`, `boundaryDetector`）の実行。
- `.nexus` フォルダ構造の整合性確認。
