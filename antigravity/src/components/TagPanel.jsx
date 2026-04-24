import React from 'react';
import './TagPanel.css';

/**
 * TagPanel - Right-side panel for tag management
 * Allows toggling tags, 種別, 状態, and 作品 with click operations
 */
const TagPanel = ({
    currentFile,
    metadata,
    onMetadataUpdate,
    allWorks = [], // List of all available works
    openInputModal = null
}) => {
    // Predefined tag categories
    const contentTags = ['キャラ', '組織', '世界', 'ガジェット', '用語', '地理', '事件', '時系列', 'プロット', '原稿'];
    const progressTags = ['草稿', '改稿中', '決定稿', '要修正', '要確認', '破綻危惧', 'メモ'];
    const importanceTags = ['核心', '伏線', '要保管'];

    // Handle tag toggle
    const handleTagToggle = (tag) => {
        if (!metadata || !onMetadataUpdate) return;

        const currentTags = metadata.tags || [];
        let newTags;

        if (currentTags.includes(tag)) {
            // Remove tag
            newTags = currentTags.filter(t => t !== tag);
        } else {
            // Add tag
            newTags = [...currentTags, tag];
        }

        onMetadataUpdate({ ...metadata, tags: newTags });
    };

    // Handle 種別 toggle (exclusive)
    const handle種別Toggle = (種別) => {
        if (!metadata || !onMetadataUpdate) return;

        const newMetadata = { ...metadata };

        // Toggle: if already selected, clear it; otherwise set it
        if (metadata.種別 === 種別) {
            newMetadata.種別 = '';
            // Remove from tags
            newMetadata.tags = (metadata.tags || []).filter(t => t !== 種別);
        } else {
            // Remove old 種別 from tags
            if (metadata.種別) {
                newMetadata.tags = (metadata.tags || []).filter(t => t !== metadata.種別);
            }
            newMetadata.種別 = 種別;
            // Add to tags if not present
            if (!newMetadata.tags.includes(種別)) {
                newMetadata.tags = [...newMetadata.tags, 種別];
            }
        }

        onMetadataUpdate(newMetadata);
    };

    // Handle 状態 toggle (exclusive)
    const handle状態Toggle = (状態) => {
        if (!metadata || !onMetadataUpdate) return;

        const newMetadata = { ...metadata };

        if (metadata.状態 === 状態) {
            newMetadata.状態 = '';
            newMetadata.tags = (metadata.tags || []).filter(t => t !== 状態);
        } else {
            if (metadata.状態) {
                newMetadata.tags = (metadata.tags || []).filter(t => t !== metadata.状態);
            }
            newMetadata.状態 = 状態;
            if (!newMetadata.tags.includes(状態)) {
                newMetadata.tags = [...newMetadata.tags, 状態];
            }
        }

        onMetadataUpdate(newMetadata);
    };

    // Handle work toggle
    const handleWorkToggle = (work) => {
        if (!metadata || !onMetadataUpdate) return;

        const currentWorks = metadata.作品 ? metadata.作品.split(',').map(w => w.trim()).filter(w => w) : [];
        let newWorks;

        if (currentWorks.includes(work)) {
            // Remove work
            newWorks = currentWorks.filter(w => w !== work);
        } else {
            // Add work
            newWorks = [...currentWorks, work];
        }

        const newMetadata = { ...metadata };
        newMetadata.作品 = newWorks.join(', ');

        // Also update tags
        const workTags = newWorks;
        let newTags = (metadata.tags || []).filter(t => !allWorks.includes(t));
        newTags = [...newTags, ...workTags];

        newMetadata.tags = newTags;
        onMetadataUpdate(newMetadata);
    };

    // Add new work
    const handleAddWork = () => {
        if (openInputModal) {
            openInputModal('新規作品', '作品名を入力してください', '', (workName) => {
                if (workName && workName.trim()) {
                    const trimmedWork = workName.trim();
                    try {
                        const savedWorks = localStorage.getItem('savedWorks');
                        const worksSet = new Set(savedWorks ? JSON.parse(savedWorks) : []);
                        worksSet.add(trimmedWork);
                        localStorage.setItem('savedWorks', JSON.stringify(Array.from(worksSet)));
                    } catch (e) {
                        console.error('Failed to save work:', e);
                    }
                    handleWorkToggle(trimmedWork);
                }
            });
            return;
        }

        const workName = window.prompt('新しい作品名を入力してください:');
        if (workName && workName.trim()) {
            const trimmedWork = workName.trim();

            // Save to localStorage immediately
            try {
                const savedWorks = localStorage.getItem('savedWorks');
                const worksSet = new Set(savedWorks ? JSON.parse(savedWorks) : []);
                worksSet.add(trimmedWork);
                localStorage.setItem('savedWorks', JSON.stringify(Array.from(worksSet)));
            } catch (e) {
                console.error('Failed to save work:', e);
            }

            // Toggle the work
            handleWorkToggle(trimmedWork);
        }
    };

    if (!currentFile) {
        return null;
    }

    const currentTags = metadata?.tags || [];
    const currentWorks = metadata?.作品 ? metadata.作品.split(',').map(w => w.trim()).filter(w => w) : [];

    return (
        <div className="tag-panel">
            <div className="tag-panel-content">
                {/* 作品 */}
                <div className="tag-section">
                    <div className="tag-section-header">【作品】</div>
                    <div className="tag-buttons">
                        {allWorks.map(work => (
                            <button
                                key={work}
                                className={`tag-btn ${currentWorks.includes(work) ? 'active' : ''}`}
                                onClick={() => handleWorkToggle(work)}
                            >
                                {currentWorks.includes(work) ? '☑' : '☐'} {work}
                            </button>
                        ))}
                        <button className="tag-btn add-btn" onClick={handleAddWork}>
                            ＋ 新規作品
                        </button>
                    </div>
                </div>

                {/* 種別 */}
                <div className="tag-section">
                    <div className="tag-section-header">【種別】</div>
                    <div className="tag-buttons">
                        {contentTags.map(tag => (
                            <button
                                key={tag}
                                className={`tag-btn ${metadata?.種別 === tag ? 'active exclusive' : ''}`}
                                onClick={() => handle種別Toggle(tag)}
                            >
                                {metadata?.種別 === tag ? '◉' : '○'} {tag}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 進行 */}
                <div className="tag-section">
                    <div className="tag-section-header">【進行】</div>
                    <div className="tag-buttons">
                        {progressTags.map(tag => (
                            <button
                                key={tag}
                                className={`tag-btn ${metadata?.状態 === tag ? 'active exclusive' : ''}`}
                                onClick={() => handle状態Toggle(tag)}
                            >
                                {metadata?.状態 === tag ? '◉' : '○'} {tag}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 重要度 */}
                <div className="tag-section">
                    <div className="tag-section-header">【重要度】</div>
                    <div className="tag-buttons">
                        {importanceTags.map(tag => (
                            <button
                                key={tag}
                                className={`tag-btn ${currentTags.includes(tag) ? 'active' : ''}`}
                                onClick={() => handleTagToggle(tag)}
                            >
                                {currentTags.includes(tag) ? '☑' : '☐'} {tag}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Tags */}
                <div className="tag-section">
                    <div className="tag-section-header">【カスタムタグ】</div>
                    <div className="tag-buttons">
                        <button
                            className="tag-btn add-btn"
                            onClick={() => {
                                if (openInputModal) {
                                    openInputModal('新規タグ', '新しいタグ名を入力してください', '', (tagName) => {
                                        if (tagName && tagName.trim()) {
                                            handleTagToggle(tagName.trim());
                                        }
                                    });
                                    return;
                                }
                                const tagName = window.prompt('新しいタグ名を入力してください:');
                                if (tagName && tagName.trim()) {
                                    handleTagToggle(tagName.trim());
                                }
                            }}
                        >
                            ＋ 新規タグ
                        </button>
                    </div>
                </div>

                {/* Current tags display */}
                {currentTags.length > 0 && (
                    <div className="tag-section">
                        <div className="tag-section-header">【現在のタグ】</div>
                        <div className="current-tags">
                            {currentTags.map(tag => (
                                <span key={tag} className="current-tag">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TagPanel;
