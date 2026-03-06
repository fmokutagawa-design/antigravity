import React from 'react';

// Refined Coordinates matching the "Clean" Otsuka Graph
const STAGE_COORDINATES = {
    // A: Start - Ordinary World (Bottom Right)
    'stage-1': { x: 700, y: 500, align: 'left', label: 'A', title: '主人公が欠落させているもの', boxOffset: { x: -20, y: -20 } },
    'stage-2': { x: 550, y: 380, align: 'left', label: '', title: '予兆', boxOffset: { x: 20, y: 0 } },
    'stage-3': { x: 500, y: 340, align: 'left', label: '', title: '使者', boxOffset: { x: 20, y: 0 } },
    'stage-4': { x: 450, y: 300, align: 'left', label: '', title: '賢者からアイテムをもらう', boxOffset: { x: 20, y: -10 } },
    'stage-5': { x: 400, y: 280, align: 'center', label: 'B', title: '第一関門突破の際の門番', boxOffset: { x: -220, y: 0 } },
    'stage-6': { x: 200, y: 240, align: 'right', label: '', title: 'パーティーの構成員', boxOffset: { x: -20, y: 0 } },
    'stage-7': { x: 150, y: 200, align: 'right', label: '', title: '挫折のエピソード', boxOffset: { x: -20, y: 0 } },
    'stage-8': { x: 100, y: 160, align: 'right', label: 'C', title: '最も危険な場所', boxOffset: { x: -20, y: 0 } },
    'stage-9': { x: 250, y: 120, align: 'right', label: '', title: '帰還におけるイベント', boxOffset: { x: -20, y: 0 } },
    'stage-10': { x: 400, y: 100, align: 'center', label: 'D', title: '主人公が代償で失ったもの', boxOffset: { x: 20, y: 20 } },
    'stage-11': { x: 550, y: 60, align: 'left', label: '', title: '主人公が得たもの', boxOffset: { x: 20, y: 0 } },
    'stage-12': { x: 700, y: 30, align: 'left', label: '', title: '新しい日常の世界', boxOffset: { x: -100, y: -40 } }
};

export const StoryStructureGraph = ({ boardData }) => {
    // Check compatibility
    const isOtsuka = boardData?.cards && (boardData.cards['stage-1'] !== undefined);

    if (!isOtsuka) {
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', flexDirection: 'column' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                <div>このグラフは大塚英志式（12ステージ）専用です</div>
                <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>三幕構成（8シークエンス）モードでは表示されません</div>
            </div>
        );
    }

    const getCardContent = (stageId) => {
        // Safe check for boardData
        if (!boardData || !boardData.cards) return null;
        const cards = boardData.cards[stageId];
        if (!cards || cards.length === 0) return null;
        // Truncate for SVG display
        const text = cards.map(c => c.title || c.content).join(' / ');
        return text.length > 20 ? text.substring(0, 20) + '...' : text;
    };

    const getLineEnd = (coord) => {
        const boxX = coord.x + coord.boxOffset.x;
        const boxY = coord.y + coord.boxOffset.y;
        const targetX = coord.boxOffset.x > 0 ? boxX : boxX + 200;
        const targetY = boxY + 20;
        return { x: targetX, y: targetY };
    };

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', background: '#fff' }}>
            <svg width="850" height="600" viewBox="0 0 850 600" style={{ backgroundColor: '#fff' }}>
                <line x1="400" y1="20" x2="400" y2="580" stroke="#000" strokeWidth="2" />
                <text x="20" y="580" fill="#000" fontSize="12" fontWeight="bold">非日常の世界</text>
                <text x="420" y="580" fill="#000" fontSize="12" fontWeight="bold">日常の世界</text>
                <path
                    d="M 800 550 L 400 280 C 400 280, 50 250, 100 160 C 150 70, 400 100, 400 100 L 700 30"
                    fill="none" stroke="#666" strokeWidth="1"
                />
                <g transform="translate(50, 50)">
                    <rect x="0" y="0" width="100" height="30" fill="none" stroke="#000" strokeWidth="1" />
                    <text x="5" y="20" fontSize="10">敵対者</text>
                    <line x1="50" y1="30" x2="100" y2="160" stroke="#ccc" strokeWidth="1" strokeDasharray="4,2" />
                </g>

                {Object.entries(STAGE_COORDINATES).map(([stageId, coord]) => {
                    const content = getCardContent(stageId);
                    const hasBox = !!content;
                    const lineEnd = getLineEnd(coord);

                    return (
                        <g key={stageId}>
                            <line
                                x1={coord.x} y1={coord.y}
                                x2={lineEnd.x} y2={lineEnd.y}
                                stroke="#999" strokeWidth="0.5"
                            />
                            <circle cx={coord.x} cy={coord.y} r="4" fill="#000" />
                            {coord.label && (
                                <text x={coord.x + 8} y={coord.y + 12} fontSize="14" fontWeight="bold" fill="#000">{coord.label}</text>
                            )}

                            <g transform={`translate(${coord.x + coord.boxOffset.x}, ${coord.y + coord.boxOffset.y})`}>
                                <text x="0" y="-5" fontSize="10" fill="#333">{coord.title}</text>
                                <rect x="0" y="0" width="200" height="40" fill="#fff" stroke="#000" strokeWidth="1" />
                                <text x="10" y="25" fill={hasBox ? "#000" : "#ccc"} fontSize="10">
                                    {hasBox ? content : '(未入力)'}
                                </text>
                            </g>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
