import React, { useState, useMemo } from 'react';
import { parseNote } from '../utils/metadataParser';

const ContextPicker = ({ availableFiles = [], selectedHandles = [], onSelectionChange, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL'); // ALL, CHAR, LOC, etc.

    // Process files to extract metadata for filtering
    const processedFiles = useMemo(() => {
        return availableFiles.map(file => {
            const { metadata } = parseNote(file.content || file.body || '');
            return {
                ...file,
                metadataType: metadata?.種別 || 'Uncategorized', // "キャラ", "設定", etc.
                displayText: file.name
            };
        });
    }, [availableFiles]);

    const filteredFiles = useMemo(() => {
        return processedFiles.filter(file => {
            // Search filter
            if (searchTerm && !file.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            // Type filter
            if (filterType === 'ALL') return true;
            if (filterType === 'CHAR' && file.metadataType === 'キャラ') return true;
            if (filterType === 'LOC' && (file.metadataType === '地名' || file.metadataType === '設定')) return true; // Group settings/locations
            if (filterType === 'OTHER' && !['キャラ', '地名', '設定'].includes(file.metadataType)) return true;

            return false;
        });
    }, [processedFiles, searchTerm, filterType]);

    const toggleFile = (handle) => {
        const newSelection = selectedHandles.includes(handle)
            ? selectedHandles.filter(h => h !== handle)
            : [...selectedHandles, handle];
        onSelectionChange(newSelection);
    };

    const selectAllFiltered = () => {
        const newHandles = [...selectedHandles];
        filteredFiles.forEach(f => {
            if (!newHandles.includes(f.handle)) {
                newHandles.push(f.handle);
            }
        });
        onSelectionChange(newHandles);
    };

    const deselectAllFiltered = () => {
        const filteredHandles = filteredFiles.map(f => f.handle);
        const newSelection = selectedHandles.filter(h => !filteredHandles.includes(h));
        onSelectionChange(newSelection);
    };

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }} onClick={onClose}>
            <div style={{
                width: '500px',
                height: '80%', // Max height
                backgroundColor: 'white',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>コンテキスト選択 ({selectedHandles.length})</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
                </div>

                {/* Filters & Search */}
                <div style={{ padding: '10px', background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                    <input
                        type="text"
                        placeholder="ファイル名を検索..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '10px' }}
                    />
                    <div style={{ display: 'flex', gap: '5px' }}>
                        {['ALL', 'CHAR', 'LOC', 'OTHER'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '15px',
                                    border: '1px solid',
                                    borderColor: filterType === type ? 'var(--accent-color)' : '#ddd',
                                    backgroundColor: filterType === type ? 'var(--accent-color)' : 'white',
                                    color: filterType === type ? 'white' : '#666',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                {type === 'ALL' ? 'すべて' : type === 'CHAR' ? 'キャラ' : type === 'LOC' ? '設定/場所' : 'その他'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div style={{ padding: '8px 15px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderBottom: '1px solid #eee' }}>
                    <button onClick={selectAllFiltered} style={{ fontSize: '12px', background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer' }}>全て選択</button>
                    <button onClick={deselectAllFiltered} style={{ fontSize: '12px', background: 'none', border: 'none', color: '#e53935', cursor: 'pointer' }}>選択解除</button>
                </div>

                {/* File List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                    {filteredFiles.map(file => (
                        <div
                            key={file.handle?.name || file.name}
                            onClick={() => toggleFile(file.handle)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px',
                                borderBottom: '1px solid #f0f0f0',
                                cursor: 'pointer',
                                backgroundColor: selectedHandles.includes(file.handle) ? '#e3f2fd' : 'transparent',
                                borderRadius: '4px'
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={selectedHandles.includes(file.handle)}
                                onChange={() => { }} // Handled by div click
                                style={{ marginRight: '10px', accentColor: 'var(--accent-color)' }}
                            />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{file.name}</div>
                                <div style={{ fontSize: '11px', color: '#888' }}>
                                    {file.metadataType} • {file.body?.length || 0}文字
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredFiles.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
                            該当するファイルがありません
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '15px', borderTop: '1px solid #eee', textAlign: 'right' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 20px',
                            backgroundColor: 'var(--accent-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        決定
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContextPicker;
