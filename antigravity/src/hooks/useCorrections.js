export function useCorrections(
  text,
  setText,
  corrections,
  setCorrections,
  editorRef,
  showToast,
  isProjectMode,
  setPendingAIContent,
  setInputModalMode,
  setInputModalValue,
  setShowInputModal
) {
  const handleAIInsert = async (insertedText, mode = 'current') => {
    if (mode === 'new-file') {
      if (!isProjectMode) {
        showToast('新規ファイルへの出力はプロジェクトモードでのみ可能です。', 'error');
        return;
      }
      setPendingAIContent(insertedText);
      setInputModalMode('ai_create_file');
      setInputModalValue('');
      setShowInputModal(true);
    } else if (mode === 'replace') {
      if (insertedText.original && insertedText.suggested) {
        // From correction
        if (text.includes(insertedText.original)) {
          setText(text.replace(insertedText.original, insertedText.suggested));
        } else {
          showToast('指摘箇所が見つかりませんでした。');
        }
      } else {
        // Simple replace at cursor (used for rewrite)
        editorRef.current?.insertText(insertedText);
      }
    } else if (mode === 'append') {
      // Append content appropriately (used for continue)
      const insertion = typeof insertedText === 'string' ? insertedText : (insertedText.suggested || '');
      setText(prev => prev.trimEnd() + insertion);
    } else if (mode === 'jump') {
      const { original } = insertedText;
      if (!original || !editorRef.current) return;

      const index = text.indexOf(original);
      if (index !== -1) {
        editorRef.current.jumpToPosition(index, index + original.length);
      } else {
        showToast('指摘箇所が見つかりませんでした。');
      }
    } else {
      if (editorRef.current) {
        editorRef.current.insertText(insertedText);
      } else {
        setText(prev => prev + '\n' + insertedText);
      }
    }
  };

  const handleApplyCorrection = (correction) => {
    if (!text.includes(correction.original)) {
      showToast('修正箇所の原文が見つかりませんでした。', 'error');
      return;
    }
    const newText = text.replace(correction.original, correction.suggested);
    setText(newText);
    setCorrections(prev => prev.filter(c => c.id !== correction.id));
    showToast('修正を適用しました');
  };

  const handleDiscardCorrection = (id) => {
    setCorrections(prev => prev.filter(c => c.id !== id));
  };

  const handleApplyAllCorrections = () => {
    let currentText = text;
    let appliedCount = 0;
    const remainingCorrections = [];
    corrections.forEach(c => {
      if (currentText.includes(c.original)) {
        currentText = currentText.replace(c.original, c.suggested);
        appliedCount++;
      } else {
        remainingCorrections.push(c);
      }
    });
    setText(currentText);
    setCorrections(remainingCorrections);
    if (remainingCorrections.length > 0) {
      showToast(`${appliedCount}件適用しましたが、${remainingCorrections.length}件は適用できませんでした。`);
    } else {
      showToast(`${appliedCount}件の修正をすべて適用しました`);
    }
  };

  return { handleAIInsert, handleApplyCorrection, handleDiscardCorrection, handleApplyAllCorrections };
}
