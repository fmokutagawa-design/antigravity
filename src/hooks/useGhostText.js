import { useState, useEffect, useRef, useCallback } from 'react';
import { ollamaService } from '../utils/ollamaService';

export function useGhostText(text, enableGhostText, selectedLocalModel) {
  const [ghostText, setGhostText] = useState('');
  const ghostTextTimer = useRef(null);
  const ghostTextAbortController = useRef(null);
  const cursorStatsRef = useRef({ start: 0, end: 0, total: 0 });

  const handleCursorStats = useCallback((stats) => {
    cursorStatsRef.current = stats;
  }, []);

  // Ghost Text Effect
  useEffect(() => {
    // 1. Clear existing ghost text on ANY change (skip if already empty to avoid extra re-render)
    setGhostText(prev => prev === '' ? prev : '');

    // 2. Abort previous generation
    if (ghostTextAbortController.current) {
      ghostTextAbortController.current.abort();
    }
    clearTimeout(ghostTextTimer.current);

    // 3. Check preconditions
    if (!enableGhostText) return;
    if (!text || text.length < 10) return;

    // 4. Debounce Trigger
    ghostTextTimer.current = setTimeout(async () => {
      const { end, total } = cursorStatsRef.current;

      if (end < total) return;

      ghostTextAbortController.current = new AbortController();

      try {
        const rawContext = text.slice(-1000);
        const systemPrompt = "以下の日本語の文章の続きを自然に書いてください。説明や翻訳は不要です。続きの文章だけを出力してください。";
        const suggestion = await ollamaService.generateCompletion(rawContext, selectedLocalModel, ghostTextAbortController.current.signal, systemPrompt);

        if (suggestion && suggestion.trim().length > 0) {
          setGhostText(suggestion);
        }
      } catch (e) {
        // Ignore aborts or failures
      } finally {
        ghostTextAbortController.current = null;
      }
    }, 1500);

    return () => {
      clearTimeout(ghostTextTimer.current);
      if (ghostTextAbortController.current) {
        ghostTextAbortController.current.abort();
      }
    };
  }, [text, enableGhostText, selectedLocalModel]);

  return {
    ghostText,
    handleCursorStats,
  };
}
