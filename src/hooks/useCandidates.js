import { useState, useEffect, useCallback } from 'react';
import { fileSystem } from '../utils/fileSystem';

const CANDIDATES_FILE_NAME = '_candidates.json';

export function useCandidates(projectHandle, showToast) {
  const [candidates, setCandidates] = useState([]);

  // Load candidates when projectHandle changes
  useEffect(() => {
    const loadCandidates = async () => {
      if (projectHandle) {
        try {
          const fileHandle = await fileSystem.getFileHandle(projectHandle, CANDIDATES_FILE_NAME, { create: false });
          const content = await fileSystem.readFile(fileHandle);
          const parsedCandidates = JSON.parse(content);
          setCandidates(parsedCandidates);
          showToast('候補箱を読み込みました。');
        } catch (e) {
          if (!e.message?.includes('ENOENT') && !e.message?.includes('not found')) {
            console.warn('候補箱の読み込みに失敗:', e.message);
          }
          setCandidates([]);
        }
      } else {
        setCandidates([]); // Clear candidates if no project is open
      }
    };
    loadCandidates();
  }, [projectHandle, showToast]);

  // Save candidates when candidates state changes
  useEffect(() => {
    const saveCandidates = async () => {
      if (projectHandle && candidates.length > 0) {
        try {
          const fileHandle = await fileSystem.getFileHandle(projectHandle, CANDIDATES_FILE_NAME, { create: true });
          await fileSystem.writeFile(fileHandle, JSON.stringify(candidates, null, 2));
        } catch (e) {
          console.error('Failed to save candidates:', e);
          showToast('候補箱の保存に失敗しました。');
        }
      } else if (projectHandle && candidates.length === 0) {
        // If candidates become empty, delete the file
        try {
          await fileSystem.deleteEntry(await fileSystem.getFileHandle(projectHandle, CANDIDATES_FILE_NAME, { create: false }));
        } catch (e) {
          if (!e.message?.includes('ENOENT') && !e.message?.includes('not found')) {
            console.warn('Failed to delete empty candidates file:', e);
          }
        }
      }
    };
    saveCandidates();
  }, [candidates, projectHandle, showToast]);

  const addCandidate = useCallback((newCandidate) => {
    setCandidates(prev => {
      const candidateWithId = { ...newCandidate, id: Date.now(), status: 'pending' };
      return [...prev, candidateWithId];
    });
    showToast('候補を追加しました。');
  }, [showToast]);

  const adoptCandidate = useCallback((id) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: 'adopted' } : c));
    showToast('候補を採用しました。');
  }, [showToast]);

  const discardCandidate = useCallback((id) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: 'discarded' } : c));
    showToast('候補を破棄しました。');
  }, [showToast]);

  const discardAllCandidates = useCallback(() => {
    setCandidates(prev => prev.map(c => c.status === 'pending' ? { ...c, status: 'discarded' } : c));
    showToast('全ての候補を破棄しました。');
  }, [showToast]);

  return {
    candidates,
    addCandidate,
    adoptCandidate,
    discardCandidate,
    discardAllCandidates,
  };
}
