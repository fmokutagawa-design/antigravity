import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import ReactDOM from 'react-dom';
import '../index.css';
import { toVerticalDisplay, fromVerticalDisplay } from '../utils/verticalPunctuation';
import { useUndoHistory } from '../hooks/useUndoHistory';
import SelectionToolbar from './SelectionToolbar';

const splitString = (str) => Array.from(str || "");

/**
 * 禁則処理付きの文字位置計算
 * グリッド座標とテキスト折り返しを完全に同期させる。
 */
function computeCharPositions(charArray, maxPerLine, startLine = 0) {
  const positions = new Array(charArray.length);
  let line = startLine;
  let pos = 0;
  for (let i = 0; i < charArray.length; i++) {
    const char = charArray[i];
    if (char === '\n') {
      positions[i] = null;
      line++;
      pos = 0;
      continue;
    }
    if (pos >= maxPerLine) {
      line++;
      pos = 0;
    }
    positions[i] = { line, pos };
    pos++;
  }
  return { positions, totalLines: line + 1 };
}

/**
 * Editor Component
 */
const Editor = forwardRef(({
  value,
  onChange,
  settings,
  onCursorStats,
  onImageDrop,
  onInsertRuby,
  onInsertLink,
  onContextMenu,
  allFiles = [],
  corrections = [],
  ghostText = '',
  setGhostText
}, ref) => {
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const viewportRef = useRef({ scrollTop: 0, scrollLeft: 0, height: 800, width: 1000 });

  // 全文をメモリ上に保持（Reactのstateには載せない）
  const fullTextRef = useRef(value);

  // 窓の位置（全文上のバイトオフセット）
  const windowRef = useRef({ start: 0, end: Math.min(30000, value.length) });

  // 各種 Ref (内部状態・タイマー)
  const isComposingRef = useRef(false);
  const compositionTextRef = useRef(null);
  const appNotifyTimerRef = useRef(null);
  const highlightDebounceRef = useRef(null);
  const debouncePrevLenRef = useRef(value.length);
  const isProcessingPropValueRef = useRef(false);
  const scrollTimerRef = useRef(null);
  const initialScrollDoneRef = useRef(false);

  // ステート
  const [scrollForce, setScrollForce] = useState(0);
  const [debouncedValue, setDebouncedValue] = useState(value.slice(0, Math.min(30000, value.length)));
  const [editorContextMenu, setEditorContextMenu] = useState(null);
  const [selectionToolbar, setSelectionToolbar] = useState({ visible: false, position: { x: 0, y: 0 }, text: '' });

  // 履歴管理
  const { initHistory, pushHistory, undo, redo, handleKeyDown } = useUndoHistory((newText) => {
    fullTextRef.current = newText;
    const { start } = windowRef.current;
    const windowText = newText.slice(start, start + 30000);
    const ta = textareaRef.current;
    if (ta) {
      ta.value = settings.isVertical ? toVerticalDisplay(windowText) : windowText;
      setDebouncedValue(windowText);
    }
    onChange(newText);
  });

  // 窓をスライドする関数
  const slideWindow = useCallback((cursorPosInFull) => {
    if (isComposingRef.current) return;
    const full = fullTextRef.current;
    const HALF = 15000;
    const newStart = Math.max(0, cursorPosInFull - HALF);
    const newEnd = Math.min(full.length, newStart + 30000);
    const windowText = full.slice(newStart, newEnd);

    const ta = textareaRef.current;
    if (!ta) return;
    const cursorInWindow = cursorPosInFull - newStart;
    ta.value = settings.isVertical ? toVerticalDisplay(windowText) : windowText;
    ta.setSelectionRange(cursorInWindow, cursorInWindow);
    windowRef.current = { start: newStart, end: newEnd };

    setDebouncedValue(windowText);
    setScrollForce(f => f + 1);

  }, [settings.isVertical]);

  const handleContainerScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    viewportRef.current = {
      scrollTop: container.scrollTop,
      scrollLeft: container.scrollLeft,
      height: container.clientHeight,
      width: container.clientWidth,
    };
    setScrollForce(f => f + 1);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      const full = fullTextRef.current;
      if (full.length <= 30000) return;
      const isVert = settings.isVertical;
      const scrollPos = isVert
        ? container.scrollLeft
        : container.scrollTop;
      const scrollMax = isVert
        ? container.scrollWidth - container.clientWidth
        : container.scrollHeight - container.clientHeight;
      if (scrollMax <= 0) return;
      const proportion = isVert
        ? 1 - scrollPos / scrollMax
        : scrollPos / scrollMax;
      const estimatedCenter = Math.floor(proportion * full.length);
      const { start } = windowRef.current;
      if (Math.abs(estimatedCenter - (start + 15000)) > 5000) {
        const newStart = Math.max(0, estimatedCenter - 15000);
        const newEnd = Math.min(full.length, newStart + 30000);
        const windowText = full.slice(newStart, newEnd);
        const ta = textareaRef.current;
        if (ta) {
          ta.value = isVert
            ? toVerticalDisplay(windowText)
            : windowText;
          windowRef.current = { start: newStart, end: newEnd };
          // ※ setDebouncedValue は呼ばない（ファイル破壊防止）
          setScrollForce(f => f + 1);
        }
      }
    }, 300);
  }, [settings.isVertical]);

  const baseMetrics = useMemo(() => {
    const fontSize = settings.fontSize || 18;
    const isManuscript = settings.paperStyle === 'grid';
    const lineHeightRatio = isManuscript
      ? (settings.lineHeight || 1.65)
      : (settings.charSpacing || 1.4);
    const cell = Math.floor(fontSize * lineHeightRatio);
    const padding = 40;
    const containerEl = containerRef.current;
    const availableH = containerEl ? containerEl.clientHeight - padding * 2 : 600;
    const availableW = containerEl ? containerEl.clientWidth - padding * 2 : 800;
    const isVert = settings.isVertical;
    const maxPerLine = settings.charsPerLine ||
      Math.floor((isVert ? availableH : availableW) / cell) || 20;
    const cols = isVert ? Math.ceil(400 / maxPerLine) + 2 : maxPerLine;
    const rows = isVert ? maxPerLine : Math.ceil(400 / maxPerLine) + 2;
    const gridW = cols * cell;
    const gridH = rows * cell;
    return { fontSize, cell, maxPerLine, padding, letterSpacing: cell - fontSize, cols, rows, gridW, gridH };
  }, [settings.fontSize, settings.lineHeight, settings.paperStyle, settings.charSpacing,
      settings.isVertical, settings.charsPerLine, scrollForce]);

  const paragraphIndex = useMemo(() => {
    const text = debouncedValue;
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    let currentLine = 0;
    return lines.map((lineText, idx) => {
      const charArray = splitString(lineText + (idx < lines.length - 1 ? '\n' : ''));
      const { totalLines } = computeCharPositions(charArray, baseMetrics.maxPerLine);
      const entry = {
        id: idx,
        text: lineText,
        charArray,
        startLine: currentLine,
        lineCount: totalLines
      };
      currentLine += totalLines;
      return entry;
    });
  }, [debouncedValue, baseMetrics.maxPerLine]);

  const totalLineCount = useMemo(() => {
    const windowLines = paragraphIndex.reduce((sum, p) => sum + p.lineCount, 0);
    const windowLen = windowRef.current.end - windowRef.current.start;
    const fullLen = fullTextRef.current.length;
    if (windowLen <= 0 || windowLines <= 0) return 50;
    return Math.ceil(windowLines * fullLen / windowLen) + 20;
  }, [paragraphIndex]);

  const textareaStyle = useMemo(() => ({
    fontFamily: `${settings.fontFamily || 'var(--font-mincho)'}, serif`,
    fontSize: `${baseMetrics.fontSize}px`,
    lineHeight: `${baseMetrics.cell}px`,
    letterSpacing: `${baseMetrics.letterSpacing}px`,
    padding: 0,
    border: 'none',
    outline: 'none',
    color: 'var(--text-main)',
    caretColor: 'var(--text-main)',
    width: settings.isVertical
      ? `${totalLineCount * baseMetrics.cell + 2}px`
      : '100%',
    height: settings.isVertical
      ? `${baseMetrics.maxPerLine * baseMetrics.cell + 2}px`
      : `${totalLineCount * baseMetrics.cell + 2}px`,
    position: 'relative',
    zIndex: 2,
    pointerEvents: 'auto',
    writingMode: settings.isVertical ? 'vertical-rl' : 'horizontal-tb',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    overflow: 'hidden',
    fontVariantEastAsian: 'full-width',
    fontVariantLigatures: 'none',
    fontKerning: 'none',
    textAutospace: 'no-autospace',
    textSpacingTrim: 'space-all',
    fontFeatureSettings: settings.isVertical ? '"palt" 0, "halt" 0, "kern" 0, "vkrn" 0, "chws" 0, "liga" 0, "clig" 0, "calt" 0, "vert" 1, "vrt2" 1' : '"palt" 0, "halt" 0, "kern" 0, "vkrn" 0, "chws" 0, "liga" 0, "clig" 0, "calt" 0, "vert" 0, "vrt2" 0',
  }), [settings.fontFamily, baseMetrics, settings.isVertical, settings.paperStyle, totalLineCount]);



  const charPositionsCache = useMemo(() => {
    if (paragraphIndex.length === 0) return { visibleParagraphs: [] };
    const { cell } = baseMetrics;
    const isVert = settings.isVertical;
    const vp = viewportRef.current;
    const viewportSize = isVert ? vp.width : vp.height;
    const scrollPos = isVert
      ? (baseMetrics.padding + totalLineCount * baseMetrics.cell - vp.scrollLeft - vp.width)
      : vp.scrollTop;
    const startVisibleLine = Math.floor(scrollPos / cell) - 10;
    const endVisibleLine = Math.ceil((scrollPos + viewportSize) / cell) + 10;

    const fullLen = fullTextRef.current.length;
    const wsl = (fullLen > 0 && totalLineCount > 0)
      ? Math.round((windowRef.current.start / fullLen) * totalLineCount)
      : 0;
    const adjStart = startVisibleLine - wsl;
    const adjEnd = endVisibleLine - wsl;
    const visibleParagraphs = paragraphIndex.filter(
      p => (p.startLine + p.lineCount) >= adjStart && p.startLine <= adjEnd
    );
    return { visibleParagraphs, wsl };
  }, [paragraphIndex, scrollForce, baseMetrics, settings.isVertical, totalLineCount]);

  const highlights = useMemo(() => {
    if (!charPositionsCache.visibleParagraphs.length) return [];
    const { cell } = baseMetrics;
    const isVert = settings.isVertical;
    const patterns = [
      { regex: /[[［［].*?[\]］］]/g, color: settings.syntaxColors?.link || '#2980b9' },
      { regex: /『.*?』/g, color: settings.syntaxColors?.emphasis || '#c0392b' },
      { regex: /「.*?」/g, color: settings.syntaxColors?.conversation || '#27ae60' },
      { regex: /《.*?》/g, color: settings.syntaxColors?.ruby || '#e67e22' },
      { regex: /［＃.*?］/g, color: settings.syntaxColors?.aozora || '#8e44ad' },
    ];
    const list = [];
    const fullLen = fullTextRef.current.length;
    const wsl = (fullLen > 0 && totalLineCount > 0)
      ? Math.round((windowRef.current.start / fullLen) * totalLineCount)
      : 0;

    charPositionsCache.visibleParagraphs.forEach(p => {
      const pPositions = computeCharPositions(p.charArray, baseMetrics.maxPerLine, p.startLine).positions;
      patterns.forEach(({ regex, color }) => {
        let match; regex.lastIndex = 0;
        while ((match = regex.exec(p.text)) !== null) {
          const pStartIdx = splitString(p.text.substring(0, match.index)).length;
          const pMatchLen = splitString(match[0]).length;
          for (let i = 0; i < pMatchLen; i++) {
            const pCoord = pPositions[pStartIdx + i];
            if (pCoord) {
              const blockStart = (pCoord.line + wsl) * cell;
              const inlineStart = pCoord.pos * cell;
              list.push({ key: `h-${windowRef.current.start}-${p.id}-${match.index}-${i}`, blockStart, inlineStart, color });
            }
          }
        }
      });
    });
    return list;
  }, [charPositionsCache, baseMetrics, settings.isVertical, settings.syntaxColors, totalLineCount]);

  // Props からの同期
  useEffect(() => {
    if (Math.abs(value.length - fullTextRef.current.length) > 100) {
      if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
      isProcessingPropValueRef.current = true;
      fullTextRef.current = value;
      const newEnd = Math.min(30000, value.length);
      windowRef.current = { start: 0, end: newEnd };
      const windowText = value.slice(0, newEnd);
      if (textareaRef.current) {
        textareaRef.current.value = settings.isVertical ? toVerticalDisplay(windowText) : windowText;
      }
      setDebouncedValue(windowText);
      initHistory(value);
      setTimeout(() => { isProcessingPropValueRef.current = false; }, 0);
    }
  }, [value, initHistory, settings.isVertical]);

  useLayoutEffect(() => {
    if (settings.isVertical && containerRef.current && !initialScrollDoneRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
      initialScrollDoneRef.current = true;
    }
  }, [settings.isVertical]);

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        viewportRef.current = {
          scrollTop: containerRef.current.scrollTop,
          scrollLeft: containerRef.current.scrollLeft,
          height: containerRef.current.clientHeight,
          width: containerRef.current.clientWidth,
        };
      }
      setScrollForce(f => f + 1);
    }, 150);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e) => {
      if (!settings.isVertical) return;
      e.preventDefault();
      container.scrollLeft -= e.deltaY;
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [settings.isVertical]);

  const handleInput = useCallback((e) => {
    if (isComposingRef.current) return;
    const ta = e.target;
    const rawVal = ta.value;
    const windowText = settings.isVertical ? fromVerticalDisplay(rawVal) : rawVal;
    const { start } = windowRef.current;
    const oldEnd = windowRef.current.end;

    const oldFull = fullTextRef.current;
    fullTextRef.current = oldFull.slice(0, start) + windowText + oldFull.slice(oldEnd);
    windowRef.current.end = start + windowText.length;

    const globalCursor = start + ta.selectionStart;
    pushHistory(oldFull, fullTextRef.current, globalCursor);

    if (highlightDebounceRef.current) clearTimeout(highlightDebounceRef.current);
    if (Math.abs(windowText.length - (debouncePrevLenRef.current || 0)) < 2) {
      setDebouncedValue(windowText);
      debouncePrevLenRef.current = windowText.length;
    } else {
      highlightDebounceRef.current = setTimeout(() => {
        setDebouncedValue(windowText);
        debouncePrevLenRef.current = windowText.length;
      }, 100);
    }

    if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
    appNotifyTimerRef.current = setTimeout(() => {
      if (!isProcessingPropValueRef.current) onChange(fullTextRef.current);
    }, 500);

    const cursorInWindow = ta.selectionStart;
    if (cursorInWindow < 5000 || cursorInWindow > windowText.length - 5000) {
      slideWindow(start + cursorInWindow);
    }
  }, [settings.isVertical, slideWindow, onChange, pushHistory]);

  const handleCursor = (e) => {
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
    if (onCursorStats && textareaRef.current) {
      onCursorStats({
        start: textareaRef.current.selectionStart + windowRef.current.start,
        end: textareaRef.current.selectionEnd + windowRef.current.start,
        total: fullTextRef.current.length
      });
    }
  };

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
    compositionTextRef.current = fullTextRef.current;
  }, []);

  const handleCompositionEnd = useCallback((e) => {
    isComposingRef.current = false;
    const ta = e.target;
    const raw = ta.value;
    const windowText = settings.isVertical ? fromVerticalDisplay(raw) : raw;
    const { start, end } = windowRef.current;
    fullTextRef.current = fullTextRef.current.slice(0, start) + windowText + fullTextRef.current.slice(end);
    windowRef.current.end = start + windowText.length;
    const globalCursor = start + ta.selectionStart;
    pushHistory(compositionTextRef.current ?? fullTextRef.current, fullTextRef.current, globalCursor);
    compositionTextRef.current = null;
    setDebouncedValue(windowText);
    if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
    appNotifyTimerRef.current = setTimeout(() => {
      if (!isProcessingPropValueRef.current) onChange(fullTextRef.current);
    }, 500);
  }, [settings.isVertical, onChange, pushHistory]);

  useImperativeHandle(ref, () => ({
    textareaRef,
    getFullText: () => fullTextRef.current,
    jumpToOffset: (offset) => slideWindow(offset),
    insertText: (text) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const newVal = ta.value.substring(0, start) + text + ta.value.substring(ta.selectionEnd);
      ta.value = newVal;
      handleInput({ target: ta });
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    }
  }));

  const paperClass = settings.paperStyle === 'grid'
    ? 'paper-manuscript'
    : settings.paperStyle === 'clean'
      ? 'paper-clean'
      : settings.paperStyle === 'lined'
        ? 'paper-lined'
        : 'paper-plain';
  const isCleanMode = settings.paperStyle === 'clean';

  return (
    <div className="editor-root" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: 'var(--bg-paper)' }}>
      <div 
        ref={containerRef}
        onScroll={handleContainerScroll}
        className={`chunks-container ${paperClass}`} 
        style={{ 
          flex: 1, 
          overflowX: settings.isVertical ? 'auto' : 'hidden',
          overflowY: settings.isVertical ? 'hidden' : 'auto',
          padding: `${baseMetrics.padding}px`, 
          position: 'relative', 
          '--cell': `${baseMetrics.cell}px`,
          '--grid-offset-x': '3px',
          '--grid-offset-y': '2px'
        }}
      >
        <div className="chunks-content-root" style={{ position: 'relative', width: settings.isVertical ? `${totalLineCount * baseMetrics.cell + baseMetrics.padding * 2 + 2}px` : '100%', height: settings.isVertical ? `${baseMetrics.maxPerLine * baseMetrics.cell + baseMetrics.padding * 2 + 2}px` : 'auto', minHeight: '100%' }}>
          {!isCleanMode && <div className={`editor-grid-layer ${paperClass}`} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' }} />}
          {!isCleanMode && (
            <div className="editor-underlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3, transform: 'none', pointerEvents: 'none', writingMode: settings.isVertical ? 'vertical-rl' : 'horizontal-tb', fontSize: `${baseMetrics.fontSize}px`, lineHeight: `${baseMetrics.cell}px`, letterSpacing: `${baseMetrics.letterSpacing}px`, fontFamily: settings.fontFamily, color: 'transparent' }}>
              {highlights.map(h => (
                <div key={h.key} style={{ 
                  position: 'absolute', 
                  ...(settings.isVertical
                    ? { right: `${h.blockStart}px`, top: `${h.inlineStart}px` }
                    : { left: `${h.inlineStart}px`, top: `${h.blockStart}px` }
                  ),
                  width: `${baseMetrics.cell}px`, 
                  height: `${baseMetrics.cell}px`, 
                  background: h.color, 
                  opacity: 0.35, 
                  borderRadius: '2px', 
                  pointerEvents: 'none' 
                }} />
              ))}
            </div>
          )}
          <textarea
            lang="ja"
            ref={textareaRef}
            className={`native-grid-editor ${paperClass}`}
            defaultValue={settings.isVertical ? toVerticalDisplay(fullTextRef.current.slice(0, Math.min(30000, fullTextRef.current.length))) : fullTextRef.current.slice(0, Math.min(30000, fullTextRef.current.length))}
            onInput={handleInput}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onScroll={handleCursor}
            onSelect={handleCursor}
            onClick={handleCursor}
            onKeyUp={handleCursor}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                e.preventDefault();
                const ta = textareaRef.current;
                if (!ta) return;
                const full = fullTextRef.current;
                ta.value = settings.isVertical ? toVerticalDisplay(full) : full;
                windowRef.current = { start: 0, end: full.length };
                ta.select();
                setDebouncedValue(full);
                return;
              }
              handleKeyDown(e);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setEditorContextMenu({ x: e.clientX, y: e.clientY });
            }}
            spellCheck={false}
            style={textareaStyle}
          />
        </div>
      </div>
      {editorContextMenu && ReactDOM.createPortal(
        <div className="context-menu" style={{ position: 'fixed', left: editorContextMenu.x, top: editorContextMenu.y, zIndex: 100000 }} onMouseLeave={() => setEditorContextMenu(null)}>
          <div className="context-menu-item" onClick={() => {
            const ta = textareaRef.current;
            if (ta) {
              const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd);
              navigator.clipboard.writeText(settings.isVertical ? fromVerticalDisplay(selected) : selected);
            }
            setEditorContextMenu(null);
          }}>📋 コピー</div>
          <div className="context-menu-item" onClick={() => { setEditorContextMenu(null); textareaRef.current.focus(); }}>📌 貼り付け</div>
        </div>,
        document.body
      )}
      {ReactDOM.createPortal(
        <SelectionToolbar
          visible={selectionToolbar.visible}
          position={selectionToolbar.position}
          text={selectionToolbar.text}
          onClose={() => setSelectionToolbar({ ...selectionToolbar, visible: false })}
        />,
        document.body
      )}
    </div>
  );
});

Editor.displayName = 'Editor';
export default Editor;
