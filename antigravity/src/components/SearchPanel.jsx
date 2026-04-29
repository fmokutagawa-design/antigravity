import React, { useState, useEffect, useCallback } from 'react';

const SearchPanel = ({ 
    allFiles, 
    onOpenFile, 
    activeWorkFolderPath,
    searchQuery: initialQuery 
}) => {
    const [searchQuery, setSearchQuery] = useState(initialQuery?.term || '');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [engineName, setEngineName] = useState('');
    
    const [isRegex, setIsRegex] = useState(false);
    const [caseSensitive, setCaseSensitive] = useState(false);

    const performSearch = useCallback(async (term) => {
        if (!term || !activeWorkFolderPath) return;
        setIsSearching(true);
        setResults([]);

        try {
            const isElectron = !!window.api;
            let rawResults = [];
            
            if (isElectron && window.api.fs.grep) {
                rawResults = await window.api.fs.grep(activeWorkFolderPath, term, {
                    isRegex,
                    caseSensitive
                });
                setEngineName('Grep');
            } else {
                setEngineName('JS Scan');
            }

            // allFiles のインデックスマップを「ファイル名」で構築
            // grep は絶対パスを返し allFiles は相対パスを持つため、
            // パス全体ではなくファイル名で突き合わせる
            const fileByName = new Map();
            const fileOrderByName = new Map();
            (allFiles || []).forEach((f, idx) => {
                const name = f.name || (typeof f === 'string' ? f.split(/[/\\]/).pop() : '');
                if (name && !fileByName.has(name)) {
                    fileByName.set(name, f);
                    fileOrderByName.set(name, idx);
                }
            });

            const mappedResults = rawResults.map(res => {
                const name = res.name || '';
                const matchedFile = fileByName.get(name);
                return {
                    ...res,
                    file: matchedFile || { name: name || 'Unknown', path: res.path },
                    fileOrder: fileOrderByName.get(name) ?? 9999
                };
            }).sort((a, b) => (a.fileOrder - b.fileOrder) || (a.lineIndex - b.lineIndex));

            setResults(mappedResults);
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setIsSearching(false);
        }
    }, [activeWorkFolderPath, allFiles, isRegex, caseSensitive]);

    useEffect(() => {
        if (initialQuery?.term) {
            setSearchQuery(initialQuery.term);
            performSearch(initialQuery.term);
        }
    }, [initialQuery, performSearch]);

    const displayPath = activeWorkFolderPath 
        ? activeWorkFolderPath.split(/[/\\]/).slice(-2).join(' / ') 
        : '未設定';

    const handleSelectFolder = async () => {
        if (window.api?.fs?.selectFolder) {
            const newPath = await window.api.fs.selectFolder();
            if (newPath) {
                window.dispatchEvent(new CustomEvent('nexus-update-search-path', {
                    detail: { path: newPath }
                }));
            }
        }
    };

    const handleResultClick = useCallback((res) => {
        // nexus-jump-to-text だけを使う。
        // App.jsx 側の handleJumpEvent が handleOpenFile → tryJumpToLine を
        // 正しい順序で実行するので、ここでは onOpenFile を直接呼ばない。
        window.dispatchEvent(new CustomEvent('nexus-jump-to-text', {
            detail: { file: res.file.name, line: res.lineIndex, path: res.file.path }
        }));
    }, []);

    return (
        <div className="search-panel-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#ccc', background: 'var(--bg-dark)' }}>
            <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span>📂</span>
                        <span title={activeWorkFolderPath}>{displayPath}</span>
                    </div>
                    <button 
                        onClick={handleSelectFolder}
                        style={{ background: 'transparent', border: '1px solid #555', color: '#888', fontSize: '9px', padding: '1px 4px', borderRadius: '2px', cursor: 'pointer' }}
                    >
                        変更
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && performSearch(searchQuery)}
                        placeholder="作品内を検索..."
                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', fontSize: '13px', borderRadius: '4px' }}
                    />
                    <button onClick={() => performSearch(searchQuery)} style={{ background: '#444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                        検索
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11px', opacity: 0.7 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} style={{ margin: 0 }} />
                        正規表現
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} style={{ margin: 0 }} />
                        大文字/小文字
                    </label>
                </div>

                {!isSearching && results.length > 0 && (
                    <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.5, color: '#89b4fa' }}>
                        {results.length} 件のヒット ({engineName})
                    </div>
                )}
                {isSearching && <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.5 }}>検索中...</div>}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                {results.map((res, i) => (
                    <div 
                        key={i} 
                        onClick={() => handleResultClick(res)}
                        style={{
                            padding: '10px 16px',
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            cursor: 'pointer',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#89b4fa', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%' }}>
                                {res.file.name.replace('.txt', '')}
                            </span>
                            <span style={{ fontSize: '10px', color: '#555' }}>L{res.lineIndex + 1}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#aaa', lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-all' }}>
                            {res.lineContent.trim()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SearchPanel;
