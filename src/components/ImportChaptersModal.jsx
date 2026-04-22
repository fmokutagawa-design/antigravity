import React, { useState, useCallback } from 'react';
import { fileSystem } from '../utils/fileSystem';
import { createEmptyManifest, writeManifest } from '../utils/manifest';
import './ImportChaptersModal.css';

/**
 * ImportChaptersModal
 * 
 * 既存の分割ファイルを選択し、.nexus フォルダにまとめるモーダル。
 */
export default function ImportChaptersModal({
  isOpen,
  onClose,
  projectHandle,
  allFiles,        // プロジェクト内の全ファイル一覧
  refreshMaterials,
  showToast,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [workTitle, setWorkTitle] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  // allFiles から .txt ファイルのみ抽出
  const txtFiles = (allFiles || []).filter(f => 
    f.name && f.name.endsWith('.txt') && f.kind === 'file'
  );

  const moveUp = useCallback((index) => {
    if (index <= 0) return;
    setSelectedFiles(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((index) => {
    setSelectedFiles(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const executeImport = useCallback(async () => {
    if (selectedFiles.length === 0 || !workTitle.trim()) {
      showToast('作品タイトルとファイルを選択してください');
      return;
    }

    setIsExecuting(true);
    try {
      const nexusFolderName = `${workTitle.trim()}.nexus`;

      // 1. .nexus フォルダ作成
      const nexusDirHandle = await fileSystem.createFolder(projectHandle, nexusFolderName);

      // 2. segments/ サブフォルダ作成
      const segmentsDirHandle = await fileSystem.createFolder(nexusDirHandle, 'segments');

      // 3. archive/ サブフォルダ作成
      await fileSystem.createFolder(nexusDirHandle, 'archive');

      // 4. ファイルを segments/ にコピー
      const segments = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const text = await fileSystem.readFile(file.handle || file);
        await fileSystem.createFile(segmentsDirHandle, file.name, text);

        segments.push({
          id: `seg-${Date.now()}-${i}`,
          file: file.name,
          displayName: file.name.replace(/\.txt$/, ''),
        });
      }

      // 5. manifest.json 作成
      const manifest = createEmptyManifest(workTitle.trim());
      manifest.segments = segments;
      await writeManifest(nexusDirHandle, manifest);

      showToast(`${selectedFiles.length} ファイルを "${nexusFolderName}" にまとめました`);
      if (refreshMaterials) await refreshMaterials();
      onClose();
    } catch (e) {
      console.error('[import] failed:', e);
      showToast(`まとめに失敗しました: ${e.message}`);
    } finally {
      setIsExecuting(false);
    }
  }, [selectedFiles, workTitle, projectHandle, showToast, refreshMaterials, onClose]);

  if (!isOpen) return null;

  return (
    <div className="import-modal-overlay" onClick={isExecuting ? undefined : onClose}>
      <div className="import-modal-content" onClick={e => e.stopPropagation()}>
        <h2>ファイルをまとめる</h2>
        <button className="import-modal-close" onClick={onClose} disabled={isExecuting}>✕</button>

        <div className="import-modal-section">
          <label>
            作品タイトル:
            <input
              type="text"
              value={workTitle}
              onChange={e => setWorkTitle(e.target.value)}
              placeholder="作品名を入力"
              className="import-modal-title-input"
              disabled={isExecuting}
            />
          </label>
        </div>

        <div className="import-modal-section">
          <h3>ファイルを選択</h3>
          <div className="import-modal-file-list">
            {txtFiles.map(file => {
              const isSelected = selectedFiles.some(f => (f.handle || f) === (file.handle || file));
              return (
                <label key={file.handle || file.name} className="import-modal-file-item">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isExecuting}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFiles(prev => [...prev, file]);
                      } else {
                        setSelectedFiles(prev => prev.filter(f => (f.handle || f) !== (file.handle || file)));
                      }
                    }}
                  />
                  <span>{file.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div className="import-modal-section">
            <h3>選択済み（この順序で manifest に登録）</h3>
            <ol className="import-modal-order-list">
              {selectedFiles.map((file, i) => (
                <li key={file.handle || file.name}>
                  <span className="order-item-name">{file.name}</span>
                  <div className="order-item-actions">
                    <button onClick={() => moveUp(i)} disabled={i === 0 || isExecuting}>↑</button>
                    <button onClick={() => moveDown(i)} disabled={i === selectedFiles.length - 1 || isExecuting}>↓</button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="import-modal-actions">
          <button onClick={onClose} disabled={isExecuting}>キャンセル</button>
          <button
            onClick={executeImport}
            disabled={isExecuting || selectedFiles.length === 0 || !workTitle.trim()}
          >
            {isExecuting ? 'まとめ中…' : `${selectedFiles.length} ファイルをまとめる`}
          </button>
        </div>
      </div>
    </div>
  );
}
