import React, { useState, useEffect } from 'react';
import { ollamaService } from '../utils/ollamaService';

const AIKnowledgeManager = () => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [message, setMessage] = useState('');

    const loadItems = async () => {
        setIsLoading(true);
        const data = await ollamaService.listDBItems();
        setItems(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadItems();
    }, []);

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

    const handleAddTag = async (item) => {
        const newTag = window.prompt('追加するタグを入力してください (例: 設定資料, プロット, ボツ案)');
        if (newTag) {
            const updatedTags = [...(item.tags || []), newTag];
            const success = await ollamaService.updateDBItemTags(item.full_path, updatedTags);
            if (success) loadItems();
        }
    };

    const handleRemoveTag = async (item, tagToRemove) => {
        const updatedTags = (item.tags || []).filter(t => t !== tagToRemove);
        const success = await ollamaService.updateDBItemTags(item.full_path, updatedTags);
        if (success) loadItems();
    };

    const handleSuggestTags = async (item) => {
        setMessage(`AIが「${item.file}」の内容を分析中...`);
        const suggested = await ollamaService.suggestTags(item.full_path, item.preview);
        if (suggested && suggested.length > 0) {
            if (window.confirm(`AIが以下のタグを提案しました。追加しますか？\n${suggested.join(', ')}`)) {
                const updatedTags = Array.from(new Set([...(item.tags || []), ...suggested]));
                const success = await ollamaService.updateDBItemTags(item.full_path, updatedTags);
                if (success) {
                    setMessage('AIタグを適用しました');
                    loadItems();
                }
            } else {
                setMessage('');
            }
        } else {
            setMessage('AIによる提案に失敗しました。Ollamaが起動しているか確認してください。');
        }
    };

    const isKnowledgeWindow = new URLSearchParams(window.location.search).get('mode') === 'knowledge';

    const handlePopOut = () => {
        if (window.api && window.api.invoke) {
            window.api.invoke('window:openKnowledge');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>AI 知識ベース管理</h3>
                    {!isKnowledgeWindow && (
                        <button 
                            onClick={handlePopOut}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '4px', opacity: 0.6 }}
                            title="別ウィンドウで開く"
                        >
                            ❐
                        </button>
                    )}
                </div>
                <button 
                    onClick={handleSync} 
                    disabled={isSyncing}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: isSyncing ? '#ccc' : 'var(--accent-color, #2196f3)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isSyncing ? 'default' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}
                >
                    {isSyncing ? '同期中...' : '今すぐ同期 (再読込)'}
                </button>
            </div>

            {message && (
                <div style={{ 
                    padding: '8px', 
                    marginBottom: '10px', 
                    backgroundColor: '#e3f2fd', 
                    color: '#0d47a1', 
                    borderRadius: '4px', 
                    fontSize: '12px' 
                }}>
                    {message}
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px', backgroundColor: '#fff' }}>
                {isLoading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>読み込み中...</div>
                ) : items.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>データが登録されていません</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '10px' }}>ファイル名 / タグ</th>
                                <th style={{ textAlign: 'center', padding: '10px', width: '60px' }}>断片数</th>
                                <th style={{ textAlign: 'right', padding: '10px', width: '80px' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '8px 10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#333' }}>{item.file}</div>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {(item.tags || []).map((tag, i) => (
                                                    <span key={i} style={{ 
                                                        fontSize: '10px', 
                                                        backgroundColor: tag === 'ボツ' || tag === 'ボツ案' ? '#ffebee' : '#e8f5e9', 
                                                        color: tag === 'ボツ' || tag === 'ボツ案' ? '#c62828' : '#2e7d32',
                                                        padding: '1px 6px',
                                                        borderRadius: '10px',
                                                        border: '1px solid currentColor',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        {tag}
                                                        <span onClick={() => handleRemoveTag(item, tag)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>×</span>
                                                    </span>
                                                ))}
                                                <button onClick={() => handleAddTag(item)} style={{ border: '1px dashed #ccc', background: 'none', borderRadius: '10px', fontSize: '10px', padding: '0 6px', cursor: 'pointer', color: '#888' }}>＋タグ</button>
                                                <button onClick={() => handleSuggestTags(item)} style={{ border: '1px solid #ddd', background: '#fff', borderRadius: '10px', fontSize: '10px', padding: '0 6px', cursor: 'pointer' }} title="AIにタグを提案させる">🪄 AI提案</button>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '6px', wordBreak: 'break-all' }}>{item.path}</div>
                                        <div style={{ 
                                            fontSize: '11px', 
                                            color: '#666', 
                                            backgroundColor: '#f9f9f9', 
                                            padding: '4px 8px', 
                                            borderRadius: '4px',
                                            borderLeft: '3px solid #ddd',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            lineHeight: '1.4'
                                        }}>
                                            {item.preview}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '8px 10px', color: '#666' }}>{item.chunks}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px' }}>
                                        <button 
                                            onClick={() => handleDelete(item.full_path)}
                                            style={{ background: 'none', border: 'none', color: '#e53935', cursor: 'pointer', fontSize: '16px' }}
                                            title="この記憶を消去"
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
