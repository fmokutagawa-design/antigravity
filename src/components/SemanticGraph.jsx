import React, { useEffect, useState, useRef, useMemo } from 'react';

const SemanticGraph = ({ allFiles, linkGraph, onUpdateFile, onClose }) => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [isConnectMode, setIsConnectMode] = useState(false);
    const [hoveredNode, setHoveredNode] = useState(null);
    const [relationModal, setRelationModal] = useState(null); // { source, target }
    const [relationLabel, setRelationLabel] = useState('');
    const [prevExtractedData, setPrevExtractedData] = useState(null);
    const containerRef = useRef(null);

    // Drag & Connect State
    const [draggingNode, setDraggingNode] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0, ctrl: false }); // Current mouse for temp line

    const [filterType, setFilterType] = useState('all'); // 'all', 'character', 'world', 'other'

    // 1. Extract Nodes/Links using useMemo for performance
    const extractedData = useMemo(() => {
        if (!allFiles || !linkGraph) return { nodes: [], links: [] };

        // Filter files based on selection
        const filteredFiles = allFiles.filter(f => {
            if (filterType === 'all') return true;

            const isChar = (f.metadata && f.metadata.種別 === 'キャラ') || (f.path && (f.path.includes('characters/') || f.path.includes('人物/')));
            if (filterType === 'character') return isChar;

            const isWorld = (f.metadata && f.metadata.種別 === '設定') || (f.path && (f.path.includes('world/') || f.path.includes('世界観/')));
            if (filterType === 'world') return isWorld;

            return !isChar && !isWorld; // 'other'
        });

        const nodes = filteredFiles.map(f => {
            // Determine type for coloring
            let type = 'other';
            if ((f.metadata && f.metadata.種別 === 'キャラ') || (f.path && (f.path.includes('characters/') || f.path.includes('人物/')))) type = 'character';
            else if ((f.metadata && f.metadata.種別 === '設定') || (f.path && (f.path.includes('world/') || f.path.includes('世界観/')))) type = 'world';
            else if ((f.metadata && f.metadata.種別 === 'プロット') || (f.path && (f.path.includes('plots/') || f.path.includes('プロット/')))) type = 'plot';

            // Stable initial position based on ID string
            const id = f.path; // Use full path as ID to match linkGraph keys
            let hash = 0;
            for (let i = 0; i < id.length; i++) {
                hash = ((hash << 5) - hash) + id.charCodeAt(i);
                hash |= 0;
            }
            const initialX = 100 + (Math.abs(hash) % 600);
            const initialY = 100 + (Math.abs(hash >> 16) % 400);

            return {
                id,
                label: f.name.replace(/\.[^/.]+$/, ""), // Display label
                file: f,
                x: initialX,
                y: initialY,
                vx: 0,
                vy: 0,
                type: type
            };
        });

        const links = [];

        // Use linkGraph for connections
        // linkGraph is Map<filePath, NodeData> where NodeData has outLinks: string[]
        if (linkGraph instanceof Map) {
            nodes.forEach(sourceNode => {
                const sourceData = linkGraph.get(sourceNode.id);
                if (sourceData && sourceData.outLinks) {
                    sourceData.outLinks.forEach(targetPath => {
                        // Check if target exists in our filtered nodes
                        const targetNode = nodes.find(n => n.id === targetPath);
                        if (targetNode && sourceNode.id !== targetNode.id) {
                            // Check for existing link (undirected visual)
                            const existing = links.find(l =>
                                (l.source === sourceNode.id && l.target === targetNode.id) ||
                                (l.source === targetNode.id && l.target === sourceNode.id)
                            );
                            if (!existing) {
                                links.push({ source: sourceNode.id, target: targetNode.id });
                            }
                        }
                    });
                }
            });
        }

        return { nodes, links };
    }, [allFiles, linkGraph, filterType]);

    // Sync state with props during render to avoid cascading renders (React 18 recommendation)
    if (extractedData !== prevExtractedData) {
        setPrevExtractedData(extractedData);
        setGraphData(prev => {
            const nextNodes = extractedData.nodes.map(newNode => {
                const existing = prev.nodes.find(n => n.id === newNode.id);
                return existing ? { ...newNode, x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy } : newNode;
            });
            return { nodes: nextNodes, links: extractedData.links };
        });
    }

    // Simple Force Simulation loop
    useEffect(() => {
        let animationFrame;
        const tick = () => {
            setGraphData(prev => {
                const nextNodes = prev.nodes.map(n => ({ ...n, fx: 0, fy: 0 }));

                // 1. Repulsion
                for (let i = 0; i < nextNodes.length; i++) {
                    for (let j = i + 1; j < nextNodes.length; j++) {
                        const ni = nextNodes[i];
                        const nj = nextNodes[j];
                        const dx = nj.x - ni.x;
                        const dy = nj.y - ni.y;
                        const distSq = dx * dx + dy * dy || 1;
                        const dist = Math.sqrt(distSq);
                        const force = 5000 / distSq;
                        const fx = (dx / dist) * force;
                        const fy = (dy / dist) * force;
                        nextNodes[i].fx -= fx;
                        nextNodes[i].fy -= fy;
                        nextNodes[j].fx += fx;
                        nextNodes[j].fy += fy;
                    }
                }

                // 2. Attraction
                prev.links.forEach(link => {
                    const sn = nextNodes.find(n => n.id === link.source);
                    const tn = nextNodes.find(n => n.id === link.target);
                    if (!sn || !tn) return;
                    const dx = tn.x - sn.x;
                    const dy = tn.y - sn.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = (dist - 150) * 0.05;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    sn.fx += fx;
                    sn.fy += fy;
                    tn.fx -= fx;
                    tn.fy -= fy;
                });

                // 3. Center Gravity
                nextNodes.forEach(n => {
                    const dx = 400 - n.x; // Adjusted center
                    const dy = 300 - n.y;
                    n.fx += dx * 0.01;
                    n.fy += dy * 0.01;
                });

                const nodes = nextNodes.map(n => {
                    if (draggingNode && n.id === draggingNode.id) return n;
                    const vx = (n.vx + n.fx) * 0.9;
                    const vy = (n.vy + n.fy) * 0.9;
                    return {
                        ...n,
                        vx, vy,
                        x: n.x + vx,
                        y: n.y + vy
                    };
                });
                return { ...prev, nodes };
            });
            animationFrame = requestAnimationFrame(tick);
        };

        animationFrame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animationFrame);
    }, [graphData.links, draggingNode]);

    const handleMouseDown = (node) => {
        setDraggingNode(node);
    };

    const handleMouseMove = (e) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setMousePos({ x, y, ctrl: e.ctrlKey });

        if (draggingNode) {
            if (isConnectMode || e.ctrlKey) {
                // Connection Mode: Just check for hover
                const target = graphData.nodes.find(n => {
                    if (n.id === draggingNode.id) return false;
                    const dx = n.x - x;
                    const dy = n.y - y;
                    return Math.sqrt(dx * dx + dy * dy) < 40;
                });
                setHoveredNode(target || null);
            } else {
                // Normal Mode: Move node
                setGraphData(prev => ({
                    ...prev,
                    nodes: prev.nodes.map(n => n.id === draggingNode.id ? { ...n, x, y, vx: 0, vy: 0 } : n)
                }));
            }
        }
    };

    const handleMouseUp = (e) => {
        if ((isConnectMode || e.ctrlKey) && draggingNode && hoveredNode) {
            setRelationModal({ source: draggingNode, target: hoveredNode });
            setRelationLabel('');
        }
        setDraggingNode(null);
        setHoveredNode(null);
    };

    const handleConfirmRelation = async () => {
        if (!relationModal || !onUpdateFile) return;

        const { source, target } = relationModal;
        const linkText = relationLabel ? `[[${target.id}|${relationLabel}]]` : `[[${target.id}]]`;

        // Update the source file
        const fullContent = source.file.content || "";
        const newContent = fullContent.trim() + "\n\n" + linkText;

        const success = await onUpdateFile(source.file.handle, newContent);
        if (success) {
            setRelationModal(null);
        } else {
            alert("ファイルの更新に失敗しました。");
        }
    };



    return (
        <div
            className="semantic-graph-overlay"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                display: 'flex', flexDirection: 'column',
                fontFamily: 'var(--font-gothic)'
            }}
        >
            <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', background: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🕸️</span> 知識グラフ
                        <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>({graphData.nodes.length} nodes)</span>
                    </h2>

                    {/* Filter Controls */}
                    <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: '6px', padding: '2px' }}>
                        {['all', 'character', 'world'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: filterType === type ? '#fff' : 'transparent',
                                    color: filterType === type ? '#333' : '#888',
                                    fontWeight: filterType === type ? 'bold' : 'normal',
                                    boxShadow: filterType === type ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                {type === 'all' ? '全て' : type === 'character' ? '人物' : '世界観'}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setIsConnectMode(!isConnectMode)}
                        style={{
                            padding: '6px 14px', borderRadius: '20px',
                            border: `1px solid ${isConnectMode ? '#7b1fa2' : '#ddd'}`,
                            background: isConnectMode ? '#f3e5f5' : '#fff',
                            color: isConnectMode ? '#7b1fa2' : '#666',
                            fontWeight: 'bold', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '12px'
                        }}
                    >
                        <span>{isConnectMode ? '⚡ 接続モード' : '🔗 接続'}</span>
                    </button>
                </div>
                <button onClick={onClose} style={{
                    padding: '8px 16px', borderRadius: '20px', border: '1px solid #ddd',
                    background: '#fff', cursor: 'pointer'
                }}>閉じる</button>
            </div>

            <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: draggingNode ? 'grabbing' : 'grab' }}>
                <svg width="100%" height="100%" style={{ pointerEvents: 'none' }}>
                    {/* Render Links */}
                    {graphData.links.map((link, i) => {
                        const s = graphData.nodes.find(n => n.id === link.source);
                        const t = graphData.nodes.find(n => n.id === link.target);
                        if (!s || !t) return null;
                        const mx = (s.x + t.x) / 2;
                        const my = (s.y + t.y) / 2;
                        return (
                            <g key={i}>
                                <line
                                    x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                                    stroke="#ccc" strokeWidth="2" strokeDasharray="4 2"
                                />
                                {link.label && (
                                    <text
                                        x={mx} y={my}
                                        dy={-5}
                                        textAnchor="middle"
                                        style={{ fontSize: '10px', fill: '#888', background: 'white' }}
                                    >
                                        {link.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                    {/* Temp Connecting Line */}
                    {draggingNode && (isConnectMode || mousePos.ctrl) && (
                        <line
                            x1={draggingNode.x} y1={draggingNode.y}
                            x2={mousePos.x} y2={mousePos.y}
                            stroke="#7b1fa2" strokeWidth="3" strokeDasharray="5 5"
                        />
                    )}
                </svg>

                {/* Render Nodes */}
                {graphData.nodes.map(node => (
                    <div
                        key={node.id}
                        onMouseDown={(e) => handleMouseDown(node, e)}
                        style={{
                            position: 'absolute',
                            left: node.x, top: node.y,
                            transform: 'translate(-50%, -50%)',
                            padding: '10px 16px',
                            background: node.type === 'character' ? 'var(--accent-color)' :
                                node.type === 'world' ? '#4CAF50' :
                                    node.type === 'plot' ? '#FF9800' : '#fff',
                            color: node.type !== 'other' ? '#fff' : '#333',
                            border: `2px solid ${node.type === 'character' ? 'var(--accent-color)' :
                                node.type === 'world' ? '#4CAF50' :
                                    node.type === 'plot' ? '#FF9800' : '#ddd'
                                }`,
                            borderRadius: '30px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            cursor: 'inherit',
                            userSelect: 'none',
                            transition: 'background 0.2s',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        <span>{
                            node.type === 'character' ? '👤' :
                                node.type === 'world' ? '🌍' :
                                    node.type === 'plot' ? '📉' : '📄'
                        }</span>
                        {node.label || node.id}
                        {isConnectMode && draggingNode && draggingNode.id === node.id && (
                            <div style={{
                                position: 'absolute', inset: -5, border: '2px solid #7b1fa2',
                                borderRadius: '35px', animation: 'pulse 1s infinite'
                            }} />
                        )}
                        {isConnectMode && hoveredNode && hoveredNode.id === node.id && (
                            <div style={{
                                position: 'absolute', inset: -5, border: '4px solid #7b1fa2',
                                borderRadius: '35px'
                            }} />
                        )}
                    </div>
                ))}

                {/* Relation Modal */}
                {relationModal && (
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                        zIndex: 2000, width: '320px', display: 'flex', flexDirection: 'column', gap: '15px',
                        border: '1px solid #ddd'
                    }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>関係性を定義</h3>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                            <strong>{relationModal.source.label || relationModal.source.id}</strong> → <strong>{relationModal.target.label || relationModal.target.id}</strong>
                        </div>
                        <input
                            autoFocus
                            value={relationLabel}
                            onChange={(e) => setRelationLabel(e.target.value)}
                            placeholder="関係名 (例: 親友, 宿敵...)"
                            onKeyDown={(e) => e.key === 'Enter' && handleConfirmRelation()}
                            style={{
                                padding: '10px', borderRadius: '8px', border: '1px solid #ddd',
                                fontSize: '14px', outline: 'none'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={handleConfirmRelation} style={{
                                flex: 1, padding: '10px', background: 'var(--accent-color)', color: '#fff',
                                border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'
                            }}>決定</button>
                            <button onClick={() => setRelationModal(null)} style={{
                                flex: 1, padding: '10px', background: '#f5f5f5', color: '#666',
                                border: 'none', borderRadius: '8px', cursor: 'pointer'
                            }}>キャンセル</button>
                        </div>
                    </div>
                )}

                {graphData.nodes.length === 0 && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#888' }}>
                        キャラクター資料が見つかりません。
                    </div>
                )}
            </div>

            <div style={{ padding: '15px 20px', fontSize: '12px', color: '#666', borderTop: '1px solid #eee' }}>
                💡 <strong>接続モード</strong>: ノードから別のノードへとドラッグして線を引くことで、関係性を定義できます。Ctrlキーを押しながらドラッグでも素早く接続できます。
            </div>
        </div>
    );
};

export default SemanticGraph;
