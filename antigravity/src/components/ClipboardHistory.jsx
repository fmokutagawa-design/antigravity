/**
 * ClipboardHistory.jsx
 * 
 * クリップボード履歴ポップアップ。
 * コピー/カットした文字列を表示し、クリックでカーソル位置にペーストする。
 */
import React from 'react';

const styles = {
    overlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9998,
        // 透明な背景（クリックで閉じる用）
    },
    popup: {
        position: 'fixed',
        bottom: '36px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        backgroundColor: 'var(--bg-secondary, #1e1e2e)',
        border: '1px solid var(--border-color, #444)',
        borderRadius: '8px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        minWidth: '300px',
        maxWidth: '500px',
        maxHeight: '400px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-color, #444)',
        fontSize: '12px',
        fontWeight: 'bold',
        color: 'var(--text-secondary, #aaa)',
    },
    list: {
        overflowY: 'auto',
        maxHeight: '350px',
        padding: '4px 0',
    },
    item: {
        padding: '8px 12px',
        cursor: 'pointer',
        fontSize: '13px',
        lineHeight: '1.4',
        color: 'var(--text-primary, #e0e0e0)',
        borderBottom: '1px solid var(--border-color, #333)',
        transition: 'background-color 0.15s',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
    },
    itemIndex: {
        // ショートカットキーのバッジ
        flexShrink: 0,
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        backgroundColor: 'var(--accent-color, #6366f1)',
        color: '#fff',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
    },
    itemText: {
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '400px',
    },
    itemPreview: {
        fontSize: '11px',
        color: 'var(--text-secondary, #888)',
        marginTop: '2px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    empty: {
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-secondary, #888)',
        fontSize: '13px',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: 'var(--text-secondary, #aaa)',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '2px 6px',
        borderRadius: '4px',
    },
};

const ClipboardHistory = ({ history, onPaste, onClose }) => {
    if (!history) return null;

    const handleItemClick = (text) => {
        onPaste(text);
        onClose();
    };

    return (
        <>
            {/* 背景オーバーレイ（クリックで閉じる） */}
            <div style={styles.overlay} onClick={onClose} />

            <div style={styles.popup}>
                <div style={styles.header}>
                    <span>📋 クリップボード履歴</span>
                    <button style={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div style={styles.list}>
                    {history.length === 0 ? (
                        <div style={styles.empty}>
                            履歴がありません。<br />
                            テキストをコピー/カットすると表示されます。
                        </div>
                    ) : (
                        history.map((text, i) => (
                            <div
                                key={`${i}-${text.substring(0, 10)}`}
                                style={styles.item}
                                onClick={() => handleItemClick(text)}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(255,255,255,0.05))'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                title={text}
                            >
                                <span style={styles.itemIndex}>{i + 1}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={styles.itemText}>
                                        {text.length > 60 ? text.substring(0, 60) + '…' : text}
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
        </>
    );
};

export default ClipboardHistory;
