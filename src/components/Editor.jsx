import React, { useRef, useImperativeHandle, forwardRef, useMemo, useEffect, useCallback, useLayoutEffect, useState } from 'react';
import ReactDOM from 'react-dom';
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
function computeCharPositions(charArray, maxPerLine, startLine = 0) {
  const positions = new Array(charArray.length);
  let line = startLine;
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


const splitString = (str) => Array.from(str || "");

// --- ヘルパー: テキスト分割 (Chapter-based Chunking) ---
// ブラウザのレイアウト負荷を下げるため、章（# 等）ごと、あるいは一定文字数ごとに分割する。
const CHUNK_CHAR_LIMIT = 20000;

// --- 再レンダリング最適化のためのチャンクエディタコンポーネント ---
const ChunkEditor = React.memo(({ 
  chunk, idx, isVertical, baseMetrics, paperClass, textareaStyle, ghostText, 
  handleChunkChange, setGhostText, undoKeyDown, handleCursor, handleChange, 
  handleCompositionStart, handleCompositionEnd, handleCopy, handleCut, 
  handleDragOver, handleDrop, setEditorContextMenu, textareaRefs, textareaRef,
  toVerticalDisplay, chunks
}) => {
  return (
    <textarea
      key={`${chunk.id}-${isVertical ? 'v' : 'h'}`}
      lang="ja"
      ref={el => textareaRefs.current[idx] = el}
      className={`native-grid-editor chunk-editor ${paperClass}`}
      defaultValue={isVertical ? toVerticalDisplay(chunk.text) : chunk.text}
      onChange={(e) => handleChange(e, idx)}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={(e) => handleCompositionEnd(e, idx)}
      onCopy={handleCopy}
      onCut={handleCut}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onFocus={() => {
        textareaRef.current = textareaRefs.current[idx];
      }}
      onKeyDown={(e) => {
        if (ghostText && e.key === 'Tab') {
          e.preventDefault();
          const ta = e.target;
          const start = ta.selectionStart;
          const val = ta.value;
          const newVal = val.slice(0, start) + ghostText + val.slice(ta.selectionEnd);
          ta.value = newVal;
          ta.selectionStart = ta.selectionEnd = start + ghostText.length;
          handleChunkChange(idx, newVal);
          setGhostText('');
          return;
        }
        if (ghostText && e.key === 'Escape') {
          e.preventDefault();
          setGhostText('');
          return;
        }
        if (ghostText && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
          setGhostText('');
        }
        undoKeyDown(e);
      }}
      onScroll={handleCursor}
      onSelect={handleCursor}
      onClick={handleCursor}
      onKeyUp={handleCursor}
      onContextMenu={(e) => {
        e.preventDefault();
        const textarea = textareaRefs.current[idx];
        const hasSelection = textarea && textarea.selectionStart !== textarea.selectionEnd;
        setEditorContextMenu({
          x: e.clientX,
          y: e.clientY,
          hasSelection,
          chunkIdx: idx
        });
      }}
      spellCheck={false}
      placeholder={idx === 0 ? "ここから物語を紡ぎましょう..." : ""}
      style={{
        ...textareaStyle,
        position: 'absolute',
        top: isVertical ? 0 : `${chunk.startLine * baseMetrics.cell}px`,
        left: isVertical ? 'auto' : 0,
        right: isVertical ? `${chunk.startLine * baseMetrics.cell}px` : 'auto',
        height: isVertical ? '100%' : `${chunk.lineCount * baseMetrics.cell}px`,
        width: isVertical ? `${chunk.lineCount * baseMetrics.cell}px` : '100%',
        overflowX: 'hidden',
        overflowY: 'hidden',
        resize: 'none',
        padding: '0 !important',
        textIndent: 0,
        margin: 0,
        display: 'block',
        background: 'transparent',
        boxSizing: 'border-box',
        zIndex: 2, // テキストを最前面に
      }}
    />
  );
});

function splitIntoChunks(text) {
  if (!text) return [{ id: 'empty', text: '', startOffset: 0 }];

  const lines = text.split('\n');
  const chunks = [];
  let currentChunkText = [];
  let currentOffset = 0;
  let chunkId = 0;

  const jpRegex = /^(第[0-9０-９一二三四五六七八九十百千万]+[章話節幕編部]).*/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeader = line.startsWith('#') || jpRegex.test(line);

    // 新しい章が見つかったか、文字数が限界を超えた場合に分割
    if ((isHeader && currentChunkText.length > 0) || (currentChunkText.join('\n').length > CHUNK_CHAR_LIMIT)) {
      chunks.push({
        id: `chunk-${chunkId++}`,
        text: currentChunkText.join('\n'),
        startOffset: currentOffset,
      });
      currentOffset += currentChunkText.join('\n').length + 1; // +1 for the \n that will be joined
      currentChunkText = [];
    }
    currentChunkText.push(line);
  }

  if (currentChunkText.length > 0) {
    chunks.push({
      id: `chunk-${chunkId++}`,
      text: currentChunkText.join('\n'),
      startOffset: currentOffset,
    });
  }

  return chunks;
}

