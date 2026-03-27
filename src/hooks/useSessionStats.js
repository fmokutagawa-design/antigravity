import { useState, useEffect, useCallback } from 'react';
import { parseNote } from '../utils/metadataParser';

export function useSessionStats(allMaterialFiles, activeFileHandle, text) {
  const [sessionStartTotal, setSessionStartTotal] = useState(null);
  const [currentSessionChars, setCurrentSessionChars] = useState(0);

  // Calculate total characters in all files
  const calculateTotalChars = useCallback(() => {
    if (!allMaterialFiles) return 0;
    let total = 0;
    for (const file of allMaterialFiles) {
      const isActiveFile = activeFileHandle && file.handle && (
        (typeof activeFileHandle === 'string' && typeof file.handle === 'string' && activeFileHandle === file.handle) ||
        (activeFileHandle.name && file.handle.name && activeFileHandle.name === file.handle.name) ||
        (file.name && activeFileHandle.name && file.name === activeFileHandle.name)
      );
      if (isActiveFile) {
        total += (parseNote(text).body?.length || 0);
      } else {
        total += (file.body?.length || 0);
      }
    }
    return total;
  }, [allMaterialFiles, activeFileHandle, text]);

  // Initialize session start total
  useEffect(() => {
    if (allMaterialFiles && allMaterialFiles.length > 0 && sessionStartTotal === null) {
      setSessionStartTotal(calculateTotalChars());
    }
  }, [allMaterialFiles, sessionStartTotal, calculateTotalChars]);

  // Update session chars whenever text or files change
  useEffect(() => {
    if (sessionStartTotal !== null) {
      const currentTotal = calculateTotalChars();
      setCurrentSessionChars(currentTotal - sessionStartTotal);
    }
  }, [calculateTotalChars, sessionStartTotal]);

  const handleResetSession = useCallback(() => {
    setSessionStartTotal(calculateTotalChars());
    setCurrentSessionChars(0);
  }, [calculateTotalChars]);

  return {
    currentSessionChars,
    handleResetSession,
  };
}
