import React, { useMemo, useState, useEffect, useRef } from 'react';
import { SCENE_TEMPLATES } from '../data/sceneTemplates';

const EXTRA_TEMPLATES = [
    { type: 'foreshadow', label: '伏線', icon: '🚩', color: '#FF9800', defaultTitle: '伏線', defaultPlot: '【伏線内容】' },
    { type: 'character', label: '重要キャラ', icon: '👤', color: '#9C27B0', defaultTitle: 'キャラ登場', defaultPlot: '【登場詳細】' }
];

const TEMPLATES = [...SCENE_TEMPLATES, ...EXTRA_TEMPLATES];

// Internal Dialog Component to replace window.prompt
const SimpleDialog = ({ isOpen, title, initialValue, onConfirm, onCancel, showInput = true }) => {
    const [val, setVal] = useState(initialValue || '');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setVal(initialValue || '');
            if (showInput) {
                setTimeout(() => inputRef.current?.focus(), 50);
            }
        }
    }, [isOpen, initialValue, showInput]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: '#fff', padding: '20px', borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)', minWidth: '300px'
            }}>
                <h4 style={{ margin: '0 0 12px 0', whiteSpace: 'pre-wrap' }}>{title}</h4>
                {showInput && (
                    <input
                        ref={inputRef}
                        type="text"
                        value={val}
                        onChange={e => setVal(e.target.value)}
                        style={{ width: '100%', padding: '8px', marginBottom: '12px', fontSize: '1rem' }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') onConfirm(val);
                            if (e.key === 'Escape') onCancel();
                        }}
                    />
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button onClick={onCancel} style={{ padding: '6px 12px', cursor: 'pointer' }}>キャンセル</button>
                    <button onClick={() => onConfirm(val)} style={{ padding: '6px 12px', background: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>OK</button>
                </div>
            </div>
        </div>
    );
};

export const StoryChronologyView = ({ boardData, onCardClick, addCard, updateCard, deleteCard, moveCardToColumn, setBoardData, saveBoard, addScene }) => {
    const [chronoMode, setChronoMode] = useState('scene');
    const [showTimeSubcols, setShowTimeSubcols] = useState(false);

    // Dialog State
    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, title: '', initialValue: '', onConfirm: null, showInput: true });

    const openDialog = (title, initialValue, callback, showInput = true) => {
        setDialogConfig({
            isOpen: true,
            title,
            initialValue,
            onConfirm: (val) => {
                // If input hidden, val might be stale but callback implies confirmation
                if (callback) callback(val);
                setDialogConfig(prev => ({ ...prev, isOpen: false }));
            },
            showInput
        });
    };

    // 1. Extract all unique characters & Sort by Order
    const characters = useMemo(() => {
        const charSet = new Set();
        Object.values(boardData.cards || {}).flat().forEach(card => {
            if (card && card.characters) {
                const chars = card.characters.split(/[,、・]+/).map(c => c.trim()).filter(Boolean);
                chars.forEach(c => charSet.add(c));
            }
        });

        let distinct = Array.from(charSet);
        const order = boardData.characterOrder || [];

        // Sort based on saved order, then alphabetical
        return distinct.sort((a, b) => {
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [boardData.cards, boardData.characterOrder]);

    // 2. Extract all unique Times
    const times = useMemo(() => {
        const tSet = new Set();
        Object.values(boardData.cards || {}).flat().forEach(card => {
            if (card && card.time) tSet.add(card.time);
        });
        return Array.from(tSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }, [boardData.cards]);

    // 3. Compute Scene Columns (Scene + Time split)
    const sceneColumns = useMemo(() => {
        if (chronoMode !== 'scene') return [];
        const uniqueScenes = [...new Map((boardData.scenes || []).filter(s => s && s.id).map(s => [s.id, s])).values()];
        return uniqueScenes.flatMap(scene => {
            if (!showTimeSubcols) return [{ scene, time: null, label: scene.title }];

            const sceneCards = (boardData.cards || {})[scene.id] || [];
            const tSet = new Set();
            sceneCards.forEach(c => tSet.add((c && c.time) || ''));
            // Always ensure at least one column
            if (tSet.size === 0) tSet.add('');

            const sorted = Array.from(tSet).sort((a, b) => {
                if (!a) return -1;
                if (!b) return 1;
                return a.localeCompare(b, undefined, { numeric: true });
            });

            return sorted.map(t => ({
                scene,
                time: t,
                label: t
                    ? `${scene.title} (${t})`
                    : (showTimeSubcols ? `${scene.title} (時間未設定)` : scene.title)
            }));
        });
    }, [boardData, chronoMode, showTimeSubcols]);

    const allCharRows = [...characters, '（未指定）'];
    const allTimeRows = [...times, '（時間未指定）'];

    const btnStyle = (isActive) => ({
        padding: '6px 12px',
        border: 'none',
        background: isActive ? '#fff' : 'transparent',
        color: isActive ? '#333' : '#777',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: isActive ? 'bold' : 'normal',
        boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
        fontSize: '0.85rem',
        whiteSpace: 'nowrap',
        flexShrink: 0
    });

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Allow Move for reordering, but use Copy for compatibility
        e.dataTransfer.dropEffect = 'copy';
        e.currentTarget.style.boxShadow = 'inset 0 0 0 2px #2196F3';
    };

    const handleDragLeave = (e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.backgroundColor = 'transparent';
    };

    const handleCellDrop = (e, context) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.style.boxShadow = 'none';

        try {
            let item;
            // 1. Try Native File Drop (Electron)
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                item = { name: file.name, path: file.path, isFile: true };
            } else {
                // 2. Try JSON Data (Internal Drag)
                // 2. Try JSON Data (Internal Drag)
                let dataStr = e.dataTransfer.getData('application/json');
                if (!dataStr) dataStr = e.dataTransfer.getData('text/plain');
                if (!dataStr) return;
                item = JSON.parse(dataStr);
            }

            // Reorder Check (Prevent Row Drag dropping into Cell)
            if (item.type === 'char-row') return;

            let charName = context.char;
            if (charName === '（未指定）') charName = '';

            // FIX: If dropping on Unspecified row, assume the file IS the character (if it's a file)
            if (!item.id && !charName && (item.name || item.title)) {
                const name = item.name || item.title;
                charName = name.replace(/\.(txt|md)$/i, '');
            }

            let timeVal = context.time;
            if (timeVal === '（時間未指定）') timeVal = '';

            // Prefer absolute path if available, else name
            const linkedPath = item.path || item.name;

            // CASE 1: MOVE EXISTING CARD
            // Key Fix: Check if it REALLY exists on board
            const existsOnBoard = item.id && Object.values(boardData.cards).flat().some(c => c.id === item.id);

            if (existsOnBoard) {
                if (updateCard) {
                    const updates = { characters: charName };
                    if (context.time !== undefined && context.time !== null) {
                        updates.time = timeVal;
                    }
                    updateCard(item.id, updates);
                }

                if (moveCardToColumn && context.sceneId) {
                    const sourceSceneId = Object.keys(boardData.cards).find(sid =>
                        boardData.cards[sid].some(c => c.id === item.id)
                    );
                    if (sourceSceneId && sourceSceneId !== context.sceneId) {
                        moveCardToColumn(item.id, context.sceneId);
                    }
                }
                return;
            }

            // CASE 2: NEW CARD (Template, File, or External Item)
            const title = item.name || item.title || 'New Card';
            // Detect if it is a file drop 
            const isFile = !!(item.path || item.isFile || (item.name && !item.id && !item.type && !item.raw));

            let plotContent = item.content || '';
            if (!plotContent && item.raw) plotContent = item.raw;
            if (!plotContent && item.originalBlock) plotContent = item.originalBlock;
            if (isFile && !plotContent) plotContent = `Linked File: ${title}`;

            const cardData = {
                defaultTitle: title,
                type: 'event',
                characters: charName,
                time: timeVal || '',
                linkedFile: isFile ? linkedPath : undefined,
                icon: '📝',
                color: '#E3F2FD',
                defaultPlot: plotContent
            };

            let targetSceneId = context.sceneId;
            if (!targetSceneId) targetSceneId = boardData.scenes[0]?.id;

            if (targetSceneId && addCard) {
                addCard(targetSceneId, cardData);
            }

        } catch (err) {
            console.error(err);
        }
    };

    const handleCardDragStart = (e, card) => {
        e.stopPropagation();
        const json = JSON.stringify(card);
        e.dataTransfer.setData('application/json', json);
        e.dataTransfer.setData('text/plain', json);
        e.dataTransfer.effectAllowed = 'copyMove';
    };

    const handleTemplateDragStart = (e, template) => {
        alert(`Debug: Chronology Drag Start: ${template.label}`);
        e.dataTransfer.setData('application/json', JSON.stringify({
            ...template,
            isTemplate: true,
            name: `New ${template.label}`,
            defaultTitle: `新規${template.label}`,
            color: template.color
        }));
        e.dataTransfer.effectAllowed = 'all';
    };

    // Header DnD - Drop Handler
    const handleHeaderDrop = (e, targetChar) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.style.boxShadow = 'none';

        try {
            let item;
            // 1. Native File
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                item = { name: file.name, path: file.path, isFile: true };
            } else {
                // 2. Internal JSON
                let dataStr = e.dataTransfer.getData('application/json');
                if (!dataStr) dataStr = e.dataTransfer.getData('text/plain');
                if (!dataStr) return;
                item = JSON.parse(dataStr);
            }

            // REORDER LOGIC
            if (item.type === 'char-row') {
                const draggedChar = item.char;
                if (draggedChar === targetChar) return;
                if (targetChar === '（未指定）') return; // Cannot sort 'Unspecified'

                const currentOrder = [...characters]; // Computed sorted list
                const fromIdx = currentOrder.indexOf(draggedChar);
                const toIdx = currentOrder.indexOf(targetChar);

                if (fromIdx !== -1 && toIdx !== -1) {
                    currentOrder.splice(fromIdx, 1);
                    currentOrder.splice(toIdx, 0, draggedChar);

                    // Save Order
                    if (setBoardData) {
                        const newData = { ...boardData, characterOrder: currentOrder };
                        setBoardData(newData);
                        saveBoard(newData);
                    }
                }
                return;
            }

            // Prefer absolute path
            const linkedPath = item.path || item.name;

            // Case 1: Existing Card -> Reassign Character
            if (item.id && updateCard) {
                const newChar = targetChar === '（未指定）' ? '' : targetChar;
                updateCard(item.id, { characters: newChar });
            }
            // Case 2: File Drop -> Create Card for this Character
            else if ((item.name || item.title) && addCard) {
                const title = item.name || item.title;
                let assignChar = targetChar;

                if (targetChar === '（未指定）') {
                    assignChar = title.replace(/\.(txt|md)$/i, '');
                }

                // Strict Target: 'Characters' column
                let targetScene = boardData.scenes.find(s => s.title === '登場人物' || s.title === 'Characters');
                let targetId = targetScene ? targetScene.id : null;

                if (!targetId && setBoardData) {
                    const newId = `custom-char-${Date.now()}`;
                    const newScene = { id: newId, title: '登場人物', act: '', description: '' };
                    const newScenes = [...boardData.scenes, newScene];
                    const newCards = { ...boardData.cards, [newId]: [] };
                    const newData = { ...boardData, scenes: newScenes, cards: newCards };
                    setBoardData(newData);
                    saveBoard(newData);
                    targetId = newId;
                }

                if (!targetId) targetId = boardData.scenes[0]?.id;

                if (targetId) {
                    addCard(targetId, {
                        defaultTitle: title,
                        type: 'character',
                        characters: assignChar,
                        linkedFile: linkedPath, // Use Path if available
                        icon: '�'
                    });
                }
            }

        } catch (e) {
            console.error(e);
        }
    };

    const handleAddCharDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.style.backgroundColor = 'transparent';
        try {
            let item;
            // 1. Native File
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                item = { name: file.name, path: file.path, isFile: true };
            } else {
                // 2. Internal JSON
                let dataStr = e.dataTransfer.getData('application/json');
                if (!dataStr) dataStr = e.dataTransfer.getData('text/plain');
                if (!dataStr) return;
                item = JSON.parse(dataStr);
            }

            if (item && addCard) {
                if (!item.id && (item.name || item.title)) {
                    const name = item.name || item.title;
                    const charName = name.replace(/\.(txt|md)$/i, '');

                    // Prefer absolute path
                    const linkedPath = item.path || item.name;

                    let targetScene = boardData.scenes.find(s => s.title === '登場人物' || s.title === 'Characters');
                    let targetId = targetScene ? targetScene.id : null;

                    if (!targetId && setBoardData) {
                        const newId = `custom-char-${Date.now()}`;
                        const newScene = { id: newId, title: '登場人物', act: '', description: '' };
                        const newScenes = [...boardData.scenes, newScene];
                        const newCards = { ...boardData.cards, [newId]: [] };
                        const newData = { ...boardData, scenes: newScenes, cards: newCards };
                        setBoardData(newData);
                        saveBoard(newData);
                        targetId = newId;
                    }
                    if (!targetId) targetId = boardData.scenes[0]?.id;

                    addCard(targetId, {
                        defaultTitle: name,
                        type: 'character',
                        characters: charName,
                        linkedFile: linkedPath, // Use Path if available
                        icon: '👤'
                    });
                }
            }
        } catch (e) { console.error(e); }
    };

    const handleRepairData = () => {
        openDialog('データの整合性を修復しますか？', 'yes', (val) => {
            const uniqueScenes = [...new Map((boardData.scenes || []).filter(s => s && s.id).map(s => [s.id, s])).values()];
            const newCards = { ...boardData.cards };
            Object.keys(newCards).forEach(key => {
                newCards[key] = newCards[key].map(c => {
                    if (c.icon === '👤' && c.type === 'event') {
                        return { ...c, type: 'character' };
                    }
                    return c;
                });
            });
            const newData = { ...boardData, scenes: uniqueScenes, cards: newCards };
            if (setBoardData) setBoardData(newData);
            if (saveBoard) saveBoard(newData);
        });
    };

    const handleDeleteTime = (sceneId, timeVal) => {
        if (!confirm(`${timeVal} の区分を削除しますか？\n(含まれるカードの時間設定もクリアされます)`)) return;

        const cards = boardData.cards[sceneId] || [];
        const targetCards = cards.filter(c => c.time === timeVal);

        targetCards.forEach(c => {
            if (c.defaultTitle === 'Time Marker' || c.title === 'Time Marker') {
                if (deleteCard) deleteCard(c.id);
            } else {
                if (updateCard) updateCard(c.id, { time: '' });
            }
        });
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'auto',
            background: '#f8f9fa',
            padding: '24px',
            position: 'relative'
        }}>
            <SimpleDialog
                isOpen={dialogConfig.isOpen}
                title={dialogConfig.title}
                initialValue={dialogConfig.initialValue}
                onConfirm={dialogConfig.onConfirm}
                onCancel={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))}
            />

            <div style={{ marginBottom: '16px', background: '#fff', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#444' }}>📅 時系列マトリクス (Chronology)</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#666' }}>
                            {chronoMode === 'scene'
                                ? '縦軸：登場人物 × 横軸：章（シーン）。物語の進行順でキャラクターの動きを確認します。'
                                : '縦軸：時間 × 横軸：登場人物。同じ時刻に誰が何をしているか（同時性）を確認します。'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {chronoMode === 'scene' && (
                            <button onClick={() => setShowTimeSubcols(!showTimeSubcols)} style={btnStyle(showTimeSubcols)} title="章の中を時間で列分割します">
                                {showTimeSubcols ? '🔽 時間統合' : '▶ 時間分割表示'}
                            </button>
                        )}
                        <button onClick={() => setChronoMode('scene')} style={btnStyle(chronoMode === 'scene')}>
                            📖 進行順 (章×キャラ)
                        </button>
                        <button onClick={() => setChronoMode('time')} style={btnStyle(chronoMode === 'time')}>
                            ⏱ 時間順 (時間×キャラ)
                        </button>
                        <button onClick={handleRepairData} style={{ ...btnStyle(false), color: '#d32f2f', borderColor: '#d32f2f' }} title="表示がおかしい場合は実行してください">
                            🛠️
                        </button>
                    </div>
                </div>

                <div style={{ paddingTop: '12px', borderTop: '1px solid #eee' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflowX: 'auto', maxWidth: '100%', paddingBottom: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap' }}>ドラッグで追加:</span>
                        {TEMPLATES.map(t => (
                            <div
                                key={t.type}
                                draggable
                                onDragStart={e => handleTemplateDragStart(e, t)}
                                onClick={() => alert('DEBUG: Click Event Fired!')}
                                style={{
                                    padding: '4px 8px',
                                    background: t.color,
                                    color: '#fff',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    cursor: 'grab',
                                    userSelect: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                }}
                            >
                                <span>{t.icon}</span>
                                <span>{t.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: chronoMode === 'scene'
                    ? `180px repeat(${sceneColumns.length}, minmax(200px, 1fr))`
                    : `120px repeat(${allCharRows.length}, minmax(200px, 1fr))`,
                gap: '8px',
                overflow: 'auto',
                paddingBottom: '20px'
            }}>
                {chronoMode === 'scene' && (
                    <>
                        <div style={{ position: 'sticky', left: 0, top: 0, zIndex: 20, background: '#e9ecef', padding: '12px', fontWeight: 'bold', borderBottom: '2px solid #ced4da', borderRight: '1px solid #ced4da' }}>
                            Char \ Scene
                        </div>
                        {sceneColumns.map((col, idx) => (
                            <div key={idx} style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8f9fa', padding: '12px', borderBottom: '2px solid #ced4da', borderRight: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', color: '#495057' }}>
                                <div style={{ fontSize: '0.9rem' }}>{col.label}</div>
                                {col.time && (
                                    <div style={{ fontSize: '0.8rem', color: '#007bff', background: '#e3f2fd', borderRadius: '4px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                        <span>{col.time}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteTime(col.scene.id, col.time); }}
                                            style={{ border: 'none', background: 'transparent', color: '#007bff', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0, fontWeight: 'bold' }}
                                            title="この時間を削除"
                                        >×</button>
                                    </div>
                                )}
                                {showTimeSubcols && !col.time && (
                                    <button
                                        style={{ display: 'block', margin: '4px auto 0', fontSize: '0.7rem', padding: '2px 6px', cursor: 'pointer', border: '1px dashed #ccc', background: 'transparent', color: '#666', borderRadius: '4px' }}
                                        onClick={() => {
                                            if (!addCard) return;
                                            openDialog('新しい時間を入力 (例: 10:30)', '10:00', (t) => {
                                                try {
                                                    if (!col.scene || !col.scene.id) return;
                                                    addCard(col.scene.id, {
                                                        defaultTitle: 'Time Marker',
                                                        type: 'event',
                                                        time: t,
                                                        icon: '🕒',
                                                        color: '#E3F2FD',
                                                        characters: ''
                                                    });
                                                    setShowTimeSubcols(true);
                                                } catch (e) {
                                                    console.error(e);
                                                }
                                            });
                                        }}
                                    >
                                        + 時間追加
                                    </button>
                                )}
                                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{col.scene.act}</div>
                            </div>
                        ))}

                        {allCharRows.map(charName => {
                            const isUnspecified = charName === '（未指定）';
                            return (
                                <React.Fragment key={charName}>
                                    <div
                                        style={{
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 10,
                                            background: isUnspecified ? '#f1f3f5' : '#fff',
                                            padding: '12px',
                                            borderRight: '2px solid #ced4da',
                                            borderBottom: '1px solid #dee2e6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontWeight: 'bold',
                                            color: isUnspecified ? '#adb5bd' : '#212529',
                                            transition: 'box-shadow 0.2s',
                                            cursor: isUnspecified ? 'default' : 'grab'
                                        }}
                                        draggable={!isUnspecified}
                                        onDragStart={(e) => {
                                            if (isUnspecified) return;
                                            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'char-row', char: charName }));
                                            e.dataTransfer.effectAllowed = 'all';
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.dataTransfer.dropEffect = 'copy';
                                        }}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleHeaderDrop(e, charName)}
                                        onDoubleClick={() => {
                                            // SMART DOUBLE CLICK LOGIC
                                            if (isUnspecified) return;

                                            // 1. Try to find a card with this character name AND a linked file
                                            let foundFileCard = null;
                                            // Prioritize "Character Definition" cards (icon=User)
                                            Object.values(boardData.cards || {}).flat().forEach(c => {
                                                if (c && c.characters && c.characters.includes(charName)) {
                                                    if (c.linkedFile) {
                                                        if (c.type === 'character') foundFileCard = c; // Best match
                                                        else if (!foundFileCard) foundFileCard = c;    // Backup
                                                    }
                                                }
                                            });

                                            if (foundFileCard && onCardClick) {
                                                onCardClick(foundFileCard);
                                                return;
                                            }

                                            // 2. Fallback to Rename Dialog
                                            openDialog("キャラクター名を変更しますか？", charName, (newName) => {
                                                if (newName && newName !== charName && setBoardData) {
                                                    const newCards = { ...boardData.cards };
                                                    let changed = false;
                                                    Object.keys(newCards).forEach(sid => {
                                                        newCards[sid] = newCards[sid].map(c => {
                                                            if (c.characters === charName) {
                                                                changed = true;
                                                                return { ...c, characters: newName };
                                                            }
                                                            if (c.characters && c.characters.includes(charName)) {
                                                                changed = true;
                                                                return { ...c, characters: c.characters.replace(charName, newName) };
                                                            }
                                                            return c;
                                                        });
                                                    });
                                                    if (changed) {
                                                        // Update characterOrder if exists
                                                        let newOrder = boardData.characterOrder ? [...boardData.characterOrder] : null;
                                                        if (newOrder) {
                                                            const idx = newOrder.indexOf(charName);
                                                            if (idx !== -1) newOrder[idx] = newName;
                                                        }

                                                        const newData = { ...boardData, cards: newCards, characterOrder: newOrder || undefined };
                                                        setBoardData(newData);
                                                        saveBoard(newData);
                                                    }
                                                }
                                            });
                                        }}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (isUnspecified) return;

                                            openDialog(`「${charName}」を削除しますか？\n(カード自体は残り、キャラ紐付けのみ解除されます)`, '', () => {
                                                if (setBoardData) {
                                                    const newCards = { ...boardData.cards };
                                                    let changed = false;

                                                    Object.keys(newCards).forEach(sid => {
                                                        // 1. Remove "Character Definition" cards for this char
                                                        const initialLen = newCards[sid].length;
                                                        newCards[sid] = newCards[sid].filter(c => !(c.type === 'character' && c.characters === charName));
                                                        if (newCards[sid].length !== initialLen) changed = true;

                                                        // 2. Remove character tag from other cards
                                                        newCards[sid] = newCards[sid].map(c => {
                                                            if (c.characters === charName) {
                                                                changed = true;
                                                                return { ...c, characters: '' };
                                                            }
                                                            if (c.characters && c.characters.includes(charName)) {
                                                                const newChars = c.characters.split(/[,、・]+/)
                                                                    .map(s => s.trim())
                                                                    .filter(s => s !== charName)
                                                                    .join('、');
                                                                if (newChars !== c.characters) {
                                                                    changed = true;
                                                                    return { ...c, characters: newChars };
                                                                }
                                                            }
                                                            return c;
                                                        });
                                                    });

                                                    // 3. Remove from Order Preference
                                                    let newOrder = boardData.characterOrder ? [...boardData.characterOrder] : [];
                                                    const idx = newOrder.indexOf(charName);
                                                    if (idx !== -1) {
                                                        newOrder.splice(idx, 1);
                                                        changed = true;
                                                    }

                                                    if (changed) {
                                                        const newData = { ...boardData, cards: newCards, characterOrder: newOrder };
                                                        setBoardData(newData);
                                                        saveBoard(newData);
                                                    }
                                                }
                                            }, false); // showInput = false
                                        }}
                                        title={isUnspecified ? '' : "ダブルクリック: ファイルを開く / 名前変更\nドラッグ: 並び替え\n右クリック: 削除"}
                                    >
                                        {charName}
                                    </div>

                                    {sceneColumns.map((col, idx) => {
                                        const cardsInScene = boardData.cards[col.scene.id] || [];
                                        const targetCards = cardsInScene.filter(c => {
                                            // Hide technical Time Marker cards
                                            if (c.defaultTitle === 'Time Marker' || c.title === 'Time Marker') return false;

                                            if (isUnspecified && (c.characters && c.characters.trim() !== '')) return false;
                                            if (!isUnspecified && (!c.characters || !c.characters.includes(charName))) return false;
                                            // if (c.type === 'character') return false; // REMOVED to show character cards
                                            if (showTimeSubcols) {
                                                const cTime = c.time || '';
                                                const colTime = col.time || '';
                                                return cTime === colTime;
                                            }
                                            return true;
                                        }).sort((a, b) => {
                                            const tA = a.time || '';
                                            const tB = b.time || '';
                                            if (!tA && !tB) return 0;
                                            if (!tA) return 1;
                                            if (!tB) return -1;
                                            return tA.localeCompare(tB, undefined, { numeric: true, sensitivity: 'base' });
                                        });

                                        return (
                                            <div
                                                key={`${charName}-${col.scene.id}-${idx}`}
                                                style={{ background: isUnspecified ? '#f8f9fa' : '#fff', borderBottom: '1px solid #dee2e6', borderRight: '1px solid #dee2e6', padding: '8px', minHeight: '80px', transition: 'box-shadow 0.2s' }}
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => {
                                                    handleCellDrop(e, { char: charName, sceneId: col.scene.id, time: col.time });
                                                }}
                                                onClick={(e) => {
                                                    if (e.target === e.currentTarget) {
                                                        openDialog('新規イベント名を入力', '新規イベント', (title) => {
                                                            if (title && addCard) {
                                                                addCard(col.scene.id, {
                                                                    defaultTitle: title,
                                                                    type: 'event',
                                                                    characters: charName !== '（未指定）' ? charName : '',
                                                                    time: col.time || ''
                                                                });
                                                            }
                                                        });
                                                    }
                                                }}
                                            >
                                                {targetCards.map(card => (
                                                    <div
                                                        key={card.id}
                                                        draggable={true}
                                                        onDragStart={(e) => handleCardDragStart(e, card)}
                                                        onClick={(e) => {
                                                            onCardClick(card);
                                                        }}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (deleteCard && window.confirm(`「${card.title}」を削除しますか？`)) {
                                                                deleteCard(card.id);
                                                            }
                                                        }}
                                                        style={{ padding: '6px 10px', marginBottom: '6px', background: card.color || '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', fontSize: '0.85rem', cursor: 'grab', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'transform 0.1s' }}
                                                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                                            <span>{card.icon || '📝'}</span>
                                                            <span style={{ fontWeight: 'bold' }}>{card.title}</span>
                                                        </div>
                                                        {card.time && <div style={{ fontSize: '0.7rem', color: '#666', background: 'rgba(255,255,255,0.5)', borderRadius: '2px', padding: '1px 3px', width: 'fit-content' }}>🕒 {card.time}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}

                        <div
                            style={{ position: 'sticky', left: 0, zIndex: 10, padding: '8px', borderRight: '2px solid #ced4da', borderBottom: '1px solid #dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2196F3', background: '#f8f9fa' }}
                            onClick={() => {
                                openDialog("追加するキャラクター名", "", (name) => {
                                    if (name && addCard) {
                                        // Use same logic for strict target
                                        let targetScene = boardData.scenes.find(s => s.title === '登場人物' || s.title === 'Characters');
                                        let targetId = targetScene ? targetScene.id : null;

                                        if (!targetId && setBoardData) {
                                            const newId = `custom-char-${Date.now()}`;
                                            const newScene = { id: newId, title: '登場人物', act: '', description: '' };
                                            const newScenes = [...boardData.scenes, newScene];
                                            const newCards = { ...boardData.cards, [newId]: [] };
                                            const newData = { ...boardData, scenes: newScenes, cards: newCards };
                                            setBoardData(newData);
                                            saveBoard(newData);
                                            targetId = newId;
                                        }
                                        if (!targetId) targetId = boardData.scenes[0]?.id;

                                        if (targetId) {
                                            addCard(targetId, {
                                                defaultTitle: `${name}`,
                                                type: 'character',
                                                characters: name,
                                                icon: '👤'
                                            });
                                        }
                                    }
                                });
                            }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.backgroundColor = '#e3f2fd'; }}
                            onDragLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            onDrop={handleAddCharDrop}
                            title="クリックしてキャラ追加、またはファイルをドロップ"
                        >
                            + キャラ追加
                        </div>
                        {sceneColumns.map((col, idx) => <div key={`add-${idx}`} style={{ background: '#f9f9f9', borderBottom: '1px solid #eee', borderRight: '1px solid #eee' }} />)}
                    </>
                )}

                {chronoMode === 'time' && (
                    <>
                        {/* Simplified Time Mode for brevity */}
                        <div style={{ position: 'sticky', left: 0, top: 0, zIndex: 20, background: '#e9ecef', padding: '12px', fontWeight: 'bold', borderBottom: '2px solid #ced4da', borderRight: '1px solid #ced4da' }}>
                            Time \ Char
                        </div>
                        {allCharRows.map(charName => (
                            <div
                                key={charName}
                                style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8f9fa', padding: '12px', borderBottom: '2px solid #ced4da', borderRight: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', color: '#495057' }}
                            >
                                {charName}
                            </div>
                        ))}

                        {allTimeRows.map(timeStr => {
                            return (
                                <React.Fragment key={timeStr}>
                                    <div style={{ position: 'sticky', left: 0, zIndex: 10, background: '#fff', padding: '12px', borderRight: '2px solid #ced4da', borderBottom: '1px solid #dee2e6', fontWeight: 'bold' }}>
                                        {timeStr}
                                    </div>
                                    {allCharRows.map(charName => {
                                        return (
                                            <div
                                                key={`${timeStr}-${charName}`}
                                                style={{ borderBottom: '1px solid #dee2e6', borderRight: '1px solid #dee2e6', padding: '8px', minHeight: '60px' }}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleCellDrop(e, { char: charName, time: timeStr })}
                                            >
                                                {/* Card Mapping Omitted */}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
};
