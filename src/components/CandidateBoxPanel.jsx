import React from 'react';

const CandidateBoxPanel = ({
    candidates = [],
    onAdopt,
    onDiscard,
    onDiscardAll,
    onCreateCard
}) => {
    // Filter out adopted/discarded? Or show all with status?
    // Usually CandidateBox shows pending.
    const [activeFilter, setActiveFilter] = React.useState('all');

    const filters = [
        { id: 'all', label: 'All' },
        { id: 'rewrite', label: 'リライト' },
        { id: 'proofread', label: '校正' },
        { id: 'shorten', label: '短縮' },
        { id: 'describe', label: '描写' },
        { id: 'analysis', label: '分析' },
        { id: 'relextract', label: '抽出' },
        { id: 'general', label: 'その他' },
    ];

    const pendingCandidates = candidates.filter(c => {
        if (c.status !== 'pending') return false;
        if (activeFilter === 'all') return true;
        // Check type or source.mode for legacy compatibility
        const type = c.type || c.source?.mode;
        return type === activeFilter;
    });

    const styles = {
        container: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-paper)',
            color: 'var(--text-main)',
        },
        tabs: {
            display: 'flex',
            overflowX: 'auto',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            padding: '0 4px',
            gap: '2px',
            flexShrink: 0
        },
        tab: {
            padding: '6px 10px',
            fontSize: '11px',
            cursor: 'pointer',
            borderBottom: '2px solid transparent',
            whiteSpace: 'nowrap',
            color: 'var(--text-secondary)',
            opacity: 0.7
        },
        activeTab: {
            borderBottom: '2px solid var(--accent-color, #3498db)',
            color: 'var(--text-main)',
            opacity: 1,
            fontWeight: 'bold'
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
        list: {
            flex: 1,
            overflowY: 'auto',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
        },
        card: {
            backgroundColor: 'var(--bg-card, #fff)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '10px',
            fontSize: '13px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        },
        cardHeader: {
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '6px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
        },
        cardBody: {
            marginBottom: '8px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
        },
        actions: {
            display: 'flex',
            gap: '8px',
        },
        button: {
            flex: 1,
            padding: '4px 8px',
            fontSize: '11px',
            borderRadius: '4px',
            cursor: 'pointer',
            border: 'none',
            fontWeight: 'bold',
        },
        empty: {
            padding: '20px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '13px',
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🗳️ 候補箱
                    <span style={{ fontSize: '11px', fontWeight: 'normal' }}>{pendingCandidates.length}件</span>
                </div>
                {pendingCandidates.length > 0 && onDiscardAll && (
                    <button
                        onClick={onDiscardAll}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '10px',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                        }}
                        title="全ての候補を破棄"
                    >
                        🗑 全クリア
                    </button>
                )}
            </div>

            <div style={styles.tabs}>
                {filters.map(filter => (
                    <div
                        key={filter.id}
                        style={{ ...styles.tab, ...(activeFilter === filter.id ? styles.activeTab : {}) }}
                        onClick={() => setActiveFilter(filter.id)}
                    >
                        {filter.label}
                    </div>
                ))}
            </div>

            <div style={styles.list}>
                {pendingCandidates.length === 0 ? (
                    <div style={styles.empty}>
                        候補はありません。<br />
                        エディタで選択範囲を右クリックして「候補箱に追加」できます。
                    </div>
                ) : (
                    pendingCandidates.map(candidate => (
                        <div key={candidate.id} style={styles.card}>
                            <div style={styles.cardHeader}>
                                <span>{candidate.source?.timestamp ? new Date(candidate.source.timestamp).toLocaleTimeString() : ''}</span>
                                <span>{candidate.type || candidate.source?.mode || 'Manual'}</span>
                            </div>
                            {candidate.originalText && (
                                <div style={{
                                    marginBottom: '6px',
                                    padding: '6px 8px',
                                    backgroundColor: 'var(--bg-secondary, #f5f5f5)',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    color: 'var(--text-secondary, #888)',
                                    borderLeft: '3px solid var(--accent-color, #3498db)',
                                    maxHeight: '60px',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: '1.4'
                                }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '10px', display: 'block', marginBottom: '2px' }}>元テキスト:</span>
                                    {candidate.originalText.length > 100
                                        ? candidate.originalText.substring(0, 100) + '...'
                                        : candidate.originalText}
                                </div>
                            )}
                            <div style={styles.cardBody}>
                                {candidate.content || candidate.text || ''}
                            </div>
                            <div style={styles.actions}>
                                <button
                                    style={{ ...styles.button, backgroundColor: '#e3f2fd', color: '#1565c0' }}
                                    onClick={() => onCreateCard && onCreateCard(candidate.content)}
                                    title="この内容でカードを作成"
                                >
                                    🃏 カード化
                                </button>
                                <button
                                    style={{ ...styles.button, backgroundColor: 'var(--accent-color)', color: '#fff' }}
                                    onClick={() => onAdopt(candidate.id)}
                                >
                                    採用
                                </button>
                                <button
                                    style={{ ...styles.button, backgroundColor: '#f5f5f5', color: '#666' }}
                                    onClick={() => onDiscard(candidate.id)}
                                >
                                    破棄
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CandidateBoxPanel;
