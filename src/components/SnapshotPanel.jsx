import React, { useState, useEffect, useCallback } from 'react';
import { getSnapshots, clearSnapshots } from '../utils/snapshotStore';

const SnapshotPanel = ({ filePath, currentText, onRestore, showToast, onSaveNow }) => {
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [previewId, setPreviewId] = useState(null);
    const [diffView, setDiffView] = useState(null);

    const loadSnapshots = useCallback(async () => {
        if (!filePath) {
            setSnapshots([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const list = await getSnapshots(filePath);
            setSnapshots(list);
        } catch (e) {
            console.error('Failed to load snapshots:', e);
            setSnapshots([]);
        }
        setLoading(false);
    }, [filePath]);

    useEffect(() => {
        loadSnapshots();
    }, [loadSnapshots]);

    const handlePreview = (snapshot) => {
        if (previewId === snapshot.id) {
            setPreviewId(null);
            setDiffView(null);
            return;
        }
        setPreviewId(snapshot.id);
        // 簡易diff: 行単位で比較
        const currentLines = (currentText || '').split('\n');
        const snapshotLines = (snapshot.content || '').split('\n');
        const maxLen = Math.max(currentLines.length, snapshotLines.length);
        const diffs = [];
        for (let i = 0; i < maxLen; i++) {
            const cur = currentLines[i] || '';
            const snap = snapshotLines[i] || '';
            if (cur !== snap) {
                diffs.push({ line: i + 1, current: cur, snapshot: snap });
            }
        }
        setDiffView({ snapshotId: snapshot.id, diffs, totalDiffs: diffs.length });
    };

    const handleRestore = (snapshot) => {
        if (onRestore) {
            onRestore(snapshot.content);
            if (showToast) showToast(`${formatTime(snapshot.timestamp)} の状態に復元しました`);
            setPreviewId(null);
            setDiffView(null);
        }
    };

    const handleClear = async () => {
        if (!filePath) return;
        try {
            await clearSnapshots(filePath);
            setSnapshots([]);
            if (showToast) showToast('履歴をクリアしました');
        } catch (e) {
            console.error('Failed to clear snapshots:', e);
        }
    };

    const formatTime = (ts) => {
        const d = new Date(ts);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) {
            return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) + ' ' +
            d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    };

    const formatAgo = (ts) => {
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'たった今';
        if (mins < 60) return `${mins}分前`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}時間前`;
        const days = Math.floor(hours / 24);
        return `${days}日前`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-secondary)',
                fontSize: '13px',
                fontWeight: 'bold'
            }}>
                <span>📸 スナップショット</span>
                {snapshots.length > 0 && (
                    <button
                        onClick={handleClear}
                        style={{
                            border: '1px solid var(--border-color)',
                            background: 'transparent',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '10px',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        🗑 全削除
                    </button>
                )}
            </div>

            {!filePath ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
                    ファイルを開いてください
                </div>
            ) : loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
                    読み込み中...
                </div>
            ) : snapshots.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
                    スナップショットはまだありません。<br />
                    <span style={{ fontSize: '11px' }}>5分ごと、または大きな変更時に自動保存されます。</span>
                    {onSaveNow && currentText && (
                        <button
                            onClick={async () => {
                                if (onSaveNow) {
                                    await onSaveNow();
                                    loadSnapshots();
                                    if (showToast) showToast('スナップショットを保存しました');
                                }
                            }}
                            style={{
                                marginTop: '12px',
                                padding: '6px 16px',
                                backgroundColor: 'var(--accent-color, #3498db)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px'
                            }}
                        >
                            📸 今すぐ保存
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                        {snapshots.length}件の履歴
                    </div>
                    {snapshots.map((snap) => (
                        <div key={snap.id} style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            marginBottom: '6px',
                            backgroundColor: previewId === snap.id ? 'var(--bg-tertiary, #f0f0f0)' : 'var(--bg-card, #fff)',
                            overflow: 'hidden'
                        }}>
                            <div
                                onClick={() => handlePreview(snap)}
                                style={{
                                    padding: '8px 10px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '12px'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{formatTime(snap.timestamp)}</div>
                                    <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                                        {formatAgo(snap.timestamp)} · {snap.charCount || snap.content?.length || 0}文字
                                    </div>
                                </div>
                                <span style={{ fontSize: '10px', color: '#aaa' }}>
                                    {previewId === snap.id ? '▼' : '▶'}
                                </span>
                            </div>

                            {previewId === snap.id && diffView && diffView.snapshotId === snap.id && (
                                <div style={{
                                    borderTop: '1px solid var(--border-color)',
                                    padding: '8px 10px',
                                    fontSize: '11px'
                                }}>
                                    {diffView.totalDiffs === 0 ? (
                                        <div style={{ color: '#888', textAlign: 'center' }}>現在のテキストと同一です</div>
                                    ) : (
                                        <>
                                            <div style={{ color: '#888', marginBottom: '6px' }}>
                                                {diffView.totalDiffs}行の差分
                                            </div>
                                            <div style={{
                                                maxHeight: '150px',
                                                overflowY: 'auto',
                                                backgroundColor: 'var(--bg-secondary, #f9f9f9)',
                                                borderRadius: '4px',
                                                padding: '4px',
                                                fontFamily: 'monospace',
                                                fontSize: '10px',
                                                lineHeight: '1.5'
                                            }}>
                                                {diffView.diffs.slice(0, 20).map((d, i) => (
                                                    <div key={i} style={{ marginBottom: '4px' }}>
                                                        <div style={{ color: '#999' }}>L{d.line}:</div>
                                                        {d.snapshot && (
                                                            <div style={{ color: '#c0392b', paddingLeft: '8px' }}>
                                                                - {d.snapshot.substring(0, 60)}{d.snapshot.length > 60 ? '...' : ''}
                                                            </div>
                                                        )}
                                                        {d.current && (
                                                            <div style={{ color: '#27ae60', paddingLeft: '8px' }}>
                                                                + {d.current.substring(0, 60)}{d.current.length > 60 ? '...' : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {diffView.diffs.length > 20 && (
                                                    <div style={{ color: '#888', textAlign: 'center' }}>
                                                        ...他 {diffView.diffs.length - 20} 行
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleRestore(snap)}
                                                style={{
                                                    marginTop: '8px',
                                                    width: '100%',
                                                    padding: '6px',
                                                    backgroundColor: 'var(--accent-color, #3498db)',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                ↩ この状態に復元
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SnapshotPanel;
