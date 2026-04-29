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

    const performSearch = useCallback(async (term) => {
        if (!term || !activeWorkFolderPath) return;
        setIsSearching(true);
        setResults([]);

        try {
            const isElectron = !!window.api;
            let rawResults = [];
            
            if (isElectron && window.api.fs.grep) {
                rawResults = await window.api.fs.grep(activeWorkFolderPath, term);
                setEngineName('Grep');
            } else {
                setEngineName('JS Scan');
            }

            // マニフェスト順にソート
            const fileOrderMap = new Map();
            (allFiles || []).forEach((f, idx) => {
                const fp = typeof f === 'string' ? f : (f.path || f.handle || '');
                if (fp) fileOrderMap.set(String(fp).normalize('NFC').replace(/\\/g, '/'), idx);
            });

            const mappedResults = rawResults.map(res => {
                const rp = (res.path || '').normalize('NFC').replace(/\\/g, '/');
                return {
                    ...res,
                    file: (allFiles || []).find(f => {
                        const fp = typeof f === 'string' ? f : (f.path || f.handle || '');
                        return fp && String(fp).normalize('NFC').replace(/\\/g, '/') === rp;
                    }) || { name: res.name || 'Unknown', path: res.path },
                    fileOrder: fileOrderMap.get(rp) ?? 9999
                };
            }).sort((a, b) => (a.fileOrder - b.fileOrder) || (a.lineIndex - b.lineIndex));

            setResults(mappedResults);
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setIsSearching(false);
        }
    }, [activeWorkFolderPath, allFiles]);

    useEffect(() => {
        if (initialQuery?.term) {
            setSearchQuery(initialQuery.term);
            performSearch(initialQuery.term);
        }
    }, [initialQuery, performSearch]);

    return (
        <div className="search-panel-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#ccc', background: 'var(--bg-dark)' }}>
            <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
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
                {!isSearching && results.length > 0 && (
                    <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.5, letterSpacing: '0.02em' }}>
                        {results.length} 件のヒット ({engineName})
                    </div>
                )}
                {isSearching && <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.5 }}>検索中...</div>}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                {results.map((res, i) => (
                    <div 
                        key={i} 
                        onClick={() => {
                            onOpenFile(res.file.handle || res.file.path, res.file.name, { line: res.lineIndex });
                            window.dispatchEvent(new CustomEvent('nexus-jump-to-text', {
                                detail: { file: res.file.name, line: res.lineIndex, path: res.file.path }
                            }));
                        }}
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
