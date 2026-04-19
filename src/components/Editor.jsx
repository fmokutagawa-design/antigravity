import React, { useRef, useImperativeHandle, forwardRef, useMemo, useEffect, useCallback, useLayoutEffect, useState } from 'react';
import '../index.css';
// ★ 約物フィルターを無効化したい場合、この import をコメントアウトしてください
import { toVerticalDisplay, fromVerticalDisplay } from '../utils/verticalPunctuation';
import { useUndoHistory } from '../hooks/useUndoHistory';
import { useClipboardHistory } from '../hooks/useClipboardHistory';
import { perfNow, perfLog, perfMeasure } from '../utils/perfProbe';
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
  const appNotifyTimerRef = useRef(null);
  const localDocumentRef = useRef(localDocument); // ★ handleChange 内で最新の localDocument を参照するため
  localDocumentRef.current = localDocument;

  // --- v3 Ref 移行: localText は state ではなく Ref で一元管理 ---
  const localTextRef = useRef(documentToText(localDocumentRef.current));
  useEffect(() => {
    localTextRef.current = documentToText(localDocument);
  }, [localDocument]);

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

  /**
   * 外部からの全文差し替え窓口（フェーズ1はまだ state ベース、
   * フェーズ3で DOM 直接操作に変わる）。
   *
   * 不変条件:
   *   - pending な debounce タイマーを全て clearTimeout する
   *   - onChange は絶対に呼ばない（呼び出し元が明示的に呼ぶ）
   *   - IME 変換中（isComposingRef.current）でも呼ばれる可能性があるが、
   *     呼び出し側の責任で発火可否を判断する
   */
  const applyText = useCallback((newValue, cursorPos = null) => {
    // 1. pending な debounce タイマーを全部破棄
    if (appNotifyTimerRef.current) {
      clearTimeout(appNotifyTimerRef.current);
      appNotifyTimerRef.current = null;
    }

    // 2. documentModel を差分更新
    const newDoc = updateDocument(
      localDocumentRef.current,
      newValue,
      cursorPos ?? 0
    );
    setLocalDocument(newDoc);

    // 3. カーソル位置を保存（useLayoutEffect で復元される）
    if (cursorPos != null) {
      nextCursorPos.current = cursorPos;
    }

    // 注: onChange は呼ばない（呼び出し側の責任）
  }, []);

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
    const totalT0 = perfNow();

    if (isComposingRef.current) {
      perfMeasure('Editor.selectionRestore.skipped.composing', totalT0);
      return;
    }

    if (pendingCursorRef && pendingCursorRef.current != null && textareaRef.current) {
      const t0 = perfNow();
      const pos = pendingCursorRef.current;
      pendingCursorRef.current = null;
      textareaRef.current.setSelectionRange(pos, pos);
      perfMeasure('Editor.selectionRestore.pendingCursor', t0, { pos });
      perfMeasure('Editor.selectionRestore.total', totalT0, { kind: 'pendingCursor' });
      return;
    }

    if (nextCursorPos.current != null && textareaRef.current) {
      const t0 = perfNow();
      const pos = nextCursorPos.current;
      nextCursorPos.current = null;
      textareaRef.current.setSelectionRange(pos, pos);
      perfMeasure('Editor.selectionRestore.nextCursor', t0, { pos });
      perfMeasure('Editor.selectionRestore.total', totalT0, { kind: 'nextCursor' });
      return;
    }

    perfMeasure('Editor.selectionRestore.total', totalT0, { kind: 'noop' });
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
    // setDebouncedValue(value) -> debouncedDocument 側で処理されるため削除
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
  // ★ 大規模テキスト（10万字超）では座標キャッシュ・ハイライト系の
  //    useEffect を全部スキップする。
  //    42万字規模では全文座標配列の生成・保持・再レンダリングが
  //    ブラウザ・React の両方を破綻させるため、highlights を諦めて
  //    打鍵だけを軽くする方針。
  const MASSIVE_TEXT_THRESHOLD = 100000;
  const isMassiveText = useMemo(() => {
    const len = localDocument.reduce((acc, p) => acc + p.text.length, 0);
    return len > MASSIVE_TEXT_THRESHOLD;
  }, [localDocument]);
  const isMassiveTextRef = useRef(isMassiveText);
  useEffect(() => { isMassiveTextRef.current = isMassiveText; }, [isMassiveText]);

  // debouncedValue state は廃止し、debouncedDocument から派生する memo に変更
  const debouncedText = useMemo(() => documentToText(debouncedDocument), [debouncedDocument]);
  const debouncePrevLenRef = useRef(debouncedText.length);
  useEffect(() => { debouncePrevLenRef.current = debouncedText.length; }, [debouncedText]);

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

  // 段落キャッシュ
  const [paraPosCache, setParaPosCache] = useState(new Map());
  const paraPosCacheRef = useRef(paraPosCache);
  useEffect(() => { paraPosCacheRef.current = paraPosCache; }, [paraPosCache]);
  const paraPosReqIdRef = useRef(new Map());

  // バージョンカウンタ（deps に配列・Mapを入れずに再実行を制御する）
  const workerDispatchVersionRef = useRef(0);
  const [workerDispatchTick, setWorkerDispatchTick] = useState(0);
  const cacheComposeVersionRef = useRef(0);
  const [cacheComposeTick, setCacheComposeTick] = useState(0);

  // debouncedDocument または baseMetrics が変わったら Worker送信を起動
  useEffect(() => {
    workerDispatchVersionRef.current += 1;
    setWorkerDispatchTick(v => v + 1);
  }, [debouncedDocument, baseMetrics.maxPerLine]);

  // paraPosCache が更新されたら合成を起動
  useEffect(() => {
    cacheComposeVersionRef.current += 1;
    setCacheComposeTick(v => v + 1);
  }, [paraPosCache]);

  // ★ 段落メモ（composedSegCacheRef）
  //    key: paraId, value: { localPositions, charArray, utf16Lens, totalLines, maxPerLine }
  const composedSegCacheRef = useRef({ map: new Map(), maxPerLine: 0 });

  // ★ Worker 受信バッファ。
  //    大量の段落が短時間に返ってくる場合、受信ごとに setParaPosCache を呼ぶと
  //    React 更新が段落数ぶん連打される（11,000 回など）。
  //    rAF 単位でまとめて 1 回だけ setParaPosCache する。
  const paraRecvBufferRef = useRef([]);
  const paraRecvRafRef = useRef(0);
  const flushParaRecvBuffer = useCallback(() => {
    paraRecvRafRef.current = 0;
    const buffer = paraRecvBufferRef.current;
    if (buffer.length === 0) return;
    paraRecvBufferRef.current = [];
    setParaPosCache(prev => {
      const next = new Map(prev);
      for (const entry of buffer) {
        next.set(entry.paraId, entry.value);
      }
      return next;
    });
  }, []);

  const debouncedLineCount = useMemo(() => {
    if (!debouncedDocument || debouncedDocument.length === 0) return 10;
    // 大規模テキスト: paraPosCache を作らないので文字数÷行幅で概算する
    if (isMassiveText) {
      const textLen = localTextRef.current.length;
      const approx = baseMetrics.maxPerLine > 0
        ? Math.ceil(textLen / baseMetrics.maxPerLine)
        : 10;
      return Math.max(approx, 10);
    }
    const cached = [...paraPosCache.values()];
    if (cached.length === 0) {
      // キャッシュが空：文字数÷1行文字数で概算
      const textLen = localTextRef.current.length;
      const approx = baseMetrics.maxPerLine > 0
        ? Math.ceil(textLen / baseMetrics.maxPerLine)
        : 10;
      return Math.max(approx, 10);
    }
    const total = cached.reduce((sum, p) => sum + (p.totalLines || 1), 0);
    return Math.max(total, 10);
  }, [debouncedDocument, paraPosCache, baseMetrics.maxPerLine, isMassiveText]);

  const [charPositionsCache, setCharPositionsCache] = useState(
    () => ({ positions: [], charArray: [], utf16ToCharIdx: new Map() })
  );

  // Worker の初期化（マウント時に一度だけ）
  useEffect(() => {
    const worker = new PositionWorker();
    workerRef.current = worker;
    worker.onmessage = (e) => {
      const t0 = perfNow();
      const { type, id } = e.data;
      if (type === 'lineCount') {
        perfMeasure('Editor.worker.onmessage.lineCount', t0, { id, totalLines: e.data.totalLines });
      } else if (type === 'positions' && id === positionsReqIdRef.current) {
        const { positions, charArray, utf16ToCharIdxEntries } = e.data;
        const utf16ToCharIdx = new Map(utf16ToCharIdxEntries);
        setCharPositionsCache({ positions, charArray, utf16ToCharIdx });
        perfMeasure('Editor.worker.onmessage.positions', t0, {
          id,
          positionsLen: positions.length,
          charArrayLen: charArray.length,
        });
      } else if (type === 'para_positions') {
        const { paraId } = e.data;
        const latestId = paraPosReqIdRef.current.get(paraId);
        if (id !== latestId) {
          perfMeasure('Editor.worker.onmessage.para_positions.stale', t0, { id, paraId, latestId });
          return;
        }
        const { positions, charArray, utf16ToCharIdxEntries, totalLines } = e.data;
        const utf16ToCharIdx = new Map(utf16ToCharIdxEntries);
        // rAF バッチングでまとめて 1 回の setState に集約
        paraRecvBufferRef.current.push({
          paraId,
          value: { positions, charArray, utf16ToCharIdx, totalLines },
        });
        if (paraRecvRafRef.current === 0) {
          paraRecvRafRef.current = requestAnimationFrame(flushParaRecvBuffer);
        }
        perfMeasure('Editor.worker.onmessage.para_positions', t0, {
          id,
          paraId,
          positionsLen: positions.length,
          charArrayLen: charArray.length,
          totalLines,
        });
      } else {
        perfMeasure('Editor.worker.onmessage.other', t0, { type, id });
      }
    };
    return () => {
      worker.terminate();
      if (paraRecvRafRef.current !== 0) {
        cancelAnimationFrame(paraRecvRafRef.current);
        paraRecvRafRef.current = 0;
      }
    };
  }, [flushParaRecvBuffer]);

  // グリッド寸法
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

  // Worker送信（workerDispatchTick または debouncedDocument が変わるたびに実行）
  useEffect(() => {
    const doc = debouncedDocument; // パッチに従い直接参照
    if (!doc || doc.length === 0) {
      setParaPosCache(new Map());
      return;
    }
    if (!workerRef.current) return;

    const uncached = doc.filter(p => !paraPosCacheRef.current.has(p.id));
    if (uncached.length === 0) return;

    // ★ lineOffset は Worker に渡さない。
    //    段落ローカル座標で計算・キャッシュし、全文座標への変換は合成側で行う。
    //    これにより段落の並び替え・挿入で lineOffset が変わっても
    //    Worker キャッシュは再利用できる。

    let batchIndex = 0;
    const timer = setInterval(() => {
      const batch = uncached.slice(batchIndex * 30, (batchIndex + 1) * 30);
      if (batch.length === 0) { clearInterval(timer); return; }

      const batchT0 = perfNow();
      perfLog('Editor.worker.dispatch.batch', {
        batchIndex,
        batchSize: batch.length,
        uncachedTotal: uncached.length,
        maxPerLine: baseMetrics.maxPerLine,
      });

      batch.forEach(para => {
        const reqId = (paraPosReqIdRef.current.get(para.id) || 0) + 1;
        paraPosReqIdRef.current.set(para.id, reqId);

        perfLog('Editor.worker.dispatch.single', {
          paraId: para.id,
          reqId,
          textLength: para.text.length,
        });

        workerRef.current.postMessage({
          type: 'para_positions',
          id: reqId,
          paraId: para.id,
          text: para.text,
          maxPerLine: baseMetrics.maxPerLine,
        });
      });
      batchIndex++;
    }, 50);

    return () => clearInterval(timer);
  }, [baseMetrics.maxPerLine, debouncedDocument]);

  // charPositionsCache 合成（cacheComposeTick または debouncedDocument が変わるたびに実行）
  useEffect(() => {
    const run = () => {
      const t0 = perfNow();
      const doc = debouncedDocument;
      if (!doc || doc.length === 0) {
        setCharPositionsCache({ positions: [], charArray: [], utf16ToCharIdx: new Map() });
        return;
      }

      // ★ 大規模テキスト: 合成をスキップして空キャッシュを維持。
      if (isMassiveTextRef.current) {
        setCharPositionsCache(prev => {
          if (prev.charArray.length === 0) return prev;
          return { positions: [], charArray: [], utf16ToCharIdx: new Map() };
        });
        perfMeasure('Editor.charPositionsCache.compose.skipped.massive', t0);
        return;
      }

      const cache = paraPosCache;
      const maxPerLine = baseMetrics.maxPerLine || 20;

      // maxPerLine が変わったら段落メモを破棄
      if (composedSegCacheRef.current.maxPerLine !== maxPerLine) {
        composedSegCacheRef.current = { map: new Map(), maxPerLine };
      }
      const segMap = composedSegCacheRef.current.map;

      // 段落メモを paraPosCache の最新内容で増補する
      const aliveIds = new Set();
      for (let paraIdx = 0; paraIdx < doc.length; paraIdx++) {
        const para = doc[paraIdx];
        aliveIds.add(para.id);
        const cached = cache.get(para.id);
        if (!cached) continue;
        const existing = segMap.get(para.id);
        if (existing && existing.source === cached) continue;

        const { positions, charArray, totalLines } = cached;
        const utf16Lens = new Uint8Array(charArray.length);
        for (let i = 0; i < charArray.length; i++) {
          utf16Lens[i] = charArray[i].codePointAt(0) > 0xFFFF ? 2 : 1;
        }
        segMap.set(para.id, {
          source: cached,
          localPositions: positions,
          charArray,
          utf16Lens,
          totalLines,
        });
      }

      // 生きていない paraId のエントリを掃除
      if (segMap.size > doc.length * 2) {
        for (const id of segMap.keys()) {
          if (!aliveIds.has(id)) segMap.delete(id);
        }
      }

      const allPositions = [];
      const allCharArray = [];
      const utf16ToCharIdx = new Map();
      let utf16Offset = 0;
      let lineOffset = 0;

      for (let paraIdx = 0; paraIdx < doc.length; paraIdx++) {
        const para = doc[paraIdx];
        const seg = segMap.get(para.id);

        if (seg) {
          const { localPositions, charArray, utf16Lens, totalLines } = seg;
          const len = charArray.length;
          for (let i = 0; i < len; i++) {
            const p = localPositions[i];
            allPositions.push(p == null ? null : { line: p.line + lineOffset, pos: p.pos });
            allCharArray.push(charArray[i]);
            const uLen = utf16Lens[i];
            const charIdx = allCharArray.length - 1;
            utf16ToCharIdx.set(utf16Offset, charIdx);
            if (uLen === 2) utf16ToCharIdx.set(utf16Offset + 1, charIdx);
            utf16Offset += uLen;
          }
          lineOffset += totalLines;
        } else {
          // 暫定表示
          const chars = [...para.text];
          for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            const approxLine = lineOffset + Math.floor(i / maxPerLine);
            const approxPos = i % maxPerLine;
            allPositions.push({ line: approxLine, pos: approxPos });
            allCharArray.push(ch);
            const utf16Len = ch.codePointAt(0) > 0xFFFF ? 2 : 1;
            const charIdx = allCharArray.length - 1;
            utf16ToCharIdx.set(utf16Offset, charIdx);
            if (utf16Len === 2) utf16ToCharIdx.set(utf16Offset + 1, charIdx);
            utf16Offset += utf16Len;
          }
          lineOffset += Math.ceil(para.text.length / maxPerLine) || 1;
        }

        if (paraIdx < doc.length - 1) {
          allCharArray.push('\n');
          allPositions.push(null);
          utf16ToCharIdx.set(utf16Offset, allCharArray.length - 1);
          utf16Offset += 1;
        }
      }

      perfMeasure('Editor.charPositionsCache.compose.setCachePre', t0, {
        docLen: doc.length,
        paraCacheSize: cache.size,
        allCharArrayLen: allCharArray.length,
        allPositionsLen: allPositions.length,
      });
      setCharPositionsCache({ positions: allPositions, charArray: allCharArray, utf16ToCharIdx });
      perfMeasure('Editor.charPositionsCache.compose.total', t0);
    };

    const timer = setTimeout(run, 40);
    return () => clearTimeout(timer);
  }, [paraPosCache, debouncedDocument, baseMetrics.maxPerLine]);

  // --- 2. アンダーレイ（座標マップ）の生成（デバウンス） ---
  // ★ 大規模テキスト（20000文字超≒原稿用紙100枚超）ではハイライトを自動停止
  const HIGHLIGHT_CHAR_LIMIT = 100000;
  const highlights = useMemo(() => {
    const t0 = perfNow();
    if (settings.editorSyntaxColors === false) {
      perfMeasure('Editor.highlights', t0, { kind: 'skipped (disabled)' });
      return [];
    }
    if (!debouncedText) {
      perfMeasure('Editor.highlights', t0, { kind: 'skipped (empty)' });
      return [];
    }
    if (debouncedText.length > HIGHLIGHT_CHAR_LIMIT) {
      perfMeasure('Editor.highlights', t0, { kind: 'skipped (massive)', len: debouncedText.length });
      return [];
    }
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
      while ((match = regex.exec(debouncedText)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;
        const visualStart = utf16ToCharIdx.get(matchStart) ?? splitString(debouncedText.substring(0, matchStart)).length;
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
    perfMeasure('Editor.highlights', t0, { count: list.length, len: debouncedText.length });
    return list;
  }, [charPositionsCache, debouncedText, baseMetrics, settings.isVertical, settings.syntaxColors, settings.editorSyntaxColors]);

  // --- 3a. ゴーストテキスト座標計算 ---
  const ghostHighlights = useMemo(() => {
    const t0 = perfNow();
    if (!ghostText || !charPositionsCache.charArray.length) {
      perfMeasure('Editor.ghostHighlights', t0, { kind: 'skipped' });
      return [];
    }

    // ★ 全文再計算を廃止。charPositionsCache の末尾座標を起点に ghost 部分だけ計算する。
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
    perfMeasure('Editor.ghostHighlights', t0, { count: list.length });
    return list;
  }, [charPositionsCache, ghostText, baseMetrics, settings.isVertical]);

  // --- 3b. 校正ハイライト座標計算（デバウンス + キャッシュ共有） ---
  const correctionHighlights = useMemo(() => {
    const t0 = perfNow();
    if (!corrections || corrections.length === 0 || !debouncedText) {
      perfMeasure('Editor.correctionHighlights', t0, { kind: 'skipped' });
      return [];
    }
 
    const { charArray, positions } = charPositionsCache;
    const { cell } = baseMetrics;
 
    const list = [];
 
    corrections.forEach(corr => {
      if (!corr.original) return;
      let searchIndex = 0;
      let index = debouncedText.indexOf(corr.original, searchIndex);
 
      while (index !== -1) {
        const len = splitString(corr.original).length;
        // ★ splitString(preStr) は index 文字分の Array.from → utf16ToCharIdx でゼロコスト化
        const startCharIdx = utf16ToCharIdx.get(index) ?? splitString(debouncedText.slice(0, index)).length;
 
        for (let i = 0; i < len; i++) {
          const p = positions[startCharIdx + i];
          if (p) {
            const x = isVert ? -p.line * cell : (p.pos * cell);
            const y = isVert ? (p.pos * cell) : (p.line * cell);
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
 
    perfMeasure('Editor.correctionHighlights', t0, { count: list.length });
    return list;
  }, [debouncedText, corrections, charPositionsCache, baseMetrics, settings.isVertical]);



  // --- 3. 約物フィルター (縦書き時のみ — メモ化でローカルテキストベース) ---
  // ★ 縦書きモードの displayValue を段落単位でメモ化する。
  //    全文 42万字に対して toVerticalDisplay を毎打鍵実行すると 6〜15ms かかるが、
  //    打鍵で変わる段落は通常 1 つだけなので、段落ごとに変換結果をキャッシュし、
  //    id と text が同じ段落は使い回す。
  const displayParaCacheRef = useRef(new Map()); // paraId -> { text, displayText }
  const displayValue = useMemo(() => {
    const t0 = perfNow();
    const currentText = localTextRef.current;

    if (!settings.isVertical) {
      perfMeasure('Editor.displayValue', t0, {
        vertical: false,
        paraCount: localDocument.length,
        textLength: currentText.length,
      });
      return currentText;
    }

    const cache = displayParaCacheRef.current;
    const parts = new Array(localDocument.length);
    for (let i = 0; i < localDocument.length; i++) {
      const para = localDocument[i];
      const cached = cache.get(para.id);
      if (cached && cached.text === para.text) {
        parts[i] = cached.displayText;
      } else {
        const paraT0 = perfNow();
        const displayText = toVerticalDisplay(para.text);
        perfMeasure('Editor.displayValue.toVerticalDisplay.singlePara', paraT0, {
          paraId: para.id,
          paraLen: para.text.length,
        });
        cache.set(para.id, { text: para.text, displayText });
        parts[i] = displayText;
      }
    }
    // 生きていない paraId の掃除
    if (cache.size > localDocument.length * 2) {
      const alive = new Set(localDocument.map(p => p.id));
      for (const id of cache.keys()) if (!alive.has(id)) cache.delete(id);
    }
    const out = parts.join('\n');
    perfMeasure('Editor.displayValue', t0, {
      vertical: true,
      paraCount: localDocument.length,
      textLength: currentText.length,
      outLength: out.length,
    });
    return out;
  }, [localDocument, settings.isVertical]);

  const handleChange = useCallback((e) => {
    const t0 = perfNow();
    const ta = e.target;
    const raw = ta.value;

    const restoreT0 = perfNow();
    const restored = settings.isVertical ? fromVerticalDisplay(raw) : raw;
    perfMeasure('Editor.handleChange.restoreDisplay', restoreT0, {
      rawLength: raw.length,
      restoredLength: restored.length,
      vertical: settings.isVertical,
    });

    const cursorPos = ta.selectionStart;

    if (isComposingRef.current) {
      const docT0 = perfNow();
      const newDoc = updateDocument(localDocumentRef.current, restored, cursorPos);
      perfMeasure('Editor.handleChange.composing.updateDocument', docT0, {
        cursorPos,
        prevParas: localDocumentRef.current.length,
        nextParas: newDoc.length,
        textLength: restored.length,
      });

      const setDocT0 = perfNow();
      setLocalDocument(newDoc);
      perfMeasure('Editor.handleChange.composing.setLocalDocument', setDocT0, {
        nextParas: newDoc.length,
      });

      perfMeasure('Editor.handleChange.composing.total', t0, {
        cursorPos,
        textLength: restored.length,
      });
      return;
    }

    const docT0 = perfNow();
    const newDoc = updateDocument(localDocumentRef.current, restored, cursorPos);
    perfMeasure('Editor.handleChange.updateDocument', docT0, {
      cursorPos,
      prevParas: localDocumentRef.current.length,
      nextParas: newDoc.length,
      textLength: restored.length,
    });

    const toTextT0 = perfNow();
    const newText = documentToText(newDoc);
    perfMeasure('Editor.handleChange.documentToText', toTextT0, {
      nextParas: newDoc.length,
      textLength: newText.length,
    });

    const historyT0 = perfNow();
    pushHistory(localTextRef.current, newText, cursorPos);
    perfMeasure('Editor.handleChange.pushHistory', historyT0, {
      cursorPos,
    });

    if (currentCursorRef) currentCursorRef.current = cursorPos;
    nextCursorPos.current = cursorPos;

    const setDocT0 = perfNow();
    setLocalDocument(newDoc);
    perfMeasure('Editor.handleChange.setLocalDocument', setDocT0, {
      nextParas: newDoc.length,
    });

    const timerT0 = perfNow();
    if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
    appNotifyTimerRef.current = setTimeout(() => {
      const notifyT0 = perfNow();
      onChange(newText);
      perfMeasure('Editor.handleChange.debouncedOnChange', notifyT0, {
        textLength: newText.length,
      });
    }, 500);
    perfMeasure('Editor.handleChange.scheduleOnChange', timerT0, {
      textLength: newText.length,
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        perfLog('Editor.handleChange.afterDoubleRAF', {
          textLength: newText.length,
          cursorPos,
        });
      });
    });

    perfMeasure('Editor.handleChange.total', t0, {
      cursorPos,
      textLength: newText.length,
      paraCount: newDoc.length,
    });
  }, [settings.isVertical, pushHistory, currentCursorRef, onChange]);

  // ★ IME composition ハンドラ
  // localTextRef 経由で参照することで、useCallback の deps から localText を除外
  // → キー入力ごとのコールバック再生成を回避
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
    compositionTextRef.current = localTextRef.current;
  }, []);

  const handleCompositionEnd = useCallback((e) => {
    const t0 = perfNow();
    isComposingRef.current = false;
    // composition 終了時に最終テキストを確定
    const ta = e.target;
    const raw = ta.value;

    const restoreT0 = perfNow();
    const restored = settings.isVertical ? fromVerticalDisplay(raw) : raw;
    perfMeasure('Editor.handleCompositionEnd.restoreDisplay', restoreT0, {
      rawLength: raw.length,
      restoredLength: restored.length,
      vertical: settings.isVertical,
    });

    const cursorPos = ta.selectionStart;
    // 変換開始前のテキストから undo 履歴を記録（中間状態は記録しない）
    const beforeComposition = compositionTextRef.current ?? localTextRef.current;
    
    const historyT0 = perfNow();
    pushHistory(beforeComposition, restored, cursorPos);
    perfMeasure('Editor.handleCompositionEnd.pushHistory', historyT0, { cursorPos });

    if (currentCursorRef) currentCursorRef.current = cursorPos;
    nextCursorPos.current = cursorPos;
    
    const docT0 = perfNow();
    const newDoc = updateDocument(localDocumentRef.current, restored, cursorPos);
    perfMeasure('Editor.handleCompositionEnd.updateDocument', docT0, {
      prevParas: localDocumentRef.current.length,
      nextParas: newDoc.length,
    });

    const setDocT0 = perfNow();
    setLocalDocument(newDoc);
    perfMeasure('Editor.handleCompositionEnd.setLocalDocument', setDocT0, {
      nextParas: newDoc.length,
    });

    const timerT0 = perfNow();
    if (appNotifyTimerRef.current) clearTimeout(appNotifyTimerRef.current);
    const finalFullText = documentToText(newDoc);
    appNotifyTimerRef.current = setTimeout(() => onChange(finalFullText), 500);
    perfMeasure('Editor.handleCompositionEnd.scheduleOnChange', timerT0, {
      textLength: finalFullText.length,
    });

    compositionTextRef.current = null;
    perfMeasure('Editor.handleCompositionEnd.total', t0, {
      cursorPos,
      textLength: finalFullText.length,
    });
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
        applyText(newValue, cursorPos);
        appNotifyTimerRef.current = setTimeout(() => onChange(newValue), 500);
      }
    }
  }, [applyText, settings.isVertical, addToClipboard, pushHistory, onChange]);

  // --- 4. ハンドラ ---
  const handleCursor = () => {
    if (onCursorStats && textareaRef.current) {
      onCursorStats({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
        total: localTextRef.current.length
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
    const currentText = localTextRef.current;
    const text = settings.isVertical ? toVerticalDisplay(currentText) : currentText;

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
      applyText(newValue, newCursor);
      appNotifyTimerRef.current = setTimeout(() => onChange(newValue), 500);
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
      applyText(newValue, newCursor);
      appNotifyTimerRef.current = setTimeout(() => onChange(newValue), 500);
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
      applyText(newValue, newCursor);
      appNotifyTimerRef.current = setTimeout(() => onChange(newValue), 500);
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
        const currentText = localTextRef.current;
        // 前後が改行されていない場合は改行で挟むなどの調整が可能（今回はシンプルに改行挟み）
        const insertion = `\n［＃挿絵（${fileName}）入る］\n`;
        const newValue = currentText.substring(0, pos) + insertion + currentText.substring(pos);
        const newCursor = pos + insertion.length;
        pushHistory(currentText, newValue, pos);
        applyText(newValue, newCursor);
        appNotifyTimerRef.current = setTimeout(() => onChange(newValue), 500);
      }
    }
  }, [applyText, pushHistory, onImageDrop, onChange]);

  return (
    <div lang="ja" className={`editor-container ${settings.isVertical ? 'vertical' : 'horizontal'} ${paperClass}`}>
      {/* Underlay: skip in clean mode (proportional fonts can't align character-by-character) */}
      {/* Underlay: skip in massive text mode（座標キャッシュを作らないため） */}
      {!isCleanMode && !isMassiveText && (
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
              applyText(newValue, newCursor);
              appNotifyTimerRef.current = setTimeout(() => onChange(newValue), 500);
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
                      const newCursor = start + wrapped.length;
                      pushHistory(localTextRef.current, newValue, start);
                      applyText(newValue, newCursor);
                      appNotifyTimerRef.current = setTimeout(() => onChange(newValue), 500);
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
                    const newCursor = start + cleaned.length;
                    pushHistory(localText, newValue, start);
                    applyText(newValue, newCursor);
                    appNotifyTimerRef.current = setTimeout(() => onChange(newValue), 500);
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
                  applyText(newValue, cursorPos);
                  appNotifyTimerRef.current = setTimeout(() => onChange(newValue), 500);
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
              const newCursor = start + text.length;
              pushHistory(localText, newValue, start);
              applyText(newValue, newCursor);
              appNotifyTimerRef.current = setTimeout(() => onChange(newValue), 500);
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
