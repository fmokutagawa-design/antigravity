import React from 'react';

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-paper)',
    },
    header: {
        padding: '12px',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '14px',
        fontWeight: 'bold',
        color: 'var(--text-main)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    list: {
        flex: 1,
        overflowY: 'auto',
        padding: '0',
    },
    item: {
        padding: '10px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--grid-line)',
        transition: 'background-color 0.15s',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
    },
    itemIndex: {
        flexShrink: 0,
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        backgroundColor: 'var(--accent-color, #3498db)',
        color: '#fff',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
    },
    itemContent: {
        flex: 1,
        minWidth: 0,
    },
    itemText: {
        fontSize: '13px',
        color: 'var(--text-main)',
        marginBottom: '2px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    itemPreview: {
        fontSize: '11px',
        color: 'var(--text-secondary, #888)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    empty: {
        padding: '2rem',
        textAlign: 'center',
        color: '#999',
        fontSize: '0.9rem',
    }
};

const ClipboardPanel = ({ history, onPaste }) => {
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                クリップボード履歴
                <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#888' }}>
                    {history.length} 件
                </span>
            </div>

            <div style={styles.list}>
                {(!history || history.length === 0) ? (
                    <div style={styles.empty}>
                        履歴がありません。<br />
                        コピーするとここに表示されます。
                    </div>
                ) : (
                    history.map((text, i) => (
                        <div
                            key={`${i}-${text.substring(0, 10)}`}
                            style={styles.item}
                            onClick={() => onPaste(text)}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            title={text}
                        >
                            <span style={styles.itemIndex}>{i + 1}</span>
                            <div style={styles.itemContent}>
                                <div style={styles.itemText}>
                                    {text}
                                </div>
                                <div style={styles.itemPreview}>
                                    {text.length} 文字
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ClipboardPanel;
