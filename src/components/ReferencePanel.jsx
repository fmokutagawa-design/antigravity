import React from 'react';

const ReferencePanel = ({ content, onClose, fileName, isFullPage }) => {
    return (
        <div className={`reference-panel ${isFullPage ? 'full-page' : ''}`}>
            <div className="reference-header">
                <span className="reference-title">
                    📖 参照: {fileName || '未選択'}
                </span>
                <button className="btn-close-reference" onClick={onClose} title="閉じる">
                    ✕
                </button>
            </div>
            <div className="reference-content">
                {content ? (
                    <div className="reference-text">
                        {content}
                    </div>
                ) : (
                    <div className="reference-empty">
                        ファイルツリーから<br />
                        「右クリック」→「参照用に開く」<br />
                        を選択してください
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReferencePanel;