const Editor = forwardRef(({ value, onChange, onCursorStats, settings, onInsertRuby, onInsertLink, onLaunchAI, ghostText, setGhostText, corrections = [], onImageDrop }, ref) => {
  const currentRenderStartTime = performance.now();

  // --- 1. Refs (初期計測などの副作用のないもの) ---
  const jsTotalTimeRef = useRef(0);
  // 毎レンダリングごとに JS 実行時間をリセット
  jsTotalTimeRef.current = 0;

  const renderStartTimeRef = useRef(currentRenderStartTime);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const textareaRefs = useRef([]);
  const localTextRef = useRef(value);
  const debouncedValueRef = useRef(value);
  const lastNotifiedValueRef = useRef(value);
  const viewportRef = useRef({ scrollTop: 0, scrollLeft: 0, height: 800, width: 1000 });
  const isComposingRef = useRef(false);
  const compositionTextRef = useRef(null);
  const undoRedoCallbackRef = useRef(null);
  const pendingCursorRef = useRef(null);
  const currentCursorRef = useRef(null);
  const appNotifyTimerRef = useRef(null);
  const highlightDebounceRef = useRef(null);
  const debouncePrevLenRef = useRef(value.length);
  const lineCountTimerRef = useRef(null);
  const lastLagUpdateRef = useRef(0);

  // --- 2. States ---
  const [lagStats, setLagStats] = useState({ jsTime: 0, totalTime: 0 });
  const [scrollForce, setScrollForce] = useState(0);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [editorContextMenu, setEditorContextMenu] = useState(null);

  // --- 3. カスタムフック (状態に依存するもの) ---
  const undoRedoCallback = useCallback((newText) => {
    if (undoRedoCallbackRef.current) undoRedoCallbackRef.current(newText);
  }, []);

  const { initHistory, pushHistory, undo, redo, handleKeyDown: undoKeyDown, pendingCursor, currentCursor } = useUndoHistory(undoRedoCallback);
  const { clipboardHistory, addToClipboard } = useClipboardHistory();

  // --- 4. メモ化変数 (Memos) - 依存関係の順序が重要 ---

  // A. ベース寸法（すべての計算の基礎）
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

  // B. チャンク分割と位置計算
  const chunks = useMemo(() => {
    const split = splitIntoChunks(debouncedValue);
    let cumulativeLines = 0;
    return split.map(c => {
      const lines = c.text.split('\n');
      let totalLines = 0;
      lines.forEach(l => {
        const len = splitString(l).length;
        totalLines += (len === 0) ? 1 : Math.ceil(len / baseMetrics.maxPerLine);
      });
      const res = { ...c, lineCount: totalLines, startLine: cumulativeLines };
      cumulativeLines += totalLines;
      return res;
    });
  }, [debouncedValue, baseMetrics.maxPerLine]);

  // B-2. 可視チャンクの抽出 (仮想化の核)
  const visibleChunks = useMemo(() => {
    const vp = viewportRef.current;
    const { cell } = baseMetrics;
    const isVert = settings.isVertical;
    const scrollPos = isVert ? -vp.scrollLeft : vp.scrollTop;
    const vpSize = isVert ? vp.width : vp.height;
    
    return chunks.filter(c => {
      const startPos = c.startLine * cell;
      const endPos = (c.startLine + c.lineCount) * cell;
      // バッファとして前後 1000px 分含める
      return (endPos >= scrollPos - 1000 && startPos <= scrollPos + vpSize + 1000);
    });
  }, [chunks, scrollForce, baseMetrics, settings.isVertical]);

  // C. 段落インデックス（ハイライト等の座標計算用）
  const paragraphIndex = useMemo(() => {
    const t0 = performance.now();
    if (!debouncedValue) return [];
    const rawParagraphs = debouncedValue.split('\n');
    const index = [];
    let currentLine = 0;
    let currentCharOffset = 0;
    for (let i = 0; i < rawParagraphs.length; i++) {
      const pText = rawParagraphs[i];
      const pCharArray = splitString(pText);
      const pLen = pCharArray.length;
      const pLineCount = (pLen === 0) ? 1 : Math.max(1, Math.ceil(pLen / baseMetrics.maxPerLine));
      index.push({
        id: i,
        text: pText,
        charArray: pCharArray,
        lineCount: pLineCount,
        startLine: currentLine,
        charOffset: currentCharOffset
      });
      currentLine += pLineCount;
      currentCharOffset += pText.length + 1;
    }
    jsTotalTimeRef.current += (performance.now() - t0);
    return index;
  }, [debouncedValue, baseMetrics.maxPerLine]);

  // D. その他依存変数
  const debouncedLineCount = useMemo(() => {
    if (paragraphIndex.length === 0) return 1;
    const last = paragraphIndex[paragraphIndex.length - 1];
    return last.startLine + last.lineCount;
  }, [paragraphIndex]);

  // E. グリッド寸法計算
  const metrics = useMemo(() => {
    const { fontSize, cell, maxPerLine, padding, letterSpacing } = baseMetrics;
    const totalLines = debouncedLineCount;
    let cols, rows, gridW, gridH;

    if (settings.isVertical) {
      rows = maxPerLine;
      cols = Math.max(totalLines, settings.linesPerPage || 10);
      gridH = rows * cell; gridW = cols * cell;
    } else {
      cols = maxPerLine;
      rows = Math.max(totalLines, settings.linesPerPage || 10);
      gridW = cols * cell; gridH = rows * cell;
    }
    return { fontSize, cell, cols, rows, gridW, gridH, padding, letterSpacing };
  }, [debouncedLineCount, baseMetrics, settings.isVertical, settings.linesPerPage]);

  // --- 5. コールバック関数 (Callbacks) ---

  const localOnChange = useCallback((newText) => {
    localTextRef.current = newText;
    lastNotifiedValueRef.current = newText;
    if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
    appNotifyTimerRef.current = setTimeout(() => { onChange(newText); }, 500);

    if (highlightDebounceRef.current) clearTimeout(highlightDebounceRef.current);
    if (Math.abs(newText.length - (debouncePrevLenRef.current || 0)) > 100) {
      setDebouncedValue(newText);
      debouncePrevLenRef.current = newText.length;
    } else {
      highlightDebounceRef.current = setTimeout(() => {
        setDebouncedValue(newText);
        debouncePrevLenRef.current = newText.length;
      }, 300);
    }
  }, [onChange]);

  const handleChunkChange = useCallback((idx, newVal) => {
    const allVals = textareaRefs.current.map((ta, i) => {
      if (!ta) return chunks[i]?.text || "";
      const v = ta.value;
      return settings.isVertical ? fromVerticalDisplay(v) : v;
    });
    const merged = allVals.join('\n');
    localTextRef.current = merged;
    lastNotifiedValueRef.current = merged;
    localOnChange(merged);
  }, [chunks, settings.isVertical, localOnChange]);

  const applyText = useCallback((newText, cursorPos = null) => {
    if (isComposingRef.current) return;
    const newChunks = splitIntoChunks(newText);
    textareaRefs.current.forEach((ta, idx) => {
      if (!ta) return;
      const chunkText = newChunks[idx]?.text || "";
      ta.value = settings.isVertical ? toVerticalDisplay(chunkText) : chunkText;
    });
    localTextRef.current = newText;
    lastNotifiedValueRef.current = newText;
    setDebouncedValue(newText);
    debouncePrevLenRef.current = newText.length;

    if (cursorPos != null) {
      let offset = 0;
      for (let i = 0; i < newChunks.length; i++) {
        const c = newChunks[i];
        if (cursorPos >= offset && cursorPos <= offset + c.text.length) {
          const ta = textareaRefs.current[i];
          if (ta) {
            ta.focus();
            ta.setSelectionRange(cursorPos - offset, cursorPos - offset);
            textareaRef.current = ta;
          }
          break;
        }
        offset += c.text.length + 1;
      }
    }
  }, [settings.isVertical]);

  const handleChange = (e, chunkIdx) => {
    const ta = e.target;
    const newValue = ta.value;
    if (isComposingRef.current) {
      handleChunkChange(chunkIdx, newValue);
      return;
    }
    const oldFull = localTextRef.current;
    handleChunkChange(chunkIdx, newValue);
    const newFull = localTextRef.current;
    const globalPos = (chunks[chunkIdx]?.startOffset || 0) + ta.selectionStart;
    pushHistory(oldFull, newFull, globalPos);
    if (currentCursorRef) currentCursorRef.current = globalPos;
  };

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
    compositionTextRef.current = localTextRef.current;
  }, []);

  const handleCompositionEnd = useCallback((e, chunkIdx) => {
    isComposingRef.current = false;
    const ta = e.target;
    const raw = ta.value;
    handleChunkChange(chunkIdx, raw);
    const beforeComposition = compositionTextRef.current ?? localTextRef.current;
    const globalPos = (chunks[chunkIdx]?.startOffset || 0) + ta.selectionStart;
    pushHistory(beforeComposition, localTextRef.current, globalPos);
    if (currentCursorRef) currentCursorRef.current = globalPos;
    compositionTextRef.current = null;
  }, [chunks, handleChunkChange, pushHistory, currentCursorRef]);

  const handleUndo = useCallback(() => {
    const restored = undo();
    if (restored === null) return;
  }, [undo]);

  const handleRedo = useCallback(() => {
    const restored = redo();
    if (restored === null) return;
  }, [redo]);

  const handleCopy = useCallback((e) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    if (selected) {
      const original = settings.isVertical ? fromVerticalDisplay(selected) : selected;
      addToClipboard(original);
      if (settings.isVertical) {
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', original);
          e.preventDefault();
        } else {
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
      addToClipboard(original);
      if (settings.isVertical) {
        e.clipboardData.setData('text/plain', original);
        e.preventDefault();
        const cursorPos = textarea.selectionStart;
        const before = textarea.value.substring(0, cursorPos);
        const after = textarea.value.substring(textarea.selectionEnd);
        const newValue = fromVerticalDisplay(before + after);
        pushHistory(localTextRef.current, newValue, cursorPos);
        applyText(newValue, cursorPos);
        onChange(newValue);
      }
    }
  }, [localOnChange, settings.isVertical, addToClipboard, pushHistory, applyText, onChange]);

  const handleCursor = (e) => {
    // 選択操作のみで仮想化の再計算が走るのを防ぐため、viewport の変化がない場合は無視
    if (textareaRef.current) {
      const container = containerRef.current;
      if (container) {
        if (Math.abs(container.scrollTop - viewportRef.current.scrollTop) > 5 || 
            Math.abs(container.scrollLeft - viewportRef.current.scrollLeft) > 5) {
          viewportRef.current = { 
            scrollTop: container.scrollTop, 
            scrollLeft: container.scrollLeft, 
            height: container.clientHeight, 
            width: container.clientWidth 
          };
          setScrollForce(f => f + 1);
        }
      }
    }
    if (onCursorStats && textareaRef.current) {
      onCursorStats({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
        total: localTextRef.current.length
      });
    }
  };


  const scrollToCaretPosition = useCallback((charIndex) => {
    const ta = textareaRef.current;
    const container = ta?.closest('.editor-container');
    if (!ta || !container) return;
    const isClean = settings.paperStyle === 'clean';
    if (isClean) {
      const origW = ta.style.width; const origH = ta.style.height; const origO = ta.style.overflow;
      ta.style.overflow = 'auto'; ta.style.width = '1px'; ta.style.height = '1px';
      ta.focus(); ta.setSelectionRange(charIndex, charIndex);
      if (settings.isVertical) container.scrollLeft = ta.scrollLeft;
      else container.scrollTop = ta.scrollTop;
      ta.scrollTop = 0; ta.scrollLeft = 0;
      ta.style.width = origW; ta.style.height = origH; ta.style.overflow = origO;
      return;
    }
    const { maxPerLine, cell, padding } = baseMetrics;
    const text = settings.isVertical ? toVerticalDisplay(localTextRef.current) : localTextRef.current;
    let line = 0; let pos = 0;
    for (let i = 0; i < charIndex && i < text.length; i++) {
      if (text[i] === '\n') { line++; pos = 0; }
      else { if (pos >= maxPerLine) { line++; pos = 0; } pos++; }
    }
    if (settings.isVertical) {
      const caretOffset = line * cell + padding;
      container.scrollLeft = Math.max(-(container.scrollWidth - container.clientWidth), Math.min(0, -(caretOffset - container.clientWidth / 2)));
    } else {
      container.scrollTop = Math.max(0, (line * cell + padding) - container.clientHeight / 2);
    }
  }, [settings.isVertical, settings.paperStyle, baseMetrics]);

  // --- 6. 副次的なメモ化 (Cache, Highlights) ---

  const charPositionsCache = useMemo(() => {
    const t0 = performance.now();
    if (paragraphIndex.length === 0) return { positions: [], charArray: [], visibleParagraphs: [] };
    const { cell, maxPerLine } = baseMetrics;
    const isVert = settings.isVertical;
    const vp = viewportRef.current;
    const viewportSize = isVert ? vp.width : vp.height;
    const scrollPos = isVert ? -vp.scrollLeft : vp.scrollTop;
    const startVisibleLine = Math.floor(scrollPos / cell) - (Math.floor(viewportSize / cell) * 5); // バッファ拡大
    const endVisibleLine = Math.ceil((scrollPos + viewportSize) / cell) + (Math.floor(viewportSize / cell) * 5);
    const visibleParagraphs = paragraphIndex.filter(p => (p.startLine + p.lineCount) >= startVisibleLine && p.startLine <= endVisibleLine);
    jsTotalTimeRef.current += (performance.now() - t0);
    return { visibleParagraphs };
  }, [paragraphIndex, scrollForce, baseMetrics, settings.isVertical]);

  const highlights = useMemo(() => {
    if (settings.editorSyntaxColors === false || !charPositionsCache.visibleParagraphs.length) return [];
    const t0 = performance.now();
    const ps = localTextRef.current.split(/\r?\n/);
    const { cell } = baseMetrics;
    const isVert = settings.isVertical;
    const patterns = [
      { regex: /\[\[.*?\]\]|［［.*?］］/g, color: settings.syntaxColors?.link || '#2980b9' },
      { regex: /『.*?』/g, color: settings.syntaxColors?.emphasis || '#c0392b' },
      { regex: /「.*?」/g, color: settings.syntaxColors?.conversation || '#27ae60', isConversation: true },
      { regex: /《.*?》/g, color: settings.syntaxColors?.ruby || '#e67e22' },
      { regex: /［＃.*?］/g, color: settings.syntaxColors?.aozora || '#8e44ad' },
      { regex: /\{font[:：].*?\}|\{\/font\}/g, color: settings.syntaxColors?.aozora || '#8e44ad' },
      { regex: /\*\*.*?\*\*/g, color: settings.syntaxColors?.emphasis || '#c0392b' },
    ];
    const list = [];
    charPositionsCache.visibleParagraphs.forEach(p => {
      const pPositions = computeCharPositions(p.charArray, baseMetrics.maxPerLine, p.startLine).positions;
      patterns.forEach(({ regex, color, isConversation }) => {
        let match; regex.lastIndex = 0;
        while ((match = regex.exec(p.text)) !== null) {
          const preMatch = p.text.substring(0, match.index);
          const pStartIdx = splitString(preMatch).length;
          const pMatchLen = splitString(match[0]).length;
          for (let i = 0; i < pMatchLen; i++) {
            const pCoord = pPositions[pStartIdx + i];
            if (pCoord) {
              const x = isVert ? -pCoord.line * cell : (pCoord.pos * cell);
              const y = isVert ? (pCoord.pos * cell) : (pCoord.line * cell);
              list.push({ key: `h-${p.id}-${match.index}-${i}-${regex.source}`, x, y, color, isConversation: !!isConversation });
            }
          }
        }
      });
    });
    jsTotalTimeRef.current += (performance.now() - t0);
    return list;
  }, [charPositionsCache, baseMetrics, settings.isVertical, settings.syntaxColors, settings.editorSyntaxColors]);

  const ghostHighlights = useMemo(() => {
    if (!ghostText || !debouncedValue || !paragraphIndex.length) return [];
    const t0 = performance.now();
    const { cell, maxPerLine } = baseMetrics;
    const lastParagraph = paragraphIndex[paragraphIndex.length - 1];
    const charArray = splitString(ghostText);
    const startLine = lastParagraph.startLine + lastParagraph.lineCount - 1;
    const positions = computeCharPositions(charArray, maxPerLine, lastParagraph.text.endsWith('\n') ? startLine + 1 : startLine).positions;
    const list = [];
    for (let i = 0; i < charArray.length; i++) {
      const p = positions[i];
      if (p) {
        const x = settings.isVertical ? -p.line * cell : (p.pos * cell);
        const y = settings.isVertical ? (p.pos * cell) : (p.line * cell);
        list.push({ key: `ghost-${i}`, x, y, char: charArray[i] });
      }
    }
    jsTotalTimeRef.current += (performance.now() - t0);
    return list;
  }, [debouncedValue, ghostText, paragraphIndex, baseMetrics, settings.isVertical]);

  const correctionHighlights = useMemo(() => {
    if (!corrections?.length || !paragraphIndex.length) return [];
    const t0 = performance.now();
    const { cell, maxPerLine } = baseMetrics;
    const isVert = settings.isVertical;
    const list = [];
    const visibleParagraphs = charPositionsCache.visibleParagraphs || [];
    corrections.forEach(corr => {
      if (!corr.original) return;
      visibleParagraphs.forEach(p => {
        let index = p.text.indexOf(corr.original);
        while (index !== -1) {
          const pPositions = computeCharPositions(p.charArray, maxPerLine, p.startLine).positions;
          const startIdx = splitString(p.text.substring(0, index)).length;
          const len = splitString(corr.original).length;
          for (let i = 0; i < len; i++) {
            const pCoord = pPositions[startIdx + i];
            if (pCoord) {
              const x = isVert ? -pCoord.line * cell : (pCoord.pos * cell);
              const y = isVert ? (pCoord.pos * cell) : (pCoord.line * cell);
              list.push({ key: `corr-${corr.id}-${p.id}-${index}-${i}`, x, y, char: p.charArray[startIdx + i], color: 'red' });
            }
          }
          index = p.text.indexOf(corr.original, index + 1);
        }
      });
    });
    jsTotalTimeRef.current += (performance.now() - t0);
    return list;
  }, [corrections, charPositionsCache, baseMetrics, settings.isVertical, paragraphIndex]);

  // --- 7. スタイルメモ化 ---

  const isCleanMode = settings.paperStyle === 'clean';
  const paperClass = isCleanMode ? 'paper-clean' : (settings.paperStyle === 'grid' ? 'paper-manuscript' : (settings.paperStyle === 'lined' ? 'paper-lined' : 'paper-plain'));
  const cleanFontFamily = settings.cleanFontFamily || 'var(--font-mincho)';
  const fontStyle = useMemo(() => isCleanMode ? {
    fontFamily: `${cleanFontFamily}, serif`, letterSpacing: '0em', fontVariantLigatures: 'common-ligatures', fontKerning: 'auto',
    fontFeatureSettings: settings.isVertical ? '"kern" 1, "vert" 1, "vrt2" 1' : '"kern" 1',
  } : {
    fontFamily: `${settings.fontFamily || 'var(--font-mincho)'}, serif`, letterSpacing: `${metrics.letterSpacing}px`, lineHeight: `${metrics.cell}px`,
    fontVariantEastAsian: 'full-width', fontVariantLigatures: 'none', fontKerning: 'none', textAutospace: 'no-autospace', textSpacingTrim: 'space-all',
    fontFeatureSettings: settings.isVertical ? '"palt" 0, "halt" 0, "kern" 0, "vkrn" 0, "chws" 0, "liga" 0, "clig" 0, "calt" 0, "vert" 1, "vrt2" 1' : '"palt" 0, "halt" 0, "kern" 0, "vkrn" 0, "chws" 0, "liga" 0, "clig" 0, "calt" 0, "vert" 0, "vrt2" 0',
  }, [isCleanMode, cleanFontFamily, settings.isVertical, settings.fontFamily, metrics.letterSpacing, metrics.cell]);

  const textareaStyle = useMemo(() => isCleanMode ? {
    fontSize: `${settings.fontSize || 16}px`, width: settings.isVertical ? `${Math.max(5000, metrics.gridW + 200)}px` : '100%', height: '100%',
    maxWidth: settings.isVertical ? 'none' : (settings.charsPerLine ? `${settings.charsPerLine * (parseInt(settings.fontSize) || 16) * 1.2 + 64}px` : 'none'),
    margin: settings.isVertical ? '0' : (settings.charsPerLine ? '0 auto' : '0'), padding: '40px 32px', textAlign: 'start', wordBreak: 'normal', overflowWrap: 'break-word', lineBreak: 'normal',
    writingMode: settings.isVertical ? 'vertical-rl' : 'horizontal-tb', textOrientation: settings.isVertical ? 'upright' : 'mixed', 
    overflowY: settings.isVertical ? 'hidden' : 'auto', 
    overflowX: settings.isVertical ? 'auto' : 'hidden', 
    resize: 'none', background: 'transparent', direction: 'ltr', ...fontStyle
  } : {
    fontSize: `${metrics.fontSize}px`,
    width: settings.isVertical ? `${metrics.gridW + (metrics.padding * 2) + metrics.cell + 2}px` : `${metrics.gridW + (metrics.padding * 2) + 2}px`,
    height: settings.isVertical ? `${metrics.gridH + (metrics.padding * 2) + 2}px` : `${metrics.gridH + (metrics.padding * 2) + metrics.cell + 2}px`,
    padding: `${metrics.padding}px`, textAlign: 'start', wordBreak: 'break-all', lineBreak: 'anywhere', textOrientation: settings.isVertical ? 'upright' : 'mixed', 
    overflowY: settings.isVertical ? 'hidden' : 'auto', 
    overflowX: settings.isVertical ? 'auto' : 'hidden', 
    position: 'relative', // 子要素の absolute 配置の基点にする
    resize: 'none', ...fontStyle
  }, [isCleanMode, settings.fontSize, settings.isVertical, settings.charsPerLine, metrics, fontStyle]);
  // --- 8. 副作用 (Effects) ---

  useLayoutEffect(() => {
    if (containerRef.current) {
      viewportRef.current = {
        scrollTop: containerRef.current.scrollTop,
        scrollLeft: containerRef.current.scrollLeft,
        height: containerRef.current.clientHeight,
        width: containerRef.current.clientWidth
      };
    }
    const now = performance.now();
    const total = now - renderStartTimeRef.current;
    
    // 最小更新間隔（100ms）を設けて無限ループを回避しつつ、負荷状況を通知
    if (now - lastLagUpdateRef.current > 100) {
      if (Math.abs(lagStats.totalTime - total) > 0.5 || Math.abs(lagStats.jsTime - jsTotalTimeRef.current) > 0.5) {
        lastLagUpdateRef.current = now;
        setLagStats({ jsTime: jsTotalTimeRef.current, totalTime: total });
      }
    }
  });

  useEffect(() => {
    if (value === lastNotifiedValueRef.current) return;
    if (value === localTextRef.current) return;
    applyText(value);
  }, [value, applyText]);

  useEffect(() => {
    if (Math.abs(value.length - localTextRef.current.length) > 100) initHistory(value);
  }, [value, initHistory]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    let rafId = null;
    const onScroll = () => {
      viewportRef.current = {
          width: container.clientWidth,
          height: container.clientHeight,
          scrollTop: container.scrollTop,
          scrollLeft: container.scrollLeft,
      };
      
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setScrollForce(f => f + 1);
      });
    };
    
    // 縦書き時のスクロール方向変換 (マウスホイール)
    // React の onWheel は passive: true になることがあるため直接登録する
    const onWheel = (e) => {
      if (!settings.isVertical) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        container.scrollLeft -= e.deltaY;
        e.preventDefault(); // passive: false なので成功する
      }
    };
    
    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('wheel', onWheel);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [settings.isVertical]);

  const highlightElements = useMemo(() => {
    if (settings.editorSyntaxColors === false || !highlights.length) return null;
    const cell = baseMetrics.cell;
    const isVert = settings.isVertical;
    
    // ★ ref から viewport を読む（ハイライト再計算時のスナップショット）
    //    スクロールだけでは再計算されない（highlights 変更時のみ）
    const vp = viewportRef.current;
    let filtered;
    if (isVert) {
      const visRight = -vp.scrollLeft;
      const visLeft = -vp.scrollLeft + vp.width;
      const buffer = vp.width * 2; // バッファ拡大
      filtered = highlights.filter(h => -h.x >= visRight - buffer && -h.x <= visLeft + buffer);
    } else {
      const visTop = vp.scrollTop;
      const visBottom = vp.scrollTop + vp.height;
      const buffer = vp.height * 2; // バッファ拡大
      filtered = highlights.filter(h => h.y >= visTop - buffer && h.y <= visBottom + buffer);
    }

    const MAX_VISIBLE = 5000;
    const limited = filtered.length > MAX_VISIBLE ? filtered.slice(0, MAX_VISIBLE) : filtered;
    
    return limited.map((h) => (
      <div key={h.key} style={{
        position: 'absolute',
        right: isVert ? `${-h.x}px` : 'auto',
        left: isVert ? 'auto' : `${h.x}px`,
        top: `${h.y}px`,
        width: `${cell}px`,
        height: `${cell}px`,
        backgroundColor: h.color,
        opacity: h.isConversation ? 0.5 : 0.25,
        borderRadius: '2px'
      }} />
    ));
  }, [highlights, baseMetrics, settings.isVertical, settings.editorSyntaxColors, scrollForce]);

  // --- ドラッグ&ドロップでの画像挿入 ---
  const handleDragOver = useCallback((e) => {
    // 画像ファイルのドラッグのみ受け入れる
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(async (e) => {
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(f => f.type.startsWith('image/'));
    if (!imageFile) return;

    e.preventDefault();

    // App.jsx から渡された onImageDrop で画像を保存
    if (onImageDrop) {
      const fileName = await onImageDrop(imageFile);
      if (fileName) {
        // カーソル位置に挿絵記法を挿入
        const ta = textareaRef.current;
        const pos = ta.selectionStart;
        // 前後が改行されていない場合は改行で挟むなどの調整が可能（今回はシンプルに改行挟み）
        const insertion = `\n［＃挿絵（${fileName}）入る］\n`;
        const newValue = localTextRef.current.substring(0, pos) + insertion + localTextRef.current.substring(pos);
        pushHistory(localTextRef.current, newValue, pos);
        applyText(newValue, pos + insertion.length);
        onChange(newValue);
      }
    }
  }, [localOnChange, pushHistory, onImageDrop, onChange, applyText]);

  return (
    <div ref={containerRef} lang="ja" className={`editor-container ${settings.isVertical ? 'vertical' : 'horizontal'} ${paperClass}`}>

      {/* チャンク化・仮想化されたエディタ本体 */}
      <div className={`chunks-container ${paperClass}`} style={{ 
        height: settings.isVertical ? '100%' : `${debouncedLineCount * baseMetrics.cell + (metrics.padding * 2)}px`,
        width: settings.isVertical ? `${debouncedLineCount * baseMetrics.cell + (metrics.padding * 2)}px` : '100%',
        padding: `${metrics.padding}px`,
        minHeight: '100%',
        position: 'relative',
        zIndex: 1, // 入力レイヤーを前面に
        pointerEvents: 'auto',
        '--cell': `${metrics.cell}px`,
        '--ls-half': `${metrics.letterSpacing / 2}px`,
        '--grid-offset-x': '3px',
        '--grid-offset-y': '2px'
      }}>
        {/* 共通描画ラッパー：すべてのレイヤーを一つのオフセット空間に閉じ込める */}
        <div className="chunks-content-root">
          {/* 背景グリッド専用レイヤー (最背面) */}
          {!isCleanMode && (
            <div className={`editor-grid-layer ${paperClass}`} style={{
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 0,
              pointerEvents: 'none'
            }} />
          )}

          {/* Underlay: Moved inside container for better synchronization */}
          {!isCleanMode && (
            <div className="editor-underlay" style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 1, // グリッドとテキストの間
              pointerEvents: 'none',
              writingMode: settings.isVertical ? 'vertical-rl' : 'horizontal-tb',
              fontFamily: `${settings.fontFamily || 'var(--font-mincho)'}, serif`,
              letterSpacing: `${metrics.letterSpacing}px`,
              lineHeight: `${metrics.cell}px`,
              fontSize: `${metrics.fontSize}px`,
              fontVariantEastAsian: 'full-width',
              fontVariantLigatures: 'none',
              fontKerning: 'none',
              textAutospace: 'no-autospace',
              textSpacingTrim: 'space-all',
              fontFeatureSettings: settings.isVertical ? '"palt" 0, "halt" 0, "kern" 0, "vkrn" 0, "chws" 0, "liga" 0, "clig" 0, "calt" 0, "vert" 1, "vrt2" 1' : '"palt" 0, "halt" 0, "kern" 0, "vkrn" 0, "chws" 0, "liga" 0, "clig" 0, "calt" 0, "vert" 0, "vrt2" 0',
            }}>
              {highlightElements}
              
              {/* ゴーストハイライト (AI補完) */}
              {ghostHighlights.map((h) => (
                <div key={h.key} style={{
                  position: 'absolute',
                  right: settings.isVertical ? `${-h.x}px` : 'auto',
                  left: settings.isVertical ? 'auto' : `${h.x}px`,
                  top: `${h.y}px`,
                  width: `${metrics.cell}px`,
                  height: `${metrics.cell}px`,
                  color: 'rgba(100, 100, 100, 0.4)',
                  pointerEvents: 'none',
                  fontSize: `${metrics.fontSize}px`,
                  textAlign: 'start'
                }}>
                  {h.char}
                </div>
              ))}

              {/* 校正ハイライト (赤背景) */}
              {correctionHighlights.map((h) => (
                <div key={h.key} style={{
                  position: 'absolute',
                  right: settings.isVertical ? `${-h.x}px` : 'auto',
                  left: settings.isVertical ? 'auto' : `${h.x}px`,
                  top: `${h.y}px`,
                  width: `${metrics.cell}px`,
                  height: `${metrics.cell}px`,
                  backgroundColor: 'rgba(255, 0, 0, 0.2)',
                  borderBottom: '2px solid red',
                  pointerEvents: 'none',
                  cursor: 'help'
                }} title="校正の提案"/>
              ))}
            </div>
          )}

        {visibleChunks.map((chunk) => {
          const idx = chunks.indexOf(chunk);
          return (
            <ChunkEditor
              key={`${chunk.id}-${settings.isVertical ? 'v' : 'h'}`}
              chunk={chunk}
              idx={idx}
              isVertical={settings.isVertical}
              baseMetrics={baseMetrics}
              paperClass={paperClass}
              textareaStyle={textareaStyle}
              ghostText={ghostText}
              handleChunkChange={handleChunkChange}
              setGhostText={setGhostText}
              undoKeyDown={undoKeyDown}
              handleCursor={handleCursor}
              handleChange={handleChange}
              handleCompositionStart={handleCompositionStart}
              handleCompositionEnd={handleCompositionEnd}
              handleCopy={handleCopy}
              handleCut={handleCut}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              setEditorContextMenu={setEditorContextMenu}
              textareaRefs={textareaRefs}
              textareaRef={textareaRef}
              toVerticalDisplay={toVerticalDisplay}
              chunks={chunks}
            />
          );
        })}
        </div>
      </div>

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
                      const ta = textareaRefs.current[editorContextMenu.chunkIdx];
                      if (!ta) return;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const rawValue = settings.isVertical ? fromVerticalDisplay(ta.value) : ta.value;
                      const selected = rawValue.substring(start, end);
                      const wrapped = `{font:${f.name}}${selected}{/font}`;
                      const newVal = rawValue.substring(0, start) + wrapped + rawValue.substring(end);
                      
                      const oldFull = localTextRef.current;
                      handleChunkChange(editorContextMenu.chunkIdx, newVal);
                      const newFull = localTextRef.current;
                      
                      const globalPos = (chunks[editorContextMenu.chunkIdx]?.startOffset || 0) + start;
                      pushHistory(oldFull, newFull, globalPos + wrapped.length);
                      
                      setEditorContextMenu(null);
                    }}>
                      {f.label}
                    </div>
                  ))}
                  <div style={{ height: '1px', background: 'var(--border-color, #eee)', margin: '4px 0' }}></div>
                  <div className="context-menu-item" onClick={() => {
                    const ta = textareaRefs.current[editorContextMenu.chunkIdx];
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const rawValue = settings.isVertical ? fromVerticalDisplay(ta.value) : ta.value;
                    const selected = rawValue.substring(start, end);
                    const cleaned = selected.replace(/\{font[:：][^}]*\}/g, '').replace(/\{\/font\}/g, '');
                    const newVal = rawValue.substring(0, start) + cleaned + rawValue.substring(end);

                    const oldFull = localTextRef.current;
                    handleChunkChange(editorContextMenu.chunkIdx, newVal);
                    const newFull = localTextRef.current;
                    
                    const globalPos = (chunks[editorContextMenu.chunkIdx]?.startOffset || 0) + start;
                    pushHistory(oldFull, newFull, globalPos + cleaned.length);

                    setEditorContextMenu(null);
                  }}>
                    ❌ フォント解除
                  </div>
                </div>
              </div>
              <div style={{ height: '1px', background: 'var(--border-color, #eee)', margin: '4px 0' }}></div>
              <div className="context-menu-item" onClick={() => {
                const ta = textareaRefs.current[editorContextMenu.chunkIdx];
                if (ta) {
                  const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd);
                  const original = settings.isVertical ? fromVerticalDisplay(selected) : selected;
                  addToClipboard(original);
                  navigator.clipboard.writeText(original).catch(() => {});
                  
                  const cursorPos = ta.selectionStart;
                  const before = ta.value.substring(0, cursorPos);
                  const after = ta.value.substring(ta.selectionEnd);
                  const newVal = before + after;
                  
                  const oldFull = localTextRef.current;
                  handleChunkChange(editorContextMenu.chunkIdx, newVal);
                  const newFull = localTextRef.current;

                  const globalPos = (chunks[editorContextMenu.chunkIdx]?.startOffset || 0) + cursorPos;
                  pushHistory(oldFull, newFull, globalPos);
                }
                setEditorContextMenu(null);
              }}>
                ✂️ 切り取り
              </div>
              <div className="context-menu-item" onClick={() => {
                const ta = textareaRefs.current[editorContextMenu.chunkIdx];
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
            const ta = textareaRefs.current[editorContextMenu.chunkIdx];
            if (!ta) { setEditorContextMenu(null); return; }
            navigator.clipboard.readText().then(text => {
              if (!text) { setEditorContextMenu(null); return; }
              const start = ta.selectionStart;
              const end = ta.selectionEnd;
              const currentVal = ta.value;
              const rawVal = settings.isVertical ? fromVerticalDisplay(currentVal) : currentVal;
              const newValue = rawVal.substring(0, start) + text + rawVal.substring(end);
              
              const oldFull = localTextRef.current;
              handleChunkChange(editorContextMenu.chunkIdx, newValue);
              const newFull = localTextRef.current;

              const globalPos = (chunks[editorContextMenu.chunkIdx]?.startOffset || 0) + start;
              pushHistory(oldFull, newFull, globalPos + text.length);
              
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

      {/* Lag Monitor Overlay */}
      <div style={{
        position: 'fixed',
        bottom: '40px',
        right: '250px',
        background: 'rgba(0,0,0,0.7)',
        color: '#0f0',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 100000,
        pointerEvents: 'none',
        display: 'flex',
        gap: '10px'
      }}>
        <span>JS: {lagStats.jsTime.toFixed(1)}ms</span>
        <span>Total: {lagStats.totalTime.toFixed(1)}ms</span>
      </div>

    </div>
  );
});

Editor.displayName = 'Editor';
const MemoEditor = React.memo(Editor);
MemoEditor.displayName = 'Editor';
export default MemoEditor;
