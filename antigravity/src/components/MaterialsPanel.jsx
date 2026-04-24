import React, { useState, useEffect } from 'react';
import { MATERIAL_TEMPLATES, AI_ORGANIZE_PROMPT } from '../constants/templates';
import { createFile, createDirectory } from '../utils/fileSystemUtils';

const MaterialsPanel = ({
    projectHandle,
    onOpenFile,
    onOpenInNewWindow,
    currentFile,
    currentFileContent,
    onRefresh,
    materialsTree = [],
    allMaterialFiles = [],
    availableTags = new Set(),
    isLoading = false,
    usageStats = {},
    onCreateFileWithTag,
    onBatchCopy,
    onOpenLink
}) => {
    const [selectedTag, setSelectedTag] = useState(null);
    const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));
    const [showNewMenu, setShowNewMenu] = useState(false);
    const [sortMode, setSortMode] = useState('name'); // 'name' or 'frequency'
    const [manualTags, setManualTags] = useState(new Set()); // State for manually added tags

    // Load manual tags from localStorage
    useEffect(() => {
        try {
            const savedTags = localStorage.getItem('novel-editor-manual-tags');
            if (savedTags) {
                setManualTags(new Set(JSON.parse(savedTags)));
            }
        } catch (e) {
            console.error('Failed to load manual tags:', e);
        }
    }, []);

    const handleAddManualTag = () => {
        const tagName = prompt('新しいタグ名を入力してください:');
        if (tagName && tagName.trim()) {
            const newTag = tagName.trim();
            const updatedManualTags = new Set(manualTags);
            updatedManualTags.add(newTag);
            setManualTags(updatedManualTags);

            // Persist
            try {
                localStorage.setItem('novel-editor-manual-tags', JSON.stringify(Array.from(updatedManualTags)));
            } catch (e) { console.error(e); }
        }
    };

    // Combine file tags with manual tags
    const displayTags = new Set([...availableTags, ...manualTags]);

    // Expand root by default when tree loads
    useEffect(() => {
        if (materialsTree.length > 0) {
            setExpandedFolders(prev => new Set([...prev, 'root']));
        }
    }, [materialsTree]);

    const handleCreateMaterial = async (type) => {
        if (!projectHandle) return;

        const template = MATERIAL_TEMPLATES[type];
        const name = prompt(`${template.name} の名前を入力してください: `);
        if (!name) return;

        try {
            const materialsHandle = await projectHandle.getDirectoryHandle('materials', { create: true });

            // Create subfolder based on type
            let targetHandle = materialsHandle;
            let subfolder = '';

            if (type === 'character') subfolder = 'characters';
            else if (type === 'world') subfolder = 'world';
            else if (type === 'item') subfolder = 'items';
            else if (type === 'plot') subfolder = 'plots';

            if (subfolder) {
                targetHandle = await materialsHandle.getDirectoryHandle(subfolder, { create: true });
            }

            const fileName = name.endsWith('.txt') ? name : `${name}.txt`;
            // Add a default tag based on type
            const contentWithTag = template.content + `\n\n#${type === 'character' ? '登場人物' : type === 'world' ? '世界観' : type === 'item' ? '用語' : 'プロット'} `;

            await createFile(targetHandle, fileName, contentWithTag);

            onRefresh(); // Refresh parent
            setShowNewMenu(false);
        } catch (error) {
            console.error('Failed to create material:', error);
            alert('作成に失敗しました。');
        }
    };

    const handleAIOrganize = () => {
        if (!currentFileContent) {
            alert('整理するファイルを開いてください。');
            return;
        }

        const prompt = AI_ORGANIZE_PROMPT + '\n' + currentFileContent;
        navigator.clipboard.writeText(prompt).then(() => {
            alert('📋 ChatGPT用のプロンプトをコピーしました！\n\nChatGPTに貼り付けて、結果をここに書き戻してください。');
        }).catch(() => {
            alert('コピーに失敗しました。');
        });
    };

    const handleTagClick = (tag) => {
        if (selectedTag === tag) {
            setSelectedTag(null);
        } else {
            setSelectedTag(tag);
        }
    };

    const handleInsertTag = (tag, e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(tag + ' ').then(() => {
            // Show small feedback
            const btn = e.target;
            const originalText = btn.innerText;
            btn.innerText = '✅';
            setTimeout(() => btn.innerText = originalText, 1000);
        });
    };

    const toggleFolder = (path) => {
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
        }
        setExpandedFolders(newExpanded);
    };

    const sortItems = (items, pathPrefix) => {
        if (!items) return [];
        return [...items].sort((a, b) => {
            // Always directories first
            if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;

            if (sortMode === 'frequency' && a.kind === 'file') {
                const pathA = pathPrefix ? `${pathPrefix}/${a.name}` : a.name;
                const pathB = pathPrefix ? `${pathPrefix}/${b.name}` : b.name;
                const countA = usageStats[pathA] || 0;
                const countB = usageStats[pathB] || 0;
                if (countA !== countB) return countB - countA;
            }
            return a.name.localeCompare(b.name);
        });
    };

    const renderTree = (items, pathPrefix = '') => {
        const sortedItems = sortItems(items, pathPrefix);
        return sortedItems.map((item) => {
            const currentPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name;

            if (item.kind === 'directory') {
                // If filtering by tag, check if this folder contains matching files
                if (selectedTag) {
                    return null;
                }

                const isExpanded = expandedFolders.has(currentPath);
                return (
                    <div key={currentPath} className="material-folder">
                        <div
                            className="material-folder-header"
                            onClick={() => toggleFolder(currentPath)}
                        >
                            <span className="folder-icon">{isExpanded ? '📂' : '📁'}</span>
                            <span className="folder-name">{item.name}</span>
                        </div>
                        {isExpanded && (
                            <div className="folder-children">
                                {item.children && renderTree(item.children, currentPath)}
                            </div>
                        )}
                    </div>
                );
            } else {
                // File
                if (selectedTag) {
                    // Check if file metadata contains the tag (in either 'tags' or '作品')
                    const fileData = allMaterialFiles.find(f => f.name === item.name && (f.path === currentPath || f.path.endsWith(currentPath)));
                    if (!fileData || !fileData.metadata) {
                        return null;
                    }

                    // Check tags array
                    const hasCategoryTag = fileData.metadata.tags && fileData.metadata.tags.includes(selectedTag);

                    // Check 作品 field
                    const hasWorkTag = fileData.metadata.作品 && fileData.metadata.作品.split(',').map(t => t.trim()).includes(selectedTag);

                    if (!hasCategoryTag && !hasWorkTag) {
                        return null;
                    }
                }

                return (
                    <div
                        key={currentPath}
                        className={`material-file ${currentFile?.name === item.name ? 'active' : ''}`}
                        onClick={() => onOpenFile(item.handle, item.name)}
                        style={{ display: 'flex', alignItems: 'center' }}
                    >
                        <span className="file-icon">📄</span>
                        <span className="file-name" style={{ flex: 1 }}>{item.name}</span>
                        {onOpenInNewWindow && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenInNewWindow(item.handle);
                                }}
                                title="新しいウィンドウで開く"
                                style={{ border: 'none', background: 'none', cursor: 'pointer', marginLeft: '5px', opacity: 0.7, fontSize: '0.8rem' }}
                            >
                                ↗️
                            </button>
                        )}
                    </div>
                );
            }
        });
    };

    const renderFilteredList = () => {
        const filtered = allMaterialFiles.filter(file => {
            if (selectedTag === 'unset') {
                const noTags = !file.metadata?.tags || file.metadata.tags.length === 0;
                const noWork = !file.metadata?.作品 || !file.metadata.作品.trim();
                return noTags && noWork;
            }
            if (!file.metadata) return false;

            // Check tags array
            const hasCategoryTag = file.metadata.tags && file.metadata.tags.includes(selectedTag);

            // Check 作品 field
            const hasWorkTag = file.metadata.作品 && file.metadata.作品.split(',').map(t => t.trim()).includes(selectedTag);

            return hasCategoryTag || hasWorkTag;
        });

        filtered.sort((a, b) => {
            if (sortMode === 'frequency') {
                const countA = usageStats[a.path] || 0;
                const countB = usageStats[b.path] || 0;
                if (countA !== countB) return countB - countA;
            }
            return a.name.localeCompare(b.name);
        });

        return filtered.map(file => (
            <div
                key={file.path}
                className={`material-file ${currentFile?.name === file.name ? 'active' : ''}`}
                onClick={() => onOpenFile(file.handle, file.name)}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <span className="file-icon">📄</span>
                <span className="file-name" style={{ flex: 1 }}>{file.name}</span>
                <span className="file-path-hint" style={{ marginRight: '5px' }}>{file.path.split('/').slice(0, -1).join('/')}</span>
                {onOpenInNewWindow && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenInNewWindow(file.handle);
                        }}
                        title="新しいウィンドウで開く"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.7 }}
                    >
                        ↗️
                    </button>
                )}
            </div>
        ));
    };

    return (
        <div className="materials-panel">
            <div className="materials-header">
                <h3>📚 設定資料</h3>
                <div className="materials-actions">
                    <button
                        className="sort-btn"
                        onClick={() => setSortMode(sortMode === 'name' ? 'frequency' : 'name')}
                        title={sortMode === 'name' ? '使用頻度順に切り替え' : '名前順に切り替え'}
                        style={{ marginRight: '8px', padding: '4px 8px', fontSize: '0.8rem', background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        {sortMode === 'name' ? '🔤 名前順' : '📊 頻度順'}
                    </button>
                    <button
                        className="new-material-btn"
                        onClick={() => setShowNewMenu(!showNewMenu)}
                    >
                        ＋ 新規作成
                    </button>
                    <button
                        className="ai-organize-btn"
                        onClick={handleAIOrganize}
                        title="AI整理プロンプトをコピー"
                    >
                        ✨ AI整理
                    </button>
                    <button
                        className="ai-link-btn"
                        onClick={() => window.open('https://chatgpt.com/', '_blank')}
                        title="ChatGPTを開く"
                        style={{
                            marginLeft: '4px',
                            padding: '4px 8px',
                            fontSize: '0.8rem',
                            background: 'none',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        ↗️
                    </button>
                </div>

                {showNewMenu && (
                    <div className="template-menu">
                        {Object.entries(MATERIAL_TEMPLATES).map(([key, template]) => (
                            <div
                                key={key}
                                className="template-item"
                                onClick={() => handleCreateMaterial(key)}
                            >
                                <span className="template-icon">{template.icon}</span>
                                <span className="template-name">{template.name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Tag Cloud */}
            {(displayTags.size > 0) && (
                <div className="tags-container">
                    <div className="tags-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>タグ ({displayTags.size})</span>
                            <button
                                className="add-tag-btn"
                                onClick={handleAddManualTag}
                                title="タグを手動追加"
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    color: 'var(--accent-color)'
                                }}
                            >
                                ＋
                            </button>
                        </div>
                        {selectedTag && (
                            <button
                                className="clear-filter-btn"
                                onClick={() => setSelectedTag(null)}
                                title="フィルタをクリア"
                            >
                                ✕ クリア
                            </button>
                        )}
                    </div>
                    <div className="tags-list">
                        {/* Unset Tag Alert */}
                        {(() => {
                            const unsetCount = allMaterialFiles.filter(f => {
                                const noTags = !f.metadata?.tags || f.metadata.tags.length === 0;
                                const noWork = !f.metadata?.作品 || !f.metadata.作品.trim();
                                return noTags && noWork;
                            }).length;
                            if (unsetCount === 0) return null;
                            return (
                                <span
                                    className={`tag-chip warning ${selectedTag === 'unset' ? 'active' : ''}`}
                                    onClick={() => handleTagClick('unset')}
                                    title="タグが設定されていないファイル"
                                    style={{ borderColor: '#ffb74d', color: '#f57c00', backgroundColor: selectedTag === 'unset' ? '#fff3e0' : 'transparent' }}
                                >
                                    ⚠️ 未設定 <span className="tag-count">({unsetCount})</span>
                                </span>
                            );
                        })()}

                        {Array.from(displayTags).map(tag => {
                            // Count files with this tag (check both tags and 作品)
                            const fileCount = allMaterialFiles.filter(f => {
                                if (!f.metadata) return false;
                                const hasCategoryTag = f.metadata.tags && f.metadata.tags.includes(tag);
                                const hasWorkTag = f.metadata.作品 && f.metadata.作品.split(',').map(t => t.trim()).includes(tag);
                                return hasCategoryTag || hasWorkTag;
                            }).length;

                            return (
                                <span
                                    key={tag}
                                    className={`tag-chip ${selectedTag === tag ? 'active' : ''}`}
                                    onClick={() => handleTagClick(tag)}
                                    title={`クリックで絞り込み (${fileCount}件)`}
                                >
                                    {tag} <span className="tag-count">({fileCount})</span>
                                    {/* Action Buttons */}
                                    <div className="tag-actions" style={{ display: 'inline-flex', marginLeft: '4px', gap: '2px' }}>
                                        {/* New: Create File with this Tag */}
                                        <button
                                            className="tag-action-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCreateFileWithTag(tag);
                                            }}
                                            title={`「${tag}」タグ付きで新規ファイル作成`}
                                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >
                                            ➕
                                        </button>

                                        {/* Existing: Copy Tag to Clipboard */}
                                        <button
                                            className="tag-action-btn"
                                            onClick={(e) => handleInsertTag(tag, e)}
                                            title="タグをコピー"
                                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >
                                            📋
                                        </button>
                                    </div>
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="materials-list">
                {isLoading ? (
                    <div className="loading">読み込み中...</div>
                ) : selectedTag ? (
                    <div className="filtered-view">
                        <div className="filter-header">
                            <span>🏷️ {selectedTag === 'unset' ? '⚠️ 未設定' : selectedTag} の検索結果: {
                                selectedTag === 'unset'
                                    ? allMaterialFiles.filter(f => {
                                        const noTags = !f.metadata?.tags || f.metadata.tags.length === 0;
                                        const noWork = !f.metadata?.作品 || !f.metadata.作品.trim();
                                        return noTags && noWork;
                                    }).length
                                    : allMaterialFiles.filter(f => {
                                        if (!f.metadata) return false;
                                        const hasCategoryTag = f.metadata.tags && f.metadata.tags.includes(selectedTag);
                                        const hasWorkTag = f.metadata.作品 && f.metadata.作品.split(',').map(t => t.trim()).includes(selectedTag);
                                        return hasCategoryTag || hasWorkTag;
                                    }).length
                            }件</span>
                            {/* New: Batch Copy Button */}
                            <button
                                onClick={() => {
                                    const filteredFiles = selectedTag === 'unset'
                                        ? allMaterialFiles.filter(f => {
                                            const noTags = !f.metadata?.tags || f.metadata.tags.length === 0;
                                            const noWork = !f.metadata?.作品 || !f.metadata.作品.trim();
                                            return noTags && noWork;
                                        })
                                        : allMaterialFiles.filter(f => {
                                            if (!f.metadata) return false;
                                            const hasCategoryTag = f.metadata.tags && f.metadata.tags.includes(selectedTag);
                                            const hasWorkTag = f.metadata.作品 && f.metadata.作品.split(',').map(t => t.trim()).includes(selectedTag);
                                            return hasCategoryTag || hasWorkTag;
                                        });
                                    onBatchCopy(filteredFiles);
                                }}
                                title="表示中の全ファイルの内容をクリップボードにコピー"
                                style={{
                                    marginLeft: 'auto',
                                    padding: '2px 8px',
                                    fontSize: '0.8rem',
                                    border: '1px solid var(--accent-color)',
                                    borderRadius: '4px',
                                    background: 'white',
                                    color: 'var(--accent-color)',
                                    cursor: 'pointer'
                                }}
                            >
                                📋 全てコピー
                            </button>
                        </div>
                        {renderFilteredList()}
                    </div>
                ) : materialsTree.length > 0 ? (
                    renderTree(materialsTree)
                ) : (
                    <div className="empty-state">
                        資料がありません。<br />
                        「新規作成」から作成してください。
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaterialsPanel;
