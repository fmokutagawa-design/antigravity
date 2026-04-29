import React, { useState } from 'react';

const NavigatePanel = ({
    activeSubTab = 'outline', // Default start
    // Props for TagPanel
    tags, onSelectTag, onAddTag, onRemoveTag,
    // Props for LinkPanel
    links, onSelectLink, onAddLink, onRemoveLink,
    // Props for SearchPanel
    onSearch, searchResults,
    // Shared
    TagPanel, LinkPanel, SearchPanel, // Passing components as props? Or better to import?
    // Let's assume we pass the *rendered* panels or specific props?
    // To keep it clean, App.jsx can pass the specific props.
    // However, existing panels are imported in App.jsx.
    // Let's pass the render functions or props.
    renderTagPanel, renderLinkPanel, renderSearchPanel, renderOutlinePanel,
    onSubTabChange
}) => {
    const [subTab, setSubTab] = useState(activeSubTab);

    React.useEffect(() => {
        if (activeSubTab) setSubTab(activeSubTab);
    }, [activeSubTab]);

    const handleTabClick = (newTab) => {
        setSubTab(newTab);
        if (onSubTabChange) onSubTabChange(newTab);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Sub-tab Navigation */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                fontSize: '12px'
            }}>
                <button
                    onClick={() => handleTabClick('outline')}
                    style={{
                        flex: 1, padding: '8px', border: 'none', background: 'transparent',
                        borderBottom: subTab === 'outline' ? '2px solid var(--accent-color)' : 'none',
                        color: subTab === 'outline' ? 'var(--accent-color)' : 'inherit',
                        fontWeight: subTab === 'outline' ? 'bold' : 'normal',
                        cursor: 'pointer'
                    }}
                >
                    📖 目次
                </button>
                <button
                    onClick={() => handleTabClick('tags')}
                    style={{
                        flex: 1, padding: '8px', border: 'none', background: 'transparent',
                        borderBottom: subTab === 'tags' ? '2px solid var(--accent-color)' : 'none',
                        color: subTab === 'tags' ? 'var(--accent-color)' : 'inherit',
                        fontWeight: subTab === 'tags' ? 'bold' : 'normal',
                        cursor: 'pointer'
                    }}
                >
                    🏷️ タグ
                </button>
                <button
                    onClick={() => handleTabClick('links')}
                    style={{
                        flex: 1, padding: '8px', border: 'none', background: 'transparent',
                        borderBottom: subTab === 'links' ? '2px solid var(--accent-color)' : 'none',
                        color: subTab === 'links' ? 'var(--accent-color)' : 'inherit',
                        fontWeight: subTab === 'links' ? 'bold' : 'normal',
                        cursor: 'pointer'
                    }}
                >
                    🔗 リンク
                </button>
                <button
                    onClick={() => handleTabClick('search')}
                    style={{
                        flex: 1, padding: '8px', border: 'none', background: 'transparent',
                        borderBottom: subTab === 'search' ? '2px solid var(--accent-color)' : 'none',
                        color: subTab === 'search' ? 'var(--accent-color)' : 'inherit',
                        fontWeight: subTab === 'search' ? 'bold' : 'normal',
                        cursor: 'pointer'
                    }}
                >
                    🔍 検索
                </button>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {subTab === 'outline' && renderOutlinePanel && renderOutlinePanel()}
                {subTab === 'tags' && renderTagPanel && renderTagPanel()}
                {subTab === 'links' && renderLinkPanel && renderLinkPanel()}
                {subTab === 'search' && renderSearchPanel && renderSearchPanel()}
            </div>
        </div>
    );
};

export default NavigatePanel;
