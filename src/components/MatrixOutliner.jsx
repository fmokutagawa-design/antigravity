import React, { useMemo } from 'react';

const MatrixOutliner = ({ allFiles, onClose, onOpenFile }) => {
    const scenes = useMemo(() => {
        if (!allFiles) return [];
        // Extract files that are scenes or story parts
        // Usually these are in a specific folder or have specific metadata
        return allFiles.filter(f =>
            f.metadata && (f.metadata.種別 === 'シーン' || f.metadata.種別 === 'プロット')
            && !f.name.startsWith('.')
        ).map(f => ({
            id: f.name,
            name: f.name.replace(/\.[^/.]+$/, ""),
            pov: f.metadata.PoV || f.metadata.視点 || '-',
            location: f.metadata.場所 || f.metadata.Location || '-',
            time: f.metadata.時間 || f.metadata.Time || '-',
            status: f.metadata.状態 || '-',
            chars: f.metadata.登場人物 || '-',
            wordCount: (f.content || "").length,
            file: f
        }));
    }, [allFiles]);

    return (
        <div className="matrix-outliner-overlay" style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: '#fff',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'var(--font-gothic)',
            color: '#333'
        }}>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', background: '#fcfcfc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ margin: 0, fontSize: '20px' }}>📊 マトリックス・アウトライナー</h2>
                    <span style={{ fontSize: '13px', color: '#888' }}>{scenes.length} シーン</span>
                </div>
                <button onClick={onClose} style={{
                    padding: '8px 20px', borderRadius: '20px', border: '1px solid #ddd',
                    background: '#fff', cursor: 'pointer', fontSize: '14px'
                }}>閉じる</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #eee' }}>
                            <th style={{ padding: '12px', width: '25%' }}>シーン名</th>
                            <th style={{ padding: '12px' }}>視点 (PoV)</th>
                            <th style={{ padding: '12px' }}>場所</th>
                            <th style={{ padding: '12px' }}>時間</th>
                            <th style={{ padding: '12px' }}>登場人物</th>
                            <th style={{ padding: '12px' }}>文字数</th>
                            <th style={{ padding: '12px' }}>状態</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scenes.map((s, i) => (
                            <tr
                                key={i}
                                onClick={() => { onOpenFile(s.file); onClose(); }}
                                style={{ borderBottom: '1px solid #eee', cursor: 'pointer', transition: 'background 0.1s' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--accent-color)' }}>{s.name}</td>
                                <td style={{ padding: '12px' }}>{s.pov}</td>
                                <td style={{ padding: '12px' }}>{s.location}</td>
                                <td style={{ padding: '12px' }}>{s.time}</td>
                                <td style={{ padding: '12px' }}>{s.chars}</td>
                                <td style={{ padding: '12px' }}>{s.wordCount.toLocaleString()}</td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{
                                        display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
                                        fontSize: '11px', background: s.status === '完成' ? '#e8f5e9' : '#fff3e0',
                                        color: s.status === '完成' ? '#2e7d32' : '#ef6c00',
                                        border: `1px solid ${s.status === '完成' ? '#c8e6c9' : '#ffe0b2'}`
                                    }}>
                                        {s.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {scenes.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                        表示できるシーンが見つかりません。
                    </div>
                )}
            </div>

            <div style={{ padding: '15px 20px', fontSize: '12px', color: '#888', background: '#fcfcfc', borderTop: '1px solid #eee' }}>
                💡 各ファイルのメタデータ（`PoV:`, `場所:`, `時間:` 等）を記述すると、自動的にこの一覧に反映されます。
            </div>
        </div>
    );
};

export default MatrixOutliner;
