import { useState, useCallback, useMemo } from 'react';

export function useSessionStats(allMaterialFiles, activeFileHandle, editorValue) {
  const [sessionStartTotal, setSessionStartTotal] = useState(null);

  // Calculate total characters in all files
  const currentTotal = useMemo(() => {
    if (!allMaterialFiles) return 0;
    let total = 0;
    for (const file of allMaterialFiles) {
      const isActiveFile = activeFileHandle && file.handle && (
        (typeof activeFileHandle === 'string' && typeof file.handle === 'string' && activeFileHandle === file.handle) ||
        (activeFileHandle.name && file.handle.name && activeFileHandle.name === file.handle.name) ||
        (file.name && activeFileHandle.name && file.name === activeFileHandle.name)
      );
      if (isActiveFile) {
        total += (editorValue?.length || 0);
      } else {
        total += (file.body?.length || 0);
      }
    }
    return total;
  }, [allMaterialFiles, activeFileHandle, editorValue]);

  // Initialize session start total (lazy — only on first valid data)
  if (allMaterialFiles && allMaterialFiles.length > 0 && sessionStartTotal === null) {
    setSessionStartTotal(currentTotal);
  }

  // ★ useMemo で直接計算（useEffect + setState の1フレーム遅延を排除）
  const currentSessionChars = useMemo(() => {
    if (sessionStartTotal === null) return 0;
    return currentTotal - sessionStartTotal;
  }, [currentTotal, sessionStartTotal]);

  const handleResetSession = useCallback(() => {
    setSessionStartTotal(currentTotal);
  }, [currentTotal]);

  return {
    currentSessionChars,
    handleResetSession,
  };
}
