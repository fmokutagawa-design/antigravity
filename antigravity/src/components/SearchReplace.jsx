import React, { useState, useEffect, useCallback } from 'react';
import './SearchReplace.css';
import ReplacePreviewModal from './ReplacePreviewModal';

const SearchReplace = ({ text, onReplace, isOpen, onClose, editorRef, allFiles = [], onOpenFile, onProjectReplace, initialTerm = '', initialIsGrepMode = false, showToast, requestConfirm }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [useRegex, setUseRegex] = useState(false);
    const [matches, setMatches] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: window.innerWidth - 450, y: 80 });
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isComposing, setIsComposing] = useState(false);

    // Grep State
    const [isGrepMode, setIsGrepMode] = useState(false);
    const [grepResults, setGrepResults] = useState([]);

    // Initialize from props when opening
    useEffect(() => {
        if (isOpen) {
            if (initialTerm) setSearchTerm(initialTerm);
            if (initialIsGrepMode !== undefined) setIsGrepMode(initialIsGrepMode);
        }
    }, [isOpen, initialTerm, initialIsGrepMode]);

    // Project Replace Preview State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [proposedChanges, setProposedChanges] = useState([]);

    // Jump to current match - Moved to explicit jumpToMatch function for reliability

    const handleSearch = useCallback(() => {
        if (!searchTerm) {
            setMatches([]);
            setCurrentMatchIndex(-1);
            setGrepResults([]);
            return;
        }

        try {
            let pattern;
            if (useRegex) {
                pattern = new RegExp(searchTerm, caseSensitive ? 'g' : 'gi');
            } else {
                const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
            }

            if (isGrepMode) {
                // Global Grep
                const results = [];
                allFiles.forEach(file => {
                    const content = file.body || file.content || ""; // Handle different file structures
                    const lines = content.split('\n');
                    lines.forEach((line, lineIdx) => {
                        // Creating a fresh regex for each line check if not global, but here we check existence
                        // For display, we might just want to check if line matches
                        if (pattern.test(line)) {
                            // Reset lastIndex for continuous matching if global
                            if (pattern.global) pattern.lastIndex = 0;

                            results.push({
                                fileHandle: file.handle,
                                fileName: file.name,
                                lineIndex: lineIdx,
                                lineContent: line.trim()
                            });
                        }
                    });
                });
                setGrepResults(results);
            } else {
                // Local Search
                const foundMatches = [];
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    foundMatches.push({
                        index: match.index,
                        length: match[0].length,
                        text: match[0]
                    });
                }
                setMatches(foundMatches);
                setCurrentMatchIndex(foundMatches.length > 0 ? 0 : -1);
            }

        } catch (error) {
            console.error('Search error:', error);
            if (showToast) showToast('検索パターンにエラーがあります。');
        }
    }, [searchTerm, caseSensitive, useRegex, isGrepMode, text, allFiles, showToast]);

    // 検索語・オプション変更時に自動で再検索（ローカルのみ）
    // ★ 変更: 検索の自動実行をIME確定後のみに
    useEffect(() => {
        if (!isOpen) return;
        if (isComposing) return;  // ★ IME変換中は検索しない
        if (!isGrepMode) {
            handleSearch();
        }
    }, [handleSearch, isOpen, isGrepMode, isComposing]);

    const handleGrepJump = (result) => {
        if (onOpenFile) {
            onOpenFile(result.fileHandle, result.fileName, { position: 0 }); // Todo: specific line jump?
            // Since onOpenFile is async and might reset state, we might need a way to jump after open.
            // App.jsx handleOpenFile accepts options.position. 
            // We need to calculate position from line index?
            // Or App.jsx handles jumpToLine?

            // For now, let's try to calculate position if we have content, 
            // but we don't always have content loaded in editor.
            // Let's pass a "lineIndex" option if supported, or improving handleOpenFile.
            // Currently handleOpenFile uses character position. 
            // We can calculate char position roughly if we access file content again or assume from current loop.
            // But checking 'allFiles' is safer.
            const file = allFiles.find(f => f.name === result.fileName);
            if (file) {
                const content = file.body || file.content || "";
                const lines = content.split('\n');
                let charPos = 0;
                for (let i = 0; i < result.lineIndex; i++) {
                    charPos += lines[i].length + 1;
                }
                onOpenFile(result.fileHandle, result.fileName, { position: charPos });
            }
        }
    };


    const handleReplaceOne = () => {
        if (currentMatchIndex === -1 || matches.length === 0) return;

        const match = matches[currentMatchIndex];
        const before = text.substring(0, match.index);
        const after = text.substring(match.index + match.length);
        const newText = before + replaceTerm + after;

        onReplace(newText);

        // Re-search after replace
        setTimeout(() => handleSearch(), 100);
    };

    const handleReplaceAll = async () => {
        if (!searchTerm) return;

        if (isGrepMode) {
            // Project Wide Replace Preview
            try {
                let pattern;
                if (useRegex) {
                    pattern = new RegExp(searchTerm, caseSensitive ? 'g' : 'gi');
                } else {
                    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
                }

                const changes = [];

                allFiles.forEach(file => {
                    const content = file.body || file.content || "";
                    const lines = content.split('\n');
                    lines.forEach((line, lineIdx) => {
                        if (pattern.test(line)) {
                            if (pattern.global) pattern.lastIndex = 0;

                            const newLine = line.replace(pattern, replaceTerm);

                            if (newLine !== line) {
                                changes.push({
                                    fileHandle: file.handle,
                                    fileName: file.name,
                                    lineIndex: lineIdx,
                                    lineContent: line,
                                    newContent: newLine
                                });
                            }
                        }
                    });
                });

                setProposedChanges(changes);
                setIsPreviewOpen(true);
            } catch (e) {
                console.error(e);
                showToast('置換準備中にエラーが発生しました');
            }
            return;
        }

        if (matches.length === 0) return;
        const confirmed = await requestConfirm("一括置換の確認", `${matches.length}件を置換しますか？`);
        if (!confirmed) return;

        try {
            let pattern;
            if (useRegex) {
                pattern = new RegExp(searchTerm, caseSensitive ? 'g' : 'gi');
            } else {
                const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
            }

            const newText = text.replace(pattern, replaceTerm);
            onReplace(newText);
            setMatches([]);
            setCurrentMatchIndex(-1);
        } catch (error) {
            console.error("Search error:", error);
            showToast('検索でエラーが発生しました');
        }
    };

    const executeProjectReplace = (selectedChanges) => {
        if (onProjectReplace) {
            onProjectReplace(selectedChanges);
            setIsPreviewOpen(false);
            setGrepResults([]);
        }
    };

    // 明示的にジャンプを実行する関数
    const jumpToMatch = useCallback((index) => {
        if (index < 0 || index >= matches.length) return;
        setCurrentMatchIndex(index);
        const match = matches[index];
        if (editorRef?.current) {
            // 少し遅延させてフォーカスを確実に戻す
            setTimeout(() => {
                editorRef.current.jumpToPosition(match.index, match.index + match.length);
            }, 0);
        }
    }, [matches, editorRef]);

    const goToNext = () => {
        if (matches.length === 0) return;
        jumpToMatch((currentMatchIndex + 1) % matches.length);
    };

    const goToPrevious = () => {
        if (matches.length === 0) return;
        jumpToMatch((currentMatchIndex - 1 + matches.length) % matches.length);
    };

    // Dragging handlers
    const handleMouseDown = (e) => {
        if (e.target.closest('.search-replace-header')) {
            setIsDragging(true);
            setDragOffset({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
        }
    };

    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    }, [isDragging, dragOffset]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    if (!isOpen) return null;

    return (
        <>
            <ReplacePreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                onExecute={executeProjectReplace}
                changes={proposedChanges}
            />
            <div
                className="search-replace-panel"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    cursor: isDragging ? 'grabbing' : 'default'
                }}
            >
                <div
                    className="search-replace-header"
                    onMouseDown={handleMouseDown}
                    style={{ cursor: 'grab' }}
                >
                    <h3>🔍 検索・置換</h3>
                    <button className="close-btn" onClick={onClose} title="閉じる（検索結果は保持されます）">✕</button>
                </div>

                <div className="search-replace-content">
                    <div className="search-input-group">
                        <input
                            type="text"
                            placeholder={isGrepMode ? "Grep検索 (全ファイル)" : "検索..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onCompositionStart={() => setIsComposing(true)}
                            onCompositionEnd={(e) => {
                                setIsComposing(false);
                                setSearchTerm(e.target.value);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            autoFocus
                        />
                        <button onClick={handleSearch}>検索</button>
                    </div>

                    <div className="replace-input-group">
                        <input
                            type="text"
                            placeholder="置換後..."
                            value={replaceTerm}
                            onChange={(e) => setReplaceTerm(e.target.value)}
                        />
                    </div>

                    <div className="search-options">
                        <label>
                            <input
                                type="checkbox"
                                checked={caseSensitive}
                                onChange={(e) => setCaseSensitive(e.target.checked)}
                            />
                            Aa
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={useRegex}
                                onChange={(e) => setUseRegex(e.target.checked)}
                            />
                            .*
                        </label>
                        {allFiles.length > 0 && (
                            <label title="全ファイルから検索" style={{ marginLeft: '12px', color: isGrepMode ? '#8e44ad' : 'inherit', fontWeight: isGrepMode ? 'bold' : 'normal' }}>
                                <input
                                    type="checkbox"
                                    checked={isGrepMode}
                                    onChange={(e) => setIsGrepMode(e.target.checked)}
                                />
                                Grep ({allFiles.length})
                            </label>
                        )}
                    </div>

                    <div className="action-buttons">
                        <button onClick={handleSearch} className="primary-btn">検索</button>
                        {!isGrepMode && (
                            <>
                                <button onClick={handleReplaceOne}>置換</button>
                                <button onClick={handleReplaceAll} className="danger-btn">全置換</button>
                            </>
                        )}
                    </div>

                    {/* Grep Results Area */}
                    {isGrepMode ? (
                        <div className="search-results-list" style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto', borderTop: '1px solid #eee' }}>
                            {grepResults.length > 0 ? (
                                <>
                                    <div style={{ fontSize: '0.8rem', padding: '4px', color: '#666' }}>{grepResults.length} 件見つかりました</div>
                                    {grepResults.map((res, i) => (
                                        <div
                                            key={i}
                                            className="grep-item"
                                            onClick={() => handleGrepJump(res)}
                                            style={{
                                                padding: '4px 8px',
                                                borderBottom: '1px solid #f0f0f0',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}
                                            title={`${res.fileName} (${res.lineIndex + 1}): ${res.lineContent}`}
                                        >
                                            <span style={{ fontWeight: 'bold', color: '#8e44ad' }}>{res.fileName}</span>
                                            <span style={{ color: '#999', fontSize: '0.8rem', marginLeft: '4px' }}>({res.lineIndex + 1})</span>
                                            <span style={{ marginLeft: '8px' }}>{res.lineContent}</span>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <div style={{ padding: '8px', color: '#999', fontSize: '0.9rem' }}>
                                    {searchTerm ? "見つかりませんでした" : "検索語を入力してください"}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Standard Results display */
                        matches.length > 0 && (
                            <div className="search-results-area">
                                <div className="search-results">
                                    <span>
                                        {matches.length} 件 ({currentMatchIndex + 1}/{matches.length})
                                    </span>
                                    <div className="navigation-buttons">
                                        <button onClick={goToPrevious} title="前へ (Shift+Enter)">▲</button>
                                        <button onClick={goToNext} title="次へ (Enter)">▼</button>
                                    </div>
                                </div>
                                <div className="search-results-list" style={{ marginTop: '4px', maxHeight: '200px', overflowY: 'auto', borderTop: '1px solid #eee' }}>
                                    {matches.map((match, i) => {
                                        const contextStart = Math.max(0, match.index - 15);
                                        const contextEnd = Math.min(text.length, match.index + match.length + 15);
                                        const before = text.substring(contextStart, match.index);
                                        const matched = text.substring(match.index, match.index + match.length);
                                        const after = text.substring(match.index + match.length, contextEnd);
                                        // 行番号を計算
                                        const lineNumber = text.substring(0, match.index).split('\n').length;

                                        return (
                                            <div
                                                key={i}
                                                className="grep-item"
                                                onClick={() => jumpToMatch(i)}
                                                style={{
                                                    padding: '4px 8px',
                                                    borderBottom: '1px solid #f0f0f0',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    background: i === currentMatchIndex ? 'rgba(52, 152, 219, 0.12)' : 'transparent',
                                                    borderLeft: i === currentMatchIndex ? '3px solid var(--accent-color, #3498db)' : '3px solid transparent',
                                                }}
                                                title={`${lineNumber}行目: ${before}${matched}${after}`}
                                            >
                                                <span style={{ color: '#999', fontSize: '0.75rem', marginRight: '6px', minWidth: '2.5em', display: 'inline-block' }}>
                                                    {lineNumber}:
                                                </span>
                                                <span style={{ color: 'var(--text-main, #666)' }}>
                                                    {contextStart > 0 ? '…' : ''}{before}
                                                </span>
                                                <span style={{ fontWeight: 'bold', color: 'var(--accent-color, #3498db)', background: 'rgba(52,152,219,0.1)', borderRadius: '2px', padding: '0 1px' }}>
                                                    {matched}
                                                </span>
                                                <span style={{ color: 'var(--text-main, #666)' }}>
                                                    {after}{contextEnd < text.length ? '…' : ''}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    )}

                    {!isGrepMode && matches.length === 0 && searchTerm && (
                        <div className="search-results" style={{ background: '#fff3cd', color: '#856404' }}>
                            <span>見つかりませんでした</span>
                        </div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.5rem', textAlign: 'center' }}>
                        Cmd/Ctrl+F で再表示
                    </div>
                </div>
            </div>
        </>
    );
};

export default SearchReplace;
