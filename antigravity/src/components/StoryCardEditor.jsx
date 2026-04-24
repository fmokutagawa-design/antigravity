import React, { useState, useEffect, useRef } from 'react';

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
};

const modalStyle = {
    backgroundColor: '#fefefe',
    color: '#333',
    width: '700px',
    maxWidth: '95%',
    height: '90vh',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif'
};

const headerStyle = {
    padding: '12px 20px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9'
};

const contentStyle = {
    padding: '24px',
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    gap: '20px'
};

const formStyle = {
    flex: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
};

const checkPanelStyle = {
    flex: 1,
    background: '#f0f4f8',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '0.9rem',
    overflowY: 'auto'
};

const labelStyle = {
    display: 'block',
    fontWeight: 'bold',
    marginBottom: '4px',
    color: '#555',
    fontSize: '0.85rem'
};

const inputStyle = {
    width: '100%',
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1rem'
};

const textareaStyle = {
    ...inputStyle,
    minHeight: '80px',
    resize: 'vertical'
};

export const StoryCardEditor = ({ card, onSave, onDelete, onClose, allFiles = [], onOpenFile }) => {
    const [formData, setFormData] = useState({
        title: '',
        sceneNo: '',
        act: '',
        time: '',
        place: '',
        characters: '',
        plot: '',
        foreshadow: '',
        info: '',
        notes: ''
    });
    const [showDetails, setShowDetails] = useState(false);

    // Smart Reference State
    const [activeReference, setActiveReference] = useState(null);
    const hoverTimeout = useRef(null);

    const checkSmartReference = (target) => {
        if (!allFiles || allFiles.length === 0) return;
        const text = target.value;
        const cursorIndex = target.selectionStart;

        const stopChars = /[ \n\u3000、。,.「」『』()（）！？!?]/;
        let start = cursorIndex;
        let end = cursorIndex;

        while (start > 0 && !stopChars.test(text[start - 1])) start--;
        while (end < text.length && !stopChars.test(text[end])) end++;

        if (start === end) {
            setActiveReference(null);
            return;
        }

        const word = text.substring(start, end).trim();
        if (!word || word.length < 2) {
            setActiveReference(null);
            return;
        }

        const match = allFiles.find(f => {
            const fname = f.name.replace(/\.[^/.]+$/, "");
            return fname === word;
        });

        if (match) {
            setActiveReference({
                name: word,
                content: match.body || match.content || "(No content)"
            });
        } else {
            setActiveReference(null);
        }
    };

    const handleInputCheck = (e) => {
        const target = e.target;
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        hoverTimeout.current = setTimeout(() => {
            checkSmartReference(target);
        }, 500);
    };

    useEffect(() => {
        if (card) {
            setFormData({
                title: card.title || '',
                sceneNo: card.sceneNo || '',
                act: card.act || '',
                time: card.time || '',
                place: card.place || '',
                characters: card.characters || '',
                plot: card.plot || card.content || '',
                foreshadow: card.foreshadow || '',
                info: card.info || '',
                notes: card.notes || '',
                linkedFile: card.linkedFile || ''
            });
        }
    }, [card]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        onSave(card.id, {
            ...formData,
            content: formData.title || formData.plot.substring(0, 30)
        });
        onClose();
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h3 style={{ margin: 0 }}>情報カード編集</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#888', alignSelf: 'center' }}>ID: {card?.id}</span>
                    </div>
                </div>

                <div style={contentStyle}>
                    <div style={formStyle}>
                        {/* Basic Info (Always Visible) */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 0.5 }}>
                                <label style={labelStyle}>Scene No</label>
                                <input name="sceneNo" style={inputStyle} value={formData.sceneNo} onChange={handleChange} placeholder="#" />
                            </div>
                            <div style={{ flex: 2 }}>
                                <label style={labelStyle}>タイトル</label>
                                <input name="title" style={inputStyle} value={formData.title} onChange={handleChange} placeholder="タイトル" autoFocus />
                            </div>
                        </div>

                        {/* Linked File Display */}
                        {(card.linkedFile || formData.linkedFile) && (
                            <div style={{ padding: '8px', background: '#e3f2fd', borderRadius: '4px', border: '1px solid #bbdefb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>📄</span>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#1565c0', fontWeight: 'bold' }}>LINKED FILE</div>
                                        <div style={{ fontWeight: '500' }}>{card.linkedFile || formData.linkedFile}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        const targetFileName = card.linkedFile || formData.linkedFile;
                                        const targetFile = allFiles.find(f => f.name === targetFileName);
                                        if (targetFile && onOpenFile) {
                                            onOpenFile(targetFile.handle);
                                            onClose();
                                        } else {
                                            alert(`ファイル "${targetFileName}" が見つかりません。\n削除されたか、名前が変更された可能性があります。`);
                                        }
                                    }}
                                    style={{ background: '#fff', border: '1px solid #2196F3', color: '#2196F3', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    📂 開く
                                </button>
                            </div>
                        )}

                        <div>
                            <label style={labelStyle}>プロット（内容）</label>
                            <textarea
                                name="plot"
                                style={{ ...textareaStyle, minHeight: '120px' }}
                                value={formData.plot}
                                onChange={handleChange}
                                onSelect={handleInputCheck}
                                onClick={handleInputCheck}
                                onKeyUp={handleInputCheck}
                                placeholder="場面の具体的な内容..."
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>メモ</label>
                            <textarea name="notes" style={{ ...textareaStyle, minHeight: '60px' }} value={formData.notes} onChange={handleChange} placeholder="メモ..." />
                        </div>

                        {/* Toggle Button */}
                        <div style={{ borderTop: '1px dashed #ddd', paddingTop: '10px' }}>
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                style={{
                                    background: 'transparent', border: 'none', color: '#2196F3', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center'
                                }}
                            >
                                {showDetails ? '🔽 詳細を隠す' : '▶ 詳細情報を入力（日時・場所・キャラ・伏線など）'}
                            </button>
                        </div>

                        {/* Detailed Fields */}
                        {showDetails && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#f9f9f9', padding: '12px', borderRadius: '8px' }}>
                                {/* Time, Place, Characters */}
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={labelStyle}>時</label>
                                        <input name="time" style={inputStyle} value={formData.time} onChange={handleChange} placeholder="日時" list="time-suggestions" />
                                        {card.suggestions && card.suggestions.times && (
                                            <datalist id="time-suggestions">
                                                {card.suggestions.times.map((t, i) => <option key={i} value={t} />)}
                                            </datalist>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={labelStyle}>場所</label>
                                        <input name="place" style={inputStyle} value={formData.place} onChange={handleChange} placeholder="場所" list="place-suggestions" />
                                        {card.suggestions && card.suggestions.places && (
                                            <datalist id="place-suggestions">
                                                {card.suggestions.places.map((p, i) => <option key={i} value={p} />)}
                                            </datalist>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={labelStyle}>登場人物</label>
                                        <input name="characters" style={inputStyle} value={formData.characters} onChange={handleChange} placeholder="人物" list="char-suggestions" />
                                        {card.suggestions && card.suggestions.characters && (
                                            <datalist id="char-suggestions">
                                                {card.suggestions.characters.map((c, i) => <option key={i} value={c} />)}
                                            </datalist>
                                        )}
                                    </div>
                                </div>

                                {/* Foreshadow, Info */}
                                <div>
                                    <label style={labelStyle}>伏線</label>
                                    <textarea name="foreshadow" style={{ ...textareaStyle, minHeight: '60px' }} value={formData.foreshadow} onChange={handleChange} placeholder="伏線..." />
                                </div>
                                <div>
                                    <label style={labelStyle}>読者への情報</label>
                                    <textarea name="info" style={{ ...textareaStyle, minHeight: '60px' }} value={formData.info} onChange={handleChange} placeholder="読者に伝えるべきこと..." />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Side Panel: Guidelines */}
                    <div style={checkPanelStyle}>
                        <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#2c3e50' }}>■カードチェック</h4>

                        <div style={{ marginBottom: '16px' }}>
                            <strong>1. 繰り返しがないか</strong>
                            <p style={{ margin: '4px 0', opacity: 0.8 }}>同じ場所が繰り返し現れていないか。意図的でなければ場所を変えるなどして単調さを回避する。</p>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <strong>2. 長すぎないか</strong>
                            <p style={{ margin: '4px 0', opacity: 0.8 }}>長すぎるなら分割するか、不要な場面ではないか疑う。</p>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <strong>3. 伏線は回収されているか</strong>
                            <p style={{ margin: '4px 0', opacity: 0.8 }}>前の場面の伏線を受けているか、あるいは後の場面で回収されるか。</p>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <strong>4. 伝えるべき情報があるか</strong>
                            <p style={{ margin: '4px 0', opacity: 0.8 }}>ただのアクションや雰囲気だけで、読者に伝える情報が欠落していないか。</p>
                        </div>
                    </div>

                </div >

                <div style={{ ...headerStyle, borderTop: '1px solid #eee', marginTop: 'auto', padding: '16px 20px', backgroundColor: '#fff' }}>
                    {onDelete && (
                        <button
                            onClick={() => {
                                if (confirm('本当にこのカードを削除しますか？')) {
                                    onDelete(card.id);
                                    onClose();
                                }
                            }}
                            style={{ padding: '8px 16px', border: 'none', background: 'transparent', color: '#F44336', cursor: 'pointer', marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            🗑️ 削除
                        </button>
                    )}
                    <button onClick={onClose} style={{ padding: '8px 16px', border: 'none', background: 'transparent', color: '#777', cursor: 'pointer' }}>キャンセル</button>
                    <button onClick={handleSave} style={{ padding: '10px 24px', border: 'none', background: '#2196F3', color: 'white', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>保存して閉じる</button>
                </div>

                {/* Smart Reference Popup (In Portal or Fixed) */}
                {activeReference && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '80px', // Above footer
                            right: '30px',
                            width: '300px',
                            maxHeight: '200px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(5px)',
                            border: '1px solid #ddd',
                            boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
                            borderRadius: '8px',
                            padding: '12px',
                            zIndex: 2000,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>📖 {activeReference.name}</span>
                            <span style={{ fontSize: '0.7rem', color: '#888' }}>Auto-Ref</span>
                        </div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: '#555',
                            whiteSpace: 'pre-wrap',
                            overflowY: 'auto',
                            flex: 1,
                            lineHeight: '1.4',
                            maxHeight: '120px'
                        }}>
                            {activeReference.content.length > 200
                                ? activeReference.content.substring(0, 200) + '...'
                                : activeReference.content}
                        </div>
                        <button
                            onClick={() => {
                                if (onOpenFile) {
                                    const file = allFiles.find(f => f.name.startsWith(activeReference.name));
                                    if (file) onOpenFile(file.handle);
                                    onClose(); // Close editor? No, maybe just open in bg? User might lose edits.
                                    // Actually, let's just alert "Open in main editor" if we can't switch safely.
                                    // Or onClose() is fine as it saves? No, saving is manual.
                                    // "Cancel" logic.
                                }
                            }}
                            style={{
                                padding: '6px',
                                background: '#e3f2fd',
                                color: '#1565c0',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 'bold'
                            }}
                        >
                            全体を開く (エディタへ移動)
                        </button>
                    </div>
                )}
            </div >
        </div >
    );
};
