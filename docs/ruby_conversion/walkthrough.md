# ルビ一括変換機能の拡張（全角英数字・ＡＭＢＡＣ対応）完了報告

ユーザーの指摘に基づき、「ＡＭＢＡＣ（アンバック）」のような全角アルファベットを含むケースにも対応できるよう機能を拡張しました。

## 拡張内容

### 1. [formatText.js](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/utils/formatText.js) の正規表現を更新
正規表現を `([一-龠々〆ヵヶＡ-Ｚａ-ｚ０-９]+)` に拡張し、漢字に加えて全角の英数字も親文字として認識するように修正しました。

## 動作確認結果

ブラウザ上のエディタにて、以下の変換が正しく行われることを確認しました。

| 入力テキスト | 変換後のテキスト | 判定 |
| :--- | :--- | :--- |
| `ＡＭＢＡＣ（アンバック）` | `ＡＭＢＡＣ《アンバック》` | ✅ 成功（新規対応） |
| `主機（メイン）` | `主機《メイン》` | ✅ 成功（既存機能維持） |
| `Main(メイン)` | `Main(メイン)` | ✅ 変換対象外（仕様通り） |

---

## 修正後の動作エビデンス
以下のスクリーンショットおよび録画にて、全角アルファベットが正しく変換される様子をご確認いただけます。

![Ruby Conversion Final Result](file:///Users/mokutagawa/.gemini/antigravity/brain/b2df335d-e7c6-4cca-aaa0-d63fcc5ac5f3/ruby_conversion_success_final_1775559310638.png)

録画：
![Ruby Conversion AMBAC Verification](file:///Users/mokutagawa/.gemini/antigravity/brain/b2df335d-e7c6-4cca-aaa0-d63fcc5ac5f3/verify_ruby_conversion_ambac_v2_1775559127089.webp)

> [!NOTE]
> SF小説等で頻出するアルファベット混じりの用語も、これで一括してルビ記法に整えることが可能になりました。
