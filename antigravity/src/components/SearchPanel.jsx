import React, { useState, useEffect } from 'react';
import './SearchPanel.css';

const SearchPanel = ({ allFiles, onOpenFile, onProjectReplace, initialQuery, projectHandle, currentText, activeFileHandle }) => {
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

            console.log(`[Search] Starting search: "${searchQuery}" in ${allFiles?.length} files`);

            // 1. Try Native Grep
            if (window.api?.fs?.grep && currentScopeHandle) {
                try {
                    const targetPath = typeof currentScopeHandle === 'string' ? currentScopeHandle : (currentScopeHandle.path || currentScopeHandle.handle);
                    console.log(`[Search] Attempting Native Grep on: ${targetPath}`);
                    const nativeResults = await window.api.fs.grep(targetPath, searchQuery, { useRegex, caseSensitive });
                    
                    const validPaths = new Set(
                        (allFiles || [])
                            .map(f => typeof f === 'string' ? f : (f.path || f.handle || ''))
                            .filter(p => p)
                            .map(p => String(p).normalize('NFC').replace(/\\/g, '/'))
                    );

                    console.log(`[Search] Validating ${nativeResults.length} native results against ${validPaths.size} paths`);
                    
                    const filteredResults = validPaths.size === 0
                        ? nativeResults
                        : nativeResults.filter(res => {
                            const rp = (res.path || '').normalize('NFC').replace(/\\/g, '/');
                            return validPaths.has(rp);
                        });

                    // 最終ガード：もしフィルターで全滅した場合は、フィルタリングせずに全件出す（パス正規化問題への対応）
                    const finalResults = (filteredResults.length === 0 && nativeResults.length > 0) ? nativeResults : filteredResults;

                    // 章の順番（allFiles のインデックス順）でソートする
                    const fileOrderMap = new Map();
                    (allFiles || []).forEach((f, idx) => {
                        const fp = typeof f === 'string' ? f : (f.path || f.handle || '');
                        if (fp) fileOrderMap.set(String(fp).normalize('NFC').replace(/\\/g, '/'), idx);
                    });

                    results = finalResults
                        .map(res => {
                            const rp = (res.path || '').normalize('NFC').replace(/\\/g, '/');
                            return {
                                file: (allFiles || []).find(f => {
                                    const fp = typeof f === 'string' ? f : (f.path || f.handle || '');
                                    return fp && String(fp).normalize('NFC').replace(/\\/g, '/') === rp;
                                }) || { name: res.name, handle: res.path, path: res.path },
                                lineIndex: res.lineIndex,
                                lineContent: res.lineContent.trim(),
                                fullLine: res.lineContent,
                                position: 0,
                                fileOrder: fileOrderMap.has(rp) ? fileOrderMap.get(rp) : 9999
                            };
                        })
                        .sort((a, b) => {
                            // 1. ファイル（章）の順番
                            if (a.fileOrder !== b.fileOrder) return a.fileOrder - b.fileOrder;
                            // 2. 同じファイル内なら行番号順
                            return a.lineIndex - b.lineIndex;
                        });
                    engineName = "⚡ 高速 Grep";
                    console.log(`[Search] Grep found ${results.length} valid matches`);
                } catch (grepError) {
                    console.warn("[Search] Grep failed:", grepError);
                }
            }

            // 2. JS Fallback
            if (results.length === 0) {
                console.log(`[Search] Falling back to JS Scan...`);
                const normalizedQuery = searchQuery.normalize('NFC');
                let pattern;
                try {
                    const escaped = useRegex ? normalizedQuery : normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
                } catch (e) {
                    pattern = new RegExp(normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
                }

                const BATCH_SIZE = 8;
                let scanCount = 0;
                for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
                    const batch = allFiles.slice(i, i + BATCH_SIZE);
                    await Promise.all(batch.map(async (file) => {
                        try {
                            const targetH = activeFileHandle?.handle || activeFileHandle?.path || activeFileHandle;
                            const fileH = file.handle || file.path;
                            const isCurrentFile = targetH && fileH === targetH;
                            
                            // ディレクトリ、または .nexus フォルダ自体をスキップ
                            if (file.kind === 'directory' || (typeof fileH === 'string' && fileH.endsWith('.nexus'))) {
                                return;
                            }

                            let content = isCurrentFile ? currentText : file.content;
                            
                            if (!content && !isCurrentFile && window.api?.fs?.readFile) {
                                content = await window.api.fs.readFile(fileH);
                            }
                            if (!content) {
                                // console.log(`[Search] Skipping empty file: ${file.name}`);
                                return;
                            }
                            
                            scanCount++;
                            const lines = content.normalize('NFC').split('\n');
                            lines.forEach((line, lineIdx) => {
                                pattern.lastIndex = 0;
                                if (pattern.test(line)) {
                                    results.push({ file, lineIndex: lineIdx, lineContent: line.trim(), fullLine: line, position: 0 });
                                }
                            });
                        } catch (err) {
                            console.error(`[Search] Error scanning ${file.name}:`, err);
                        }
                    }));
                }
                engineName = "🐌 JS スキャン";
                console.log(`[Search] JS Scan complete. Scanned ${scanCount} files, found ${results.length} hits`);
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

    const targetPathStr = typeof currentScopeHandle === 'string' ? currentScopeHandle : (currentScopeHandle?.path || currentScopeHandle?.handle || '');
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
                                    onClick={() => {
                                        // 1. ファイルを開く
                                        onOpenFile(res.file.handle || res.file.path, res.file.name, { 
                                            position: res.position,
                                            line: res.lineIndex,
                                            searchQuery: searchQuery 
                                        });
                                        // 2. 行ジャンプイベントを発行（App.jsx のリスナーが捕捉する）
                                        window.dispatchEvent(new CustomEvent('nexus-jump-to-text', {
                                            detail: {
                                                file: res.file.name,
                                                line: res.lineIndex,
                                                path: res.file.handle || res.file.path
                                            }
                                        }));
                                    }}
                                >
                                    <div className="result-card-header">
                                        <div className="res-file-info">
                                            <span className="res-file-icon">📖</span>
                                            <span className="res-file-tag">{res.file.name.replace('.txt', '').replace('.md', '')}</span>
                                        </div>
                                        <span className="res-line-number">{res.lineIndex + 1}行目</span>
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
