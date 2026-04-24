import React, { useMemo } from 'react';

const OutlinePanel = ({ text, onJump, onClose, embedded = false }) => {
    // Parse outline from text
    const outlineItems = useMemo(() => {
        if (!text) return [];

        const lines = text.split('\n');
        const items = [];

        // Regex Patterns
        // 1. Markdown Headers: #, ##, ...
        const mdRegex = /^(#{1,6})\s+(.+)/;
        // 2. Japanese Chapters: 第N章, 第N話, etc.
        const jpRegex = /^(第[0-9０-９一二三四五六七八九十百千万]+[章話節幕編部]).*/;
        // 3. Simple Symbols: ■, □, ●, ○ (User preference)
        const symbolRegex = /^([■□●○◆◇★☆])\s*(.*)/;

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            let match;
            let level = 0;
            let label = '';

            if ((match = trimmed.match(mdRegex))) {
                level = match[1].length - 1; // #=0, ##=1
                label = match[2];
            } else if ((match = trimmed.match(jpRegex))) {
                level = 0; // Top level
                label = trimmed; // Use full line
            } else if ((match = trimmed.match(symbolRegex))) {
                level = 1; // Sub level
                label = trimmed;
            }

            if (label) {
                items.push({
                    lineIndex: index,
                    level,
                    label
                });
            }
        });

        return items;
    }, [text]);

    return (
        <div className="outline-panel" style={{
            width: embedded ? '100%' : '250px',
            height: '100%',
            backgroundColor: embedded ? 'transparent' : 'var(--bg-secondary)',
            borderRight: embedded ? 'none' : '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            fontSize: '0.9rem'
        }}>
            {!embedded && (
            <div className="outline-header" style={{
                padding: '8px',
                borderBottom: '1px solid var(--border-color)',
                fontWeight: 'bold',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-tertiary)'
            }}>
                <span>アウトライン</span>
                <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            )}

            <div className="outline-content" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                {outlineItems.length === 0 ? (
                    <div style={{ padding: '16px', color: '#888', textAlign: 'center', fontSize: '0.8rem' }}>
                        見出しが見つかりません。<br />
                        (# 見出し, 第N章, ■ など)
                    </div>
                ) : (
                    outlineItems.map((item, i) => (
                        <div
                            key={i}
                            onClick={() => onJump(item.lineIndex)}
                            style={{
                                padding: '4px 8px',
                                paddingLeft: `${8 + item.level * 16}px`,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: 'var(--text-primary)',
                                // Hover effect handles via CSS usually, inline for now
                            }}
                            className="outline-item"
                            onMouseEnter={(e) => e.target.style.background = 'rgba(0,0,0,0.05)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                            {item.label}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default OutlinePanel;
