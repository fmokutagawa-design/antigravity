import { useRef, useCallback } from 'react';
import { saveTextFile, loadTextFile } from '../utils/fileUtils';
import { fileSystem, isNative } from '../utils/fileSystem';
import { parseNote } from '../utils/metadataParser';

/**
 * useFileOperations
 * 
 * Handles single-file save/load/duplicate/update and batch operations.
 * Extracted from App.jsx to reduce component size.
 */
export function useFileOperations({
  text,
  setText,
  activeFileHandle,
  setActiveFileHandle,
  projectHandle,
  allMaterialFiles,
  refreshMaterials,
  setLastSaved,
  lastSavedTextRef,
  showToast,
  setFileTree,
  setActiveTab,
  autoOrganizeFile,
  handleOpenFile,
  handleCreateFileInProject,
  openInputModal,
  settings,
}) {
  const handleSaveFileRef = useRef(null);

  const handleSaveFile = useCallback(async () => {
    if (activeFileHandle && projectHandle) {
      try {
        const { metadata } = parseNote(text);

        const options = { disableJournal: settings?.enableJournaling === false };
        await fileSystem.writeFile(activeFileHandle, text, options);

        // Trigger Auto-Organize
        const newHandle = await autoOrganizeFile(activeFileHandle, metadata);
        if (newHandle && (newHandle !== activeFileHandle)) {
          setActiveFileHandle(newHandle);
          await refreshMaterials();
        }
        setLastSaved(new Date());
        lastSavedTextRef.current = text;
        showToast('💾 保存しました');

      } catch (error) {
        console.error('Failed to save file:', error);
        showToast('ファイルの保存に失敗しました。');
      }
    } else {
      // Fallback to download
      try {
        saveTextFile(text);
      } catch (error) {
        console.error('Failed to save file:', error);
        showToast('ファイルの保存に失敗しました。');
      }
    }
  }, [text, activeFileHandle, projectHandle, autoOrganizeFile, setActiveFileHandle, refreshMaterials, setLastSaved, lastSavedTextRef, showToast, settings?.enableJournaling]);

  // Keep ref in sync
  handleSaveFileRef.current = handleSaveFile;

  const handleUpdateFile = useCallback(async (handle, newContent) => {
    try {
      const options = { disableJournal: settings?.enableJournaling === false };
      await fileSystem.writeFile(handle, newContent, options);
      await refreshMaterials();

      // Bug K 対策: ブラウザ版のハンドル比較に対応
      const isSame = async (h1, h2) => {
        if (!h1 || !h2) return false;
        if (isNative) {
          const p1 = typeof h1 === 'string' ? h1 : h1.handle;
          const p2 = typeof h2 === 'string' ? h2 : h2.handle;
          return p1 === p2;
        }
        if (h1 === h2) return true;
        if (h1.isSameEntry) return await h1.isSameEntry(h2);
        return false;
      };

      if (await isSame(activeFileHandle, handle)) {
        setText(newContent);
        lastSavedTextRef.current = newContent; // 同期
      }
      return true;
    } catch (e) {
      console.error("Failed to update file:", e);
      return false;
    }
  }, [activeFileHandle, setText, refreshMaterials, lastSavedTextRef, settings?.enableJournaling]);

  const handleLoadFile = useCallback(async (file) => {
    try {
      const content = await loadTextFile(file);
      setText(content);
    } catch (error) {
      console.error('Failed to load file:', error);
      showToast('ファイルの読み込みに失敗しました。\n' + error.message);
    }
  }, [setText, showToast]);

  const handleDuplicateFile = useCallback(async (handleToDup = activeFileHandle) => {
    if (!handleToDup) return;

    let contentToSave = text;
    if (handleToDup !== activeFileHandle) {
      try {
        contentToSave = await fileSystem.readFile(handleToDup);
      } catch (err) {
        console.error("Failed to read file for duplication", err);
      }
    }

    const currentName = typeof handleToDup === 'string'
      ? handleToDup.split(/[/\\]/).pop()
      : handleToDup.name;
    const extIndex = currentName.lastIndexOf('.');
    const baseName = extIndex !== -1 ? currentName.substring(0, extIndex) : currentName;
    const ext = extIndex !== -1 ? currentName.substring(extIndex) : '.txt';
    const defaultNewName = `${baseName}_copy${ext}`;

    try {
      if (isNative) {
        const currentPath = typeof handleToDup === 'string' ? handleToDup : null;
        let defaultPath = defaultNewName;
        if (currentPath) {
          const sep = currentPath.includes('\\') ? '\\' : '/';
          const parentDir = currentPath.substring(0, currentPath.lastIndexOf(sep));
          defaultPath = `${parentDir}${sep}${defaultNewName} `;
        }

        const newPath = await fileSystem.saveFile(defaultPath);
        if (!newPath) return; // Cancelled

        await fileSystem.writeFile(newPath, contentToSave, {
          disableJournal: settings?.enableJournaling === false
        });

        const projectPath = typeof projectHandle === 'string' ? projectHandle : projectHandle?.handle;
        if (projectPath) {
          await refreshMaterials();
        }

        // handleFileSelect equivalent
        const fileName = newPath.split(/[/\\]/).pop();
        await handleOpenFile(newPath, fileName);
        showToast(`「${fileName}」として保存しました。`);

      } else if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultNewName,
          types: [{
            description: 'Text Files',
            accept: { 'text/plain': ['.txt'] },
          }],
        });
        const writable = await handle.createWritable();
        // Bug L 修正: text ではなく contentToSave を使う
        await writable.write(contentToSave);
        await writable.close();

        setActiveFileHandle(handle);
        if (projectHandle) await refreshMaterials();
        showToast('保存しました。');
      } else {
          openInputModal('保存', '新しいファイル名を入力してください:', defaultNewName, async (newName) => {
            if (!newName) return;
            // Bug L 修正: text ではなく contentToSave を使う
            await handleCreateFileInProject(null, newName, contentToSave, {
              disableJournal: settings?.enableJournaling === false
            });
            showToast('プロジェクトルートに保存しました（ブラウザ制限のため場所指定不可）。');
          });
          return;
        }
        const newName = window.prompt('新しいファイル名を入力してください:', defaultNewName);
        if (!newName) return;
        // Bug L 修正
        await handleCreateFileInProject(null, newName, contentToSave, {
          disableJournal: settings?.enableJournaling === false
        });
        showToast('プロジェクトルートに保存しました（ブラウザ制限のため場所指定不可）。');
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e);
        showToast('保存に失敗しました。');
      }
    }
  }, [text, activeFileHandle, projectHandle, refreshMaterials, showToast, handleOpenFile, handleCreateFileInProject, openInputModal, setActiveFileHandle]);

  const handleBatchCopy = useCallback(async (filesToCopy) => {
    if (!filesToCopy || filesToCopy.length === 0) return;

    let clipboardText = "以下の資料を参考にしてください:\n\n";

    for (const file of filesToCopy) {
      const body = file.body || file.content || "";
      clipboardText += `## Filename: ${file.name}\n${body}\n\n---\n\n`;
    }

    try {
      await navigator.clipboard.writeText(clipboardText);
      showToast(`${filesToCopy.length} 件のファイルをクリップボードにコピーしました！`);
    } catch (e) {
      console.error("Copy failed", e);
      showToast("コピーに失敗しました。");
    }
  }, [showToast]);

  const handleBatchExport = useCallback(async () => {
    if (!allMaterialFiles || allMaterialFiles.length === 0) {
      showToast('プロジェクトファイルがありません。');
      return;
    }
    try {
      // 原稿ファイルを収集
      const manuscriptFiles = allMaterialFiles.filter(f => {
        const type = f.metadata?.種別 || '';
        const name = f.name || '';
        const isManuscript = type === '原稿' || name.includes('原稿') || name.includes('本原稿');
        return isManuscript && name.endsWith('.txt');
      });
      const targetFiles = manuscriptFiles.length > 0 ? manuscriptFiles : allMaterialFiles.filter(f => (f.name || '').endsWith('.txt'));
      if (targetFiles.length === 0) {
        showToast('書き出し対象のファイルが見つかりません。');
        return;
      }
      // ファイル名順にソート
      targetFiles.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
      // 結合
      const parts = [];
      for (const file of targetFiles) {
        const content = file.body || file.content || '';
        if (content.trim()) {
          parts.push(content);
        }
      }
      const merged = parts.join('\n\n［＃改ページ］\n\n');
      // 保存
      if (isNative) {
        const defaultPath = (projectHandle?.handle || projectHandle || '') + '/exported.txt';
        const savePath = await fileSystem.saveFile(defaultPath);
        if (savePath) {
          await fileSystem.writeFile({ handle: savePath, name: 'exported.txt' }, merged, {
            disableJournal: settings?.enableJournaling === false
          });
          showToast(`${targetFiles.length}ファイルを結合して書き出しました。`);
        }
      } else {
        const blob = new Blob([merged], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exported.txt';
        a.click();
        URL.revokeObjectURL(url);
        showToast(`${targetFiles.length}ファイルを結合して書き出しました。`);
      }
    } catch (e) {
      console.error('Batch export failed:', e);
      showToast('一括書き出しに失敗しました: ' + e.message);
    }
  }, [allMaterialFiles, projectHandle, showToast]);

  return {
    handleSaveFile,
    handleSaveFileRef,
    handleUpdateFile,
    handleLoadFile,
    handleDuplicateFile,
    handleBatchCopy,
    handleBatchExport,
  };
}
