/**
 * useClipboardHistory.js
 *
 * コピー/カットした文字列を最大10件保持する履歴フック。
 * UIからクリップボード履歴を選択してペーストできる。
 */
import { useState, useCallback, useRef } from 'react';

const MAX_CLIPBOARD_HISTORY = 10;

/**
 * @returns {{ clipboardHistory, addToClipboard, clearHistory }}
 */
export function useClipboardHistory() {
    const [history, setHistory] = useState([]);
    const historyRef = useRef([]);

    /**
     * クリップボード履歴に追加
     * @param {string} text - コピー/カットされたテキスト
     */
    const addToClipboard = useCallback((text) => {
        if (!text || text.trim() === '') return;
        historyRef.current = [
            text,
            ...historyRef.current.filter(item => item !== text) // 重複を除去
        ].slice(0, MAX_CLIPBOARD_HISTORY);
        setHistory([...historyRef.current]);
    }, []);

    /**
     * 履歴をクリア
     */
    const clearHistory = useCallback(() => {
        historyRef.current = [];
        setHistory([]);
    }, []);

    return {
        clipboardHistory: history,
        addToClipboard,
        clearHistory,
    };
}
