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
  // ★ debouncedText は Editor(500ms) + App(500ms) で既に約1秒遅延済み
  //    さらに setTimeout(1000) を挟むと最大2秒の遅延になるため、
  //    スロットル方式に変更: debouncedText 変更で即保存、ただし前回から1秒未満ならスキップ
  const lastSaveTimeRef = useRef(0);
  useEffect(() => {
    if (!isProjectMode || !activeFileHandle || debouncedText === undefined) return;
    // ★ 安全策: 空文字列での保存を禁止（ファイル消失防止）
    if (!debouncedText || debouncedText.length === 0) return;
    // ★ 同一内容なら保存しない（無駄な I/O 回避）
    if (debouncedText === lastSavedTextRef.current) return;

    // ★ 追加のセーフティガード: 保存する内容が、直前にファイルからロードされた内容と極端に乖離していないか？
    // もし前回ロード時から1文字も変更されていないはずなのに、debouncedText が異なる場合は、
    // それは前のファイルの内容が残っている可能性が高い。
    // (App.jsxの handleOpenFile で debouncedText も更新するようになったため、通常はここはスキップされる)

    const now = Date.now();
    const elapsed = now - lastSaveTimeRef.current;

    const doSave = async () => {
      // 保存直前にもう一度ハンドルを確認（非同期の間に切り替わっていないか）
      const currentHandle = activeFileHandle;
      try {
        // 安全ガード: ハンドルが切り替わっていたら保存しない（前ファイルの内容を上書きしない）
        // 文字数での判定は大量削除・章分割時に保存を拒否する危険があるため廃止。
        if (currentHandle !== activeFileHandle) {
          console.warn('自動保存をブロック: ファイルハンドルが切り替わっている');
          return;
        }

        await fileSystem.writeFile(currentHandle, debouncedText);
        setLastSaved(new Date());
        lastSavedTextRef.current = debouncedText;
        lastSaveTimeRef.current = Date.now();
      } catch (error) {
        console.error('Failed to auto-save:', error);
        showToast('⚠️ 自動保存に失敗しました');
      }
    };

    if (elapsed >= 1000) {
      // 前回保存から1秒以上経過 → 即保存
      doSave();
    } else {
      // 前回保存から1秒未満 → 残り時間後に保存
      const timer = setTimeout(doSave, 1000 - elapsed);
      return () => clearTimeout(timer);
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
