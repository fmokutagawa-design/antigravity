export function usePresets({
  setInputModalMode,
  setInputModalValue,
  setShowInputModal,
  settings,
  setPresets,
  inputModalMode,
  pendingRenameTarget,
  fileSystem,
  activeFileHandle,
  setActiveFileHandle,
  refreshMaterials,
  pendingCreateParent,
  handleCreateFileInProject,
  handleCreateFolderInProject,
  pendingTag,
  projectHandle,
  latestMetadataRef,
  setFileTree,
  handleFileSelect,
  showToast,
  pendingAIContent,
  setText,
  editorRef,
  setPendingRenameTarget,
  setPendingCreateParent,
  setPendingAIContent,
  setPendingTag,
  presets,
  setSettings,
  requestConfirm
}) {

  const handleSavePreset = (name) => {
    // If name is not provided (event object or empty), open modal
    if (!name || typeof name !== 'string') {
      setInputModalMode('save_preset');
      setInputModalValue('');
      setShowInputModal(true);
      return;
    }

    const newPreset = {
      id: Date.now().toString(),
      name,
      settings: { ...settings }
    };
    setPresets(prev => [...prev, newPreset]);
  };

  const handleInputModalSubmit = async (value) => {
    setShowInputModal(false);
    try {

      if (inputModalMode === 'rename' && pendingRenameTarget) {
        if (!value || value === pendingRenameTarget.name) return;

        const newPath = await fileSystem.rename(pendingRenameTarget.handle, value);

        // Update Tab if renamed
        if (activeFileHandle && activeFileHandle.handle === pendingRenameTarget.handle) {
          setActiveFileHandle({ ...activeFileHandle, handle: newPath.handle, name: newPath.name });
        }

        // Refresh
        await refreshMaterials();

      } else if (inputModalMode === 'create_file') {
        if (value) {
          const fullName = value.endsWith('.txt') ? value : `${value}.txt`;
          await handleCreateFileInProject(pendingCreateParent, fullName);
        }
      } else if (inputModalMode === 'create_folder') {
        if (value) {
          await handleCreateFolderInProject(pendingCreateParent, value);
        }
      } else if (inputModalMode === 'save_preset') {
        if (value) {
          handleSavePreset(value);
        }

      } else if (inputModalMode === 'create_file_with_tag') {
        if (value && pendingTag) {
          const fullName = value.trim().endsWith('.txt') ? value.trim() : `${value.trim()}.txt`;
          const tagName = pendingTag;

          try {
            const tagLower = tagName.toLowerCase();
            let rootFolderName = 'materials';
            let subfolderName = '';

            if (['プロット', 'Plot'].some(t => tagLower.includes(t.toLowerCase()))) {
              rootFolderName = 'plots';
            } else {
              if (['登場人物', 'Character', 'キャラ'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'characters';
              else if (['世界観', 'World', '世界'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'world';
              else if (['舞台', 'Location', '場所'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'locations';
              else if (['アイテム', 'Item', '道具'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'items';
              else if (['魔法', 'Magic', 'スキル'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'magic';
            }

            // Ensure folders exist
            let targetHandle = projectHandle;
            latestMetadataRef.current = { ...latestMetadataRef.current, tags: [tagName] }; // Bug A 対策

            // Check/Create root
            let rootHandle;
            try {
              rootHandle = await projectHandle.getDirectoryHandle(rootFolderName, { create: true });
            } catch (e) { console.error(e); }

            if (rootHandle) {
              targetHandle = rootHandle;
              if (subfolderName) {
                try {
                  targetHandle = await rootHandle.getDirectoryHandle(subfolderName, { create: true });
                } catch (e) { console.error(e); }
              }
            }

            // Create File
            const fileHandle = await targetHandle.getFileHandle(fullName, { create: true });

            // Write initial content with tag
            const initialContent = `-- -\ntags: [${tagName}]\n-- -\n# ${fullName.replace('.txt', '')} \n\n`;
            const options = { disableJournal: settings?.enableJournaling === false };
            await fileSystem.writeFile(fileHandle, initialContent, options);

            // Refresh and Open
            await refreshMaterials();
            const tree = await fileSystem.readDirectory(projectHandle);
            setFileTree(tree);

            await handleFileSelect(fileHandle);
            showToast(`「${tagName}」のファイルを自動振り分けで作成しました`);

          } catch (e) {
            console.error(e);
            showToast('ファイルの作成に失敗しました: ' + e.message);
          }
        }
      } else if (inputModalMode === 'ai_create_file') {
        if (value && pendingAIContent) {
          const fullName = value.endsWith('.txt') ? value : `${value}.txt`;
          try {
            // If project mode, save to project
            if (projectHandle) {
              const fileHandle = await projectHandle.getFileHandle(fullName, { create: true });
              await fileSystem.writeFile(fileHandle, pendingAIContent);
              const tree = await fileSystem.readDirectory((projectHandle));
              setFileTree(tree);
              setActiveFileHandle(fileHandle);
              setText(pendingAIContent);
              showToast(`${fullName} に出力しました。`);
            }
          } catch (e) {
            console.error(e);
            showToast('ファイルの作成に失敗しました。');
          }
        }
      } else if (inputModalMode === 'insert_todo') {
        if (value) {
          // Parse "カテゴリ | 内容" or just "内容"
          const parts = value.split('|').map(s => s.trim());
          let todoText;
          if (parts.length >= 2) {
            todoText = `[TODO: ${parts[0]} | ${parts.slice(1).join('|')}]`;
          } else {
            todoText = `[TODO: その他 | ${value}]`;
          }
          // Insert at cursor position via editor ref
          if (editorRef.current?.insertText) {
            editorRef.current.insertText(todoText);
          } else {
            // Fallback: append to text
            setText(prev => prev + todoText);
          }
        }
      }

      setPendingRenameTarget(null);
      setPendingCreateParent(null);
      setPendingAIContent(null);
      setPendingTag(null);

    } catch (error) {
      console.error('Modal action failed:', error);
      showToast('操作に失敗しました: ' + error.message);
    }
  };

  const handleLoadPreset = (presetId) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setSettings(preset.settings);
    }
  };

  const handleDeletePreset = async (presetId) => {
    if (await requestConfirm("確認", 'このプリセットを削除しますか？')) {
      setPresets(prev => prev.filter(p => p.id !== presetId));
    }
  };

  return {
    handleSavePreset,
    handleInputModalSubmit,
    handleLoadPreset,
    handleDeletePreset
  };
}
