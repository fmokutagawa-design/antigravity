import { useState, useEffect, useRef, useCallback } from 'react';
import { ollamaService } from '../utils/ollamaService';

export function useGhostText(text, debouncedText, enableGhostText, selectedLocalModel) {
  const [ghostText, setGhostText] = useState('');
  const ghostTextTimer = useRef(null);
  const ghostTextAbortController = useRef(null);
  const cursorStatsRef = useRef({ start: 0, end: 0, total: 0 });

  const handleCursorStats = useCallback((stats) => {
    cursorStatsRef.current = stats;
  }, []);

  // Ghost Text: Clear immediately on any text change (lightweight, no side effects)
  const prevTextForGhostRef = useRef(text);
  useEffect(() => {
    if (text !== prevTextForGhostRef.current) {
      prevTextForGhostRef.current = text;
      setGhostText(prev => prev === '' ? prev : '');
    }
  }, [text]);

  // Ghost Text: Generation (debounced — only fires when debouncedText changes)
  useEffect(() => {
    // Abort previous generation
    if (ghostTextAbortController.current) {
      ghostTextAbortController.current.abort();
    }
    clearTimeout(ghostTextTimer.current);

    // Check preconditions
    if (!enableGhostText) return;
    if (!debouncedText || debouncedText.length < 10) return;

    // Debounce Trigger
    ghostTextTimer.current = setTimeout(async () => {
      const { end, total } = cursorStatsRef.current;

      if (end < total) return;

      ghostTextAbortController.current = new AbortController();

      try {
        const rawContext = debouncedText.slice(-1000);
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
  }, [debouncedText, enableGhostText, selectedLocalModel]);

  return {
    ghostText,
    setGhostText,
    handleCursorStats,
  };
}
