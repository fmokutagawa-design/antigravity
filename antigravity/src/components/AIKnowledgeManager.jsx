import React, { useState, useEffect } from 'react';
import { ollamaService } from '../utils/ollamaService';

const AIKnowledgeManager = (props) => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState(null);
    const [filterTag, setFilterTag] = useState(null);
    const [isKnowledgeWindow] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'knowledge');

    const loadItems = async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log("Fetching knowledge items from bridge server...");
            const data = await ollamaService.listDBItems();
            setItems(data || []);
        } catch (err) {
            console.error("Failed to load knowledge items:", err);
            setError("データの読み込みに失敗しました。Pythonブリッジサーバー(localhost:8000)が起動しているか確認してください。");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadItems();
    }, []);

    const handlePopOut = () => {
        if (window.api && window.api.invoke) {
            window.api.invoke('window:openKnowledge');
        }
    };

    const handleDelete = async (fullPath) => {
        if (!window.confirm(`このファイルをAIの記憶から消去しますか？\n${fullPath}`)) return;
        
        const success = await ollamaService.deleteDBItem(fullPath);
        if (success) {
            setMessage('記憶を消去しました');
            loadItems();
        } else {
            setMessage('消去に失敗しました');
        }
        setTimeout(() => setMessage(''), 3000);
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setMessage('同期（記憶）を開始しました。完了まで数分かかる場合があります...');
        const success = await ollamaService.triggerIngest();
        if (success) {
            // Ingest runs in background, so we just wait a bit and refresh
            setTimeout(loadItems, 5000);
        } else {
            setMessage('同期の開始に失敗しました');
            setIsSyncing(false);
        }
    };

    const handleOpenFile = (item) => {
        if (window.api && window.api.invoke) {
            // ElectronのIPC経由でメインエディタにファイルを開くよう命令
            window.api.invoke('file:open', item.full_path);
            setMessage(`「${item.file}」をエディタで開きました`);
            setTimeout(() => setMessage(''), 2000);
        } else if (props.onOpenFile) {
            // Webブラウザ版などの場合（props経由）
            props.onOpenFile(null, item.file, { path: item.full_path });
        }
    };

    const handleTagClick = (tag) => {
        setFilterTag(prev => prev === tag ? null : tag);
    };

    const [refSheetQuery, setRefSheetQuery] = useState('');
    const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);

    const handleGenerateReferenceSheet = async () => {
        if (!refSheetQuery) {
            alert("検索したいキーワード（例：莓朱の設定矛盾について）を入力してください");
            return;
        }
        setIsGeneratingSheet(true);
        try {
            const response = await fetch('http://localhost:8000/analyze/reference_sheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: refSheetQuery })
            });
            const data = await response.json();
            if (data.sheet) {
                await navigator.clipboard.writeText(data.sheet);
                setMessage("📋 外部AI用リファレンス・シートをクリップボードにコピーしました！");
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (err) {
            console.error("Failed to generate sheet:", err);
            setMessage("シート生成に失敗しました");
        } finally {
            setIsGeneratingSheet(false);
        }
    };

    const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'SETTING', 'PLOT', 'MANUSCRIPT'

    const filteredItems = items.filter(item => {
        const matchTag = filterTag ? (item.tags || []).includes(filterTag) : true;
        const matchTab = activeTab === 'ALL' ? true : item.doc_type === activeTab;
        return matchTag && matchTab;
    });

    const categories = [
        { id: 'ALL', label: 'すべて', icon: '🌐' },
        { id: 'SETTING', label: '設定資料', icon: '📚' },
        { id: 'PLOT', label: 'プロット', icon: '🗺️' },
        { id: 'MANUSCRIPT', label: '原稿', icon: '✍️' }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, overflow: 'hidden', padding: '15px', backgroundColor: '#fcfcfc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#333', fontWeight: '800' }}>🧠 AI 知識ベース・ブラウザ</h3>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ display: 'flex', border: '1px solid #ddd', borderRadius: '20px', overflow: 'hidden', backgroundColor: '#fff' }}>
                        <input 
                            type="text" 
                            placeholder="外部AI用リファレンス抽出..." 
                            value={refSheetQuery}
                            onChange={(e) => setRefSheetQuery(e.target.value)}
                            style={{ border: 'none', padding: '6px 12px', fontSize: '11px', width: '180px', outline: 'none' }}
                        />
                        <button 
                            onClick={handleGenerateReferenceSheet}
                            disabled={isGeneratingSheet}
                            style={{ 
                                border: 'none', 
                                backgroundColor: '#2196f3', 
                                color: 'white', 
                                padding: '6px 12px', 
                                cursor: 'pointer', 
                                fontSize: '11px',
                                fontWeight: 'bold'
                            }}
                        >
                            {isGeneratingSheet ? '...' : 'AIシート抽出'}
                        </button>
                    </div>
                    <button 
                        onClick={handleSync} 
                        disabled={isSyncing}
                        style={{
                            padding: '6px 16px',
                            backgroundColor: isSyncing ? '#ccc' : '#333',
                            color: 'white',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: isSyncing ? 'default' : 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isSyncing ? '🧠 スキャン中...' : '資料を一括再読込'}
                    </button>
                </div>
            </div>

            {/* カテゴリタブ */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveTab(cat.id)}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            background: activeTab === cat.id ? '#333' : 'transparent',
                            color: activeTab === cat.id ? 'white' : '#666',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>{cat.icon}</span>
                        {cat.label}
                        <span style={{ 
                            fontSize: '10px', 
                            backgroundColor: activeTab === cat.id ? 'rgba(255,255,255,0.2)' : '#eee', 
                            padding: '1px 6px', 
                            borderRadius: '10px',
                            marginLeft: '4px'
                        }}>
                            {items.filter(item => cat.id === 'ALL' || item.doc_type === cat.id).length}
                        </span>
                    </button>
                ))}
            </div>

            {filterTag && (
                <div style={{ 
                    backgroundColor: '#e3f2fd', 
                    color: '#1976d2', 
                    padding: '8px 15px', 
                    borderRadius: '8px', 
                    fontSize: '12px',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span>🏷️ タグで絞り込み中: <strong>#{filterTag}</strong></span>
                    <span onClick={() => setFilterTag(null)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>✕ 解除</span>
                </div>
            )}

            {message && (
                <div style={{ 
                    padding: '8px 12px', 
                    marginBottom: '10px', 
                    backgroundColor: '#e3f2fd', 
                    color: '#0d47a1', 
                    borderRadius: '6px', 
                    fontSize: '12px',
                    borderLeft: '4px solid #2196f3',
                    animation: 'fadeIn 0.3s'
                }}>
                    {message}
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                {isLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>記憶を読み出し中...</div>
                ) : error ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{ color: '#d32f2f', marginBottom: '10px', fontSize: '13px' }}>{error}</div>
                        <button onClick={loadItems} style={{ padding: '6px 20px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>再試行</button>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                        一致する資料はありません
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '2px solid #eee', zIndex: 10 }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '12px 15px' }}>ファイル名 / AI自動タグ</th>
                                <th style={{ textAlign: 'center', padding: '12px 10px', width: '80px' }}>重要度</th>
                                <th style={{ textAlign: 'right', padding: '12px 15px', width: '80px' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid #f0f0f0', transition: 'background 0.2s' }} className="knowledge-row">
                                    <td style={{ padding: '12px 15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <div 
                                                onClick={() => handleOpenFile(item)}
                                                style={{ 
                                                    fontWeight: 'bold', 
                                                    fontSize: '14px', 
                                                    color: '#2196f3', 
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline'
                                                }}
                                                title="エディタで開く"
                                            >
                                                {item.file}
                                            </div>
                                            {item.project && (
                                                <span style={{ fontSize: '10px', backgroundColor: '#f0f0f0', padding: '1px 6px', borderRadius: '4px', color: '#666' }}>
                                                    📁 {item.project}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                            {(item.tags || []).map((tag, i) => (
                                                <span key={i} 
                                                    onClick={() => handleTagClick(tag)}
                                                    style={{ 
                                                        fontSize: '10px', 
                                                        backgroundColor: filterTag === tag ? '#e3f2fd' : '#f5f5f5', 
                                                        color: filterTag === tag ? '#1976d2' : '#555',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        border: filterTag === tag ? '1px solid #2196f3' : '1px solid #ddd',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                    title="このタグで絞り込み"
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                        <div style={{ 
                                            fontSize: '11px', 
                                            color: '#666', 
                                            backgroundColor: '#f9f9f9', 
                                            padding: '6px 10px', 
                                            borderRadius: '6px',
                                            lineHeight: '1.5',
                                            borderLeft: '2px solid #ddd'
                                        }}>
                                            {item.preview}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '12px 10px' }}>
                                        <div style={{ 
                                            fontSize: '11px', 
                                            fontWeight: 'bold',
                                            color: item.importance > 80 ? '#d32f2f' : item.importance > 50 ? '#f57c00' : '#666'
                                        }}>
                                            {item.importance}pts
                                        </div>
                                        <div style={{ fontSize: '9px', color: '#999' }}>{item.chunks} chunks</div>
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '12px 15px' }}>
                                        <button 
                                            onClick={() => handleDelete(item.full_path)}
                                            style={{ background: 'none', border: 'none', color: '#e53935', cursor: 'pointer', fontSize: '18px', opacity: 0.6 }}
                                            title="AIの記憶から消去"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div style={{ marginTop: '15px', fontSize: '11px', color: '#888' }}>
                ※ 削除するとAIはその内容を引用できなくなります。再度同期すると、ファイルが実在する限り再び記憶されます。
            </div>
        </div>
    );
};

export default AIKnowledgeManager;
