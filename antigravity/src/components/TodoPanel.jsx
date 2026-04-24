import React, { useMemo, useState } from 'react';

/**
 * TodoPanel - Displays [TODO: category | content] items from text with filtering and jump-to-location
 */
const TodoPanel = ({ text, onJumpToIndex, onInsertTodo, activeFileName }) => {
    const [filterCategory, setFilterCategory] = useState('all');
    const [sortMode, setSortMode] = useState('order'); // 'order' | 'category'

    // Parse all TODOs from the text
    const todos = useMemo(() => {
        if (!text) return [];
        const regex = /\[TODO:\s*([^|\]]+?)(?:\s*\|\s*([^\]]*))?\]/g;
        const results = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            results.push({
                full: match[0],
                category: (match[1] || 'その他').trim(),
                content: (match[2] || match[1] || '').trim(),
                index: match.index,
                // Compute line number
                line: text.substring(0, match.index).split('\n').length
            });
        }
        return results;
    }, [text]);

    // Get unique categories
    const categories = useMemo(() => {
        const cats = new Set(todos.map(t => t.category));
        return ['all', ...Array.from(cats).sort()];
    }, [todos]);

    // Filter and sort
    const filteredTodos = useMemo(() => {
        let filtered = todos;
        if (filterCategory !== 'all') {
            filtered = filtered.filter(t => t.category === filterCategory);
        }
        if (sortMode === 'category') {
            filtered = [...filtered].sort((a, b) => a.category.localeCompare(b.category));
        }
        return filtered;
    }, [todos, filterCategory, sortMode]);

    // Category colors for visual distinction
    const categoryColors = {
        '背景': '#4caf50',
        '人物': '#2196f3',
        '心理': '#9c27b0',
        '銃': '#f44336',
        '薬品': '#ff9800',
        'その他': '#607d8b',
        '描写': '#00bcd4',
        '設定': '#795548',
        '伏線': '#e91e63',
        '調査': '#ff5722',
    };

    const getCategoryColor = (cat) => categoryColors[cat] || '#78909c';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px', borderBottom: '1px solid var(--grid-line)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
                        📋 TODO ({todos.length}件)
                    </span>
                    {onInsertTodo && (
                        <button
                            onClick={onInsertTodo}
                            style={{
                                padding: '3px 10px',
                                fontSize: '11px',
                                border: '1px solid var(--accent-color)',
                                borderRadius: '12px',
                                background: 'none',
                                color: 'var(--accent-color)',
                                cursor: 'pointer'
                            }}
                            title="⌘T"
                        >
                            + TODO追加
                        </button>
                    )}
                </div>

                {/* Filter & Sort Controls */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        style={{
                            flex: 1,
                            fontSize: '11px',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-paper)',
                            color: 'var(--text-main)'
                        }}
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>
                                {cat === 'all' ? '全カテゴリ' : `${cat} (${todos.filter(t => t.category === cat).length})`}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => setSortMode(prev => prev === 'order' ? 'category' : 'order')}
                        style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            background: 'none',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                        title={sortMode === 'order' ? 'カテゴリ順に切替' : '出現順に切替'}
                    >
                        {sortMode === 'order' ? '↕ 出現順' : '🏷 カテゴリ順'}
                    </button>
                </div>
            </div>

            {/* TODO List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {filteredTodos.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        opacity: 0.4,
                        fontSize: '13px'
                    }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📝</div>
                        <p>TODOはまだありません</p>
                        <p style={{ fontSize: '11px', marginTop: '8px' }}>
                            ⌘T でTODOを挿入できます
                        </p>
                    </div>
                ) : (
                    filteredTodos.map((todo, i) => (
                        <div
                            key={`${todo.index}-${i}`}
                            onClick={() => onJumpToIndex?.(todo.index)}
                            style={{
                                padding: '8px 10px',
                                marginBottom: '4px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                background: 'var(--bg-paper)',
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'flex-start'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-paper)'}
                        >
                            {/* Category Tag */}
                            <span style={{
                                fontSize: '10px',
                                padding: '1px 8px',
                                borderRadius: '10px',
                                background: getCategoryColor(todo.category) + '20',
                                color: getCategoryColor(todo.category),
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                marginTop: '2px'
                            }}>
                                {todo.category}
                            </span>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '12px',
                                    lineHeight: '1.4',
                                    wordBreak: 'break-word'
                                }}>
                                    {todo.content || todo.category}
                                </div>
                                <div style={{
                                    fontSize: '10px',
                                    opacity: 0.4,
                                    marginTop: '2px'
                                }}>
                                    {activeFileName ? `${activeFileName}:` : ''}L{todo.line}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Summary Footer */}
            {todos.length > 0 && (
                <div style={{
                    padding: '8px 12px',
                    borderTop: '1px solid var(--grid-line)',
                    fontSize: '10px',
                    opacity: 0.6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <span>合計 {todos.length}件</span>
                    <span>{categories.length - 1}カテゴリ</span>
                </div>
            )}
        </div>
    );
};

export default TodoPanel;
