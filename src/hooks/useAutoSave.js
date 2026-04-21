import { useEffect, useRef } from 'react';
import { fileSystem } from '../utils/fileSystem';
import { saveSnapshot } from '../utils/snapshotStore';
import { perfNow, perfMeasure, perfLog } from '../utils/perfProbe';

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
  setProjectSettings,
  setIsRapidMode,
  activeFileHandleRef,
  debouncedTextRef,
  settings, // 追加
  showToast,
}) {
  // Auto-save to active file in project mode
  // ★ debouncedText は Editor(500ms) + App(500ms) で既に約1秒遅延済み
  //    さらに setTimeout を挟んで節電する。
  //    スロットル方式: debouncedText 変更で即保存、ただし前回から規定時間未満ならスキップ
  //
  //    旧仕様は 1 秒スロットルだったが、42万字クラスのファイルだと
  //    IPC 経由の writeFile 自体が数百ms〜数秒かかり、打鍵のたびに
  //    IPC キューが詰まってメインスレッドが長時間ブロックされる。
  //    このため「十分な休憩」を与える長いスロットルに変更する。
  const lastSaveTimeRef = useRef(0);
  useEffect(() => {
    if (!isProjectMode || !activeFileHandle || debouncedText === undefined) return;
    // ★ 安全策: 空文字列での保存を禁止（ファイル消失防止）
    if (!debouncedText || debouncedText.length === 0) return;
    // ★ 同一内容なら保存しない（無駄な I/O 回避）
    if (debouncedText === lastSavedTextRef.current) return;

    // ★ ファイルサイズに応じてスロットルを変える。
    //    大きいファイルは I/O コストが高く、またクラッシュ復旧も手動で再読込すれば済む。
    //    10万字超: 10秒、20万字超: 20秒、それ以外: 5秒
    const len = debouncedText.length;
    let throttleMs;
    if (len > 200000) throttleMs = 20000;
    else if (len > 100000) throttleMs = 10000;
    else throttleMs = 5000;

    const now = Date.now();
    const elapsed = now - lastSaveTimeRef.current;

    const doSave = async () => {
      const tStart = perfNow();
      // Bug F 対策: closure の debouncedText/activeFileHandle ではなく Ref の最新値を使う
      const currentHandle = activeFileHandleRef.current;
      const currentText = debouncedTextRef.current;

      try {
        if (!currentHandle) return;

        // ジャーナリング設定を反映
        const options = {
          disableJournal: settings?.enableJournaling === false
        };

        await fileSystem.writeFile(currentHandle, currentText, options);
        setLastSaved(new Date());
        lastSavedTextRef.current = currentText;
        lastSaveTimeRef.current = Date.now();
        perfMeasure('useAutoSave.doSave', tStart, {
          ok: true,
          textLength: currentText.length,
          throttleMs,
          elapsed,
        });
      } catch (error) {
        perfMeasure('useAutoSave.doSave', tStart, {
          ok: false,
          textLength: currentText.length,
          throttleMs,
          elapsed,
          error: String(error),
        });
        console.error('Failed to auto-save:', error);
        showToast('⚠️ 自動保存に失敗しました');
      }
    };

    if (elapsed >= throttleMs) {
      // 前回保存から規定時間経過 → 即保存
      doSave();
    } else {
      // 前回保存から規定時間未満 → 残り時間後に保存
      const timer = setTimeout(doSave, throttleMs - elapsed);
      return () => clearTimeout(timer);
    }
  }, [debouncedText, isProjectMode, activeFileHandle, setLastSaved, lastSavedTextRef, showToast, activeFileHandleRef, debouncedTextRef, settings?.enableJournaling]);

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

      // Bug G, H 対策: closure の debouncedText ではなく Ref の最新値を使う
      const currentText = debouncedTextRef.current;
      if (!currentText) return;

      const charDiff = Math.abs(currentText.length - lastText.length);
      const timeDiff = now - lastTime;

      if (timeDiff >= INTERVAL || charDiff >= CHAR_THRESHOLD) {
        if (currentText !== lastText) {
          const snapT0 = perfNow();
          saveSnapshot(filePath, currentText, currentText.length)
            .then(() => {
              perfMeasure('useAutoSave.snapshot.tick', snapT0, { len: currentText.length });
            })
            .catch(e => {
              perfMeasure('useAutoSave.snapshot.tick.fail', snapT0, { error: String(e) });
              console.warn('Snapshot save failed:', e);
            });
          lastSnapshotRef.current = { text: currentText, time: now };
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
