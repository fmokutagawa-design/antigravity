import React from 'react';

const CustomConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'OK', cancelText = 'キャンセル', isDanger = false }) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200000,
            pointerEvents: 'auto'
        }} onClick={onCancel}>
            <div style={{
                backgroundColor: 'var(--bg-paper, #fff)',
                color: 'var(--text-color, #333)',
                padding: '24px',
                borderRadius: '12px',
                width: '400px',
                maxWidth: '90%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color, #eee)',
                animation: 'modalFadeIn 0.2s ease-out'
            }} onClick={e => e.stopPropagation()}>
                <style>
                    {`
                    @keyframes modalFadeIn {
                        from { transform: scale(0.95); opacity: 0; }
                        to { transform: scale(1); opacity: 1; }
                    }
                    `}
                </style>
                <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.25rem' }}>{title}</h3>
                <p style={{
                    marginBottom: '24px',
                    fontSize: '1rem',
                    lineHeight: '1.5',
                    color: 'var(--text-dim, #555)',
                    whiteSpace: 'pre-wrap'
                }}>{message}</p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            background: 'transparent',
                            color: '#666',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: '500'
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            background: isDanger ? '#e74c3c' : 'var(--primary-color, #2196f3)',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: '600'
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomConfirmModal;
