import { useEffect } from 'react';
import { loadProjectHandle, saveProjectHandle, clearProjectHandle } from '../utils/indexedDBUtils';
import { perfNow, perfMeasure } from '../utils/perfProbe';

export function useStatePersistence({
  debouncedText,
  activeFileHandle,
  isProjectMode,
  isWindowMode,
  settings,
  projectHandle,
  setProjectHandle,
  setLastSaved,
}) {
  // debouncedText → localStorage
  useEffect(() => {
    // Bug 4 修正: ファイル（Native/Project）が開いている場合は localStorage への保存を完全に抑止する
    if (activeFileHandle) return; 
    if (isProjectMode) return; 
    if (!debouncedText && debouncedText !== '') return;

    const t0 = perfNow();
    const isLarge = debouncedText.length > 100000;
    if (!isLarge) {
      localStorage.setItem('novel-editor-text', debouncedText);
    }
    perfMeasure('App.localStorageSave', t0, {
      textLength: debouncedText.length,
      skipped: isLarge,
      isProjectMode,
      hasActiveFileHandle: !!activeFileHandle,
    });
    setLastSaved(new Date());
  }, [debouncedText, isProjectMode, activeFileHandle, setLastSaved]);

  // settings → localStorage
  useEffect(() => {
    const settingsKey = isWindowMode ? 'novel-editor-settings-window' : 'novel-editor-settings';
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  }, [settings, isWindowMode]);

  // theme → body dataset
  useEffect(() => {
    // Apply theme and style to body dataset for clean CSS
    document.body.dataset.colorTheme = settings.colorTheme || 'light';
    const paperStyle = settings.paperStyle || 'plain';
    document.body.dataset.paperStyle = paperStyle === 'grid' ? 'manuscript' : paperStyle;

    // Keep legacy class for dark mode compatibility if needed elsewhere
    if (settings.colorTheme === 'dark' || settings.colorTheme === 'blackboard') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    // Clean up old classes
    document.body.classList.remove('theme-blackboard', 'theme-notebook');
  }, [settings.colorTheme, settings.paperStyle]);

  // Load project handle from IndexedDB on mount
  useEffect(() => {
    const loadSavedProject = async () => {
      try {
        const savedHandle = await loadProjectHandle();
        if (savedHandle) {
          // Verify permission
          const permission = await savedHandle.queryPermission({ mode: 'readwrite' });
          if (permission === 'granted') {
            setProjectHandle(savedHandle);
            // The file tree and project mode will be set by the useMaterials hook and its effects
          } else {
            // Permission not granted, clear saved handle
            await clearProjectHandle();
          }
        }
      } catch (error) {
        console.error('Failed to load saved project:', error);
        await clearProjectHandle();
      }
    };

    loadSavedProject();
  }, [setProjectHandle]);

  // Save project handle to IndexedDB when it changes
  useEffect(() => {
    if (projectHandle) {
      saveProjectHandle(projectHandle).catch(error => {
        console.error('Failed to save project handle:', error);
      });
    }
  }, [projectHandle]);
}
