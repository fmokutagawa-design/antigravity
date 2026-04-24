import React, { useState, useMemo } from 'react';
// import './InputModal.css'; // Removed: File does not exist, InputModal uses inline styles.

const ReplacePreviewModal = ({ isOpen, onClose, onExecute, changes }) => {
    const [selectedIndices, setSelectedIndices] = useState(new Set());
    const [isAllSelected, setIsAllSelected] = useState(true);

    // Initialize selection when changes load
    useMemo(() => {
        if (isOpen && changes) {
            const allIndices = new Set(changes.map((_, i) => i));
            setSelectedIndices(allIndices);
            setIsAllSelected(true);
        }
    }, [isOpen, changes]);

    const handleToggle = (index) => {
        const newSet = new Set(selectedIndices);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedIndices(newSet);
        setIsAllSelected(newSet.size === changes.length);
    };

    const handleToggleAll = () => {
        if (isAllSelected) {
            setSelectedIndices(new Set());
            setIsAllSelected(false);
        } else {
            const allIndices = new Set(changes.map((_, i) => i));
            setSelectedIndices(allIndices);
            setIsAllSelected(true);
        }
    };

    const handleExecute = () => {
        const selectedChanges = changes.filter((_, i) => selectedIndices.has(i));
        onExecute(selectedChanges);
    };

    if (!isOpen) return null;

    // Group changes by file for better display?
    // changes structure expected: { fileHandle, fileName, lineIndex, lineContent, newContent }

    return (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
            <div className="modal-content" style={{ width: '800px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <h3>一括置換プレビュー</h3>
                <div style={{ marginBottom: '10px', color: '#666', fontSize: '0.9rem' }}>
                    以下の変更を適用します。確認して実行してください。<br />
                    <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>注意: この操作はファイルシステムに直接書き込みます。念のためバックアップを推奨します。</span>
                </div>

                <div className="preview-list" style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '4px', background: '#f9f9f9' }}>
                    <div style={{ marginBottom: '8px', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>
                        <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={handleToggleAll}
                                style={{ marginRight: '8px' }}
                            />
                            すべて選択 ({selectedIndices.size} / {changes.length})
                        </label>
                    </div>

                    {changes.length === 0 ? (
                        <div>変更対象はありません。</div>
                    ) : (
                        changes.map((change, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                padding: '8px 0',
                                borderBottom: '1px solid #eee',
                                opacity: selectedIndices.has(i) ? 1 : 0.5
                            }}>
                                <input
                                    type="checkbox"
                                    checked={selectedIndices.has(i)}
                                    onChange={() => handleToggle(i)}
                                    style={{ marginTop: '4px', marginRight: '8px' }}
                                />
                                <div style={{ flex: 1, fontSize: '0.9rem' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                                        {change.fileName} <span style={{ color: '#888', fontWeight: 'normal' }}>({change.lineIndex + 1}行目)</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 20px 1fr', gap: '8px', alignItems: 'center' }}>
                                        <div style={{ background: '#ffebee', padding: '2px 4px', borderRadius: '2px', wordBreak: 'break-all' }}>
                                            {change.lineContent}
                                        </div>
                                        <div style={{ textAlign: 'center', color: '#999' }}>→</div>
                                        <div style={{ background: '#e8f5e9', padding: '2px 4px', borderRadius: '2px', wordBreak: 'break-all' }}>
                                            {change.newContent}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="modal-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px' }}>キャンセル</button>
                    <button
                        onClick={handleExecute}
                        className="active"
                        style={{ padding: '8px 16px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        disabled={selectedIndices.size === 0}
                    >
                        実行 ({selectedIndices.size}件)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReplacePreviewModal;
