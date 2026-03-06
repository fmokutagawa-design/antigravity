/**
 * useUndoHistory.js
 *
 * React 制御 textarea 用の Undo/Redo フック。
 * ブラウザのネイティブ undo は React が value を上書きするため動作しないので、
 * 独自のスタックで管理する。
 *
 * 特徴:
 *   - 連続入力をデバウンスして1操作にまとめる（500ms）
 *   - Cmd+Z / Cmd+Shift+Z でundo/redo
 *   - カーソル位置も保存・復元
 *   - 最大100エントリ保持
 */
import { useRef, useCallback } from 'react';

const MAX_HISTORY = 100;
const DEBOUNCE_MS = 500;

/**
 * @param {Function} onChange - 値変更時のコールバック (newValue) => void
 * @returns {{ pushHistory, undo, redo, handleKeyDown }}
 */
export function useUndoHistory(onChange) {
    // undo/redo スタック（カーソル位置も保存）
    const undoStack = useRef([]);
    const redoStack = useRef([]);

    // デバウンス用: 最後にスタックに追加した時刻
    const lastPushTime = useRef(0);
    // 現在の値を追跡（undo時に現在値をredoに入れるため）
    const currentValue = useRef('');
    // 現在のカーソル位置
    const currentCursor = useRef(0);

    // onChangeをrefで保持（stale closure回避）
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // undo/redo後にカーソル復元が必要な位置
    const pendingCursor = useRef(null);

    /**
     * 値を初期化（ファイル切替時等）
     */
    const initHistory = useCallback((value) => {
        undoStack.current = [];
        redoStack.current = [];
        currentValue.current = value;
        currentCursor.current = 0;
        lastPushTime.current = 0;
    }, []);

    /**
     * 変更があったときに呼ぶ。
     * デバウンスして連続入力を1操作にまとめる。
     * @param {string} oldValue - 変更前の値
     * @param {string} newValue - 変更後の値
     * @param {number} [cursorPos] - 変更前のカーソル位置
     */
    const pushHistory = useCallback((oldValue, newValue, cursorPos) => {
        const now = Date.now();
        const elapsed = now - lastPushTime.current;

        if (elapsed > DEBOUNCE_MS || undoStack.current.length === 0) {
            // 新しい操作: oldValue をスタックに積む
            undoStack.current.push({
                value: oldValue,
                cursor: cursorPos != null ? cursorPos : currentCursor.current
            });
            if (undoStack.current.length > MAX_HISTORY) {
                undoStack.current.shift(); // 古いエントリを削除
            }
        }
        // 連続入力中は最後のエントリを更新しない（oldValueは最初の値を保持）

        // redo スタックをクリア（新しい入力が入ったら redo は無効）
        redoStack.current = [];
        currentValue.current = newValue;
        lastPushTime.current = now;
    }, []);

    /**
     * Undo: Cmd+Z
     */
    const undo = useCallback(() => {
        if (undoStack.current.length === 0) return;
        const entry = undoStack.current.pop();
        redoStack.current.push({
            value: currentValue.current,
            cursor: currentCursor.current
        });
        currentValue.current = entry.value;
        pendingCursor.current = entry.cursor;
        onChangeRef.current(entry.value);
    }, []);

    /**
     * Redo: Cmd+Shift+Z
     */
    const redo = useCallback(() => {
        if (redoStack.current.length === 0) return;
        const entry = redoStack.current.pop();
        undoStack.current.push({
            value: currentValue.current,
            cursor: currentCursor.current
        });
        currentValue.current = entry.value;
        pendingCursor.current = entry.cursor;
        onChangeRef.current(entry.value);
    }, []);

    /**
     * キーボードハンドラ: textarea の onKeyDown に接続
     */
    const handleKeyDown = useCallback((e) => {
        const isMeta = e.metaKey || e.ctrlKey;
        if (isMeta && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
        }
    }, [undo, redo]);

    return {
        initHistory,
        pushHistory,
        undo,
        redo,
        handleKeyDown,
        pendingCursor,
        currentCursor,
        // デバッグ用
        getUndoCount: () => undoStack.current.length,
        getRedoCount: () => redoStack.current.length,
    };
}
