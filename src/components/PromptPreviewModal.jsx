import React from 'react';
import ReactDOM from 'react-dom';

const PromptPreviewModal = ({ prompt, sysPrompt, onConfirm, onCancel, visible }) => {
    if (!visible) return null;

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000 // Very high z-index as requested
        }} onClick={onCancel}>
            <div style={{
                width: '800px',
                maxWidth: '90%',
                maxHeight: '80%',
                backgroundColor: 'white',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>🚀 プロンプトプレビュー</h3>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}>×</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {sysPrompt && (
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>SYSTEM PROMPT</div>
                            <div style={{
                                padding: '10px',
                                background: '#f0f0f0',
                                borderRadius: '4px',
                                fontSize: '13px',
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'monospace',
                                border: '1px solid #ddd'
                            }}>
                                {sysPrompt}
                            </div>
                        </div>
                    )}

                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>USER PROMPT</div>
                        <div style={{
                            padding: '10px',
                            background: '#e3f2fd',
                            borderRadius: '4px',
                            fontSize: '13px',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            border: '1px solid #bbdefb',
                            color: '#0d47a1'
                        }}>
                            {prompt}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div style={{ padding: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: '#f8f9fa' }}>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText((sysPrompt ? sysPrompt + "\n---\n" : "") + prompt);
                            alert('クリップボードにコピーしました');
                        }}
                        style={{
                            padding: '10px 20px',
                            background: 'white',
                            border: '1px solid #ddd',
                            color: '#333',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', gap: '5px'
                        }}
                    >
                        📋 コピー
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '10px 30px',
                            backgroundColor: 'var(--accent-color)', // Uses global CSS var
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        送信する 🚀
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PromptPreviewModal;
