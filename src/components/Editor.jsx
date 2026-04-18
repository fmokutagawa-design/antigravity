import React, { useRef, useImperativeHandle, forwardRef, useMemo, useEffect, useCallback, useLayoutEffect, useState } from 'react';
import '../index.css';
// ★ 約物フィルターを無効化したい場合、この import をコメントアウトしてください
import { toVerticalDisplay, fromVerticalDisplay } from '../utils/verticalPunctuation';
import { useUndoHistory } from '../hooks/useUndoHistory';
import { useClipboardHistory } from '../hooks/useClipboardHistory';
import PositionWorker from '../utils/positionWorker?worker';
import { textToDocument, documentToText, updateDocument } from '../utils/documentModel';


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

const Editor = forwardRef(({ value, onChange, onCursorStats, settings, onInsertRuby, onInsertLink, onLaunchAI, ghostText, setGhostText, corrections = [], onImageDrop, fileId = '' }, ref) => {
  const textareaRef = useRef(null);
  const [editorContextMenu, setEditorContextMenu] = React.useState(null);

  // ★ IME（日本語入力）変換中フラグ
  // composition 中は React の state 更新をスキップし、IME バッファを破壊しない
  const isComposingRef = useRef(false);
  const compositionTextRef = useRef(null); // composition 開始前のテキストを保持

  // ★ パフォーマンス根治: ローカルテキスト状態
  // タイピング時は localDocument のみ更新（Editor 内部の再レンダリングだけ）
  // App への通知（onChange）は 500ms デバウンスで行い、App の再レンダリングを回避
  //
  // ★ 文書モデル化：内部では段落配列（localDocument）を正として保持する。
  //    localText は localDocument から派生する読み取り専用の値。
  //    外部（App.jsx）とのインターフェースは従来どおり文字列のまま変わらない。
  const [localDocument, setLocalDocument] = useState(() => textToDocument(value));
  const localText = useMemo(() => documentToText(localDocument), [localDocument]);
  const appNotifyTimerRef = useRef(null);
  const localTextRef = useRef(localText); // ★ composition ハンドラ用（deps から localText を除外するため）
  localTextRef.current = localText;
  const localDocumentRef = useRef(localDocument); // ★ handleChange 内で最新の localDocument を参照するため
  localDocumentRef.current = localDocument;

  // ★ 外部からの value 変更（フォーマット適用・AI補完・検索置換等）を同期
  //    Editor → App → Editor の往復で value が debounce 遅延つきで戻ってくるため、
  //    localText と value が一致している場合は何もしない（カーソル位置を守る）。
  //    ファイル切替は fileId の useEffect で処理するため、ここでは扱わない。
  const prevValueRef2 = useRef(value);
  useEffect(() => {
    const prev = prevValueRef2.current;
    prevValueRef2.current = value;
    // localText と value が既に一致していれば往復なので無視
    if (value === localTextRef.current) return;
    // prev と value が同じであれば変化なし
    if (value === prev) return;
    // 外部から意図的に書き換えられた → 確実に反映する
    setLocalDocument(textToDocument(value));
  }, [value]);

  // --- Undo/Redo スタック ---
  const localOnChange = useCallback((newText) => {
    // ローカル状態を即座に更新（文書モデルとして保持）
    setLocalDocument(textToDocument(newText));
    // App への通知はデバウンス（500ms）
    if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
    appNotifyTimerRef.current = setTimeout(() => {
      onChange(newText);
    }, 500);
  }, [onChange]);

  const { initHistory, pushHistory, undo, redo, handleKeyDown: undoKeyDown, pendingCursor: pendingCursorRef, currentCursor: currentCursorRef } = useUndoHistory(localOnChange);
  // --- クリップボード履歴 ---
  const { clipboardHistory, addToClipboard } = useClipboardHistory();

  // カーソル位置を追跡するref（全てのonChange呼び出しで更新）
  const nextCursorPos = useRef(null);

  // ファイル切替時: localText・undo履歴・debounce タイマーを確実にリセット
  // value ではなく fileId を監視することで「編集中の往復」と「ファイル切替」を明確に分離する
  useEffect(() => {
    // App から渡された最新テキストで localDocument を強制上書き
    setLocalDocument(textToDocument(value));
    // undo/redo 履歴を新ファイルで初期化（前ファイルの履歴混入を防ぐ）
    initHistory(value);
    // 進行中の App 通知タイマーをキャンセル（前ファイルの内容を App に送らない）
    if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
    // カーソル位置リセット
    nextCursorPos.current = null;
  }, [fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // React再レンダリング直後にカーソル位置を復元（useLayoutEffectでペイント前に実行）
  // ★ IME 変換中はカーソル復元をスキップ（変換カーソルを破壊しないため）
  useLayoutEffect(() => {
    if (isComposingRef.current) return;
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

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
    };
  }, []);

  // ファイル切替時にdebouncedValueをリセットし、Worker の古い計算結果が適用されないようにする。
  // ① charPositionsCache を即座に空にして前ファイルの着色を消去
  // ② positionsReqIdRef をインクリメントして飛行中の Worker 結果を無効化
  // ③ debouncedValue を新ファイルの内容で上書き（Worker が正しいテキストで再計算するように）
  // localText ではなく value を参照（fileId useEffect で setLocalText が走る前に読む可能性があるため）
  useEffect(() => {
    positionsReqIdRef.current += 1;
    lineCountReqIdRef.current += 1;
    setCharPositionsCache({ positions: [], charArray: [], utf16ToCharIdx: new Map() });
    setDebouncedValue(value);
  }, [fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ファイル切替・縦横切替時の初期スクロール（文頭＝縦書き右端へ）
  useEffect(() => {
    const container = textareaRef.current?.closest('.editor-container');
    if (!container) return;
    if (settings.isVertical) {
      let attempts = 0;
      const tryScroll = () => {
        if (container.scrollWidth > container.clientWidth) {
          container.scrollLeft = container.scrollWidth;
        } else if (attempts < 10) {
          attempts++;
          setTimeout(tryScroll, 50);
        }
      };
      setTimeout(tryScroll, 50);
    } else {
      container.scrollTop = 0;
      container.scrollLeft = 0;
    }
  }, [fileId, settings.isVertical]);


  const splitString = (str) => Array.from(str || "");

  // --- パフォーマンス最適化: ハイライト用デバウンス（ローカルテキストベース）---
  const [debouncedValue, setDebouncedValue] = useState(localText);
  const debouncePrevLenRef = useRef(localText.length);

  useEffect(() => {
    debouncePrevLenRef.current = localText.length;
    const timer = setTimeout(() => setDebouncedValue(localText), 300);
    return () => clearTimeout(timer);
  }, [localText]);

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

  // --- 共有 Web Worker（lineCount / positions を1つのWorkerで処理） ---
  const workerRef = useRef(null);
  const lineCountReqIdRef = useRef(0);
  const positionsReqIdRef = useRef(0);

  // debouncedDocument（800ms 遅延）を監視
  const [debouncedDocument, setDebouncedDocument] = useState(localDocument);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDocument(localDocument), 800);
    return () => clearTimeout(timer);
  }, [localDocument]);

  const debouncedDocumentRef = useRef(debouncedDocument);
  useEffect(() => { debouncedDocumentRef.current = debouncedDocument; }, [debouncedDocument]);

  // ★ 文書モデル化：段落ごとの座標キャッシュ（paraId → { positions, charArray, utf16ToCharIdx }）
  // 変更された段落だけ Worker に投げて更新し、変わっていない段落は再計算しない。
  const [paraPosCache, setParaPosCache] = useState(new Map());
  const paraPosCacheRef = useRef(paraPosCache);
  useEffect(() => { paraPosCacheRef.current = paraPosCache; }, [paraPosCache]);

  const debouncedLineCount = useMemo(() => {
    if (!debouncedDocument || debouncedDocument.length === 0) return 10;
    const cached = [...paraPosCache.values()];
    if (cached.length === 0) {
      // キャッシュが空：文字数÷1行文字数で概算
      const approx = baseMetrics.maxPerLine > 0
        ? Math.ceil(localText.length / baseMetrics.maxPerLine)
        : 10;
      return Math.max(approx, 10);
    }
    const total = cached.reduce((sum, p) => sum + (p.totalLines || 1), 0);
    return Math.max(total, 10);
  }, [debouncedDocument, paraPosCache, baseMetrics.maxPerLine, localText]);

  const [charPositionsCache, setCharPositionsCache] = useState(
    () => ({ positions: [], charArray: [], utf16ToCharIdx: new Map() })
  );

  const paraPosReqIdRef = useRef(new Map()); // paraId → 最新リクエスト id

  // Worker の初期化（マウント時に一度だけ）
  useEffect(() => {
    const worker = new PositionWorker();
    workerRef.current = worker;
    worker.onmessage = (e) => {
      const { type, id } = e.data;
      if (type === 'lineCount') {
        // lineCount は現在使用していないため無視
      } else if (type === 'positions' && id === positionsReqIdRef.current) {
        // 全文モード（フォールバック・互換）
        const { positions, charArray, utf16ToCharIdxEntries, totalLines } = e.data;
        const utf16ToCharIdx = new Map(utf16ToCharIdxEntries);
        setCharPositionsCache({ positions, charArray, utf16ToCharIdx });
      } else if (type === 'para_positions') {
        // 段落単位モード：最新リクエストのみ反映
        const { paraId } = e.data;
        const latestId = paraPosReqIdRef.current.get(paraId);
        if (id !== latestId) return; // 古いリクエストは無視
        const { positions, charArray, utf16ToCharIdxEntries, totalLines } = e.data;
        const utf16ToCharIdx = new Map(utf16ToCharIdxEntries);
        setParaPosCache(prev => {
          const next = new Map(prev);
          next.set(paraId, { positions, charArray, utf16ToCharIdx, totalLines });
          return next;
        });
      }
    };
    return () => worker.terminate();
  }, []);

  // --- 1b. グリッド寸法（Worker で計算） ---

  const metrics = useMemo(() => {
    const { fontSize, cell, maxPerLine, padding, letterSpacing } = baseMetrics;
    const totalLines = debouncedLineCount;

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
  }, [debouncedLineCount, baseMetrics, settings.isVertical, settings.linesPerPage]);


  useEffect(() => {
    const doc = debouncedDocumentRef.current;
    if (!doc || doc.length === 0) {
      setParaPosCache(new Map());
      return;
    }
    if (!workerRef.current) return;

    // キャッシュにない段落のみ送信（setIntervalで間引く）
    const uncached = doc.filter(p => !paraPosCacheRef.current.has(p.id));
    if (uncached.length === 0) return;

    // 送信間隔を設けてWorkerのキューを詰まらせない
    const BATCH = 30; // 1回あたりの送信数
    const INTERVAL = 50; // ms間隔

    let lineOffset = 0;
    // lineOffsetの初期計算（キャッシュ済みの分）
    const offsetMap = new Map();
    let runningOffset = 0;
    doc.forEach(para => {
      offsetMap.set(para.id, runningOffset);
      runningOffset += paraPosCacheRef.current.get(para.id)?.totalLines || 1;
    });

    let batchIndex = 0;
    const timer = setInterval(() => {
      const currentDoc = debouncedDocumentRef.current;
      const batch = uncached.slice(batchIndex * BATCH, (batchIndex + 1) * BATCH);
      if (batch.length === 0) {
        clearInterval(timer);
        return;
      }
      batch.forEach(para => {
        const reqId = (paraPosReqIdRef.current.get(para.id) || 0) + 1;
        paraPosReqIdRef.current.set(para.id, reqId);
        workerRef.current.postMessage({
          type: 'para_positions',
          id: reqId,
          paraId: para.id,
          text: para.text,
          maxPerLine: baseMetrics.maxPerLine,
          lineOffset: offsetMap.get(para.id) || 0,
        });
      });
      batchIndex++;
    }, INTERVAL);

    return () => clearInterval(timer);
  }, [baseMetrics.maxPerLine]);

  // --- 段落キャッシュ → charPositionsCache への合成 ---
  // 全段落のキャッシュが揃ったら、全文の charPositionsCache を組み立てる。
  // 1段落でも未キャッシュがある場合は前の状態を維持（チラつき防止）。
  useEffect(() => {
    const doc = debouncedDocumentRef.current;
    if (!doc || doc.length === 0) {
      setCharPositionsCache({ positions: [], charArray: [], utf16ToCharIdx: new Map() });
      return;
    }

    const allPositions = [];
    const allCharArray = [];
    const utf16ToCharIdx = new Map();
    let utf16Offset = 0;
    let lineOffset = 0;

    doc.forEach((para, paraIdx) => {
      const cached = paraPosCacheRef.current.get(para.id);

      if (cached) {
        // キャッシュあり：正確な座標を使う
        cached.positions.forEach(pos => {
          allPositions.push(pos == null ? null : {
            ...pos,
            line: pos.line + lineOffset,
          });
        });
        cached.charArray.forEach((ch, i) => {
          allCharArray.push(ch);
          const utf16Len = ch.codePointAt(0) > 0xFFFF ? 2 : 1;
          for (let u = 0; u < utf16Len; u++) {
            utf16ToCharIdx.set(utf16Offset + u, allCharArray.length - 1);
          }
          utf16Offset += utf16Len;
        });
        lineOffset += cached.totalLines;
      } else {
        // キャッシュなし：1文字ずつ概算座標を生成
        const chars = [...para.text];
        chars.forEach((ch, i) => {
          const approxLine = lineOffset + Math.floor(i / (baseMetrics.maxPerLine || 20));
          allPositions.push({ x: 0, y: 0, line: approxLine, col: i % (baseMetrics.maxPerLine || 20) });
          allCharArray.push(ch);
          const utf16Len = ch.codePointAt(0) > 0xFFFF ? 2 : 1;
          for (let u = 0; u < utf16Len; u++) {
            utf16ToCharIdx.set(utf16Offset + u, allCharArray.length - 1);
          }
          utf16Offset += utf16Len;
        });
        lineOffset += Math.ceil(para.text.length / (baseMetrics.maxPerLine || 20)) || 1;
      }

      // 段落間の改行文字
      if (paraIdx < doc.length - 1) {
        allCharArray.push('\n');
        allPositions.push(null); // 改行文字の座標は null
        utf16ToCharIdx.set(utf16Offset, allCharArray.length - 1);
        utf16Offset += 1;
      }
    });

    setCharPositionsCache({ positions: allPositions, charArray: allCharArray, utf16ToCharIdx });
  }, [baseMetrics.maxPerLine]);

  // --- 2. アンダーレイ（座標マップ）の生成（デバウンス） ---
  // ★ 大規模テキスト（20000文字超≒原稿用紙100枚超）ではハイライトを自動停止
  const HIGHLIGHT_CHAR_LIMIT = 100000;
  const highlights = useMemo(() => {
    if (settings.editorSyntaxColors === false) return [];
    if (!debouncedValue) return [];
    if (debouncedValue.length > HIGHLIGHT_CHAR_LIMIT) return [];
    const { cell } = baseMetrics;
    const { positions, utf16ToCharIdx } = charPositionsCache;
    const isVert = settings.isVertical;

    const patterns = [
      { type: 'link',         regex: /\[\[.*?\]\]|［［.*?］］/g, color: settings.syntaxColors?.link || '#2980b9' },
      { type: 'emphasis',     regex: /『.*?』/g,                  color: settings.syntaxColors?.emphasis || '#c0392b' },
      { type: 'conversation', regex: /「.*?」/g,                  color: settings.syntaxColors?.conversation || '#27ae60', isConversation: true },
      { type: 'ruby',         regex: /《.*?》/g,                  color: settings.syntaxColors?.ruby || '#e67e22' },
      { type: 'aozora',       regex: /［＃.*?］/g,                color: settings.syntaxColors?.aozora || '#8e44ad' },
      { type: 'font',         regex: /\{font[:：].*?\}|\{\/font\}/g, color: settings.syntaxColors?.aozora || '#8e44ad' },
      { type: 'bold',         regex: /\*\*.*?\*\*/g,             color: settings.syntaxColors?.emphasis || '#c0392b' },
    ];

    const list = [];
    patterns.forEach(({ type, regex, color, isConversation }) => {
      let match;
      while ((match = regex.exec(debouncedValue)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;
        const visualStart = utf16ToCharIdx.get(matchStart) ?? splitString(debouncedValue.substring(0, matchStart)).length;
        const visualLen = splitString(match[0]).length;
        for (let i = 0; i < visualLen; i++) {
          const p = positions[visualStart + i];
          if (p) {
            const x = isVert ? -p.line * cell : (p.pos * cell);
            const y = isVert ? (p.pos * cell) : (p.line * cell);
            // key: type + match開始位置 + 文字オフセットで完全一意に
            list.push({ type, start: matchStart, end: matchEnd, x, y, color, isConversation: !!isConversation });
          }
        }
      }
    });
    return list;
  }, [charPositionsCache, debouncedValue, baseMetrics, settings.isVertical, settings.syntaxColors, settings.editorSyntaxColors]);

  // --- 3a. ゴーストテキスト座標計算 ---
  const ghostHighlights = useMemo(() => {
    if (!ghostText || !charPositionsCache.charArray.length) return [];

    // ★ 全文再計算を廃止。charPositionsCache の末尾座標を起点に ghost 部分だけ計算する。
    //    value（42万字）を毎回 Array.from + computeCharPositions するのを防ぐ。
    const { cell, maxPerLine } = baseMetrics;
    const { positions: basePositions, charArray: baseCharArray } = charPositionsCache;

    // 末尾の有効座標（最後の非null）を取得して ghost の起点にする
    let lastLine = 0;
    let lastPos = 0;
    for (let i = basePositions.length - 1; i >= 0; i--) {
      const p = basePositions[i];
      if (p != null) { lastLine = p.line; lastPos = p.pos + 1; break; }
    }

    // ghost テキストを末尾から続けて座標計算（ghost 部分だけ）
    const ghostCharArray = splitString(ghostText);
    let line = lastLine;
    let pos = lastPos;
    const list = [];

    for (let i = 0; i < ghostCharArray.length; i++) {
      const ch = ghostCharArray[i];
      if (ch === '\n') { line++; pos = 0; continue; }
      if (pos >= maxPerLine) { line++; pos = 0; }
      const x = settings.isVertical ? -line * cell : (pos * cell);
      const y = settings.isVertical ? (pos * cell) : (line * cell);
      list.push({ x, y, char: ch, charIdx: baseCharArray.length + i });
      pos++;
    }
    return list;
  }, [charPositionsCache, ghostText, baseMetrics, settings.isVertical]);

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
        // ★ splitString(preStr) は index 文字分の Array.from → utf16ToCharIdx でゼロコスト化
        const startCharIdx = utf16ToCharIdx.get(index) ?? splitString(debouncedValue.slice(0, index)).length;

        for (let i = 0; i < len; i++) {
          const p = positions[startCharIdx + i];
          if (p) {
            const x = settings.isVertical ? -p.line * cell : (p.pos * cell);
            const y = settings.isVertical ? (p.pos * cell) : (p.line * cell);
            list.push({
              corrId: corr.id, matchIndex: index, charOffset: i,
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



  // --- 3. 約物フィルター (縦書き時のみ — メモ化でローカルテキストベース) ---
  const displayValue = useMemo(() => {
    return settings.isVertical ? toVerticalDisplay(localText) : localText;
  }, [localText, settings.isVertical]);

  const handleChange = useCallback((e) => {
    const ta = e.target;
    const raw = ta.value;
    const restored = settings.isVertical ? fromVerticalDisplay(raw) : raw;
    const cursorPos = ta.selectionStart;

    if (isComposingRef.current) {
      // ★ IME 変換中: localDocument は更新する（React が DOM を上書きしないように）
      //    ただし undo 履歴と App への通知はスキップ（確定時に handleCompositionEnd で行う）
      //    差分更新で IME 中間状態も正しく反映する。
      const newDoc = updateDocument(localDocumentRef.current, restored, cursorPos);
      setLocalDocument(newDoc);
      return;
    }

    // ★ 文書モデル化：変更された段落だけを更新（全文再構築は段落数変化時のみ）
    const newDoc = updateDocument(localDocumentRef.current, restored, cursorPos);
    const newText = documentToText(newDoc);
    pushHistory(localTextRef.current, newText, cursorPos);
    if (currentCursorRef) currentCursorRef.current = cursorPos;
    nextCursorPos.current = cursorPos;
    // localDocument を即座に差分更新（setLocalDocument直接呼び、localOnChange 経由はしない）
    setLocalDocument(newDoc);
    // App への通知はデバウンスで
    if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
    appNotifyTimerRef.current = setTimeout(() => { onChange(newText); }, 500);
  }, [settings.isVertical, pushHistory, currentCursorRef, onChange]);

  // ★ IME composition ハンドラ
  // localTextRef 経由で参照することで、useCallback の deps から localText を除外
  // → キー入力ごとのコールバック再生成を回避
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
    compositionTextRef.current = localTextRef.current;
  }, []);

  const handleCompositionEnd = useCallback((e) => {
    isComposingRef.current = false;
    // composition 終了時に最終テキストを確定
    const ta = e.target;
    const raw = ta.value;
    const restored = settings.isVertical ? fromVerticalDisplay(raw) : raw;
    const cursorPos = ta.selectionStart;
    // 変換開始前のテキストから undo 履歴を記録（中間状態は記録しない）
    const beforeComposition = compositionTextRef.current ?? localTextRef.current;
    pushHistory(beforeComposition, restored, cursorPos);
    if (currentCursorRef) currentCursorRef.current = cursorPos;
    nextCursorPos.current = cursorPos;
    // ★ localOnChange（全文textToDocument）ではなく差分更新を使う
    //    IME確定のたびに全文split('\n')が走るのを防ぐ
    const newDoc = updateDocument(localDocumentRef.current, restored, cursorPos);
    setLocalDocument(newDoc);
    if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
    appNotifyTimerRef.current = setTimeout(() => onChange(documentToText(newDoc)), 500);
    compositionTextRef.current = null;
  }, [settings.isVertical, pushHistory, currentCursorRef, onChange]);

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
        pushHistory(localTextRef.current, newValue, cursorPos);
        nextCursorPos.current = cursorPos;
        localOnChange(newValue);
      }
    }
  }, [localOnChange, settings.isVertical, addToClipboard, pushHistory]);

  // --- 4. ハンドラ ---
  const handleCursor = () => {
    if (onCursorStats && textareaRef.current) {
      onCursorStats({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
        total: localText.length
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
    const ta = textareaRef.current;
    const container = ta?.closest('.editor-container');
    if (!ta || !container) return;

    const isClean = settings.paperStyle === 'clean';

    if (isClean) {
      const origWidth = ta.style.width;
      const origHeight = ta.style.height;
      const origOverflow = ta.style.overflow;

      ta.style.overflow = 'auto';
      ta.style.width = '1px';
      ta.style.height = '1px';

      ta.focus();
      ta.setSelectionRange(charIndex, charIndex);

      const innerTop = ta.scrollTop;
      const innerLeft = ta.scrollLeft;

      if (settings.isVertical) {
        container.scrollLeft = innerLeft;
      } else {
        container.scrollTop = innerTop;
      }

      ta.scrollTop = 0;
      ta.scrollLeft = 0;
      ta.style.width = origWidth;
      ta.style.height = origHeight;
      ta.style.overflow = origOverflow;

      return;
    }

    const { maxPerLine, cell, padding } = baseMetrics;
    const text = settings.isVertical ? toVerticalDisplay(localText) : localText;

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

    if (settings.isVertical) {
      const caretOffsetFromRight = line * cell + padding;
      const viewCenter = container.clientWidth / 2;
      const targetScrollLeft = -(caretOffsetFromRight - viewCenter);
      const minScrollLeft = -(container.scrollWidth - container.clientWidth);
      const clampedScrollLeft = Math.max(minScrollLeft, Math.min(0, targetScrollLeft));
      container.scrollLeft = clampedScrollLeft;
    } else {
      const caretY = line * cell + padding;
      const viewCenter = container.clientHeight / 2;
      const targetScrollTop = Math.max(0, caretY - viewCenter);
      container.scrollTop = targetScrollTop;
    }
  }, [localText, settings.isVertical, settings.paperStyle, baseMetrics]);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    textarea: textareaRef.current,
    textareaRef,
    // Undo/Redo
    undo,
    redo,
    // クリップボード履歴
    clipboardHistory,
    // ★ テキスト挿入（Todoパネル・AI補完・スニペット挿入など）
    //    文書モデル化に対応した差分更新方式
    insertText: (text) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const rawVal = settings.isVertical ? fromVerticalDisplay(ta.value) : ta.value;
      const newValue = rawVal.substring(0, start) + text + rawVal.substring(end);
      const newCursor = start + splitString(text).length;
      pushHistory(localTextRef.current, newValue, newCursor);
      nextCursorPos.current = newCursor;
      const newDoc = updateDocument(localDocumentRef.current, newValue, newCursor);
      setLocalDocument(newDoc);
      if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
      appNotifyTimerRef.current = setTimeout(() => onChange(documentToText(newDoc)), 500);
    },
    pasteFromHistory: (text) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const currentVal = ta.value;
      const rawVal = settings.isVertical ? fromVerticalDisplay(currentVal) : currentVal;
      const newValue = rawVal.substring(0, start) + text + rawVal.substring(end);
      const newCursor = start + text.length;
      pushHistory(localTextRef.current, newValue, newCursor);
      nextCursorPos.current = newCursor;
      // ★ localOnChange（全文再構築）→ 差分更新
      const newDoc = updateDocument(localDocumentRef.current, newValue, newCursor);
      setLocalDocument(newDoc);
      if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
      appNotifyTimerRef.current = setTimeout(() => onChange(documentToText(newDoc)), 500);
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
      const newCursor = start + (selectedText ? selectedText.length + 1 : 1);
      pushHistory(localTextRef.current, newValue, newCursor);
      nextCursorPos.current = newCursor;
      // ★ localOnChange（全文再構築）→ 差分更新
      const newDoc = updateDocument(localDocumentRef.current, newValue, newCursor);
      setLocalDocument(newDoc);
      if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
      appNotifyTimerRef.current = setTimeout(() => onChange(documentToText(newDoc)), 500);
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
      const ta = textareaRef.current;
      if (!ta) return;
      const selEnd = end != null ? end : start;
      scrollToCaretPosition(start);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(start, selEnd);
      });
    },
    // ★ jumpToIndex: 検索結果ジャンプ（jumpToPositionの別名）
    //    App.jsx が editorRef.current?.jumpToIndex(index) で呼んでいるが未定義だったため追加
    jumpToIndex: (index) => {
      const ta = textareaRef.current;
      if (!ta) return;
      scrollToCaretPosition(index);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(index, index);
      });
    },
  }));

  const isCleanMode = settings.paperStyle === 'clean';
  const paperClass = isCleanMode ? 'paper-clean' :
    settings.paperStyle === 'grid' ? 'paper-manuscript' :
      settings.paperStyle === 'lined' ? 'paper-lined' : 'paper-plain';

  // フォントスタイル（メモ化 — レンダリングごとの新規オブジェクト生成を回避）
  const cleanFontFamily = settings.cleanFontFamily || 'var(--font-mincho)';
  const fontStyle = useMemo(() => isCleanMode ? {
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
    fontVariantEastAsian: 'full-width',
    fontVariantLigatures: 'none',
    fontKerning: 'none',
    textAutospace: 'no-autospace',
    textSpacingTrim: 'space-all',
    fontFeatureSettings: settings.isVertical
      ? '"palt" 0, "halt" 0, "kern" 0, "vkrn" 0, "chws" 0, "liga" 0, "clig" 0, "calt" 0, "vert" 1, "vrt2" 1'
      : '"palt" 0, "halt" 0, "kern" 0, "vkrn" 0, "chws" 0, "liga" 0, "clig" 0, "calt" 0, "vert" 0, "vrt2" 0',
  }, [isCleanMode, cleanFontFamily, settings.isVertical, settings.fontFamily, metrics.letterSpacing, metrics.cell]);

  // ★ textarea の style オブジェクトをメモ化（キー入力ごとの新規オブジェクト生成を回避）
  const textareaStyle = useMemo(() => isCleanMode ? {
    fontSize: `${settings.fontSize || 16}px`,
    width: settings.isVertical ? `${Math.max(5000, metrics.gridW + 200)}px` : '100%',
    height: '100%',
    maxWidth: settings.isVertical ? 'none'
      : (settings.charsPerLine ? `${settings.charsPerLine * (parseInt(settings.fontSize) || 16) * 1.2 + 64}px` : 'none'),
    margin: settings.isVertical ? '0' : (settings.charsPerLine ? '0 auto' : '0'),
    padding: '40px 32px',
    textAlign: 'start',
    wordBreak: 'normal',
    overflowWrap: 'break-word',
    lineBreak: 'normal',
    writingMode: settings.isVertical ? 'vertical-rl' : 'horizontal-tb',
    textOrientation: settings.isVertical ? 'upright' : 'mixed',
    overflowY: settings.isVertical ? 'hidden' : 'scroll',
    overflowX: 'hidden',
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
  }, [isCleanMode, settings.fontSize, settings.isVertical, settings.charsPerLine, metrics, fontStyle]);

  // --- メモ化: シンタックスハイライト要素 ---
  const highlightElements = useMemo(() => {
    if (settings.editorSyntaxColors === false || !highlights.length) return null;
    const cell = baseMetrics.cell;
    const isVert = settings.isVertical;
    // viewport フィルタリングは廃止。
    // スクロール位置と再計算タイミングのズレで「着色が半端・途中から消える」バグの原因だった。
    // HIGHLIGHT_CHAR_LIMIT(100000字)で大規模テキストはスキップ済みなのでフィルタ不要。
    return highlights.map((h, idx) => (
      <div key={`${h.type}-${h.start}-${h.end}-${h.x}-${h.y}-${idx}`} style={{
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
  }, [highlights, settings.isVertical, settings.editorSyntaxColors, baseMetrics.cell]);

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
        const newValue = localText.substring(0, pos) + insertion + localText.substring(pos);
        pushHistory(localText, newValue, pos);
        nextCursorPos.current = pos + insertion.length;
        localOnChange(newValue);
      }
    }
  }, [localText, localOnChange, pushHistory, onImageDrop]);

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
          {ghostHighlights.map((gh, idx) => (
            <div key={`ghost-${gh.charIdx}-${gh.x}-${gh.y}-${idx}`} style={{
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
          {correctionHighlights.map((ch, idx) => (
            <div key={`corr-${ch.corrId}-${ch.matchIndex}-${ch.charOffset}-${idx}`} style={{
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
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onCopy={handleCopy}
        onCut={handleCut}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={(e) => {
          if (ghostText) {
            if (e.key === 'Tab') {
              e.preventDefault();
              // Accept Ghost Text（★ localOnChange → 差分更新）
              const ta = textareaRef.current;
              const start = ta.selectionStart;
              const val = settings.isVertical ? fromVerticalDisplay(ta.value) : ta.value;
              const newValue = val.slice(0, start) + ghostText + val.slice(start);
              const newCursor = start + ghostText.length;
              pushHistory(localTextRef.current, newValue, newCursor);
              nextCursorPos.current = newCursor;
              const newDoc = updateDocument(localDocumentRef.current, newValue, newCursor);
              setLocalDocument(newDoc);
              if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
              appNotifyTimerRef.current = setTimeout(() => onChange(documentToText(newDoc)), 500);
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
        style={textareaStyle}
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
                      pushHistory(localText, newValue, start);
                      nextCursorPos.current = start + wrapped.length;
                      localOnChange(newValue);
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
                    pushHistory(localText, newValue, start);
                    nextCursorPos.current = start + cleaned.length;
                    localOnChange(newValue);
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
                  pushHistory(localText, newValue, cursorPos);
                  localOnChange(newValue);
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
              pushHistory(localText, newValue, start);
              nextCursorPos.current = start + text.length;
              localOnChange(newValue);
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
