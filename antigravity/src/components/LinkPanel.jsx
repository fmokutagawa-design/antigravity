import React, { useState, useEffect, useMemo } from 'react';
import { findUnlinkedMentions } from '../utils/linkUtils';

const LinkPanel = ({
    activeFile,
    allFiles,
    linkGraph,
    currentText,
    onOpenLink,
    onInsertLink
}) => {
    const [activeTab, setActiveTab] = useState('mentions'); // 'mentions' or 'backlinks'
    const [mentions, setMentions] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    // Get backlinks for current file
    const backlinks = useMemo(() => {
        if (!activeFile || !activeFile.name || !linkGraph || !(linkGraph instanceof Map)) return [];
        const currentPath = activeFile.path;
        const currentName = activeFile.name.replace(/\.[^/.]+$/, ""); // remove extension
        const incoming = [];

        // Iterate over all files in graph
        for (const [path, node] of linkGraph.entries()) {
            if (node.outLinks && Array.isArray(node.outLinks) && node.outLinks.includes(currentPath)) {
                // Find file object
                const file = allFiles?.find(f => f.path === path);
                if (file) {
                    // Extract context
                    let context = '';
                    if (file.content) {
                        try {
                            // Simple regex to find [[currentName]] or [[currentName|Label]]
                            // key: escape special chars in filename just in case
                            const escapedName = currentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const regex = new RegExp(`\\[\\[${escapedName}(?:\\|.*?)?\\]\\]`, 'i');
                            const match = regex.exec(file.content);
                            if (match) {
                                const start = Math.max(0, match.index - 30);
                                const end = Math.min(file.content.length, match.index + match[0].length + 30);
                                context = (start > 0 ? '...' : '') +
                                    file.content.substring(start, end).replace(/\n/g, ' ') +
                                    (end < file.content.length ? '...' : '');
                            }
                        } catch (e) {
                            console.error('Error extracting backlink context:', e);
                        }
                    }

                    incoming.push({ ...file, context });
                }
            }
        }
        return incoming;
    }, [activeFile, linkGraph, allFiles]);

    // Scan for mentions when text changes (debounced)
    useEffect(() => {
        if (!currentText || !allFiles || allFiles.length === 0) return;

        const timer = setTimeout(() => {
            setIsScanning(true);
            // Run in next tick to avoid blocking UI
            setTimeout(() => {
                const found = findUnlinkedMentions(currentText, allFiles);
                setMentions(found);
                setIsScanning(false);
            }, 0);
        }, 1000); // Debounce 1s

        return () => clearTimeout(timer);
    }, [currentText, allFiles]);

    if (!activeFile) {
        return <div className="link-panel-empty">ファイルを開くとリンク情報が表示されます</div>;
    }

    return (
        <div className="link-panel">
            <div className="link-panel-tabs">
                <button
                    className={`link-tab ${activeTab === 'mentions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('mentions')}
                >
                    未リンク ({mentions.length})
                </button>
                <button
                    className={`link-tab ${activeTab === 'backlinks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('backlinks')}
                >
                    被リンク ({backlinks.length})
                </button>
            </div>

            <div className="link-panel-content">
                {activeTab === 'mentions' && (
                    <div className="mentions-list">
                        {isScanning ? (
                            <div className="loading">スキャン中...</div>
                        ) : mentions.length === 0 ? (
                            <div className="empty-state">未リンクの言及はありません</div>
                        ) : (
                            mentions.map((mention, i) => (
                                <div key={i} className="mention-item">
                                    <div className="mention-header">
                                        <span className="mention-term">{mention.term}</span>
                                        <button
                                            className="link-btn"
                                            onClick={() => onInsertLink(mention.term, mention.index)}
                                        >
                                            リンクする
                                        </button>
                                    </div>
                                    <div className="mention-context">{mention.context}</div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'backlinks' && (
                    <div className="backlinks-list">
                        {backlinks.length === 0 ? (
                            <div className="empty-state">このノートへのリンクはありません</div>
                        ) : (
                            backlinks.map((file, i) => (
                                <div
                                    key={i}
                                    className="backlink-item"
                                    onClick={() => onOpenLink(file.path)}
                                >
                                    <div className="backlink-header">
                                        <span className="file-icon">📄</span>
                                        <span className="file-name">{(file.name || '').replace(/\.[^/.]+$/, "")}</span>
                                    </div>
                                    {file.context && (
                                        <div className="backlink-context" style={{ fontSize: '0.85em', color: '#666', marginTop: '4px', paddingLeft: '20px', fontStyle: 'italic' }}>
                                            {file.context}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LinkPanel;
