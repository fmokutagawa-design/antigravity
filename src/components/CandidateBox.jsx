import React, { useState } from 'react';

const CandidateBox = ({
    candidates = [],
    onAdopt,
    onDiscard,
    onClose,
    isOpen
}) => {
    const [filter, setFilter] = useState('pending'); // pending, adopted, discarded, all

    if (!isOpen) return null;

    const filteredCandidates = candidates.filter(c => {
        if (filter === 'all') return true;
        return c.status === filter;
    }).sort((a, b) => new Date(b.source.timestamp) - new Date(a.source.timestamp));

    const getTypeIcon = (type) => {
        switch (type) {
            case 'rewrite': return '🔄';
            case 'brainstorm': return '💡';
            case 'extraction': return '⛏️';
            case 'draft': return '📝';
            case 'proofread': return '✅';
            default: return '🤖';
        }
    };

    const formatDate = (isoString) => {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '40px', // Above footer
            right: '20px',
            width: '400px',
            height: '500px',
            backgroundColor: 'var(--bg-paper)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px 8px 0 0',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
            zIndex: 900,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-main)'
        }}>
            {/* Header */}
            <div style={{
                padding: '10px 15px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'rgba(0,0,0,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📦 候補箱</span>
                    <span style={{ fontSize: '0.8em', opacity: 0.7 }}>({candidates.filter(c => c.status === 'pending').length})</span>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-sub)',
                        fontSize: '18px'
                    }}
                >✕</button>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-paper)'
            }}>
                {['pending', 'adopted', 'discarded', 'all'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            flex: 1,
                            padding: '8px',
                            background: 'none',
                            border: 'none',
                            borderBottom: filter === f ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: filter === f ? 'var(--accent-color)' : '#888',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: filter === f ? 'bold' : 'normal',
                            textTransform: 'capitalize'
                        }}
                    >
                        {f === 'pending' ? '未処理' :
                            f === 'adopted' ? '採用済' :
                                f === 'discarded' ? '破棄' : 'すべて'}
                    </button>
                ))}
            </div>

            {/* List */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                backgroundColor: 'var(--bg-paper)'
            }}>
                {filteredCandidates.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '0.9em' }}>
                        ここには何もありません
                    </div>
                ) : (
                    filteredCandidates.map(candidate => (
                        <div key={candidate.id} style={{
                            marginBottom: '10px',
                            padding: '12px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(0,0,0,0.02)',
                            border: '1px solid var(--border-color)',
                            opacity: candidate.status === 'discarded' ? 0.6 : 1
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', color: '#888' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {getTypeIcon(candidate.type)} {candidate.type}
                                </span>
                                <span>{formatDate(candidate.source.timestamp)}</span>
                            </div>

                            <div style={{
                                fontSize: '13px',
                                color: 'var(--text-main)',
                                whiteSpace: 'pre-wrap',
                                maxHeight: '100px',
                                overflow: 'hidden',
                                position: 'relative',
                                marginBottom: '10px',
                                lineHeight: '1.5'
                            }}>
                                {candidate.content}
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    height: '24px',
                                    background: 'linear-gradient(to bottom, transparent, var(--bg-paper))'
                                }}></div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                {candidate.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => onDiscard(candidate.id)}
                                            style={{
                                                padding: '4px 10px',
                                                fontSize: '11px',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '4px',
                                                background: 'transparent',
                                                color: '#888',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            破棄
                                        </button>
                                        <button
                                            onClick={() => onAdopt(candidate.id)}
                                            style={{
                                                padding: '4px 12px',
                                                fontSize: '11px',
                                                border: 'none',
                                                borderRadius: '4px',
                                                background: 'var(--accent-color)',
                                                color: '#fff',
                                                cursor: 'pointer',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            採用
                                        </button>
                                    </>
                                )}
                                {candidate.status === 'adopted' && (
                                    <span style={{ fontSize: '11px', color: 'var(--accent-color)' }}>✓ 採用済み</span>
                                )}
                                {candidate.status === 'discarded' && (
                                    <button
                                        onClick={() => onDiscard(candidate.id)} // Toggle back to pending
                                        style={{
                                            fontSize: '11px',
                                            background: 'none',
                                            border: 'none',
                                            color: '#888',
                                            cursor: 'pointer',
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        復元
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CandidateBox;
