import React, { useRef, useImperativeHandle, forwardRef, useMemo, useEffect, useCallback, useLayoutEffect, useState } from 'react';
import '../index.css';
// ★ 約物フィルターを無効化したい場合、この import をコメントアウトしてください
import { toVerticalDisplay, fromVerticalDisplay } from '../utils/verticalPunctuation';
import { useUndoHistory } from '../hooks/useUndoHistory';
import { useClipboardHistory } from '../hooks/useClipboardHistory';


/**
 * Editor Component
 * 「見た目の1文字＝1マス」を物理的に強制する究極の安定化エディタ。
 */

// --- 禁則処理の文字セット ---
// ★ エディタでは無効化（プレビューで禁則処理を適用）
// アンダーレイ座標が break-all/anywhere の単純折り返しと同期するため
const KINSOKU_ENABLED = false;

// 行頭禁止 (Gyoto): これらの文字で行を始めてはいけない
const GYOTO_CHARS = new Set([
  '、', '。', '，', '．', '！', '？', '!', '?', '‼', '⁇', '⁈', '⁉',
  '）', ']', '｝', '〉', '》', '｣', '』', '】', '〕', "\u201D", "\u2019", '」',
  'っ', 'ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ',
  'ッ', 'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ',
  'ゝ', 'ゞ', '々', 'ー',
  // 約物フィルターの縦書き専用字形も登録
  '︙', '︱',
]);

// 行末禁止 (Gyomatsu): これらの文字で行を終えてはいけない
const GYOMATSU_CHARS = new Set([
  '（', '［', '｛', '〈', '《', '｢', '『', '【', '〔', "\u201C", "\u2018", '「', '[',
]);

// ぶら下げ (Hanging): 行末からはみ出してもOK
const HANGING_CHARS = new Set(['、', '。', '，', '．']);

/**
 * 禁則処理付きの文字位置計算
 * CSS lineBreak: strict と同じルールを JS で再現し、
 * グリッド座標とテキスト折り返しを完全に同期させる。
 */
function computeCharPositions(charArray, maxPerLine) {
  const positions = new Array(charArray.length);
  let line = 0;
  let pos = 0;
  let allowHanging = false;

  for (let i = 0; i < charArray.length; i++) {
    const char = charArray[i];

    if (char === '\n') {
      positions[i] = null;
      line++;
      pos = 0;
      allowHanging = false;
      continue;
    }

    // 通常の折り返し（ぶら下げ許可時はスキップ）
    if (pos >= maxPerLine && !allowHanging) {
      line++;
      pos = 0;
    }

    // ぶら下げ文字の配置
    if (allowHanging && pos >= maxPerLine) {
      positions[i] = { line, pos };
      line++;
      pos = 0;
      allowHanging = false;
      continue;
    }

    allowHanging = false;

    // 文字を配置
    positions[i] = { line, pos };
    pos++;

    // 禁則処理: 行末に達したら次の文字をチェック
    if (KINSOKU_ENABLED && pos >= maxPerLine && i + 1 < charArray.length && charArray[i + 1] !== '\n') {
      const nextChar = charArray[i + 1];

      // 1. ぶら下げ: 。、は行末からはみ出してもOK
      if (HANGING_CHARS.has(nextChar)) {
        allowHanging = true;
        continue;
      }

      // 2. 行頭禁止 (追い出し): 次の文字が行頭に来れない → 現在の文字を次の行に送る
      if (GYOTO_CHARS.has(nextChar)) {
        pos--;
        line++;
        positions[i] = { line, pos: 0 };
        pos = 1;
        continue;
      }

      // 3. 行末禁止: 現在の文字が行末に来れない → 次の行に送る
      if (GYOMATSU_CHARS.has(char)) {
        pos--;
        line++;
        positions[i] = { line, pos: 0 };
        pos = 1;
        continue;
      }
    }
  }

  return { positions, totalLines: line + 1 };
}

/**
 * 軽量版: 行数だけを計算（座標配列を生成しない）
 * metrics の gridW/gridH 計算用。Array.from() による配列生成を回避。
 */
function computeTotalLines(text, maxPerLine) {
  if (!text || maxPerLine <= 0) return 1;
  let line = 0;
  let pos = 0;
  for (const char of text) {
    if (char === '\n') { line++; pos = 0; continue; }
    if (pos >= maxPerLine) { line++; pos = 0; }
    pos++;
  }
  return line + 1;
}


import ReactDOM from 'react-dom';

