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

  // ★ フッター統計をメモ化（10万字のTODO正規表現を毎レンダリングで走らせない）
  const footerStats = useMemo(() => {
    const len = debouncedText.length;
    const pages = Math.ceil(len / 400);
    const todoMatches = debouncedText.match(/\[TODO:/g);
    const todoCount = todoMatches ? todoMatches.length : 0;
    return { len, pages, todoCount };
  }, [debouncedText]);

  // 既存のフォルダ（またはルートにあるバラバラのファイル）から作品（マニフェスト）を生成する
  const handleAdoptFolderAsWork = async () => {
    if (!activeFileHandle || activeManifest || !projectHandle) {
      showToast("現在のファイルは既に作品管理下にあるか、無効な状態です。");
      return;
    }

    const currentName = activeFileHandle.name.replace(/\.txt$/, '');
    // 末尾の数字や「第x」「#xx」を話数とみなし、その手前までをタイトル候補とする
    // 例: "機動戦士ガンダム 虚空の三叉 01" -> "機動戦士ガンダム 虚空の三叉"
    const trimmed = currentName.replace(/[\s\u3000]*(第?\d+話?|#?\d+|第.+?話)[\s\u3000]*$/, '').trim();
    const suggestedPrefix = trimmed || currentName;

    // プロジェクト内から似た名前のファイルを探す（スマート検出）
    const similarFiles = allMaterialFiles.filter(f => {
      if (f.kind !== 'file' || !f.name.endsWith('.txt')) return false;
      return f.name.startsWith(suggestedPrefix);
    });

    const fileListStr = similarFiles.map(f => `・${f.name}`).join('\n');
    const confirmed = await requestConfirm(
      "作品として初期化",
      `以下の${similarFiles.length}個のファイルを作品「${suggestedPrefix}」としてまとめますか？\n\n${fileListStr}\n\n※これらのファイルは新しいフォルダへ移動されます。`
    );

    if (!confirmed) return;

    setInputModalMode('adopt_folder');
    setInputModalValue(suggestedPrefix);
    setPendingAdoptFiles({
      handles: similarFiles.map(f => f.handle),
      names: similarFiles.map(f => f.name),
      prefix: suggestedPrefix
    });
    setShowInputModal(true);
  };

  const isConcatenatingRef = useRef(false);

  // 分割作品の全文連結ロジック
  useEffect(() => {
    if (!activeManifest || !projectHandle) {
      setConcatenatedWorkText('');
      return;
    }

    const updateConcatenatedText = async () => {
      if (isConcatenatingRef.current) return;
      isConcatenatingRef.current = true;
      try {
        const segments = activeManifest.segments;
        const parts = [];
        const offsets = [];
        let currentOffset = 0;

        for (const seg of segments) {
          const isCurrentSegment = activeFileHandle && (
            (typeof activeFileHandle === 'string' && activeFileHandle.endsWith(seg.file)) ||
            (activeFileHandle.name === seg.file)
          );

          let content = "";
          if (isCurrentSegment) {
            content = text;
          } else {
            const segFile = await fileSystem.getFile(activeManifest.dirHandle, seg.file);
            if (segFile) {
              content = await fileSystem.readFile(segFile.handle);
            } else {
              content = `\n[エラー: ${seg.displayName} (${seg.file}) が見つかりません]\n`;
            }
          }

          offsets.push({
            file: seg.file,
            start: currentOffset,
            end: currentOffset + content.length
          });
          parts.push(content);
          currentOffset += content.length + 2;
        }
        setSegmentOffsets(offsets);
        setConcatenatedWorkText(parts.join('\n\n'));
      } catch (e) {
        console.error('Failed to concatenate work:', e);
      } finally {
        isConcatenatingRef.current = false;
      }
    };

    // モーダル表示中は、重い連結処理を避ける（入力中のチラつきや消失を防止）
    if (showInputModal) return;

    updateConcatenatedText();
  }, [activeManifest, debouncedText, activeFileHandle, projectHandle, showInputModal]);
