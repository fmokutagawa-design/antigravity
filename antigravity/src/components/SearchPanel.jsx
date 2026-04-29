import React, { useState, useEffect } from 'react';
import './SearchPanel.css';

const SearchPanel = ({ allFiles, onOpenFile, onProjectReplace, initialQuery, projectHandle }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [replaceQuery, setReplaceQuery] = useState('');
    const [useRegex, setUseRegex] = useState(false);
    const [caseSensitive, setCaseSensitive] = useState(false);

    const searchInputRef = React.useRef(null);

    // Results
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchTime, setSearchTime] = useState(0);

    // Replace Preview State
    const [showReplaceUI, setShowReplaceUI] = useState(false);

    // Engine and Scope
    const [searchEngine, setSearchEngine] = useState('');
    const [currentScopeHandle, setCurrentScopeHandle] = useState(projectHandle);

    useEffect(() => {
        setCurrentScopeHandle(projectHandle);
    }, [projectHandle]);

    const performSearch = async () => {
        if (!searchQuery) {
            setSearchResults([]);
            setSearchEngine('');
            return;
        }

        if (!currentScopeHandle && (!allFiles || allFiles.length === 0)) {
            setSearchResults([]);
            setIsSearching(false);
            setSearchEngine('❌ 作品未選択');
            return;
        }

        setIsSearching(true);
        const startTime = performance.now();
        
        try {
            let results = [];
            let engineName = "🐌 JS スキャン";

            // 1. Try Native Grep
            if (window.api?.fs?.grep && currentScopeHandle) {
                try {
                    const targetPath = typeof currentScopeHandle === 'string' ? currentScopeHandle : (currentScopeHandle.path || currentScopeHandle.handle);
                    const nativeResults = await window.api.fs.grep(targetPath, searchQuery, { useRegex, caseSensitive });
                    
                    const validPaths = new Set(allFiles.map(f => f.handle || f.path));
                    results = nativeResults
                        .filter(res => validPaths.has(res.path))
                        .map(res => ({
                            file: allFiles.find(f => (f.handle || f.path) === res.path) || { name: res.name, handle: res.path, path: res.path },
                            lineIndex: res.lineIndex,
                            lineContent: res.lineContent.trim(),
                            fullLine: res.lineContent,
                            position: 0
                        }));
                    engineName = "⚡ 高速 Grep";
                } catch (grepError) {
                    console.warn("Grep failed:", grepError);
                }
            }

            // 2. JS Fallback
            if (results.length === 0) {
                const normalizedQuery = searchQuery.normalize('NFC');
                let pattern;
                try {
                    const escaped = useRegex ? normalizedQuery : normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
                } catch (e) {
                    pattern = new RegExp(normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
                }

                const BATCH_SIZE = 8;
                for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
                    const batch = allFiles.slice(i, i + BATCH_SIZE);
                    await Promise.all(batch.map(async (file) => {
                        try {
                            const targetH = activeFileHandle?.handle || activeFileHandle?.path || activeFileHandle;
                            const fileH = file.handle || file.path;
                            const isCurrentFile = targetH && fileH === targetH;
                            
                            let content = isCurrentFile ? currentText : file.content;
                            
                            if (!content && !isCurrentFile && window.api?.fs?.readFile) {
                                content = await window.api.fs.readFile(fileH);
                            }
                            if (!content) return;
                            
                            const lines = content.normalize('NFC').split('\n');
                            lines.forEach((line, lineIdx) => {
                                pattern.lastIndex = 0;
                                if (pattern.test(line)) {
                                    results.push({ file, lineIndex: lineIdx, lineContent: line.trim(), fullLine: line, position: 0 });
                                }
                            });
                        } catch (err) {}
                    }));
                }
                engineName = "🐌 JS スキャン";
            }

            setSearchResults(results);
            setSearchEngine(engineName);
        } catch (e) {
            console.error("Search failed", e);
        } finally {
            setIsSearching(false);
            setSearchTime(performance.now() - startTime);
        }
    };

    const handleChangeScope = async () => {
        if (window.api?.fs?.selectFolder) {
            const newFolder = await window.api.fs.selectFolder();
            if (newFolder) {
                setCurrentScopeHandle(newFolder);
            }
        }
    };

    const handleReplaceAllPreview = () => {
        if (!replaceQuery || searchResults.length === 0) return;

        const confirmed = confirm(`${searchResults.length}箇所を「${replaceQuery}」に置換しますか？\n(この操作は取り消せません)`);
        if (!confirmed) return;

        const changes = [];
        try {
            let pattern;
            if (useRegex) {
                pattern = new RegExp(searchQuery, caseSensitive ? 'g' : 'gi');
            } else {
                const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
            }

            searchResults.forEach(res => {
                const newLine = res.fullLine.replace(pattern, replaceQuery);
                if (newLine !== res.fullLine) {
                    changes.push({
                        fileHandle: res.file.handle || res.file.path,
                        fileName: res.file.name,
                        lineIndex: res.lineIndex,
                        lineContent: res.fullLine,
                        newContent: newLine
                    });
                }
            });

            if (changes.length === 0) {
                alert("変更箇所が計算できませんでした。");
                return;
            }

            if (onProjectReplace) {
                onProjectReplace(changes);
            }
        } catch (e) {
            alert('置換エラー: ' + e.message);
        }
    };

    // Initial query sync and auto-search
    useEffect(() => {
        if (initialQuery) {
            const term = typeof initialQuery === 'object' ? initialQuery.term : initialQuery;
            setSearchQuery(term || '');
            if (term) setTimeout(performSearch, 50);
            
            if (searchInputRef.current) {
                searchInputRef.current.focus();
                searchInputRef.current.select();
            }
        }
    }, [initialQuery]);

    useEffect(() => {
        if (!searchQuery) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(performSearch, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, useRegex, caseSensitive, currentScopeHandle, allFiles]);

    const targetPathStr = typeof currentScopeHandle === 'string' ? currentScopeHandle : (currentScopeHandle?.path || currentScopeHandle?.handle || '不明');
    const pathParts = targetPathStr.split(/[/\\]/).filter(p => p && p !== ' ');
    const displayPath = pathParts.slice(-2).join('/');

    return (
        <div className="search-panel">
            <div className="search-status-bar">
                <span className="scope-badge">範囲</span>
                <span className="path-text" title={targetPathStr}>.../{displayPath}</span>
                <button className="change-scope-btn" onClick={handleChangeScope} title="検索範囲を変更">
                    📁 変更
                </button>
                {searchEngine && <span className="engine-badge">{searchEngine}</span>}
            </div>

            <div className="search-header-advanced">
                <div className="search-row main-search-row">
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="search-input"
                        placeholder="🔍 検索ワード..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                    />
                    <button className="primary-search-btn" onClick={performSearch} disabled={isSearching}>
                        {isSearching ? '...' : '検索'}
                    </button>
                </div>

                <div className="search-controls-secondary">
                    <button
                        className={`toggle-replace-btn ${showReplaceUI ? 'active' : ''}`}
                        onClick={() => setShowReplaceUI(!showReplaceUI)}
                    >
                        {showReplaceUI ? '▲ 置換を隠す' : '▼ 置換を表示'}
                    </button>
                    
                    <div className="search-options-mini">
                        <label className={`option-chip ${caseSensitive ? 'on' : ''}`}>
                            <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} />
                            Aa
                        </label>
                        <label className={`option-chip ${useRegex ? 'on' : ''}`}>
                            <input type="checkbox" checked={useRegex} onChange={e => setUseRegex(e.target.checked)} />
                            .* (正規表現)
                        </label>
                    </div>
                </div>

                {showReplaceUI && (
                    <div className="replace-container-box">
                        <input
                            type="text"
                            className="search-input replace-input"
                            placeholder="置換後の文字列..."
                            value={replaceQuery}
                            onChange={(e) => setReplaceQuery(e.target.value)}
                        />
                        <button
                            className="primary-replace-btn"
                            onClick={handleReplaceAllPreview}
                            disabled={!searchQuery || searchResults.length === 0}
                        >
                            全ファイルで一括置換
                        </button>
                    </div>
                )}
            </div>

            <div className="search-results-container">
                {isSearching ? (
                    <div className="search-loading-spinner">走査中...</div>
                ) : (
                    <>
                        <div className="search-meta-info">
                            {searchResults.length > 0 ? (
                                <span>ヒット: <strong>{searchResults.length}</strong> 件</span>
                            ) : searchQuery ? (
                                <span className="no-hits">見つかりませんでした</span>
                            ) : null}
                            {searchTime > 0 && <span className="time-tag">{searchTime.toFixed(0)}ms</span>}
                        </div>
                        
                        <div className="results-list-scrollable">
                            {searchResults.map((res, i) => (
                                <div
                                    key={i}
                                    className="result-item-card"
                                    onClick={() => onOpenFile(res.file.handle || res.file.path, res.file.name, { position: res.position })}
                                >
                                    <div className="result-card-header">
                                        <span className="res-file-tag">{res.file.name}</span>
                                        <span className="res-line-tag">L{res.lineIndex + 1}</span>
                                    </div>
                                    <div className="res-preview-text">{res.lineContent}</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SearchPanel;