const Editor = forwardRef(({ value, onChange, onCursorStats, settings, onInsertRuby, onInsertLink, onLaunchAI, ghostText, setGhostText, corrections = [] }, ref) => {
  const textareaRef = useRef(null);
  const [editorContextMenu, setEditorContextMenu] = React.useState(null);

  // --- Undo/Redo スタック ---
  const { initHistory, pushHistory, undo, redo, handleKeyDown: undoKeyDown, pendingCursor: pendingCursorRef, currentCursor: currentCursorRef } = useUndoHistory(onChange);
  // --- クリップボード履歴 ---
  const { clipboardHistory, addToClipboard } = useClipboardHistory();

  // ファイル切替時に履歴をリセット
  const prevValueRef = useRef(value);
  useEffect(() => {
    // 値が大きく変わった場合（ファイル切替）は履歴リセット
    if (Math.abs(value.length - prevValueRef.current.length) > 100) {
      initHistory(value);
    }
    prevValueRef.current = value;
  }, [value, initHistory]);

  // カーソル位置を追跡するref（全てのonChange呼び出しで更新）
  const nextCursorPos = useRef(null);

  // React再レンダリング直後にカーソル位置を復元（useLayoutEffectでペイント前に実行）
  useLayoutEffect(() => {
    // undo/redo後のカーソル復元
    if (pendingCursorRef && pendingCursorRef.current != null && textareaRef.current) {
      const pos = pendingCursorRef.current;
      pendingCursorRef.current = null;
      textareaRef.current.setSelectionRange(pos, pos);
      return;
    }
    // 通常編集後のカーソル復元
    if (nextCursorPos.current != null && textareaRef.current) {
      const pos = nextCursorPos.current;
      nextCursorPos.current = null;
      textareaRef.current.setSelectionRange(pos, pos);
    }
  });

  // Context Menu Close Handler
  useEffect(() => {
    const close = () => setEditorContextMenu(null);
    if (editorContextMenu) {
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [editorContextMenu]);





  const splitString = (str) => Array.from(str || "");

  // --- パフォーマンス最適化: ハイライト用デバウンス ---
  const [debouncedValue, setDebouncedValue] = useState(value);
  const debouncePrevLenRef = useRef(value.length);

  useEffect(() => {
    // 大きな変更（ファイル切替等）は即座に反映
    if (Math.abs(value.length - debouncePrevLenRef.current) > 100) {
      setDebouncedValue(value);
      debouncePrevLenRef.current = value.length;
      return;
    }
    debouncePrevLenRef.current = value.length;
    const timer = setTimeout(() => setDebouncedValue(value), 150);
    return () => clearTimeout(timer);
  }, [value]);

  // --- 1a. ベース寸法（設定のみ依存、valueに依存しない） ---
  const baseMetrics = useMemo(() => {
    const fontSize = parseInt(settings.fontSize) || 18;
    const isManuscript = settings.paperStyle === 'grid';
    const lineHeightRatio = isManuscript
      ? (settings.lineHeight || 1.65)
      : (settings.charSpacing || 1.4);
    const cell = Math.floor(fontSize * lineHeightRatio);
    const PADDING = 10;

    let maxPerLine;
    if (settings.isVertical) {
      const winH = window.innerHeight;
      const availableH = winH - (PADDING * 2) - 28 - 40;
      maxPerLine = settings.charsPerLine || Math.floor(availableH / cell);
      if (maxPerLine < 5) maxPerLine = 20;
    } else {
      const winW = window.innerWidth;
      const availableW = winW - 320 - (PADDING * 2);
      maxPerLine = settings.charsPerLine || Math.floor(availableW / cell);
      if (maxPerLine < 5) maxPerLine = 20;
    }

    return { fontSize, cell, maxPerLine, padding: PADDING, letterSpacing: cell - fontSize };
  }, [settings.fontSize, settings.lineHeight, settings.isVertical, settings.charsPerLine, settings.paperStyle, settings.charSpacing]);

  // --- 1b. グリッド寸法（valueに依存、ただし軽量な computeTotalLines を使用） ---
  const metrics = useMemo(() => {
    const { fontSize, cell, maxPerLine, padding, letterSpacing } = baseMetrics;
    const totalLines = computeTotalLines(value, maxPerLine);

    let cols, rows, gridW, gridH;
    if (settings.isVertical) {
      rows = maxPerLine;
      cols = Math.max(totalLines, settings.linesPerPage || 10);
      gridH = rows * cell;
      gridW = cols * cell;
    } else {
      cols = maxPerLine;
      rows = Math.max(totalLines, settings.linesPerPage || 10);
      gridW = cols * cell;
      gridH = rows * cell;
    }

    return { fontSize, cell, cols, rows, gridW, gridH, padding, letterSpacing };
  }, [value, baseMetrics, settings.isVertical, settings.linesPerPage]);

  // --- 共有キャラクター座標キャッシュ（デバウンス値 + 安定した maxPerLine） ---
  const charPositionsCache = useMemo(() => {
    if (!debouncedValue) return { positions: [], charArray: [], utf16ToCharIdx: new Map() };
    const charArray = splitString(debouncedValue);
    const { positions } = computeCharPositions(charArray, baseMetrics.maxPerLine);

    // UTF-16インデックス → 文字インデックスのマッピングを事前計算
    const utf16ToCharIdx = new Map();
    let codeUnitOffset = 0;
    for (let i = 0; i < charArray.length; i++) {
      utf16ToCharIdx.set(codeUnitOffset, i);
      codeUnitOffset += charArray[i].length;
    }

    return { positions, charArray, utf16ToCharIdx };
  }, [debouncedValue, baseMetrics.maxPerLine]);

  // --- 2. アンダーレイ（座標マップ）の生成（デバウンス） ---
  const highlights = useMemo(() => {
    if (settings.editorSyntaxColors === false) return [];
    if (!debouncedValue) return [];
    const { cell } = baseMetrics;
    const { positions, utf16ToCharIdx } = charPositionsCache;

    // 座標マップ生成
    const charCoords = positions.map((p) => {
      if (!p) return null;
      const x = settings.isVertical ? -p.line * cell : (p.pos * cell);
      const y = settings.isVertical ? (p.pos * cell) : (p.line * cell);
      return { x, y };
    });

    const patterns = [
      { regex: /\[\[.*?\]\]|［［.*?］］/g, color: settings.syntaxColors?.link || '#2980b9' },
      { regex: /『.*?』/g, color: settings.syntaxColors?.emphasis || '#c0392b' },
      { regex: /「.*?」/g, color: settings.syntaxColors?.conversation || '#27ae60' },
      { regex: /《.*?》/g, color: settings.syntaxColors?.ruby || '#e67e22' },
      { regex: /［＃.*?］/g, color: settings.syntaxColors?.aozora || '#8e44ad' },
      { regex: /\{font[:：].*?\}|\{\/font\}/g, color: settings.syntaxColors?.aozora || '#8e44ad' },
      { regex: /\*\*.*?\*\*/g, color: settings.syntaxColors?.emphasis || '#c0392b' },
    ];

    const list = [];
    patterns.forEach(({ regex, color }) => {
      let match;
      while ((match = regex.exec(debouncedValue)) !== null) {
        const visualStart = utf16ToCharIdx.get(match.index) ?? splitString(debouncedValue.substring(0, match.index)).length;
        const visualLen = splitString(match[0]).length;
        for (let i = 0; i < visualLen; i++) {
          const pos = charCoords[visualStart + i];
          if (pos) {
            list.push({ key: `${visualStart + i}-${regex.source}`, x: pos.x, y: pos.y, color });
          }
        }
      }
    });
    return list;
  }, [charPositionsCache, debouncedValue, baseMetrics, settings.isVertical, settings.syntaxColors, settings.editorSyntaxColors]);

  // --- 3a. ゴーストテキスト座標計算 ---
  const ghostHighlights = useMemo(() => {
    if (!ghostText || !value) return [];

    const fullText = value + ghostText;
    const charArray = splitString(fullText);
    const valueLen = splitString(value).length;
    const ghostLen = splitString(ghostText).length;

    const { cell, maxPerLine } = baseMetrics;
    const { positions } = computeCharPositions(charArray, maxPerLine);

    const list = [];
    for (let i = 0; i < ghostLen; i++) {
      const idx = valueLen + i;
      const p = positions[idx];
      if (p) {
        const x = settings.isVertical ? -p.line * cell : (p.pos * cell);
        const y = settings.isVertical ? (p.pos * cell) : (p.line * cell);
        list.push({ key: `ghost-${i}`, x, y, char: charArray[idx] });
      }
    }
    return list;
  }, [value, ghostText, baseMetrics, settings.isVertical]);

  // --- 3b. 校正ハイライト座標計算（デバウンス + キャッシュ共有） ---
  const correctionHighlights = useMemo(() => {
    if (!corrections || corrections.length === 0 || !debouncedValue) return [];

    const { charArray, positions } = charPositionsCache;
    const { cell } = baseMetrics;

    const list = [];

    corrections.forEach(corr => {
      if (!corr.original) return;
      let searchIndex = 0;
      let index = debouncedValue.indexOf(corr.original, searchIndex);

      while (index !== -1) {
        const len = splitString(corr.original).length;
        const preStr = debouncedValue.slice(0, index);
        const startCharIdx = splitString(preStr).length;

        for (let i = 0; i < len; i++) {
          const p = positions[startCharIdx + i];
          if (p) {
            const x = settings.isVertical ? -p.line * cell : (p.pos * cell);
            const y = settings.isVertical ? (p.pos * cell) : (p.line * cell);
            list.push({
              key: `corr-${corr.id}-${index}-${i}`,
              x, y,
              char: charArray[startCharIdx + i],
              color: 'red'
            });
          }
        }
        break;
      }
    });

    return list;
  }, [debouncedValue, corrections, charPositionsCache, baseMetrics, settings.isVertical]);



  // --- 3. 約物フィルター (縦書き時のみ) ---
  const displayValue = settings.isVertical ? toVerticalDisplay(value) : value;

  const handleChange = useCallback((e) => {
    const ta = e.target;
    const raw = ta.value;
    const restored = settings.isVertical ? fromVerticalDisplay(raw) : raw;
    // カーソル位置を保存（React再レンダリングでリセットされるため）
    const cursorPos = ta.selectionStart;
    pushHistory(value, restored, cursorPos);
    if (currentCursorRef) currentCursorRef.current = cursorPos;
    nextCursorPos.current = cursorPos;
    onChange(restored);
  }, [onChange, settings.isVertical, value, pushHistory, currentCursorRef]);

  const handleCopy = useCallback((e) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    if (selected) {
      const original = settings.isVertical ? fromVerticalDisplay(selected) : selected;
      // クリップボード履歴に追加
      addToClipboard(original);
      if (settings.isVertical) {
        // clipboardData が使える場合は同期APIで書き込む
        if (e.clipboardData) {
          try {
            e.clipboardData.setData('text/plain', original);
            e.preventDefault();
          } catch (err) {
            // 別ウィンドウ等で clipboardData が無効な場合、非同期APIにフォールバック
            e.preventDefault();
            navigator.clipboard.writeText(original).catch(() => {});
          }
        } else {
          // clipboardData 自体がない場合
          e.preventDefault();
          navigator.clipboard.writeText(original).catch(() => {});
        }
      }
    }
  }, [settings.isVertical, addToClipboard]);

  const handleCut = useCallback((e) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    if (selected) {
      const original = settings.isVertical ? fromVerticalDisplay(selected) : selected;
      // クリップボード履歴に追加
      addToClipboard(original);
      if (settings.isVertical) {
        e.clipboardData.setData('text/plain', original);
        e.preventDefault();
        const cursorPos = textarea.selectionStart;
        const before = textarea.value.substring(0, cursorPos);
        const after = textarea.value.substring(textarea.selectionEnd);
        const newValue = fromVerticalDisplay(before + after);
        pushHistory(value, newValue, cursorPos);
        nextCursorPos.current = cursorPos;
        onChange(newValue);
      }
    }
  }, [onChange, settings.isVertical, addToClipboard, value, pushHistory]);

  // --- 4. ハンドラ ---
  const handleCursor = () => {
    if (onCursorStats && textareaRef.current) {
      onCursorStats({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
        total: value.length
      });
    }
  };

  const handleWheel = useCallback((e) => {
    if (!settings.isVertical) return;
    // Only convert vertical wheel → horizontal scroll
    // Let deltaX pass through to native browser scrolling
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      const container = textareaRef.current?.closest('.editor-container');
      if (container) {
        container.scrollLeft -= e.deltaY;
        e.preventDefault();
      }
    }
  }, [settings.isVertical]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el && settings.isVertical) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [settings.isVertical, handleWheel]);

  // ★ コンテナにスクロールバーを強制表示（縦書き・横書き両対応）
  useEffect(() => {
    const container = textareaRef.current?.closest('.editor-container');
    if (!container) return;

    // 親フレックスコンテナに合わせる
    container.style.height = '100%';

    if (settings.isVertical) {
      container.style.overflowX = 'scroll';
      container.style.overflowY = 'hidden';
    } else {
      container.style.overflowX = 'hidden';
      container.style.overflowY = 'scroll';
    }

    // -webkit-scrollbar 用の動的スタイルを注入
    const styleId = 'nexus-scrollbar-style';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    const darkMode = document.body.classList.contains('dark-mode');
    const thumbColor = darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
    const thumbHover = darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
    const trackColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const scrollbarCSS = `
      background: ${thumbColor} !important;
      border-radius: 7px !important;
      border: 2px solid transparent !important;
      background-clip: padding-box !important;
    `;
    styleEl.textContent = `
      .editor-container.vertical,
      .editor-container.horizontal {
        height: 100% !important;
      }
      .editor-container.vertical {
        overflow-x: scroll !important;
        overflow-y: hidden !important;
      }
      .editor-container.horizontal {
        overflow-y: scroll !important;
        overflow-x: hidden !important;
      }
      .editor-container::-webkit-scrollbar { width: 14px !important; height: 14px !important; }
      .editor-container::-webkit-scrollbar-track { background: ${trackColor} !important; }
      .editor-container::-webkit-scrollbar-thumb { ${scrollbarCSS} }
      .editor-container::-webkit-scrollbar-thumb:hover { background: ${thumbHover} !important; }
    `;

    return () => {
      if (container) {
        container.style.overflowX = '';
        container.style.overflowY = '';
        container.style.height = '';
      }
    };
  }, [settings.isVertical]);

  const scrollToCaretPosition = useCallback((charIndex) => {
    console.log('[JUMP DEBUG] scrollToCaretPosition called, charIndex=', charIndex);
    
    const ta = textareaRef.current;
    const container = ta?.closest('.editor-container');
    
    console.log('[JUMP DEBUG] ta=', !!ta, 'container=', !!container);
    if (!ta || !container) return;

    const isClean = settings.paperStyle === 'clean';

    if (isClean) {
      // クリーンモード: プロポーショナルフォントのため行計算不可
      // textarea を一時的に 1x1 に縮小し、ブラウザの内部スクロールを利用
      const origWidth = ta.style.width;
      const origHeight = ta.style.height;
      const origOverflow = ta.style.overflow;

      ta.style.overflow = 'auto';
      ta.style.width = '1px';
      ta.style.height = '1px';

      ta.focus();
      ta.setSelectionRange(charIndex, charIndex);

      // ブラウザが内部的にスクロールしたはず
      const innerTop = ta.scrollTop;
      const innerLeft = ta.scrollLeft;

      console.log('[JUMP DEBUG] CLEAN MODE: innerTop=', innerTop, 'innerLeft=', innerLeft);

      // container に転写
      if (settings.isVertical) {
        // vertical-rl: scrollLeft は負方向
        container.scrollLeft = innerLeft;
      } else {
        container.scrollTop = innerTop;
      }

      // textarea を元に戻す
      ta.scrollTop = 0;
      ta.scrollLeft = 0;
      ta.style.width = origWidth;
      ta.style.height = origHeight;
      ta.style.overflow = origOverflow;

      return;
    }

    const { maxPerLine, cell, padding } = baseMetrics;
    const text = settings.isVertical ? toVerticalDisplay(value) : value;
    
    console.log('[JUMP DEBUG] textLen=', text.length, 'maxPerLine=', maxPerLine, 'cell=', cell, 'isVertical=', settings.isVertical);

    let line = 0;
    let pos = 0;
    for (let i = 0; i < charIndex && i < text.length; i++) {
      if (text[i] === '\n') {
        line++;
        pos = 0;
      } else {
        if (pos >= maxPerLine) {
          line++;
          pos = 0;
        }
        pos++;
      }
    }

    console.log('[JUMP DEBUG] computed line=', line, 'pos=', pos);

    if (settings.isVertical) {
      // vertical-rl コンテナの scrollLeft は右端=0、左方向=負
      // line=0 が右端、line が増えるほど左（負の方向）
      const caretOffsetFromRight = line * cell + padding;
      const viewCenter = container.clientWidth / 2;
      // キャレット行がビューポート中央に来るように負の値を設定
      const targetScrollLeft = -(caretOffsetFromRight - viewCenter);
      // 最小値（最も左）= -(scrollWidth - clientWidth)
      const minScrollLeft = -(container.scrollWidth - container.clientWidth);
      const clampedScrollLeft = Math.max(minScrollLeft, Math.min(0, targetScrollLeft));

      console.log('[JUMP DEBUG] VERTICAL: caretOffsetFromRight=', caretOffsetFromRight,
        'minScrollLeft=', minScrollLeft,
        'targetScrollLeft=', targetScrollLeft,
        'clampedScrollLeft=', clampedScrollLeft,
        'BEFORE scrollLeft=', container.scrollLeft);

      container.scrollLeft = clampedScrollLeft;

      console.log('[JUMP DEBUG] AFTER scrollLeft=', container.scrollLeft);
    } else {
      const caretY = line * cell + padding;
      const viewCenter = container.clientHeight / 2;
      const targetScrollTop = Math.max(0, caretY - viewCenter);
      
      console.log('[JUMP DEBUG] HORIZONTAL: caretY=', caretY, 'targetScrollTop=', targetScrollTop);
      
      container.scrollTop = targetScrollTop;
    }
  }, [value, settings.isVertical, settings.paperStyle, baseMetrics]);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    textarea: textareaRef.current,
    textareaRef,
    // Undo/Redo
    undo,
    redo,
    // クリップボード履歴
    clipboardHistory,
    pasteFromHistory: (text) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const currentVal = ta.value;
      const rawVal = settings.isVertical ? fromVerticalDisplay(currentVal) : currentVal;
      const newValue = rawVal.substring(0, start) + text + rawVal.substring(end);
      pushHistory(value, newValue, start);
      nextCursorPos.current = start + text.length;
      onChange(newValue);
    },
    insertRuby: () => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const currentValue = ta.value;
      const rawValue = settings.isVertical ? fromVerticalDisplay(currentValue) : currentValue;
      const selectedText = rawValue.substring(start, end);
      const insertion = selectedText
        ? `${selectedText}《》`
        : '《》';
      const newValue = rawValue.substring(0, start) + insertion + rawValue.substring(end);
      pushHistory(value, newValue, start);
      // カーソルを《》の間に配置（読みを入力する位置）
      nextCursorPos.current = start + (selectedText ? selectedText.length + 1 : 1);
      onChange(newValue);
      // useLayoutEffect だけでは縦書き時に復元されないことがあるため、明示的にフォーカス
      setTimeout(() => {
        const pos = start + (selectedText ? selectedText.length + 1 : 1);
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }, 0);
    },
    setCursorPosition: (position) => {
      const ta = textareaRef.current;
      if (!ta) return;
      // まずスクロール（focus前にやることで画面移動を確実に）
      scrollToCaretPosition(position);
      // 次フレームで focus + selection
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(position, position);
      });
    },
    jumpToPosition: (start, end) => {
      console.log('[JUMP DEBUG] jumpToPosition called, start=', start, 'end=', end);
      const ta = textareaRef.current;
      if (!ta) { console.log('[JUMP DEBUG] textarea is null!'); return; }
      const selEnd = end != null ? end : start;
      scrollToCaretPosition(start);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(start, selEnd);
        console.log('[JUMP DEBUG] rAF: focus + setSelectionRange done');
      });
    }
  }));

  const isCleanMode = settings.paperStyle === 'clean';
  const paperClass = isCleanMode ? 'paper-clean' :
    settings.paperStyle === 'grid' ? 'paper-manuscript' :
      settings.paperStyle === 'lined' ? 'paper-lined' : 'paper-plain';

  // フォントスタイル
  const cleanFontFamily = settings.cleanFontFamily || 'var(--font-mincho)';
  const fontStyle = isCleanMode ? {
    fontFamily: `${cleanFontFamily}, serif`,
    letterSpacing: '0em',
    lineHeight: settings.isVertical ? 'normal' : '2.0',
    fontVariantLigatures: 'common-ligatures',
    fontKerning: 'auto',
    fontFeatureSettings: settings.isVertical
      ? '"kern" 1, "vert" 1, "vrt2" 1'
      : '"kern" 1',
  } : {
    fontFamily: `${settings.fontFamily || 'var(--font-mincho)'}, serif`,
    letterSpacing: `${metrics.letterSpacing}px`,
    lineHeight: `${metrics.cell}px`,
    // 全角幅を強制
    fontVariantEastAsian: 'full-width',
    // 合字を無効化
    fontVariantLigatures: 'none',
    // カーニング完全無効化
    fontKerning: 'none',
    // Chromium の自動アキ（句読点・括弧周りの余白調整）を殺す
    textAutospace: 'no-autospace',
    // CJK約物間の余白折りたたみを殺す（Chromium 144 対応）
    textSpacingTrim: 'space-all',
    // OpenType機能を制御:
    fontFeatureSettings: settings.isVertical
      ? '"palt" 0, "halt" 0, "kern" 0, "vkrn" 0, "chws" 0, "liga" 0, "clig" 0, "calt" 0, "vert" 1, "vrt2" 1'
      : '"palt" 0, "halt" 0, "kern" 0, "vkrn" 0, "chws" 0, "liga" 0, "clig" 0, "calt" 0, "vert" 0, "vrt2" 0',
  };

  // --- メモ化: シンタックスハイライト要素（数百〜数千のdivを毎キー入力で再生成しない） ---
  const highlightElements = useMemo(() => {
    if (settings.editorSyntaxColors === false || !highlights.length) return null;
    const cell = baseMetrics.cell;
    const isVert = settings.isVertical;
    return highlights.map((h) => (
      <div key={h.key} style={{
        position: 'absolute',
        right: isVert ? `${-h.x}px` : 'auto',
        left: isVert ? 'auto' : `${h.x}px`,
        top: `${h.y}px`,
        width: `${cell}px`,
        height: `${cell}px`,
        backgroundColor: h.color,
        opacity: 0.15,
        borderRadius: '2px'
      }} />
    ));
  }, [highlights, settings.isVertical, settings.editorSyntaxColors, baseMetrics.cell]);

  return (
    <div lang="ja" className={`editor-container ${settings.isVertical ? 'vertical' : 'horizontal'} ${paperClass}`}>
      {/* Underlay: skip in clean mode (proportional fonts can't align character-by-character) */}
      {!isCleanMode && (
        <div className="editor-underlay" style={{
          top: `${metrics.padding - (settings.isVertical ? Math.round(metrics.letterSpacing / 2) : 0)}px`,
          right: settings.isVertical ? `${metrics.padding}px` : 'auto',
          left: settings.isVertical ? 'auto' : `${metrics.padding}px`,
          writingMode: settings.isVertical ? 'vertical-rl' : 'horizontal-tb',
          ...fontStyle,
          fontSize: `${metrics.fontSize}px`,
        }}>
          {highlightElements}
          {/* Ghost Text Overlay */}
          {ghostHighlights.map((gh) => (
            <div key={gh.key} style={{
              position: 'absolute',
              right: settings.isVertical ? `${-gh.x}px` : 'auto',
              left: settings.isVertical ? 'auto' : `${gh.x}px`,
              top: `${gh.y}px`,
              width: `${baseMetrics.cell}px`,
              height: `${baseMetrics.cell}px`,
              color: '#aaa',
              opacity: 0.6,
              pointerEvents: 'none',
              lineHeight: `${baseMetrics.cell}px`,
              fontSize: `${baseMetrics.fontSize}px`,
              fontFamily: fontStyle.fontFamily,
              writingMode: settings.isVertical ? 'vertical-rl' : 'horizontal-tb',
              ...fontStyle,
            }}>
              {gh.char}
            </div>
          ))}
          {/* Correction Highlights */}
          {correctionHighlights.map((ch) => (
            <div key={ch.key} style={{
              position: 'absolute',
              right: settings.isVertical ? `${-ch.x}px` : 'auto',
              left: settings.isVertical ? 'auto' : `${ch.x}px`,
              top: `${ch.y}px`,
              width: `${baseMetrics.cell}px`,
              height: `${baseMetrics.cell}px`,
              borderBottom: settings.isVertical ? 'none' : '2px wavy red',
              borderLeft: settings.isVertical ? '2px wavy red' : 'none',
              opacity: 0.7,
              pointerEvents: 'none',
            }} />
          ))}
        </div>
      )}

      <textarea
        lang="ja"
        ref={textareaRef}
        className={`native-grid-editor ${paperClass}`}
        value={displayValue}
        onChange={handleChange}
        onCopy={handleCopy}
        onCut={handleCut}
        onKeyDown={(e) => {
          if (ghostText) {
            if (e.key === 'Tab') {
              e.preventDefault();
              // Accept Ghost Text
              const ta = textareaRef.current;
              const start = ta.selectionStart;
              const val = ta.value;
              const newValue = val.slice(0, start) + ghostText + val.slice(start);
              pushHistory(val, newValue);
              nextCursorPos.current = start + ghostText.length;
              onChange(newValue);
              setGhostText('');
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setGhostText('');
              return;
            }
            // Any other key acts normally but clears ghost text (via App or here)
            // App.jsx effect clears it on text change.
            // But for navigation keys (Arrow), we might want to clear it too?
            // Request says "Any other keypress: clear ghost text."
            if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
              setGhostText('');
            }
          }
          undoKeyDown(e);
        }}
        onScroll={handleCursor}
        onSelect={handleCursor}
        onClick={handleCursor}
        onKeyUp={(e) => {
          handleCursor(e);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const textarea = textareaRef.current;
          const hasSelection = textarea && textarea.selectionStart !== textarea.selectionEnd;
          setEditorContextMenu({
            x: e.clientX,
            y: e.clientY,
            hasSelection
          });
        }}
        spellCheck={false}
        placeholder="ここから物語を紡ぎましょう..."
        style={isCleanMode ? {
          // Clean mode: proportional font, no grid
          fontSize: `${settings.fontSize || 16}px`,
          width: settings.isVertical ? `${Math.max(5000, metrics.gridW + 200)}px` : '100%',
          height: '100%',
          maxWidth: settings.isVertical ? 'none'
            : (settings.charsPerLine ? `${settings.charsPerLine * (parseInt(settings.fontSize) || 16) * 1.2 + 64}px` : 'none'),
          margin: settings.isVertical ? '0'
            : (settings.charsPerLine ? '0 auto' : '0'),
          padding: '40px 32px',
          textAlign: 'start',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          lineBreak: 'normal',
          writingMode: settings.isVertical ? 'vertical-rl' : 'horizontal-tb',
          textOrientation: settings.isVertical ? 'upright' : 'mixed',
          // 横書き: textarea自身がスクロール / 縦書き: コンテナがスクロール
          overflowY: settings.isVertical ? 'hidden' : 'scroll',
          overflowX: settings.isVertical ? 'hidden' : 'hidden',
          resize: 'none',
          background: 'transparent',
          direction: 'ltr',
          ...fontStyle
        } : {
          fontSize: `${metrics.fontSize}px`,
          '--cell': `${metrics.cell}px`,
          '--grid-w': `${metrics.gridW}px`,
          '--grid-h': `${metrics.gridH}px`,
          '--ls-half': `${Math.round(metrics.letterSpacing / 2)}px`,
          width: settings.isVertical
            ? `${metrics.gridW + (metrics.padding * 2) + metrics.cell + 2}px`
            : `${metrics.gridW + (metrics.padding * 2) + 2}px`,
          height: settings.isVertical
            ? `${metrics.gridH + (metrics.padding * 2) + 2}px`
            : `${metrics.gridH + (metrics.padding * 2) + metrics.cell + 2}px`,
          padding: `${metrics.padding}px`,
          textAlign: 'start',
          wordBreak: 'break-all',
          lineBreak: 'anywhere',
          textOrientation: settings.isVertical ? 'upright' : 'mixed',
          overflow: 'hidden',
          resize: 'none',
          ...fontStyle
        }}
      />
      {editorContextMenu && ReactDOM.createPortal(
        <div className="context-menu" style={{
          position: 'fixed',
          top: editorContextMenu.y,
          left: editorContextMenu.x,
          zIndex: 99999
        }} onClick={(e) => e.stopPropagation()}>
          <div className="context-menu-item" onClick={() => {
            if (onInsertRuby) onInsertRuby();
            setEditorContextMenu(null);
          }}>
            ルビ挿入
          </div>
          <div className="context-menu-item" onClick={() => {
            if (onInsertLink) onInsertLink();
            setEditorContextMenu(null);
          }}>
            🔗 リンク挿入
          </div>
          {editorContextMenu.hasSelection && (
            <>
              <div style={{ height: '1px', background: 'var(--border-color, #eee)', margin: '4px 0' }}></div>
              {/* Font change submenu */}
              <div className="context-menu-item" style={{ position: 'relative' }}
                onMouseEnter={(e) => {
                  const sub = e.currentTarget.querySelector('.font-submenu');
                  if (sub) sub.style.display = 'block';
                }}
                onMouseLeave={(e) => {
                  const sub = e.currentTarget.querySelector('.font-submenu');
                  if (sub) sub.style.display = 'none';
                }}
              >
                🔤 フォント変更 ▸
                <div className="font-submenu context-menu" style={{
                  display: 'none',
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  minWidth: '140px',
                  zIndex: 100000,
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {[
                    { label: '明朝', name: '明朝' },
                    { label: 'ゴシック', name: 'ゴシック' },
                    { label: 'ヒラギノ明朝', name: 'ヒラギノ明朝' },
                    { label: '筑紫A', name: '筑紫A' },
                    { label: '筑紫B', name: '筑紫B' },
                    { label: 'クレー', name: 'クレー' },
                    { label: '游明朝', name: '游明朝' },
                    { label: 'Noto明朝', name: 'Noto明朝' },
                    { label: 'キウイ丸', name: 'キウイ丸' },
                    { label: 'ひな明朝', name: 'ひな明朝' },
                    { label: 'うつくし明朝', name: 'うつくし明朝' },
                    { label: '紅道', name: '紅道' },
                  ].map(f => (
                    <div key={f.name} className="context-menu-item" onClick={() => {
                      const ta = textareaRef.current;
                      if (!ta) return;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const rawValue = settings.isVertical ? fromVerticalDisplay(ta.value) : ta.value;
                      const selected = rawValue.substring(start, end);
                      const wrapped = `{font:${f.name}}${selected}{/font}`;
                      const newValue = rawValue.substring(0, start) + wrapped + rawValue.substring(end);
                      pushHistory(value, newValue, start);
                      nextCursorPos.current = start + wrapped.length;
                      onChange(newValue);
                      setEditorContextMenu(null);
                    }}>
                      {f.label}
                    </div>
                  ))}
                  <div style={{ height: '1px', background: 'var(--border-color, #eee)', margin: '4px 0' }}></div>
                  <div className="context-menu-item" onClick={() => {
                    const ta = textareaRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const rawValue = settings.isVertical ? fromVerticalDisplay(ta.value) : ta.value;
                    const selected = rawValue.substring(start, end);
                    // Remove font tags from selection
                    const cleaned = selected.replace(/\{font[:：][^}]*\}/g, '').replace(/\{\/font\}/g, '');
                    const newValue = rawValue.substring(0, start) + cleaned + rawValue.substring(end);
                    pushHistory(value, newValue, start);
                    nextCursorPos.current = start + cleaned.length;
                    onChange(newValue);
                    setEditorContextMenu(null);
                  }}>
                    ❌ フォント解除
                  </div>
                </div>
              </div>
              <div style={{ height: '1px', background: 'var(--border-color, #eee)', margin: '4px 0' }}></div>
              <div className="context-menu-item" onClick={() => {
                const ta = textareaRef.current;
                if (ta) {
                  const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd);
                  const original = settings.isVertical ? fromVerticalDisplay(selected) : selected;
                  addToClipboard(original);
                  navigator.clipboard.writeText(original).catch(() => {});
                  // テキストから選択部分を削除
                  const cursorPos = ta.selectionStart;
                  const before = ta.value.substring(0, cursorPos);
                  const after = ta.value.substring(ta.selectionEnd);
                  const newValue = settings.isVertical ? fromVerticalDisplay(before + after) : (before + after);
                  pushHistory(value, newValue, cursorPos);
                  onChange(newValue);
                }
                setEditorContextMenu(null);
              }}>
                ✂️ 切り取り
              </div>
              <div className="context-menu-item" onClick={() => {
                const ta = textareaRef.current;
                if (ta) {
                  const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd);
                  const original = settings.isVertical ? fromVerticalDisplay(selected) : selected;
                  addToClipboard(original);
                  navigator.clipboard.writeText(original).catch(() => {
                    document.execCommand('copy');
                  });
                }
                setEditorContextMenu(null);
              }}>
                📋 コピー
              </div>
            </>
          )}
          <div className="context-menu-item" onClick={() => {
            const ta = textareaRef.current;
            if (!ta) { setEditorContextMenu(null); return; }
            navigator.clipboard.readText().then(text => {
              if (!text) { setEditorContextMenu(null); return; }
              const start = ta.selectionStart;
              const end = ta.selectionEnd;
              const currentVal = ta.value;
              const rawVal = settings.isVertical ? fromVerticalDisplay(currentVal) : currentVal;
              const newValue = rawVal.substring(0, start) + text + rawVal.substring(end);
              pushHistory(value, newValue, start);
              nextCursorPos.current = start + text.length;
              onChange(newValue);
              addToClipboard(text);
              requestAnimationFrame(() => {
                ta.focus();
              });
            }).catch(() => {
              ta.focus();
            });
            setEditorContextMenu(null);
          }}>
            📌 貼り付け
          </div>
        </div>,
        document.body
      )}

    </div>
  );
});

Editor.displayName = 'Editor';
const MemoEditor = React.memo(Editor);
MemoEditor.displayName = 'Editor';
export default MemoEditor;
