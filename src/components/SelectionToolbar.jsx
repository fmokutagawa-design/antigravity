import React from 'react';

const SelectionToolbar = ({
    position,
    onCopy,
    onRewrite,
    onProofread,
    onShorten,
    onDescribe,
    onCardCreate,
    visible,
    showAIActions = true,
    showCardCreate = true
}) => {
    if (!visible || !position) return null;

    return (
        <div
            className="selection-toolbar"
            style={{
                position: 'fixed',
                top: `${position.top}px`,
                left: `${position.left}px`,
                transform: 'translate(-50%, -100%)',
                marginTop: '-10px',
                backgroundColor: 'var(--bg-popover, #2c3e50)',
                color: 'white',
                borderRadius: '6px',
                padding: '4px',
                display: 'flex',
                gap: '4px',
                zIndex: 1500,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                fontSize: '13px',
                whiteSpace: 'nowrap',
                pointerEvents: 'auto',
                animation: 'fadeIn 0.15s ease-out'
            }}
            onMouseDown={(e) => {
                // ボタンクリック時のみ preventDefault（選択状態保持）
                // それ以外ではブラウザのデフォルト動作を許可
                if (e.target.tagName === 'BUTTON') {
                    e.preventDefault();
                }
            }}
        >
            <button
                onClick={onCopy}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}
                className="toolbar-btn"
                title="コピー"
            >
                📋
            </button>
            {showAIActions && (
            <>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '2px 0' }} />
            <button onClick={onRewrite} style={{ background: 'transparent', border: 'none', color: 'white', padding: '6px 10px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }} className="toolbar-btn">🔄 リライト</button>
            <button onClick={onProofread} style={{ background: 'transparent', border: 'none', color: 'white', padding: '6px 10px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }} className="toolbar-btn">📝 校正</button>
            <button onClick={onShorten} style={{ background: 'transparent', border: 'none', color: 'white', padding: '6px 10px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }} className="toolbar-btn">📐 短く</button>
            <button onClick={onDescribe} style={{ background: 'transparent', border: 'none', color: 'white', padding: '6px 10px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }} className="toolbar-btn">🎨 描写</button>
            </>
            )}
            {showCardCreate && (
            <>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '2px 0' }} />
            <button onClick={onCardCreate} style={{ background: 'transparent', border: 'none', color: 'white', padding: '6px 10px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }} className="toolbar-btn">🃏 カード化</button>
            </>
            )}

            <style>{`
                .toolbar-btn:hover {
                    background-color: rgba(255,255,255,0.1) !important;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translate(-50%, -90%); }
                    to { opacity: 1; transform: translate(-50%, -100%); }
                }
            `}</style>
        </div>
    );
};

export default SelectionToolbar;
