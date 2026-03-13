import React, { useState } from 'react';

// Reuseable Toggle Switch Component for consistency
const Toggle = ({ active, onClick, label }) => (
    <div className="control-item" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ margin: 0, fontSize: '11px' }}>{label}</label>
        <div
            className={`toggle-switch ${active ? 'active' : ''}`}
            onClick={onClick}
            style={{
                width: '30px', height: '16px', background: active ? '#8e44ad' : '#ccc',
                borderRadius: '8px', cursor: 'pointer', position: 'relative', transition: 'background 0.2s'
            }}
        >
            <div style={{
                position: 'absolute', top: '2px', left: active ? '16px' : '2px',
                width: '12px', height: '12px', borderRadius: '50%', background: 'white', transition: 'left 0.2s'
            }} />
        </div>
    </div>
);

const Toolbar = ({
    settings, setSettings, presets = [], onSavePreset, onLoadPreset, onDeletePreset,
    isDarkMode, setIsDarkMode, showMetadata, setShowMetadata, showOutline, onToggleOutline, onFormat,
    // AI Props
    aiModel, setAiModel, localModels = [], selectedLocalModel, setSelectedLocalModel, isLocalConnected, checkLocalConnection,
    // Export
    onBatchExport, onEpubExport, onDocxExport, onPrint
}) => {

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const [showTextMenu, setShowTextMenu] = useState(false);

    return (
        <div className="settings-panel" style={{ overflowX: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 1. 環境・表示切替 */}
            <div className="toolbar-section">
                <div className="section-title">環境・表示</div>
                <div className="control-grid">
                    <Toggle active={showOutline} onClick={onToggleOutline} label="アウトライン" />
                    <Toggle active={showMetadata} onClick={() => setShowMetadata(!showMetadata)} label="メタ表示" />
                    <Toggle active={settings.showLogo !== false} onClick={() => handleChange('showLogo', settings.showLogo === false)} label="ロゴ表示" />
                    <div className="control-item">
                        <label>UIスケール</label>
                        <select
                            value={settings.uiScale || 100}
                            onChange={(e) => handleChange('uiScale', Number(e.target.value))}
                            style={{ width: '70px' }}
                        >
                            <option value={80}>80%</option>
                            <option value={85}>85%</option>
                            <option value={90}>90%</option>
                            <option value={95}>95%</option>
                            <option value={100}>100%</option>
                            <option value={110}>110%</option>
                            <option value={120}>120%</option>
                        </select>
                    </div>
                    <div className="control-item">
                        <label>テーマ</label>
                        <select
                            value={settings.colorTheme || (isDarkMode ? 'dark' : 'light')}
                            onChange={(e) => {
                                handleChange('colorTheme', e.target.value);
                                setIsDarkMode(e.target.value === 'dark' || e.target.value === 'blackboard');
                            }}
                            style={{ height: '22px', fontSize: '10px' }}
                        >
                            <option value="light">ライト</option>
                            <option value="sakura">サクラ</option>
                            <option value="dark">ダーク</option>
                            <option value="blackboard">黒板</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 2. 原稿・グリッド設定 (Editor + Output に影響) */}
            <div className="toolbar-section">
                <div className="section-title">原稿・グリッド</div>
                <div className="control-grid">
                    <div className="control-item">
                        <label>用紙</label>
                        <select value={settings.paperStyle || 'plain'} onChange={(e) => handleChange('paperStyle', e.target.value)}>
                            <option value="plain">無地</option>
                            <option value="grid">原稿用紙</option>
                            <option value="lined">ノート</option>
                            <option value="clean">クリーン</option>
                        </select>
                    </div>
                    <div className="control-item">
                        <label>向き</label>
                        <select value={settings.orientation || 'portrait'} onChange={(e) => handleChange('orientation', e.target.value)}>
                            <option value="portrait">タテ</option>
                            <option value="landscape">ヨコ</option>
                        </select>
                    </div>
                    <div className="control-item">
                        <label>1行文字数</label>
                        <input type="number" value={settings.charsPerLine || 0} onChange={(e) => handleChange('charsPerLine', Number(e.target.value))} />
                    </div>
                    <div className="control-item">
                        <label>ページ行数</label>
                        <input type="number" value={settings.linesPerPage || 0} onChange={(e) => handleChange('linesPerPage', Number(e.target.value))} />
                    </div>
                    <div className="control-item span-full" style={{ borderTop: '1px solid #eee', paddingTop: '6px', marginTop: '2px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '4px' }}>
                        <Toggle active={settings.showGrid !== false} onClick={() => handleChange('showGrid', settings.showGrid === false)} label="枠線" />
                        <Toggle active={settings.showLineNumbers !== false} onClick={() => handleChange('showLineNumbers', settings.showLineNumbers === false)} label="行番号" />
                        <Toggle active={settings.strictManuscriptMode || false} onClick={() => handleChange('strictManuscriptMode', !settings.strictManuscriptMode)} label="厳密マス" />
                    </div>
                </div>
            </div>

            {/* 3. 執筆・書式設定 */}
            <div className="toolbar-section">
                <div className="section-title">執筆・配色</div>
                <div className="control-grid">
                    <div className="control-item">
                        <label>字寸(px)</label>
                        <input type="number" value={settings.fontSize} onChange={(e) => handleChange('fontSize', Number(e.target.value))} />
                    </div>
                    <div className="control-item">
                        <label>行間</label>
                        <input type="number" value={settings.lineHeight || 1.65} onChange={(e) => handleChange('lineHeight', Number(e.target.value))} step="0.01" />
                    </div>
                    {settings.paperStyle !== 'grid' && settings.paperStyle !== 'clean' && (
                        <div className="control-item">
                            <label>字間</label>
                            <input type="number" value={settings.charSpacing || 1.4} onChange={(e) => handleChange('charSpacing', Number(e.target.value))} step="0.05" min="1.0" max="1.65" />
                        </div>
                    )}
                    <div className="control-item">
                        <label>書向</label>
                        <select value={settings.isVertical ? 'vertical' : 'horizontal'} onChange={(e) => handleChange('isVertical', e.target.value === 'vertical')}>
                            <option value="vertical">縦書</option>
                            <option value="horizontal">横書</option>
                        </select>
                    </div>
                    <div className="control-item">
                        <label>書体</label>
                        <input 
                            type="text" 
                            list="font-list" 
                            value={settings.fontFamily || 'var(--font-mincho)'} 
                            onChange={(e) => handleChange('fontFamily', e.target.value)} 
                            style={{ fontSize: '10px', width: '100%', padding: '4px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', background: 'rgba(0,0,0,0.02)' }} 
                            placeholder="リストから選ぶか入力..."
                            title="PC内のフォント名を直接入力することも可能です"
                        />
                        <datalist id="font-list">
                            <option value="var(--font-mincho)">明朝 (標準)</option>
                            <option value="var(--font-gothic)">ゴシック (標準)</option>
                            <option value="'Hiragino Mincho ProN', 'Hiragino Mincho Pro', 'ヒラギノ明朝 ProN', 'ヒラギノ明朝 Pro', serif">ヒラギノ明朝</option>
                            <option value="'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'ヒラギノ角ゴ ProN', sans-serif">ヒラギノ角ゴ (見やすいゴシック)</option>
                            <option value="'FOT-筑紫Aオールド明朝 Pr6N', 'FOT-筑紫Aオールド明朝 Pr6', 'Tsukushi A Old Mincho', '筑紫Aオールド明朝', '筑紫Aオールド明朝 Pr6N', serif">筑紫Aオールド明朝</option>
                            <option value="'FOT-筑紫Bオールド明朝 Pr6N', 'FOT-筑紫Bオールド明朝 Pr6', 'Tsukushi B Old Mincho', '筑紫Bオールド明朝', '筑紫Bオールド明朝 Pr6N', serif">筑紫Bオールド明朝</option>
                            <option value="'FOT-筑紫Cオールド明朝 Pr6N', 'FOT-筑紫Cオールド明朝 Pr6', 'Tsukushi C Old Mincho', '筑紫Cオールド明朝', '筑紫Cオールド明朝 Pr6N', serif">筑紫Cオールド明朝</option>
                            <option value="'Meiryo', sans-serif">メイリオ</option>
                            <option value="'BIZ UDGothic', 'BIZ UDゴシック', sans-serif">BIZ UDゴシック (見やすい・太字)</option>
                            <option value="'A-OTF A1ゴシック Std', 'A-OTF A1ゴシック StdN', 'A1ゴシック', sans-serif">A1ゴシック (見やすい太字)</option>
                            <option value="var(--font-hand)">紅道 (手書き風)</option>
                            <option value="'Klee One', cursive">クレー</option>
                            <option value="'A-OTF 黎ミン Pr6N', 'A-OTF 黎ミン Pro', '黎ミン', serif">モリサワ 黎ミン</option>
                            <option value="'A P-OTF 秀英にじみ明朝 StdN', 'A P-OTF 秀英にじみ明朝 Std', '秀英にじみ明朝', serif">秀英にじみ明朝</option>
                            <option value="'02うつくし明朝体', 'うつくし明朝体', serif">うつくし明朝体</option>
                            <option value="'A-OTF 毎日新聞明朝 Pro', '毎日新聞明朝', serif">毎日新聞明朝</option>
                            <option value="'A-OTF A1明朝 Std', 'A1明朝', serif">A1明朝</option>
                            <option value="'BIZ UDMincho', serif">BIZ UD明朝</option>
                            <option value="'Kiwi Maru', serif">キウイ丸</option>
                            <option value="'Zen Old Mincho', serif">Zenオールド明朝</option>
                            <option value="'Hina Mincho', serif">ひな明朝</option>
                            <option value="'Kaisei Opti', serif">解星オプティ</option>
                            <option value="'Kaisei Tokumin', serif">解星特ミン</option>
                            <option value="'YuMincho', 'Yu Mincho', serif">游明朝 (標準)</option>
                            <option value="'YuMincho-Demibold', 'YuMincho-Bold', 'Yu Mincho Demibold', '游明朝体', serif">游明朝 Demibold (太字)</option>
                            <option value="'YuGothic-Bold', 'Yu Gothic Bold', 'Yu Gothic', sans-serif">游ゴシック Bold (太字)</option>
                            <option value="'RyuminPr6N-Ultra', 'RyuminPr6N-Heavy', 'A-OTF Ryumin Pr6N', serif">リュウミン 極太</option>
                            <option value="'GothicMB101Pr6N-Ultra', 'A-OTF Gothic MB101 Pr6N', sans-serif">ゴシックMB101 極太</option>
                            <option value="'ToppanBunkyuMidashiMincho-ExtraBold', 'AP-OTF Bunkyu MdMin StdN', serif">凸版文久見出し明朝</option>
                            <option value="'FOT-UDMinchoPr6N-B', 'FOT-UDMinchoPro-B', 'UD明朝', serif">UD明朝 Bold</option>
                            <option value="'SoukouMincho', '装甲明朝', serif">装甲明朝 (極太)</option>
                            <option value="'GenkaiMincho', '源界明朝', serif">源界明朝</option>
                            <option value="'EVA-Matisse_Classic', 'EVA-Matisse Classic', 'EVA明朝', serif">エヴァ明朝 (EVA-Matisse Classic)</option>
                            <option value="'FOT-MatissePro-EB', 'FOT-マティス Pro EB', 'Matisse Pro', serif">マティス Pro EB (極太)</option>
                            <option value="'FOT-MatissePro-UB', 'FOT-マティス Pro UB', 'Matisse Pro', serif">マティス Pro UB (超特太)</option>
                            <option value="'Yuji Syuku', serif">Yuji Syuku (游築・手書き風)</option>
                        </datalist>
                    </div>
                </div>

                {/* 3列カラーグリッド */}
                {/* 5 列カラーグリッド + Toggle */}
                <div className="control-grid color-grid" style={{ marginTop: '8px', borderTop: '1px dotted #eee', paddingTop: '8px' }}>
                    <div className="control-item color-item">
                        <label>ルビ</label>
                        <input type="color" value={settings.syntaxColors?.ruby || '#3498db'} onChange={(e) => setSettings(prev => ({ ...prev, syntaxColors: { ...prev.syntaxColors, ruby: e.target.value } }))} />
                    </div>
                    <div className="control-item color-item">
                        <label>リンク</label>
                        <input type="color" value={settings.syntaxColors?.link || '#2980b9'} onChange={(e) => setSettings(prev => ({ ...prev, syntaxColors: { ...prev.syntaxColors, link: e.target.value } }))} />
                    </div>
                    <div className="control-item color-item">
                        <label>強調</label>
                        <input type="color" value={settings.syntaxColors?.emphasis || '#c0392b'} onChange={(e) => setSettings(prev => ({ ...prev, syntaxColors: { ...prev.syntaxColors, emphasis: e.target.value } }))} />
                    </div>
                    <div className="control-item color-item">
                        <label>会話</label>
                        <input type="color" value={settings.syntaxColors?.conversation || '#e8f6f3'} onChange={(e) => setSettings(prev => ({ ...prev, syntaxColors: { ...prev.syntaxColors, conversation: e.target.value } }))} />
                    </div>
                    <div className="control-item color-item">
                        <label>注釈</label>
                        <input type="color" value={settings.syntaxColors?.aozora || '#27ae60'} onChange={(e) => setSettings(prev => ({ ...prev, syntaxColors: { ...prev.syntaxColors, aozora: e.target.value } }))} />
                    </div>
                </div>
                <div style={{ marginTop: '2px', padding: '0 4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Toggle active={settings.editorSyntaxColors !== false} onClick={() => handleChange('editorSyntaxColors', settings.editorSyntaxColors === false)} label="エディタ着色" />
                    <Toggle active={settings.previewSyntaxColors || false} onClick={() => handleChange('previewSyntaxColors', !settings.previewSyntaxColors)} label="プレビュー着色" />
                </div>
            </div>

            {/* AI / Model Settings */}
            <div className="toolbar-section">
                <div className="section-title">AI / Model</div>
                <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                    {/* Model Type Selector */}
                    <div style={{ display: 'flex', background: '#ecf0f1', borderRadius: '4px', padding: '2px' }}>
                        <button
                            onClick={() => setAiModel('local')}
                            style={{
                                flex: 1, border: 'none', background: aiModel === 'local' ? '#fff' : 'transparent',
                                color: aiModel === 'local' ? '#2c3e50' : '#7f8c8d',
                                borderRadius: '3px', padding: '4px', fontSize: '10px', cursor: 'pointer',
                                boxShadow: aiModel === 'local' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                fontWeight: aiModel === 'local' ? 'bold' : 'normal'
                            }}
                        >
                            Local (Ollama)
                        </button>
                        <button
                            onClick={() => setAiModel('chatgpt')}
                            style={{
                                flex: 1, border: 'none', background: aiModel !== 'local' ? '#fff' : 'transparent', // 'chatgpt' or 'gemini' treated as Cloud
                                color: aiModel !== 'local' ? '#2c3e50' : '#7f8c8d',
                                borderRadius: '3px', padding: '4px', fontSize: '10px', cursor: 'pointer',
                                boxShadow: aiModel !== 'local' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                fontWeight: aiModel !== 'local' ? 'bold' : 'normal'
                            }}
                        >
                            Cloud
                        </button>
                    </div>

                    {/* Local AI Controls */}
                    {aiModel === 'local' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f9f9f9', padding: '6px', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                                    <span style={{ color: isLocalConnected ? '#2ecc71' : '#e74c3c' }}>●</span>
                                    {isLocalConnected ? 'Connected' : 'Disconnected'}
                                </div>
                                <button
                                    onClick={checkLocalConnection}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                                    title="再接続"
                                >
                                    🔄
                                </button>
                            </div>

                            {isLocalConnected && (
                                <select
                                    value={selectedLocalModel}
                                    onChange={(e) => setSelectedLocalModel(e.target.value)}
                                    style={{ width: '100%', fontSize: '10px', padding: '2px' }}
                                >
                                    {localModels.map(m => {
                                        const name = typeof m === 'string' ? m : m.name || m.model;
                                        return <option key={name} value={name}>{name}</option>;
                                    })}
                                    {localModels.length === 0 && <option value="">No models found</option>}
                                </select>
                            )}
                            {!isLocalConnected && <div style={{ fontSize: '9px', color: '#e74c3c' }}>Ollamaを起動してください</div>}

                            <div style={{ marginTop: '4px', borderTop: '1px dotted #ddd', paddingTop: '4px' }}>
                                <Toggle
                                    active={settings.enableGhostText !== false}
                                    onClick={() => handleChange('enableGhostText', settings.enableGhostText === false)}
                                    label="ゴーストテキスト (自動補完)"
                                />
                                <Toggle
                                    active={settings.enableSelectionAI || false}
                                    onClick={() => handleChange('enableSelectionAI', !settings.enableSelectionAI)}
                                    label="選択ツールバーにAI項目"
                                />
                            </div>
                        </div>
                    )}

                    {/* Cloud AI Controls */}
                    {aiModel !== 'local' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f9f9f9', padding: '6px', borderRadius: '4px' }}>
                            <div style={{ fontSize: '10px', color: '#7f8c8d', marginBottom: '2px' }}>Provider</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        checked={aiModel === 'chatgpt'}
                                        onChange={() => setAiModel('chatgpt')}
                                    />
                                    ChatGPT
                                </label>
                                <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        checked={aiModel === 'gemini'}
                                        onChange={() => setAiModel('gemini')}
                                    />
                                    Gemini
                                </label>
                                <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        checked={aiModel === 'claude'}
                                        onChange={() => setAiModel('claude')}
                                    />
                                    Claude
                                </label>
                                <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        checked={aiModel === 'genspark'}
                                        onChange={() => setAiModel('genspark')}
                                    />
                                    Genspark
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. ツール・出力 */}
            <div className="toolbar-section">
                <div className="section-title">ツール・出力</div>
                <div className="control-grid">
                    <div
                        className="span-full"
                        onClick={() => setShowTextMenu(!showTextMenu)}
                        style={{
                            padding: '4px',
                            fontSize: '11px',
                            position: 'relative',
                            background: settings.colorTheme === 'dark' ? '#2c3e50' : '#f8f9fa',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            userSelect: 'none',
                            color: settings.colorTheme === 'dark' ? '#eee' : '#555',
                            fontWeight: '600'
                        }}
                    >
                        Aa 文字整形
                        {showTextMenu && (
                            <div className="dropdown-menu" style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 0,
                                right: 0,
                                background: settings.colorTheme === 'dark' ? '#34495e' : 'white',
                                border: '1px solid var(--border-color)',
                                padding: '2px',
                                zIndex: 1100,
                                boxShadow: '0 -2px 8px rgba(0,0,0,0.15)',
                                borderRadius: '4px'
                            }}>
                                <button onClick={(e) => { e.stopPropagation(); onFormat('fullwidth'); setShowTextMenu(false); }} style={{ display: 'block', width: '100%', padding: '4px', textAlign: 'left', fontSize: '10px', background: 'none', border: 'none', cursor: 'pointer', color: settings.colorTheme === 'dark' ? '#fff' : '#333' }}>全角化</button>
                                <button onClick={(e) => { e.stopPropagation(); onFormat('quotes'); setShowTextMenu(false); }} style={{ display: 'block', width: '100%', padding: '4px', textAlign: 'left', fontSize: '10px', background: 'none', border: 'none', cursor: 'pointer', color: settings.colorTheme === 'dark' ? '#fff' : '#333' }}>引用符『』</button>
                                <button onClick={(e) => { e.stopPropagation(); onFormat('markdown'); setShowTextMenu(false); }} style={{ display: 'block', width: '100%', padding: '4px', textAlign: 'left', fontSize: '10px', background: 'none', border: 'none', cursor: 'pointer', color: settings.colorTheme === 'dark' ? '#fff' : '#333' }}>MD→『』</button>
                            </div>
                        )}
                    </div>
                    <button onClick={onPrint ? onPrint : () => window.print()} className="span-full" style={{ padding: '4px', fontSize: '11px' }}>🖨️ PDF/印刷</button>
                    {onEpubExport && (
                        <button onClick={onEpubExport} className="span-full" style={{ padding: '4px', fontSize: '11px', marginTop: '4px' }}>📚 EPUB書き出し</button>
                    )}
                    {onDocxExport && (
                        <button onClick={onDocxExport} className="span-full" style={{ padding: '4px', fontSize: '11px', marginTop: '4px' }}>📄 Word書き出し</button>
                    )}

                    <div className="span-full" style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
                        <select id="preset-load-select" onChange={(e) => e.target.value && onLoadPreset(e.target.value)} style={{ flex: 1, height: '22px', fontSize: '10px' }}>
                            <option value="">読込...</option>
                            {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button onClick={() => onSavePreset()} style={{ width: '22px', height: '22px', padding: 0 }} title="現在の設定を保存">+</button>
                        <button
                            onClick={() => {
                                const sel = document.getElementById('preset-load-select');
                                if (sel && sel.value) {
                                    if (window.confirm('このプリセットを削除しますか？')) onDeletePreset(sel.value);
                                }
                            }}
                            style={{ width: '22px', height: '22px', padding: 0, color: '#e74c3c' }}
                            title="選択中のプリセットを削除"
                        >
                            ×
                        </button>
                    </div>
                    {onBatchExport && (
                        <button onClick={onBatchExport} className="span-full" style={{ padding: '4px', fontSize: '11px', marginTop: '4px' }}>📦 一括書き出し</button>
                    )}
                    <div className="span-full" style={{ marginTop: '6px' }}>
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>カスタムCSS</div>
                        <textarea
                            value={settings.customCSS || ''}
                            onChange={(e) => handleChange('customCSS', e.target.value)}
                            placeholder=".native-grid-editor { background: ... }"
                            style={{
                                width: '100%',
                                height: '60px',
                                fontSize: '10px',
                                fontFamily: 'monospace',
                                resize: 'vertical',
                                background: settings.colorTheme === 'dark' ? '#1a1a2e' : '#fafafa',
                                color: settings.colorTheme === 'dark' ? '#ccc' : '#333',
                                border: '1px solid var(--border-color)',
                                borderRadius: '3px',
                                padding: '4px',
                            }}
                        />
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Toolbar;
