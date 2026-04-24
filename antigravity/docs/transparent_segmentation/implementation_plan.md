# 実装計画：複数ファイル原稿の疑似一体化 (Lightweight MVP)

ユーザーが章ごとに分割されたファイルを「一つの作品」として扱いやすくするための、フォルダベースの管理機構（Transparent Segmentation の軽量版）を実装します。

## 概要

独自拡張子（.nexus）を使わず、**通常のフォルダ内に `manifest.json` を置く**ことで、そのフォルダを「分割された一つの作品」として認識させます。これにより、執筆は章ごとに行いつつ、プレビューや出力、検索は「全文」に対して行えるようにします。

## ユーザーレビューが必要な項目

> [!IMPORTANT]
> **フォルダの命名規則**
> `作品名.txt` を分割する際、デフォルトでは `作品名/` というフォルダを作成し、その中に `manifest.json` と各章ファイルを生成します。元の `.txt` ファイルは `.backup/` フォルダへ移動されます。
>
> **マニフェストの自動更新**
> ファイル名をエディタ上のリネーム機能で書き換えた際、自動的に `manifest.json` を更新します。ただし、Finder（OS）上で直接ファイル名を変更された場合は、次回の読み込み時に不整合を検知してユーザーに修復を求めます。

## 提案する変更内容

### 1. 共通ユーティリティ・基盤

#### [NEW] [manifest.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/utils/manifest.js)
マニフェストファイルの定義と操作（読み込み、書き出し、整合性チェック）。

#### [MODIFY] [fileSystem.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/utils/fileSystem.js) / [fileSystem.electron.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/utils/fileSystem.electron.js)
指定したフォルダが「分割作品フォルダ」かどうかを判定する `isSegmentedWork(folderHandle)` 関数を追加。

---

### 2. 分割機能のアップデート

#### [MODIFY] [useSplitByChapters.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/hooks/useSplitByChapters.js)
`performSplit` 関数を更新：
1. `[作品名]/` フォルダを作成。
2. その中に `manifest.json` を生成。
3. 各章を `segments/` (または平坦にフォルダ直下) へ保存。
4. 元ファイルをバックアップへ移動。

---

### 3. UI・機能連携

#### [MODIFY] [Preview.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Preview.jsx)
- 現在のファイルが分割作品の一部であれば、自動的にマニフェストに記載された全ファイルを非同期で読み込む。
- 読み込んだテキストを連結して `renderManuscript` に渡す。

#### [MODIFY] [SearchReplace.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/SearchReplace.jsx)
- 「作品内検索」をより簡単に使えるよう、Grep モード時の対象ファイルを分割作品内のファイル群にフィルタリングするオプションを追加。

#### [MODIFY] [App.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx)
- 全文エクスポート（結合出力）機能の追加。
- 逆統合（全結合して単一ファイルに戻す）コマンドの追加。

---

## オープン質問

> [!IMPORTANT]
> **1. 操作 UI の場所**
> 「章の並べ替え」や「単一ファイルへ戻す（逆統合）」などの操作は、どこにあるのが一番使いやすいでしょうか？
> - 左サイドバーのフォルダを右クリックした時のメニュー
> - 「原稿管理」タブの中
> - ツールバーの新しいアイコン

> [!NOTE]
> **2. 章ファイルの配置**
> フォルダ直下に章ファイルを並べるか、それとも `segments/` というサブフォルダを作るか、どちらが好みですか？
> - 直下：Finder で見た時にすぐファイルにアクセスできる。
> - サブフォルダ：`manifest.json` と原稿が混ざらず、整理されて見える。

## 検証計画

### 自動テスト（コードベース）
- `manifest.js` のパース・生成テスト。

### 手動検証（ブラウザ/Electron）
1. 既存のファイルを「章ごとに分割」し、フォルダが作成され `manifest.json` が含まれていることを確認。
2. その中の 1 つの章を開き、「プレビュー」タブで全章が繋がって表示されるか確認。
3. 全文検索で、現在開いていない章の言葉がヒットし、クリックでその章へジャンプできるか確認。
4. 「一括エクスポート」を実行し、全ての章が結合された一つのテキストファイルが正しく出力されるか確認。
