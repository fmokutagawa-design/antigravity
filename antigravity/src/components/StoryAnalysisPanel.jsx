import React, { useState } from 'react';
import { StoryStructureGraph } from './StoryStructureGraph';

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
};

const modalStyle = {
    backgroundColor: '#fefefe',
    color: '#333',
    width: '800px',
    maxWidth: '95%',
    height: '85vh',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    fontFamily: '"Helvetica Neue", Arial, sans-serif'
};

const headerStyle = {
    padding: '16px 24px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9'
};

const tabBarStyle = {
    display: 'flex',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#fff'
};

const tabStyle = (isActive) => ({
    padding: '12px 24px',
    cursor: 'pointer',
    fontWeight: isActive ? 'bold' : 'normal',
    borderBottom: isActive ? '3px solid #2196F3' : '3px solid transparent',
    color: isActive ? '#2196F3' : '#666',
    transition: 'all 0.2s'
});

const contentStyle = {
    padding: '24px',
    flex: 1,
    overflowY: 'auto'
};

export const StoryAnalysisPanel = ({ boardData, onClose, addConnection }) => {
    const [activeTab, setActiveTab] = useState('structure');

    // --- Analysis Logic ---
    const analyzeStructure = () => {
        // Count cards per scene
        return boardData.scenes.map(scene => ({
            id: scene.id,
            title: scene.title,
            act: scene.act,
            cardCount: (boardData.cards[scene.id] || []).length,
            hasCritical: (boardData.cards[scene.id] || []).some(c => c.type === 'event') // Simplified check
        }));
    };

    const analyzeThreads = () => {
        const issues = [];
        const interactions = [];

        const allCards = Object.values(boardData.cards).flat();
        const connections = boardData.connections || [];

        allCards.forEach(card => {
            if (card.type === 'foreshadow') {
                const outgoing = connections.find(c => c.source === card.id);
                if (!outgoing) {
                    issues.push({ card, type: 'missing_payoff', message: 'この伏線は回収されていません（接続先なし）。' });
                } else {
                    interactions.push({ card, type: 'resolved', message: '回収済み', target: outgoing.target });
                }
            }
        });

        return { issues, interactions };
    };

    const getPlotText = () => {
        let text = '';
        boardData.scenes.forEach(scene => {
            const cards = boardData.cards[scene.id] || [];
            if (cards.length > 0) {
                text += `■ ${scene.act} - ${scene.title}\n\n`;
                const filteredCards = cards.filter(c => c.title !== 'Time Marker' && c.defaultTitle !== 'Time Marker');
                filteredCards.forEach((card, idx) => {
                    text += `【${idx + 1}. ${card.title || card.content}】\n`;
                    if (card.plot) text += `${card.plot}\n`;
                    if (card.time) text += `(時: ${card.time})\n`;
                    text += '\n';
                });
                text += '\n-------------------\n\n';
            }
        });
        return text;
    };

    const structureData = analyzeStructure();
    const threadData = analyzeThreads();
    const plotText = getPlotText();

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h3 style={{ margin: 0 }}>物語構造分析 (Story Analysis)</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                </div>

                <div style={tabBarStyle}>
                    <div style={tabStyle(activeTab === 'structure')} onClick={() => setActiveTab('structure')}>
                        📊 構造バランス
                    </div>
                    <div style={tabStyle(activeTab === 'graph')} onClick={() => setActiveTab('graph')}>
                        📈 構造グラフ
                    </div>
                    <div style={tabStyle(activeTab === 'threads')} onClick={() => setActiveTab('threads')}>
                        🧵 伏線チェック
                    </div>
                    <div style={tabStyle(activeTab === 'plot')} onClick={() => setActiveTab('plot')}>
                        📝 プロット概観
                    </div>
                </div>

                <div style={contentStyle}>
                    {activeTab === 'structure' && (
                        <div>
                            <h4 style={{ marginTop: 0 }}>シーンごとのカード分布</h4>
                            <p style={{ fontSize: '0.9rem', color: '#666' }}>
                                各シーン（ビート）に含まれるイベントカードの数です。重要な転換点（カタリスト、ミッドポイントなど）にイベントがあるか確認しましょう。
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
                                {structureData.map(item => (
                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '8px', borderBottom: '1px solid #f0f0f0' }}>
                                        <div style={{ width: '200px', fontSize: '0.9rem' }}>
                                            <div style={{ fontWeight: 'bold' }}>{item.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#888' }}>{item.act}</div>
                                        </div>
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                            <div style={{
                                                height: '24px',
                                                width: `${Math.min(item.cardCount * 30, 100)}%`, // Scale logic
                                                backgroundColor: item.cardCount > 0 ? '#4CAF50' : '#eee',
                                                borderRadius: '4px',
                                                transition: 'width 0.5s'
                                            }}></div>
                                            <span style={{ marginLeft: '10px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                                {item.cardCount} cards
                                            </span>
                                        </div>
                                        {item.cardCount === 0 && (
                                            <div style={{ color: '#FF9800', fontSize: '0.8rem' }}>⚠️ イベントなし</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'graph' && (
                        <StoryStructureGraph boardData={boardData} />
                    )}

                    {activeTab === 'threads' && (
                        <div>
                            <h4 style={{ marginTop: 0 }}>伏線回収状況</h4>

                            {threadData.issues.length > 0 && (
                                <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#ffebee', borderRadius: '8px', border: '1px solid #ffcdd2' }}>
                                    <strong style={{ color: '#d32f2f', display: 'block', marginBottom: '8px' }}>⚠️ 未回収の伏線があります ({threadData.issues.length}件)</strong>
                                    <p style={{ fontSize: '0.85rem', color: '#d32f2f', marginBottom: '12px' }}>プルダウンからイベントを選択して、すぐに線を引くことができます。</p>

                                    <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '0', listStyle: 'none' }}>
                                        {threadData.issues.map((issue, idx) => {
                                            // Prepare candidates (Events only, usually)
                                            const allCards = Object.values(boardData.cards).flat();
                                            // Filter candidates: Not self, and usually we look for Events.
                                            const candidates = allCards.filter(c => c.id !== issue.card.id && c.type !== 'foreshadow');

                                            return (
                                                <li key={idx} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.5)', padding: '6px', borderRadius: '4px' }}>
                                                    <span style={{ flex: 1, fontWeight: 'bold', fontSize: '0.9rem' }}>🚩 {issue.card.title || issue.card.content}</span>
                                                    <span style={{ fontSize: '1rem', color: '#999' }}>➡️</span>
                                                    <select
                                                        style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc', maxWidth: '240px', fontSize: '0.85rem' }}
                                                        value=""
                                                        onChange={(e) => {
                                                            if (e.target.value && addConnection) {
                                                                const targetName = candidates.find(c => c.id === e.target.value)?.title || '選択したカード';
                                                                if (confirm(`「${issue.card.title}」を「${targetName}」に関連付け（回収）しますか？`)) {
                                                                    addConnection(issue.card.id, e.target.value);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <option value="">(回収イベントを選択...)</option>
                                                        {candidates.map(c => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.title || c.content.substring(0, 20)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            <div>
                                <strong>回収済みライン</strong>
                                {threadData.interactions.length === 0 ? (
                                    <p style={{ color: '#888' }}>接続された伏線はありません。</p>
                                ) : (
                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                        {threadData.interactions.map((item, idx) => (
                                            <li key={idx} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                                                ✅ <strong>{item.card.title || item.card.content}</strong> ➡️ 回収済み
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'plot' && (
                        <div>
                            <h4 style={{ marginTop: 0 }}>プロット一括表示</h4>
                            <p style={{ fontSize: '0.9rem', color: '#666' }}>
                                すべてのカードのプロット内容を時系列順に表示しています。全体流れの確認や、コピペしての再利用に便利です。
                            </p>
                            <textarea
                                readOnly
                                value={plotText}
                                style={{
                                    width: '100%',
                                    height: '420px',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    border: '1px solid #ccc',
                                    lineHeight: '1.6',
                                    fontFamily: 'monospace',
                                    fontSize: '1rem',
                                    marginBottom: '10px'
                                }}
                            />
                            <div style={{ textAlign: 'right' }}>
                                <button
                                    onClick={async () => {
                                        try {
                                            const now = new Date();
                                            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
                                            const filename = `plot_export_${timestamp}.txt`;
                                            const blob = new Blob([plotText], { type: 'text/plain' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = filename;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        } catch (e) {
                                            alert('保存に失敗しました: ' + e.message);
                                        }
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#2196F3',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    💾 テキストファイルとして保存
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
