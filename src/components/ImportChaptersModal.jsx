import React, { useState, useCallback, useEffect } from 'react';
import { fileSystem } from '../utils/fileSystem';
import { createEmptyManifest, writeManifest } from '../utils/manifest';
import './ImportChaptersModal.css';

/**
 * ImportChaptersModal
 * 
 * 既存の分割ファイルを選択し、.nexus フォルダにまとめる（作品化する）モーダル。
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

  // モーダルを開くときに状態をリセット
  useEffect(() => {
    if (isOpen) {
      setSelectedFiles([]);
      setWorkTitle('');
    }
  }, [isOpen]);

  // ファイルが初めて選択されたとき、タイトルが空ならファイル名を提案する
  useEffect(() => {
    if (selectedFiles.length > 0 && !workTitle) {
      const firstName = selectedFiles[0].name.replace(/\.txt$/, '');
      // 数字や話数（第1話、#01など）を除去して作品名っぽくする
      const suggested = firstName.replace(/[\s\u3000]*(第?\d+話?|#?\d+|第.+?話)[\s\u3000]*$/, '').trim();
      setWorkTitle(suggested || firstName);
    }
  }, [selectedFiles, workTitle]);

  // allFiles から .txt ファイルのみ抽出（既に .nexus 内にあるものは除外するのが望ましいが、簡易的に .txt 全て）
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

  const removeFile = useCallback((index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const executeImport = useCallback(async () => {
    if (selectedFiles.length === 0 || !workTitle.trim()) {
      showToast('タイトルとファイルを選択してください');
      return;
    }

    setIsExecuting(true);
    try {
      const nexusFolderName = `${workTitle.trim()}.nexus`;

      // 1. .nexus フォルダ作成
      const nexusDirHandle = await fileSystem.createFolder(projectHandle, nexusFolderName);

      // 2. ファイルを .nexus フォルダ直下に移動（segments 階層を廃止）
      const segments = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // 元ファイルを .nexus フォルダに移動（コピーではなく移動）
        try {
          const movedFile = await fileSystem.moveFile(file.handle || file, nexusDirHandle);
          
          segments.push({
            id: `seg-${Date.now()}-${i}`,
            file: movedFile.name,
            displayName: movedFile.name.replace(/\.txt$/, ''),
          });
        } catch (moveError) {
          console.error(`[import] Could not move ${file.name}:`, moveError);
          throw new Error(`ファイル "${file.name}" の移動に失敗しました`);
        }
      }

      // 3. manifest.json 作成（同じ階層に配置）
      const manifest = createEmptyManifest(workTitle.trim());
      manifest.segments = segments;
      await writeManifest(nexusDirHandle, manifest);

      showToast(`「${workTitle.trim()}」として作品化しました。`);
      if (refreshMaterials) await refreshMaterials();
      onClose();
    } catch (e) {
      console.error('[import] failed:', e);
      showToast(`作品化に失敗しました: ${e.message}`);
    } finally {
      setIsExecuting(false);
    }
  }, [selectedFiles, workTitle, projectHandle, showToast, refreshMaterials, onClose]);

  if (!isOpen) return null;

  return (
    <div className="import-modal-overlay" onClick={isExecuting ? undefined : onClose}>
      <div className="import-modal-content" onClick={e => e.stopPropagation()}>
        <h2>既存ファイルを作品化する</h2>
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
            <h3>作品構成（この順序で登録）</h3>
            <ol className="import-modal-order-list">
              {selectedFiles.map((file, i) => (
                <li key={file.handle || file.name}>
                  <span className="order-item-name">{file.name}</span>
                  <div className="order-item-actions">
                    <button onClick={() => moveUp(i)} disabled={i === 0 || isExecuting} title="上に移動">↑</button>
                    <button onClick={() => moveDown(i)} disabled={i === selectedFiles.length - 1 || isExecuting} title="下に移動">↓</button>
                    <button onClick={() => removeFile(i)} disabled={isExecuting} className="btn-remove" title="選択を解除">✕</button>
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
            {isExecuting ? '実行中…' : `${selectedFiles.length} ファイルを作品化する`}
          </button>
        </div>
      </div>
    </div>
  );
}
