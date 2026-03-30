import React, { useState, useMemo } from 'react';
import literaryPrizes, { GENRES, getNextDeadline, getDaysUntilDeadline } from '../data/literaryPrizes';

const PrizePanel = ({ onApplyPrize, onApplyFormat, projectSettings, editorText, showToast }) => {
    const [selectedPrize, setSelectedPrize] = useState(null);
    const [genreFilter, setGenreFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPrizes = useMemo(() => {
        return literaryPrizes.filter(p => {
            if (genreFilter !== 'all' && !p.genre.includes(genreFilter)) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchName = p.name.toLowerCase().includes(term);
                const matchOrg = p.organizer.toLowerCase().includes(term);
                const matchGenre = p.genre.toLowerCase().includes(term);
                if (!matchName && !matchOrg && !matchGenre) return false;
            }
            return true;
        });
    }, [genreFilter, searchTerm]);

    const handleApply = (prize) => {
        if (!onApplyPrize) return;
        const deadline = getNextDeadline(prize);
        onApplyPrize({
            targetPages: prize.pageLimit.max || prize.pageLimit.min,
            deadline: deadline ? deadline.toISOString().split('T')[0] : null,
            prizeName: prize.name,
            prizeId: prize.id,
            editorFormat: prize.editorFormat || null,
            pageCountBasis: prize.pageCountBasis || '400-page',
            targetChars: prize.charLimit?.max || 0
        });
    };

    const handleApplyFormat = (prize) => {
        if (!onApplyFormat || !prize.editorFormat) return;
        const { charsPerLine, linesPerPage } = prize.editorFormat;
        if (!charsPerLine || !linesPerPage) {
            showToast?.('この賞には指定フォーマットがありません');
            return;
        }
        if (window.confirm(`エディタの設定を ${charsPerLine}字×${linesPerPage}行 に変更しますか？\n（現在の設定は上書きされます）`)) {
            onApplyFormat({ charsPerLine, linesPerPage });
            showToast?.(`📄 ${charsPerLine}字×${linesPerPage}行 に変更しました`);
        }
    };

    const getCurrentProgress = (prize) => {
        if (!editorText) return null;
        const basis = prize.pageCountBasis || '400-page';
        const target = prize.pageLimit.max || prize.pageLimit.min;
        if (basis === 'char-count') {
            const charTarget = prize.charLimit?.max || 0;
            return { current: editorText.length, target: charTarget, unit: '字' };
        } else if (basis === 'format-page') {
            const cpl = prize.editorFormat?.charsPerLine || 20;
            const lpp = prize.editorFormat?.linesPerPage || 20;
            return { current: Math.ceil(editorText.length / (cpl * lpp)), target, unit: '枚' };
        } else {
            return { current: Math.ceil(editorText.length / 400), target, unit: '枚' };
        }
    };

    const renderDeadlineBadge = (prize) => {
        const days = getDaysUntilDeadline(prize);
        if (days === null) return <span style={{ fontSize: '10px', color: '#7f8c8d' }}>通年</span>;
        const color = days <= 30 ? '#e74c3c' : days <= 90 ? '#f39c12' : '#27ae60';
        return (
            <span style={{ fontSize: '10px', color, fontWeight: days <= 30 ? 'bold' : 'normal' }}>
                〆切まで{days}日
            </span>
        );
    };

    if (selectedPrize) {
        const prize = selectedPrize;
        const days = getDaysUntilDeadline(prize);
        const deadline = getNextDeadline(prize);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => setSelectedPrize(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>←</button>
                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{prize.name}</span>
                    <span style={{ fontSize: '10px', color: '#7f8c8d' }}>{prize.organizer}</span>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Basic Info */}
                    <div style={{ background: 'var(--bg-paper)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                            <div>
                                <div style={{ color: '#7f8c8d', fontSize: '10px' }}>ジャンル</div>
                                <div style={{ fontWeight: 'bold' }}>{prize.genre}</div>
                            </div>
                            <div>
                                <div style={{ color: '#7f8c8d', fontSize: '10px' }}>賞金</div>
                                <div style={{ fontWeight: 'bold' }}>{prize.prize}</div>
                            </div>
                            <div>
                                <div style={{ color: '#7f8c8d', fontSize: '10px' }}>分量規定</div>
                                <div style={{ fontWeight: 'bold', fontSize: prize.formatNote ? '10px' : '12px' }}>
                                    {prize.formatNote ? prize.formatNote
                                        : prize.charLimit && prize.charLimit.max ? `${prize.charLimit.min || ''}〜${prize.charLimit.max} 字`
                                            : `${prize.pageLimit.min}〜${prize.pageLimit.max || '上限なし'} 枚（400字詰）`}
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#7f8c8d', fontSize: '10px' }}>締切</div>
                                <div style={{ fontWeight: 'bold' }}>{prize.deadlineNote}</div>
                            </div>
                        </div>
                    </div>

                    {/* Deadline Countdown */}
                    {days !== null && (
                        <div style={{
                            background: days <= 30 ? '#fde8e8' : days <= 90 ? '#fef3cd' : '#e8f8f5',
                            border: `1px solid ${days <= 30 ? '#f5c6cb' : days <= 90 ? '#ffeeba' : '#c3e6cb'}`,
                            borderRadius: '8px', padding: '12px', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '10px', color: '#666' }}>次回締切</div>
                            <div style={{ fontSize: '22px', fontWeight: 'bold', color: days <= 30 ? '#c0392b' : days <= 90 ? '#d68910' : '#27ae60' }}>
                                あと {days} 日
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>
                                {deadline?.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                        </div>
                    )}

                    {/* Apply Button */}
                    <button
                        onClick={() => handleApply(prize)}
                        style={{
                            padding: '10px', background: '#8e44ad', color: 'white',
                            border: 'none', borderRadius: '8px', cursor: 'pointer',
                            fontWeight: 'bold', fontSize: '13px'
                        }}
                    >
                        🎯 この賞に応募する（目標設定）
                    </button>
                    {prize.editorFormat && prize.editorFormat.charsPerLine > 0 && (
                        <button
                            onClick={() => handleApplyFormat(prize)}
                            style={{
                                padding: '8px', background: 'transparent', color: '#8e44ad',
                                border: '1px solid #8e44ad', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            📄 印刷用にフォーマット変更（{prize.editorFormat.charsPerLine}字×{prize.editorFormat.linesPerPage}行）
                        </button>
                    )}
                    {projectSettings?.prizeName === prize.name && (
                        <div style={{ fontSize: '10px', color: '#27ae60', textAlign: 'center' }}>✓ 現在この賞が設定されています</div>
                    )}

                    {/* Progress */}
                    {(() => {
                        const progress = getCurrentProgress(prize);
                        if (!progress) return null;
                        const pct = progress.target > 0 ? Math.min(100, Math.round(progress.current / progress.target * 100)) : 0;
                        return (
                            <div style={{ background: '#f0ebf5', borderRadius: '8px', padding: '10px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', color: '#555' }}>📊 現在の進捗</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span>{progress.current.toLocaleString()}{progress.unit}</span>
                                    <span style={{ color: '#888' }}>{progress.target > 0 ? `${progress.target.toLocaleString()}${progress.unit}` : '上限なし'}</span>
                                </div>
                                {progress.target > 0 && (
                                    <div style={{ background: '#ddd', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                                        <div style={{ background: pct >= 100 ? '#27ae60' : '#8e44ad', width: `${pct}%`, height: '100%', borderRadius: '4px', transition: 'width 0.3s' }} />
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Analysis */}
                    <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', color: '#555' }}>📊 傾向分析</div>
                        <div style={{ fontSize: '12px', lineHeight: '1.7', color: '#333' }}>{prize.analysis}</div>
                    </div>

                    {/* Recent Winners */}
                    <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', color: '#555' }}>🏆 近年の受賞作</div>
                        {prize.recentWinners.map((w, i) => (
                            <div key={i} style={{ padding: '4px 0', fontSize: '12px', borderBottom: i < prize.recentWinners.length - 1 ? '1px dotted #ddd' : 'none' }}>
                                <span style={{ color: '#7f8c8d', marginRight: '6px' }}>{w.year}</span>
                                <span style={{ fontWeight: 'bold' }}>{w.title}</span>
                                <span style={{ color: '#888', marginLeft: '6px' }}>{w.author}</span>
                            </div>
                        ))}
                    </div>

                    {/* Links */}
                    <a href={prize.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '12px', color: '#3498db', textAlign: 'center' }}>
                        🔗 公式ページを開く
                    </a>
                </div>
            </div>
        );
    }

    // List View
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🏆 文学新人賞</span>
                    <span style={{ fontSize: '10px', color: '#888', fontWeight: 'normal' }}>
                        {filteredPrizes.length} / {literaryPrizes.length} 賞
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setGenreFilter('all')}
                        style={{
                            padding: '2px 8px', fontSize: '10px', border: '1px solid #ddd',
                            borderRadius: '12px', cursor: 'pointer',
                            background: genreFilter === 'all' ? '#8e44ad' : 'transparent',
                            color: genreFilter === 'all' ? 'white' : '#666'
                        }}
                    >全て</button>
                    {GENRES.map(g => (
                        <button
                            key={g}
                            onClick={() => setGenreFilter(g)}
                            style={{
                                padding: '2px 8px', fontSize: '10px', border: '1px solid #ddd',
                                borderRadius: '12px', cursor: 'pointer',
                                background: genreFilter === g ? '#8e44ad' : 'transparent',
                                color: genreFilter === g ? 'white' : '#666'
                            }}
                        >{g}</button>
                    ))}
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="賞名・出版社で検索..."
                    style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '4px', marginTop: '6px', boxSizing: 'border-box' }}
                />
            </div>

            {/* Prize List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredPrizes.map(prize => (
                    <div
                        key={prize.id}
                        onClick={() => setSelectedPrize(prize)}
                        style={{
                            padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,0.05)',
                            cursor: 'pointer', transition: 'background 0.15s',
                            background: projectSettings?.prizeId === prize.id ? 'rgba(142, 68, 173, 0.08)' : 'transparent'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                        onMouseLeave={e => e.currentTarget.style.background = projectSettings?.prizeId === prize.id ? 'rgba(142, 68, 173, 0.08)' : 'transparent'}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                                    {prize.name}
                                    {projectSettings?.prizeId === prize.id && <span style={{ marginLeft: '6px', color: '#8e44ad', fontSize: '10px' }}>✓ 応募中</span>}
                                </div>
                                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                                    {prize.organizer} | {prize.genre} | {prize.formatNote ? prize.formatNote.substring(0, 20) + (prize.formatNote.length > 20 ? '…' : '') : prize.charLimit && prize.charLimit.max ? prize.charLimit.max + '字' : prize.pageLimit.min + '〜' + (prize.pageLimit.max || '∞') + '枚'}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                {renderDeadlineBadge(prize)}
                                <div style={{ fontSize: '9px', color: '#aaa' }}>{prize.prize}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PrizePanel;
