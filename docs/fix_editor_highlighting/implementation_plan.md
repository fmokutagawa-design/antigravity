# シンタックスハイライト表示修正 実装計画

縦書きモードにおいて、シンタックスハイライト（会話文、強調、ルビなど）の背景色が表示されない問題を修正します。

## ユーザーレビューが必要な事項
特にありません。指示書に従い、特定のロジックのみを修正します。

## 提案される変更

### Editor コンポーネント

#### [MODIFY] [Editor.jsx](file:///Volumes/Black6T/Nexus_Dev/antigravity/src/components/Editor.jsx)

`highlightElements` の `useMemo` 内にある、縦書きモードのフィルタリングロジックを修正します。

- **原因**: `visRight` が `margin`（固定値）になっており、スクロール位置に関係なく右端（先頭）付近のハイライトしか表示されない。
- **修正**: `visRight` を `vp.scrollLeft + vp.width + margin` に変更し、スクロール位置に応じた可視範囲でフィルタリングするようにします。

```diff
     if (isVert) {
-      const sl = vp.scrollLeft;
-      const visRight = margin;
-      const visLeft = sl - margin;
+      const visLeft = vp.scrollLeft - margin;
+      const visRight = vp.scrollLeft + vp.width + margin;
       filtered = highlights.filter(h => h.x >= visLeft && h.x <= visRight);
     }
```

## 検証計画

### 手動確認
1.  縦書きモードで長いテキスト（10,000文字以上）を開く。
2.  会話文（「」）などのハイライトが、画面内のどの位置でも（スクロールしても）正しく表示されることを確認。
3.  横書きモードでハイライトが維持されていることを確認。
4.  日本語入力および undo (Cmd+Z) が正常に動作することを確認。
