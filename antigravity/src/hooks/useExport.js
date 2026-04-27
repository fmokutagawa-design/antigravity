import { useCallback } from 'react';
import { generateEpub, downloadBlob } from '../utils/epubExporter';
import { generateDocx, downloadBlob as downloadDocxBlob } from '../utils/docxExporter';
import { applyFormat } from '../utils/formatText';

export function useExport(text, setText, activeFileHandle, projectHandle, settings, allMaterialFiles, showToast, activeTab, setActiveTab) {
  const handleFormat = (type) => {
    const result = applyFormat(text, type);
    if (result !== null) {
      setText(result);
    }
  };

  const handleEpubExport = async (pName, materials) => {
    if (!materials || materials.length === 0) {
      alert('エクスポートするファイルがありません');
      return;
    }
    try {
      const title = pName || 'Untitled';
      const author = '著者名'; // TODO: 設定から取得
      const epubFiles = materials
        .filter(f => f.name.endsWith('.txt') || f.name.endsWith('.md'))
        .filter(f => !f.name.startsWith('.'))
        .map(f => ({ name: f.name, content: f.body || f.content || '' }));

      if (epubFiles.length === 0) {
        alert('テキストファイルが見つかりません');
        return;
      }

      const blob = await generateEpub({
        title,
        author,
        files: epubFiles,
        isVertical: settings.isVertical !== false,
        projectHandle
      });
      downloadBlob(blob, `${title}.epub`);
      if (showToast) showToast('EPUBを書き出しました');
    } catch (err) {
      console.error('EPUB export failed:', err);
      alert('EPUB書き出しに失敗しました: ' + err.message);
    }
  };

  const handleDocxExport = async () => {
    try {
      const fileName = activeFileHandle?.name?.replace(/\.[^/.]+$/, '') || '原稿';
      const blob = await generateDocx({
        title: fileName,
        content: text,
        isVertical: settings.isVertical,
        fontName: '游明朝',
        pageSize: settings.pageSize || 'A4',
        orientation: settings.orientation || 'portrait',
      });
      downloadDocxBlob(blob, `${fileName}.docx`);
      if (showToast) showToast('Word(.docx)を書き出しました');
    } catch (err) {
      console.error('DOCX export failed:', err);
      if (showToast) showToast('DOCX書き出しに失敗しました: ' + err.message, 'error');
      else alert('DOCX書き出しに失敗しました: ' + err.message);
    }
  };

  const handlePrint = () => {
    if (activeTab !== 'preview') {
      const confirmPrint = window.confirm("原稿全体を印刷（PDF化）するにはプレビュー画面を使用します。\nプレビュー画面に切り替えて印刷しますか？");
      if (confirmPrint) {
        setActiveTab('preview');
        // 描画が完了するのを待ってから印刷ダイアログを出す
        setTimeout(() => window.print(), 500);
      }
    } else {
      window.print();
    }
  };

  return { handleFormat, handleEpubExport, handleDocxExport, handlePrint };
}
