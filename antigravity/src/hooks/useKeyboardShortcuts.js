import { useEffect } from 'react';

export function useKeyboardShortcuts({
  setIsSearchOpen,
  handleSaveFileRef,
  setIsRapidMode,
  setShowReader,
  setInputModalMode,
  setInputModalValue,
  setShowInputModal
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      // Cmd+S: Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (handleSaveFileRef.current) handleSaveFileRef.current();
      }
      // Cmd+Shift+R: Toggle rapid writing mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        setIsRapidMode(prev => !prev);
      }
      // Alt+R: Reader Mode
      if (e.altKey && (e.code === 'KeyR' || e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        setShowReader(prev => !prev);
      }
      // Cmd+T: Insert TODO
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        setInputModalMode('insert_todo');
        setInputModalValue('');
        setShowInputModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    setIsSearchOpen,
    handleSaveFileRef,
    setIsRapidMode,
    setShowReader,
    setInputModalMode,
    setInputModalValue,
    setShowInputModal
  ]);
}
