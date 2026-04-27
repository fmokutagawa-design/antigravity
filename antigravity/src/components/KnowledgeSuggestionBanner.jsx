import React, { useState, useEffect, useRef } from 'react';

/**
 * KnowledgeSuggestionBanner
 * AI がファイルの内容を分析し、作品への紐付けやドキュメントタイプを提案する
 */
const KnowledgeSuggestionBanner = ({ activeFile, currentText, onConfirm }) => {
    const [suggestion, setSuggestion] = useState(null);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const analyzedPathRef = useRef(null); // すでに分析済みのパスを記録

    useEffect(() => {
        const fullPath = activeFile?.path || activeFile?.handle || activeFile?.name;
        
        // ファイルが変わっていない、または短すぎる、または既に分析済みなら何もしない
        if (!fullPath || !currentText || currentText.length < 100 || analyzedPathRef.current === fullPath) {
            if (analyzedPathRef.current !== fullPath) setVisible(false);
            return;
        }

        // すでにタグがあるかチェック (YAML Frontmatter)
        // 冒頭200文字以内に tags: があるか
        const head = currentText.substring(0, 500);
        if (head.includes('tags:') || head.includes('doc_type:')) {
            analyzedPathRef.current = fullPath; // タグがあるなら分析済みとして扱う
            setVisible(false);
            return;
        }

        const checkMetadata = async () => {
            if (loading) return;
            setLoading(true);
            try {
                const response = await fetch('http://localhost:8000/db/propose_metadata', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        full_path: fullPath,
                        content: currentText.substring(0, 2000)
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    setSuggestion(data);
                    setVisible(true);
                    analyzedPathRef.current = fullPath; // 分析完了を記録
                }
            } catch (error) {
                console.error("Failed to fetch metadata suggestion:", error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(checkMetadata, 3000); // 3秒待ってから分析 (タイピング中を避ける)
        return () => clearTimeout(timer);
    }, [activeFile, currentText, loading]);

    const handleAccept = async () => {
        if (!suggestion) return;
        // 親コンポーネントで Frontmatter を更新させる
        onConfirm({
            tags: [suggestion.suggested_project, suggestion.suggested_doc_type],
            project: suggestion.suggested_project,
            doc_type: suggestion.suggested_doc_type,
            importance: suggestion.suggested_importance,
            entities: suggestion.suggested_entities
        });
        setVisible(false);
    };

    if (!visible || !suggestion) return null;

    return (
        <div className="knowledge-suggestion-banner" style={{
            background: 'var(--ai-banner-bg, #e3f2fd)',
            borderBottom: '1px solid var(--ai-banner-border, #bbdefb)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            color: '#0d47a1',
            animation: 'slideDown 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px' }}>💡</span>
                <span>
                    このファイルは <b>{suggestion.suggested_project}</b> の <b>{suggestion.suggested_doc_type === 'SETTING' ? '設定資料' : 
                                    suggestion.suggested_doc_type === 'PLOT' ? 'プロット' : 
                                    suggestion.suggested_doc_type === 'MANUSCRIPT' ? '本文' : '草稿'}</b> として登録しますか？
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {suggestion.suggested_entities.slice(0, 3).map(e => (
                        <span key={e} style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>#{e}</span>
                    ))}
                </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleAccept} style={{
                    background: '#007aff',
                    color: 'white',
                    border: 'none',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}>はい（確定）</button>
                <button onClick={() => setVisible(false)} style={{
                    background: 'transparent',
                    border: '1px solid #999',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}>いいえ</button>
            </div>
            <style>{`
                @keyframes slideDown {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default KnowledgeSuggestionBanner;
