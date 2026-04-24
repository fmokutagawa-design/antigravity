import React, { useState, useEffect } from 'react';
import './SearchPanel.css';

const SearchPanel = ({ allFiles, currentText, currentFileName, onOpenFile, onProjectReplace }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [replaceQuery, setReplaceQuery] = useState('');
    const [useRegex, setUseRegex] = useState(false);
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [targetBodyOnly, setTargetBodyOnly] = useState(true); // Default: Ignore frontmatter

    // Results
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchTime, setSearchTime] = useState(0);

    // Replace Preview State
    const [showReplaceUI, setShowReplaceUI] = useState(false);

    // Perform search
    useEffect(() => {
        if (!searchQuery) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(() => {
            setIsSearching(true);
            const startTime = performance.now();
            const results = [];

            try {
                const normalizedQuery = searchQuery.normalize('NFC');
                let pattern;
                if (useRegex) {
                    try {
                        pattern = new RegExp(normalizedQuery, caseSensitive ? 'g' : 'gi');
                    } catch (e) {
                        pattern = new RegExp(normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
                    }
                } else {
                    const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
                }

                // Search current document first (unsaved state)
                if (currentText) {
                    searchSingleContent(
                        { name: currentFileName || '未保存の文書', isCurrent: true },
                        currentText.normalize('NFC'),
                        pattern,
                        results
                    );
                }

                // Search other files
                allFiles.forEach(file => {
                    // Skip if it's the current file (already searched)
                    if (currentFileName && (file.name === currentFileName || file.path === currentFileName)) return;

                    const content = (file.content || "").normalize('NFC');
                    searchSingleContent(file, content, pattern, results);
                });

                setSearchResults(results);
            } catch (e) {
                console.error("Search invalid", e);
            } finally {
                setIsSearching(false);
                setSearchTime(performance.now() - startTime);
            }

        }, 300); // Debounce

        return () => clearTimeout(timer);

        function searchSingleContent(file, content, pattern, resultsList) {
            // Frontmatter boundary detection
            let bodyStartIndex = 0;
            if (targetBodyOnly) {
                // Support both --- and ［METADATA］
                const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/) ||
                    content.match(/^［METADATA］\n([\s\S]*?)\n［\/METADATA］\n/);
                if (fmMatch) {
                    bodyStartIndex = fmMatch[0].length;
                }
            }

            const lines = content.split('\n');
            let currentCharIndex = 0;

            lines.forEach((line, lineIdx) => {
                const lineStartChar = currentCharIndex;
                const lineEndChar = lineStartChar + line.length;
                currentCharIndex += line.length + 1;

                if (targetBodyOnly && lineEndChar <= bodyStartIndex) return;

                if (pattern.global) pattern.lastIndex = 0;
                if (pattern.test(line)) {
                    resultsList.push({
                        file,
                        lineIndex: lineIdx,
                        lineContent: line.trim(),
                        fullLine: line,
                        position: lineStartChar
                    });
                }
            });
        }
    }, [searchQuery, useRegex, caseSensitive, targetBodyOnly, allFiles, currentText, currentFileName]);

    const handleReplaceAllPreview = () => {
        if (!replaceQuery || searchResults.length === 0) return;

        const confirmed = confirm(`${searchResults.length}箇所を「${replaceQuery}」に置換しますか？\n(この操作は取り消せません)`);
        if (!confirmed) return;

        // Calculate changes
        const changes = [];
        // Re-run regex to get strict replacement
        try {
            let pattern;
            if (useRegex) {
                pattern = new RegExp(searchQuery, caseSensitive ? 'g' : 'gi');
            } else {
                const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
            }

            // We need to group by file to do safe replace
            // But onProjectReplace accepts flat list of changes?
            // Let's construct changes object compatible with handleProjectReplace
            // It expects: { fileHandle, fileName, lineIndex, newContent }

            searchResults.forEach(res => {
                const newLine = res.fullLine.replace(pattern, replaceQuery);
                if (newLine !== res.fullLine) {
                    changes.push({
                        fileHandle: res.file.handle, // Verify this handle exists!
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
            } else {
                alert("エラー: onProjectReplace 関数が見つかりません。");
            }

        } catch (e) {
            alert('置換エラー: ' + e.message);
        }
    };

    return (
        <div className="search-panel">
            <div className="search-header-advanced">
                <div className="search-row">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="🔍 検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    <button
                        className={`toggle-btn ${showReplaceUI ? 'active' : ''}`}
                        onClick={() => setShowReplaceUI(!showReplaceUI)}
                        title="置換パネルを表示"
                    >
                        ↪
                    </button>
                </div>

                {showReplaceUI && (
                    <div className="search-row replace-row">
                        <input
                            type="text"
                            className="search-input replace-input"
                            placeholder="置換後の文字列..."
                            value={replaceQuery}
                            onChange={(e) => setReplaceQuery(e.target.value)}
                        />
                        <button
                            className="action-btn"
                            onClick={handleReplaceAllPreview}
                            disabled={!searchQuery || searchResults.length === 0}
                        >
                            全置換
                        </button>
                    </div>
                )}

                <div className="search-options">
                    <label title="正規表現を使用">
                        <input type="checkbox" checked={useRegex} onChange={e => setUseRegex(e.target.checked)} />
                        .*
                    </label>
                    <label title="大文字・小文字を区別">
                        <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} />
                        Aa
                    </label>
                    <label title="本文のみ検索 (Frontmatterを除外)">
                        <input type="checkbox" checked={targetBodyOnly} onChange={e => setTargetBodyOnly(e.target.checked)} />
                        本文のみ
                    </label>
                </div>
            </div>

            <div className="search-results">
                {isSearching ? (
                    <div className="search-loading">検索中...</div>
                ) : (
                    <>
                        <div className="search-meta">
                            {searchResults.length} 件 ({searchTime.toFixed(0)}ms)
                        </div>
                        <div className="results-list">
                            {searchResults.map((res, i) => (
                                <div
                                    key={i}
                                    className="result-item"
                                    onClick={() => onOpenFile(res.file.handle, res.file.name, { position: res.position })}
                                    title={`${res.file.name}:${res.lineIndex + 1}`}
                                >
                                    <div className="result-header">
                                        <span className="file-name">{res.file.name}</span>
                                        <span className="line-num">Line {res.lineIndex + 1}</span>
                                    </div>
                                    <div className="preview">{res.lineContent}</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
            {/* Removed inline style jsx in favor of external CSS */}
        </div>
    );
};

export default SearchPanel;
