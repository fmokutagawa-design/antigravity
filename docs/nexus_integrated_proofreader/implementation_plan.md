# NEXUS 校正エンジン統合実装計画（フェーズ 1）

## プロジェクト概要
執筆支援アプリ「NEXUS」において、既存の主要な OSS 校正ツール（textlint, LanguageTool, RedPen, Tomarigi）の知見を統合した強力な校正エンジンを構築する。

## 実施フェーズ
1. **基盤構築**: Node.js 親和性の高い `textlint` をコア・ハブとして採用。
2. **ルール移植**: LanguageTool および RedPen の主要な日本語チェックロジックを JavaScript ルールとして実装。
3. **辞書統合**: Tomarigi の XML 辞書を `prh` 形式に変換し、表記ゆれチェックを可能にする。
4. **Electron 統合**: Electron のメインプロセスで textlint を動作させ、フロントエンドから IPC 経由で利用可能にする。

## 技術スタック
- **Core Engine**: textlint v15
- **Linguistic Logic**: kuromojin (形態素解析), textlint-rule-preset-japanese
- **Dictionary Hub**: textlint-rule-prh (YAML 形式辞書)
- **Bridge**: Electron IPC (Main process handler)

## 影響範囲・リスク管理
- **既存機能の保護**: Python 側の Narrative Engine とは独立して動作させ、後に結果をマージするハイブリッド方式を採る。
- **パフォーマンス**: 形態素解析の結果をキャッシュし、大規模文書でも入力遅延が発生しない設計とする。
- **互換性**: Windows/Mac 両環境で動作する純粋な Node.js ロジックのみを使用する。
