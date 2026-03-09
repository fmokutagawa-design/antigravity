import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { serializeNote } from '../utils/metadataParser';

const CARD_TYPES = [
    '登場人物',
    '場所',
    'アイテム',
    'イベント',
    '組織',
    '用語',
    'その他'
];

const CardCreator = ({ isOpen, onClose, onSave, initialType = '登場人物', initialDescription = '' }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState(initialType);
    const [tags, setTags] = useState('');
    const [summary, setSummary] = useState(initialDescription);

    React.useEffect(() => {
        if (isOpen) {
            setType(initialType);
            if (initialDescription) {
                setSummary(initialDescription);
            }
        }
    }, [isOpen, initialType, initialDescription]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!name.trim()) {
            alert('カードの名前を入力してください');
            return;
        }

        const tagList = tags.split(/[,、]/).map(t => t.trim()).filter(Boolean);

        const metadata = {
            種別: type,
            tags: tagList,
            ...(summary ? { あらすじ: summary } : {})
        };

        const content = serializeNote('', metadata);
        // Filename: name + .txt (or .md? let's default to .txt for now as per system)
        const filename = `${name}.txt`;

        onSave(filename, content);

        // Reset and close
        setName('');
        setType('登場人物');
        setTags('');
        setSummary('');
        onClose();
    };

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
        }} onClick={onClose}>
            <div style={{
                backgroundColor: 'var(--bg-paper, #fff)',
                color: 'var(--text-main, #333)',
                padding: '24px',
                borderRadius: '8px',
                width: '400px',
                maxWidth: '90%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }} onClick={e => e.stopPropagation()}>

                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', borderBottom: '1px solid var(--border-color, #eee)', paddingBottom: '10px' }}>
                    🃏 新規カード作成
                </h3>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>名前 <span style={{ color: 'red' }}>*</span></label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="例: 主人公, 魔法の剣"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        autoFocus
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>種別</label>
                    <select
                        value={type}
                        onChange={e => setType(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                        {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>タグ (カンマ区切り)</label>
                    <input
                        type="text"
                        value={tags}
                        onChange={e => setTags(e.target.value)}
                        placeholder="例: 重要, 第1章"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>あらすじ / 概要</label>
                    <textarea
                        value={summary}
                        onChange={e => setSummary(e.target.value)}
                        placeholder="簡潔な説明を入力..."
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '80px', fontFamily: 'inherit' }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            background: 'transparent',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: '8px 16px',
                            background: 'var(--accent-color, #1976d2)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        作成する
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
};

export default CardCreator;
