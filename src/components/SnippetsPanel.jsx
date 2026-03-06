import React, { useState } from 'react';

const SnippetsPanel = ({
    snippets = [],
    onAdd,
    onDelete,
    onCopy,
    onDragStart
}) => {
    const [text, setText] = useState('');

    const handleAdd = () => {
        if (text.trim()) {
            onAdd(text);
            setText('');
        }
    };

    const styles = {
        container: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-paper)',
            color: 'var(--text-main)',
        },
        header: {
            padding: '12px',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary)',
        },
        inputArea: {
            padding: '10px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        },
        textarea: {
            width: '100%',
            minHeight: '60px',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            resize: 'vertical',
            fontFamily: 'inherit'
        },
        addButton: {
            alignSelf: 'flex-end',
            padding: '4px 12px',
            backgroundColor: 'var(--accent-color)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
        },
        list: {
            flex: 1,
            overflowY: 'auto',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
        },
        item: {
            backgroundColor: 'var(--bg-card, #fff)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '10px',
            fontSize: '13px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            cursor: 'grab',
            position: 'relative'
        },
        itemContent: {
            whiteSpace: 'pre-wrap',
            marginBottom: '8px',
            maxHeight: '150px',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        },
        actions: {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
        },
        actionButton: {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            padding: '2px 4px'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                📝 メモ (Snippets)
                <span style={{ fontSize: '11px', fontWeight: 'normal' }}>{snippets.length}件</span>
            </div>

            <div style={styles.inputArea}>
                <textarea
                    style={styles.textarea}
                    placeholder="新しいメモを入力..."
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                            handleAdd();
                        }
                    }}
                />
                <button style={styles.addButton} onClick={handleAdd}>追加</button>
            </div>

            <div style={styles.list}>
                {snippets.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
                        メモはありません
                    </div>
                ) : (
                    snippets.map((snippet) => (
                        <div
                            key={snippet.id}
                            style={styles.item}
                            draggable
                            onDragStart={(e) => onDragStart(e, snippet)}
                        >
                            <div style={styles.itemContent}>
                                {snippet.content}
                            </div>
                            <div style={styles.actions}>
                                <button
                                    style={styles.actionButton}
                                    onClick={() => onCopy(snippet.content)}
                                    title="コピー"
                                >
                                    📋
                                </button>
                                <button
                                    style={{ ...styles.actionButton, color: '#f44336' }}
                                    onClick={() => onDelete(snippet.id)}
                                    title="削除"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SnippetsPanel;
