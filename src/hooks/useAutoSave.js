import { useEffect, useRef } from 'react';
import { fileSystem } from '../utils/fileSystem';
import { saveSnapshot } from '../utils/snapshotStore';

/**
 * useAutoSave
 * 
 * Handles auto-saving to active file in project mode,
 * periodic snapshot creation, and nexus-project.json loading.
 */
export function useAutoSave({
  text,
  debouncedText,
  isProjectMode,
  activeFileHandle,
  projectHandle,
  setLastSaved,
  lastSavedTextRef,
  showToast,
  setProjectSettings,
  setIsRapidMode,
}) {
  // Auto-save to active file in project mode
  useEffect(() => {
    if (isProjectMode && activeFileHandle && debouncedText !== undefined) {
      const saveTimeout = setTimeout(async () => {
        try {
          await fileSystem.writeFile(activeFileHandle, debouncedText);
          setLastSaved(new Date());
          lastSavedTextRef.current = debouncedText;
        } catch (error) {
          console.error('Failed to auto-save:', error);
          showToast('⚠️ 自動保存に失敗しました');
        }
      }, 1000);

      return () => clearTimeout(saveTimeout);
    }
  }, [debouncedText, isProjectMode, activeFileHandle, setLastSaved, lastSavedTextRef, showToast]);

  // Auto-snapshot: 5分間隔 or 500文字以上の変更で自動スナップショット
  const lastSnapshotRef = useRef({ text: '', time: 0 });

  useEffect(() => {
    if (!isProjectMode || !activeFileHandle || !debouncedText) return;

    const filePath = typeof activeFileHandle === 'string'
      ? activeFileHandle
      : (activeFileHandle.handle || activeFileHandle.name || 'unknown');

    const INTERVAL = 5 * 60 * 1000; // 5分
    const CHAR_THRESHOLD = 500;

    const timer = setInterval(() => {
      const now = Date.now();
      const lastText = lastSnapshotRef.current.text;
      const lastTime = lastSnapshotRef.current.time;
      const charDiff = Math.abs(debouncedText.length - lastText.length);
      const timeDiff = now - lastTime;

      if (timeDiff >= INTERVAL || charDiff >= CHAR_THRESHOLD) {
        if (debouncedText !== lastText) {
          saveSnapshot(filePath, debouncedText, debouncedText.length).catch(e =>
            console.warn('Snapshot save failed:', e)
          );
          lastSnapshotRef.current = { text: debouncedText, time: now };
        }
      }
    }, 30000); // 30秒ごとにチェック

    return () => clearInterval(timer);
  }, [debouncedText, isProjectMode, activeFileHandle]);

  // ファイル切替時にスナップショットの基準をリセット＋初回保存
  useEffect(() => {
    lastSnapshotRef.current = { text: text || '', time: Date.now() };
    if (isProjectMode && activeFileHandle && text) {
      const fp = typeof activeFileHandle === 'string'
        ? activeFileHandle
        : (activeFileHandle.handle || activeFileHandle.name || '');
      if (fp) {
        saveSnapshot(fp, text, text.length).catch(e =>
          console.warn('Initial snapshot failed:', e)
        );
      }
    }
  }, [activeFileHandle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load nexus-project.json when project opens
  useEffect(() => {
    if (!projectHandle) return;
    (async () => {
      try {
        const settingsHandle = await fileSystem.getFile(projectHandle, 'nexus-project.json');
        if (settingsHandle) {
          const content = await fileSystem.readFile(settingsHandle);
          const parsed = JSON.parse(content);
          setProjectSettings(prev => ({ ...prev, ...parsed }));
          if (parsed.rapidModeDefault) setIsRapidMode(true);
        }
      } catch {
        console.log('nexus-project.json not found, will create on first settings save');
      }
    })();
  }, [projectHandle, setProjectSettings, setIsRapidMode]);
}
