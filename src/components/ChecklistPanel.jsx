import React, { useState, useEffect } from 'react';
import './ChecklistPanel.css';

const ChecklistPanel = ({ allFiles, currentWork, activeFileContent, onUpdateFile, onCreateFile, onNavigate, onInsert, onAddToBoard }) => {
    const [activeTab, setActiveTab] = useState('foreshadowing'); // 'foreshadowing' or 'plot'
    const [items, setItems] = useState([]);
    const [targetFile, setTargetFile] = useState(null);
    const [filterTag, setFilterTag] = useState(null); // Auto-detected from active file
    const [manualFilter, setManualFilter] = useState(null); // User clicked tag

    const [selectedWork, setSelectedWork] = useState(currentWork || '');
    const [availableWorks, setAvailableWorks] = useState([]);

    // Update selectedWork when currentWork prop changes
    // Only if selectedWork is not set, to avoid overriding user manual selection
    useEffect(() => {
        if (currentWork && !selectedWork) setSelectedWork(currentWork);
    }, [currentWork, selectedWork]);

    // Detect all available works from files
    useEffect(() => {
        if (!allFiles || !Array.isArray(allFiles)) return;
        const works = new Set();
        allFiles.forEach(f => {
            if (!f.name) return;
            // Matches: [WorkName]_伏線管理シート.txt OR [WorkName]_プロット進捗シート.txt
            // WorkName can contain anything including #, spaces, etc.
            const match = f.name.match(/^(.+)_(伏線管理シート|プロット進捗シート)\.txt$/);
            if (match) {
                works.add(match[1]);
            }
        });
        setAvailableWorks(Array.from(works));
    }, [allFiles]);

    // Identify Target Files based on Selected Work (Priority) or Current Work
    useEffect(() => {
        if (!allFiles || !Array.isArray(allFiles)) return;
        const suffix = activeTab === 'foreshadowing' ? '伏線管理シート.txt' : 'プロット進捗シート.txt';

        // Find file for selected work
        let found = null;
        if (selectedWork) {
            found = allFiles.find(f => f.name && f.name === `${selectedWork}_${suffix}`);
        }

        // Fallback: search for generic or matching currentWork if selectedWork is empty
        if (!found) {
            found = allFiles.find(f =>
                f.name && (f.name === suffix ||
                    (currentWork && f.name === `${currentWork}_${suffix}`))
            );
        }

        setTargetFile(found);
    }, [allFiles, selectedWork, currentWork, activeTab]);

    // Detect Context (Current Chapter) from Active File
    useEffect(() => {
        if (!activeFileContent) {
            setFilterTag(null);
            return;
        }
        const match = activeFileContent.match(/#ch\d+/i);
        if (match) {
            setFilterTag(match[0]);
        } else {
            setFilterTag(null);
        }
    }, [activeFileContent]);

    // Parse Content
    useEffect(() => {
        if (!targetFile || !targetFile.body) {
            setItems([]);
            return;
        }
        setItems(parseChecklist(targetFile.body));
    }, [targetFile]);

    const parseChecklist = (text) => {
        if (!text) return [];
        const blocks = text.split(/\n\s*\n/);
        return blocks.map((block, index) => {
            const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length === 0) return null;

            // First line: [ ] ID | Title
            const headerMatch = lines[0].match(/^\[( |✔)\]\s*(.+?)[｜|](.+)$/);
            if (!headerMatch) return null;

            const isChecked = headerMatch[1] === '✔';
            const id = headerMatch[2];
            const title = headerMatch[3];

            const attributes = {};
            lines.slice(1).forEach(line => {
                const parts = line.split(/[｜|]/);
                if (parts.length >= 2) {
                    attributes[parts[0].trim()] = parts[1].trim();
                }
            });

            return {
                originalBlock: block,
                index,
                isChecked,
                id,
                title,
                attributes,
                tags: attributes['タグ'] ? attributes['タグ'].split(' ').filter(t => t.startsWith('#')) : [],
                chapter: attributes['初出'] || '',
                raw: block
            };
        }).filter(Boolean);
    };

    const toggleCheck = async (item) => {
        if (!targetFile) return;
        const newStatus = item.isChecked ? ' ' : '✔';
        const oldHeaderStart = `[${item.isChecked ? '✔' : ' '}]`;
        const newHeaderStart = `[${newStatus}]`;

        const fileContent = targetFile.body;
        const blockIndex = fileContent.indexOf(item.raw);
        if (blockIndex === -1) {
            console.error("Could not find block to update");
            return;
        }

        const updatedBlock = item.raw.replace(oldHeaderStart, newHeaderStart);
        const newFileContent = fileContent.substring(0, blockIndex) + updatedBlock + fileContent.substring(blockIndex + item.raw.length);

        const updatedItems = items.map(i => i.id === item.id ? { ...i, isChecked: !i.isChecked, raw: updatedBlock } : i);
        setItems(updatedItems);
        if (targetFile.handle && onUpdateFile) {
            await onUpdateFile(targetFile.handle, newFileContent);
        }
    };

    // Import Form State
    const [showImportForm, setShowImportForm] = useState(false);
    const [importText, setImportText] = useState('');

    const handleImport = async () => {
        if (!importText || (!onUpdateFile && !onCreateFile)) return;

        // Smart Parsing Logic
        // 1. Split into lines
        const rawLines = importText.split('\n');
        const prefix = activeTab === 'foreshadowing' ? 'F' : 'P';
        let currentNum = items.length + 1;

        // If creating new file, start from 1
        if (!targetFile) currentNum = 1;

        let newBlock = '';

        // Context Tracking
        let currentChapter = ''; // #chXX
        let currentSectionTags = [];

        rawLines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // A. Detect Separators (Ignore)
            if (/^[─\-=]{3,}$/.test(trimmed)) return;

            // B. Detect Chapter Header (Update Context)
            // e.g. "第0章 ノルヴィアの惨劇", "Chapter 1", "Section 5"
            const chapterMatch = trimmed.match(/^(第(\d+)章|Chapter\s*(\d+)|Section\s*(\d+)|(\d+)章)[：:\s]*(.*)$/i);
            if (chapterMatch) {
                // Extract number
                const num = chapterMatch[2] || chapterMatch[3] || chapterMatch[4] || chapterMatch[5];
                // Format as #chXX
                const chNum = String(num).padStart(2, '0');
                currentChapter = `#ch${chNum}`;
                return;
            }

            // C. Detect List Item (Bullet points)
            // Or simple lines if they look like items
            const isBullet = /^[・\-\*]\s*/.test(trimmed);
            let cleanText = trimmed.replace(/^[・\-\*]\s*/, '');

            // D. Parse Tags from line (e.g. #tag)
            const inlineTags = cleanText.match(/#[^\s#]+/g) || [];
            cleanText = cleanText.replace(/#[^\s#]+/g, '').trim();

            // E. Detect Evidence Codes (Specific requests: A-1, B-5)
            // e.g. "A-1 REMOTE COMMAND..."
            const evidenceMatch = cleanText.match(/^([A-C]-[1-9])\s+(.+)$/);
            let evidenceTag = '';
            if (evidenceMatch) {
                evidenceTag = '#証拠'; // General tag
            }

            // Construct Item
            const id = `${prefix}-${String(currentNum).padStart(3, '0')}`;

            // Merge tags
            const tags = [...currentSectionTags, ...inlineTags];
            if (evidenceTag) tags.push(evidenceTag);
            // Dedupe tags
            const uniqueTags = [...new Set(tags)];

            // Identify chapter from tags if present, otherwise use context
            const chTagInLine = uniqueTags.find(t => /^#ch\d+$/i.test(t));
            const finalStart = chTagInLine || currentChapter || '(未定)';

            // Remove chTag from uniqueTags for cleaner "Tags" field
            const displayTags = uniqueTags.filter(t => !/^#ch\d+$/i.test(t)).join(' ');

            newBlock += `\n[ ] ${id}｜${cleanText || '名称未定'}\n初出｜${finalStart}\n回収予定｜(未定)\n`;
            if (displayTags) newBlock += `タグ｜${displayTags}\n`;

            currentNum++;
        });

        if (!newBlock) {
            alert("取り込み可能な項目が見つかりませんでした。");
            return;
        }

        if (targetFile) {
            const newContent = targetFile.body + newBlock;
            await onUpdateFile(targetFile.handle, newContent);
            alert(`${currentNum - items.length - 1}件の項目を取り込みました。`);
        } else {
            // Create New File
            if (!onCreateFile) return;
            const workPrefix = selectedWork || currentWork || 'Main';
            const fileName = `${workPrefix}_${activeTab === 'foreshadowing' ? '伏線管理シート.txt' : 'プロット進捗シート.txt'}`;

            await onCreateFile(fileName, newBlock);
            setSelectedWork(workPrefix);

            alert(`${fileName} を作成し、${currentNum - 1}件の項目を取り込みました。\nリストが表示されない場合は、右上の「作品」から「${workPrefix}」を選択してください。`);
        }

        setImportText('');
        setShowImportForm(false);
    };

    // Add Item Form State
    const [showAddForm, setShowAddForm] = useState(false);
    const [newItem, setNewItem] = useState({ title: '', start: '', end: '', tags: '', note: '' });

    const handleAddItem = async () => {
        if (!newItem.title || !targetFile || !onUpdateFile) return;
        const prefix = activeTab === 'foreshadowing' ? 'F' : 'P';
        const nextNum = items.length + 1;
        const id = `${prefix}-${String(nextNum).padStart(3, '0')}`;
        let block = `\n[ ] ${id}｜${newItem.title}\n初出｜${newItem.start || '(未定)'}\n回収予定｜${newItem.end || '(未定)'}\n`;
        if (newItem.tags) block += `タグ｜${newItem.tags}\n`;
        if (newItem.note) block += `備考｜${newItem.note}\n`;

        const newContent = targetFile.body + block;
        await onUpdateFile(targetFile.handle, newContent);

        setNewItem({ title: '', start: '', end: '', tags: '', note: '' });
        setShowAddForm(false);
    };

    // Completion Rate
    const completionRate = items.length > 0
        ? Math.round((items.filter(i => i.isChecked).length / items.length) * 100)
        : 0;

    // Helper to render clickable tags
    const renderLocationTag = (text) => {
        if (!text) return '?';
        const isTag = text.trim().startsWith('#');

        return (
            <span className="location-tag-wrapper">
                {isTag ? (
                    <span
                        className="location-link"
                        onClick={(e) => { e.stopPropagation(); if (onNavigate) onNavigate(text.trim()); }}
                        title="この場所へジャンプ"
                    >
                        {text}
                    </span>
                ) : (
                    <span>{text}</span>
                )}
                {isTag && onInsert && (
                    <button
                        className="insert-tag-btn"
                        onClick={(e) => { e.stopPropagation(); if (onInsert) onInsert(text.trim()); }}
                        title="カーソル位置にタグを挿入"
                    >
                        📍
                    </button>
                )}
            </span>
        );
    };

    const deleteItem = async (item) => {
        if (!targetFile || !onUpdateFile) return;
        if (!window.confirm(`「${item.title}」を削除してもよろしいですか？`)) return;

        const fileContent = targetFile.body;
        const blockIndex = fileContent.indexOf(item.raw);
        if (blockIndex === -1) {
            alert("削除対象が見つかりませんでした（保存されていない変更がある可能性があります）。");
            return;
        }

        const newFileContent = fileContent.substring(0, blockIndex) + fileContent.substring(blockIndex + item.raw.length);
        const updatedItems = items.filter(i => i.id !== item.id);
        setItems(updatedItems);

        await onUpdateFile(targetFile.handle, newFileContent);
    };

    const moveItem = async (item, direction) => {
        if (!targetFile || !onUpdateFile) return;
        const index = items.findIndex(i => i.id === item.id);
        if (index === -1) return;

        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= items.length) return;

        const targetItem = items[targetIndex];

        // Swap text blocks in the file
        const fileContent = targetFile.body;
        const idx1 = fileContent.indexOf(item.raw);
        const idx2 = fileContent.indexOf(targetItem.raw);

        if (idx1 === -1 || idx2 === -1) {
            alert("移動対象が見つかりませんでした。");
            return;
        }

        const firstPos = Math.min(idx1, idx2);
        const secondPos = Math.max(idx1, idx2);

        const firstBlock = idx1 < idx2 ? item.raw : targetItem.raw;
        const secondBlock = idx1 < idx2 ? targetItem.raw : item.raw;

        const gap = fileContent.substring(firstPos + firstBlock.length, secondPos);
        const newSegment = secondBlock + gap + firstBlock;

        const header = fileContent.substring(0, firstPos);
        const safeFooter = fileContent.length > secondPos + secondBlock.length ? fileContent.substring(secondPos + secondBlock.length) : '';

        const newContent = header + newSegment + safeFooter;

        await onUpdateFile(targetFile.handle, newContent);
    };

    const mergeWithNext = async (item) => {
        if (!targetFile || !onUpdateFile) return;
        const index = items.findIndex(i => i.id === item.id);
        if (index === -1 || index === items.length - 1) return; // No next item

        const nextItem = items[index + 1];
        if (!window.confirm(`「${item.title}」と「${nextItem.title}」を合体させますか？\n（下の項目は削除されます）`)) return;

        // 1. Construct Merged Data
        const mergedTitle = `${item.title} / ${nextItem.title}`;

        // Tags
        const mergedTags = [...new Set([...item.tags, ...nextItem.tags])];
        const tagString = mergedTags.join(' ');

        // Notes
        const note1 = item.attributes['備考'] || '';
        const note2 = nextItem.attributes['備考'] || '';
        const mergedNote = [note1, note2].filter(Boolean).join('\n');

        // Start/End (Take earliest start, latest end? Or just keep item's?)
        // Let's keep item's start, and if item lacks end, take nextItem's.
        const start = item.attributes['初出'] || nextItem.attributes['初出'] || '(未定)';
        const end = item.attributes['回収予定'] || nextItem.attributes['回収予定'] || '(未定)';

        // 2. Create New Block String
        // We reuse item.id (Shift IDs? No, just keep top ID. Gaps are fine.)
        let newBlock = `\n[${item.isChecked ? '✔' : ' '}] ${item.id}｜${mergedTitle}\n初出｜${start}\n回収予定｜${end}\n`;
        if (tagString) newBlock += `タグ｜${tagString}\n`;
        if (mergedNote) newBlock += `備考｜${mergedNote}\n`;

        // 3. Update File Content
        const fileContent = targetFile.body;
        const idx1 = fileContent.indexOf(item.raw);
        const idx2 = fileContent.indexOf(nextItem.raw);

        if (idx1 === -1 || idx2 === -1) {
            alert("結合対象が見つかりませんでした。");
            return;
        }

        // We assume idx1 < idx2 usually, but let's be safe.
        // We want to remove BOTH raw blocks and insert newBlock at idx1.

        const firstPos = Math.min(idx1, idx2);
        const secondPos = Math.max(idx1, idx2);

        const firstBlock = idx1 < idx2 ? item.raw : nextItem.raw; // Should be item.raw
        const secondBlock = idx1 < idx2 ? nextItem.raw : item.raw; // Should be nextItem.raw (to be deleted)

        // If we replace First with New, and Second with Empty.
        const header = fileContent.substring(0, firstPos);
        const gap = fileContent.substring(firstPos + firstBlock.length, secondPos);
        const footer = fileContent.substring(secondPos + secondBlock.length);

        const newContent = header + newBlock + gap + footer;

        await onUpdateFile(targetFile.handle, newContent);
    };

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState(new Set());

    const toggleSelection = (id) => {
        const newSet = new Set(selectedItemIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedItemIds(newSet);
    };


    const mergeSelectedItems = async () => {
        if (selectedItemIds.size < 2) return;
        if (!targetFile || !onUpdateFile) return;

        // Get selected items sorted by current index
        const selectedItemsList = items
            .filter(i => selectedItemIds.has(i.id))
            .sort((a, b) => a.index - b.index);

        const topItem = selectedItemsList[0];
        const otherItems = selectedItemsList.slice(1);

        if (!window.confirm(`${selectedItemsList.length}個の項目を「${topItem.title}」に統合しますか？\n（他の項目は削除されます）`)) return;

        // 1. Construct Merged Data
        const mergedTitle = selectedItemsList.map(i => i.title).join(' / ');

        // Tags
        const allTags = selectedItemsList.flatMap(i => i.tags);
        const mergedTags = [...new Set(allTags)];
        const tagString = mergedTags.join(' ');

        // Notes
        const mergedNote = selectedItemsList
            .map(i => i.attributes['備考'])
            .filter(Boolean)
            .join('\n');

        // Start/End
        // Start = Top Item's Start
        // End = Last Item's End (if present), else Top Item's End
        const lastItem = selectedItemsList[selectedItemsList.length - 1];
        const start = topItem.attributes['初出'] || '(未定)';
        const end = lastItem.attributes['回収予定'] || topItem.attributes['回収予定'] || '(未定)';

        // 2. Create New Block String
        let newBlock = `\n[${topItem.isChecked ? '✔' : ' '}] ${topItem.id}｜${mergedTitle}\n初出｜${start}\n回収予定｜${end}\n`;
        if (tagString) newBlock += `タグ｜${tagString}\n`;
        if (mergedNote) newBlock += `備考｜${mergedNote}\n`;

        // 3. Update File Content
        let newContent = targetFile.body;

        // First, verify all blocks exist
        for (const item of selectedItemsList) {
            if (newContent.indexOf(item.raw) === -1) {
                alert("エラー: 編集対象の項目が見つかりませんでした。");
                return;
            }
        }

        // Remove others first (Replace with empty)
        // We iterate and replace. Since raw blocks should be unique enough.
        // If IDs are unique, we assume raws are unique or at least we find the correct one if we are careful?
        // Actually, identical raws might be an issue. `replace` replaces only the first occurrence.
        // If we have duplicate content, we might delete the wrong one?
        // If our `selectedItems` includes both duplicates, we call replace twice, removing both. Correct.
        // If our `selectedItems` includes only the second duplicate, `replace` removes the FIRST one. INCORRECT.
        // However, standard usage implies unique IDs. If IDs are unique, lines are unique.

        for (const item of otherItems) {
            newContent = newContent.replace(item.raw, '');
        }

        // Replace Top Item with New Block
        newContent = newContent.replace(topItem.raw, newBlock);

        await onUpdateFile(targetFile.handle, newContent);

        // Reset Selection
        setSelectedItemIds(new Set());
        setIsSelectionMode(false);
    };

    // Filter Logic
    const activeFilter = manualFilter || filterTag;
    const filteredItems = items.filter(item => {
        if (!activeFilter) return true;
        const tagMatch = item.tags.some(t => t.toLowerCase() === activeFilter.toLowerCase());
        const firstMatch = item.attributes['初出'] === activeFilter;
        const targetMatch = item.attributes['回収予定'] === activeFilter;
        return tagMatch || firstMatch || targetMatch;
    });

    return (
        <div className="checklist-panel">
            {/* Work Selector */}
            <div className="work-selector" style={{ padding: '8px', borderBottom: '1px solid #eee', background: '#f9f9f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap' }}>作品:</span>
                <select
                    value={selectedWork}
                    onChange={(e) => setSelectedWork(e.target.value)}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                    <option value="">(自動検出 / 未設定)</option>
                    {availableWorks.map(w => (
                        <option key={w} value={w}>{w}</option>
                    ))}
                    {currentWork && !availableWorks.includes(currentWork) && (
                        <option value={currentWork}>{currentWork} (現在のファイル)</option>
                    )}
                </select>
            </div>

            <div className="checklist-tabs">
                <button
                    className={activeTab === 'foreshadowing' ? 'active' : ''}
                    onClick={() => setActiveTab('foreshadowing')}
                >
                    伏線
                </button>
                <button
                    className={activeTab === 'plot' ? 'active' : ''}
                    onClick={() => setActiveTab('plot')}
                >
                    プロット
                </button>
            </div>

            {!targetFile ? (
                <div className="checklist-empty">
                    <p>管理ファイルが見つかりません。</p>
                    <p>
                        作品: <strong>{selectedWork || currentWork || '(未設定)'}</strong><br />
                        <code>{selectedWork ? `${selectedWork}_` : ''}{activeTab === 'foreshadowing' ? '伏線管理シート.txt' : 'プロット進捗シート.txt'}</code><br />
                        を作成して管理を始めましょう。
                    </p>
                    {/* Debug info removed */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button
                            className="btn-primary"
                            onClick={async () => {
                                if (!onCreateFile) return;
                                const workPrefix = selectedWork || currentWork;
                                const fileName = workPrefix
                                    ? `${workPrefix}_${activeTab === 'foreshadowing' ? '伏線管理シート.txt' : 'プロット進捗シート.txt'}`
                                    : (activeTab === 'foreshadowing' ? '伏線管理シート.txt' : 'プロット進捗シート.txt');

                                const template = activeTab === 'foreshadowing'
                                    ? `[ ] F-001｜(例) 主人公の古傷\n初出｜#ch01\n回収予定｜#ch10\nタグ｜#主人公 #過去\n備考｜第1章の戦闘シーンでちらっと見せる\n`
                                    : `[ ] P-001｜(例) 起：日常の崩壊\n初出｜#ch01\nタグ｜#導入\n備考｜平凡な日常を描写してから落とす\n`;

                                if (onCreateFile) {
                                    await onCreateFile(fileName, template);
                                }
                            }}
                        >
                            テンプレートを作成
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={() => setShowImportForm(true)}
                        >
                            テキストから作成 (一括取り込み)
                        </button>
                    </div>

                    {showImportForm && (
                        <div className="add-item-form" style={{ marginTop: '10px', borderTop: '1px solid #ddd', paddingTop: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>
                                    テキストを貼り付けてください。自動解析してファイルを作成します。
                                </p>
                                <button
                                    className="text-btn-small"
                                    style={{ fontSize: '0.75rem', cursor: 'pointer', border: '1px solid #ddd', padding: '2px 6px', borderRadius: '4px', background: '#f8f9fa' }}
                                    onClick={() => {
                                        const prompt = `以下のフォーマットで伏線/プロットのリストを出力してください。
・各行に1つの項目
・フォーマット: 項目名 #chXX #タグ
・例:
  謎の古文書 #ch01 #重要アイテム
  王国の滅亡 #ch10 #背景設定`;
                                        navigator.clipboard.writeText(prompt);
                                        alert("AI指示用のフォーマット例をコピーしました。\nチャットAIに貼り付けて指示してください。");
                                    }}
                                >
                                    📋 AI指示用例をコピー
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', justifyContent: 'flex-end' }}>
                                <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#666', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                    🤖 ChatGPTを開く
                                </a>
                                <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#666', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                    ✨ Geminiを開く
                                </a>
                            </div>
                            <textarea
                                placeholder="第1章 ノルヴィアの惨劇&#13;&#10;・早良の負傷 #ch01&#13;&#10;・不破の幻視"
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                                rows={5}
                            />
                            <div className="form-actions">
                                <button onClick={handleImport} disabled={!importText}>作成して取り込み</button>
                                <button onClick={() => setShowImportForm(false)} className="cancel">キャンセル</button>
                            </div>
                        </div>
                    )}

                    <div className="format-guide">
                        <h5>📝 記法ガイド</h5>
                        <pre>
                            [ ] ID｜タイトル
                            初出｜#chXX
                            回収予定｜#chYY
                            タグ｜#タグ1 #タグ2
                            備考｜メモ
                        </pre>
                    </div>
                </div>
            ) : (
                <>
                    <div className="checklist-header">
                        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>📄 {targetFile.name}</span>
                        </div>
                        <div className="progress-ring">
                            <span>達成率 {completionRate}%</span>
                            <div className="progress-bar-mini">
                                <div style={{ width: `${completionRate}%` }}></div>
                            </div>
                        </div>
                        {activeFilter && (
                            <div className="active-filter">
                                Filter: <strong>{activeFilter}</strong>
                                <button onClick={() => { setManualFilter(null); setFilterTag(null); }}>×</button>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                            <button
                                className="add-item-btn"
                                onClick={() => setShowAddForm(!showAddForm)}
                                style={{ flex: 1 }}
                            >
                                + 追加
                            </button>
                            <button
                                className={`add-item-btn ${isSelectionMode ? 'active' : ''}`}
                                style={{ flex: 1, background: isSelectionMode ? '#ddd' : '#f0f0f0', color: '#333' }}
                                onClick={() => {
                                    setIsSelectionMode(!isSelectionMode);
                                    setSelectedItemIds(new Set());
                                }}
                            >
                                {isSelectionMode ? '完了' : '選択モード'}
                            </button>

                            {isSelectionMode && selectedItemIds.size > 1 && (
                                <button
                                    className="add-item-btn"
                                    style={{ flex: 2, background: '#4CAF50', color: 'white' }}
                                    onClick={mergeSelectedItems}
                                >
                                    合体 ({selectedItemIds.size})
                                </button>
                            )}
                        </div>
                        <button
                            className="text-btn-small"
                            style={{ marginTop: '5px', fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: '#666', width: '100%', textAlign: 'right' }}
                            onClick={() => {
                                if (items.length === 0) return;
                                if (confirm(`リスト内の${items.length}件の項目をストーリーボードにカードとして追加しますか？`)) {
                                    if (onAddToBoard) onAddToBoard(items);
                                }
                            }}
                        >
                            📤 このリストをボードへ反映
                        </button>
                        <button
                            className="text-btn-small"
                            style={{ marginTop: '5px', fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: '#666', width: '100%', textAlign: 'right' }}
                            onClick={() => setShowImportForm(!showImportForm)}
                        >
                            一括取り込み・ファイル合体
                        </button>
                    </div>

                    {showImportForm && (
                        <div className="add-item-form">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>
                                    テキストを貼り付けてください（1行1項目）。
                                </p>
                                <button
                                    className="text-btn-small"
                                    style={{ fontSize: '0.75rem', cursor: 'pointer', border: '1px solid #ddd', padding: '2px 6px', borderRadius: '4px', background: '#f8f9fa' }}
                                    onClick={() => {
                                        const prompt = `以下のフォーマットで伏線/プロットのリストを出力してください。
・各行に1つの項目
・フォーマット: 項目名 #chXX #タグ
・例:
  謎の古文書 #ch01 #重要アイテム
  王国の滅亡 #ch10 #背景設定`;
                                        navigator.clipboard.writeText(prompt);
                                        alert("AI指示用のフォーマット例をコピーしました。\nチャットAIに貼り付けて指示してください。");
                                    }}
                                >
                                    📋 AI指示用例をコピー
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', justifyContent: 'flex-end' }}>
                                <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#666', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                    🤖 ChatGPTを開く
                                </a>
                                <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#666', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                    ✨ Geminiを開く
                                </a>
                            </div>

                            {/* File Loader for Merging */}
                            <div style={{ marginBottom: '8px' }}>
                                <select
                                    style={{ width: '100%', fontSize: '0.8rem', padding: '4px', border: '1px solid #ddd', borderRadius: '4px', color: '#555' }}
                                    onChange={(e) => {
                                        const file = allFiles.find(f => f.name === e.target.value);
                                        if (file && file.body) {
                                            if (importText && !window.confirm("現在のテキストエリアの内容を上書きしてもよろしいですか？")) return;
                                            setImportText(file.body);
                                        }
                                        e.target.value = ""; // Reset
                                    }}
                                >
                                    <option value="">📂 他のファイルから読み込む...</option>
                                    {allFiles && allFiles
                                        .filter(f => f.name.endsWith('.txt') || f.name.endsWith('.md'))
                                        .map(f => (
                                            <option key={f.name} value={f.name}>{f.name}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <textarea
                                placeholder="例：&#13;&#10;謎の古文書 #ch01 #重要アイテム&#13;&#10;王国の滅亡 #ch10 #背景設定"
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                                rows={5}
                            />
                            <div className="form-actions">
                                <button onClick={handleImport} disabled={!importText}>取り込み</button>
                                <button onClick={() => setShowImportForm(false)} className="cancel">キャンセル</button>
                            </div>
                        </div>
                    )}

                    {showAddForm && (
                        <div className="add-item-form">
                            <input
                                placeholder="項目名（例：剣のひび割れ）"
                                value={newItem.title}
                                onChange={e => setNewItem({ ...newItem, title: e.target.value })}
                                autoFocus
                            />
                            <div className="form-row">
                                <input
                                    placeholder="初出 (#ch01)"
                                    value={newItem.start}
                                    onChange={e => setNewItem({ ...newItem, start: e.target.value })}
                                />
                                <span className="arrow">→</span>
                                <input
                                    placeholder="回収 (#ch10)"
                                    value={newItem.end}
                                    onChange={e => setNewItem({ ...newItem, end: e.target.value })}
                                />
                            </div>
                            <input
                                placeholder="タグ (#重要 #キャラ名)"
                                value={newItem.tags}
                                onChange={e => setNewItem({ ...newItem, tags: e.target.value })}
                            />
                            <textarea
                                placeholder="備考"
                                value={newItem.note}
                                onChange={e => setNewItem({ ...newItem, note: e.target.value })}
                                rows={2}
                            />
                            <div className="form-actions">
                                <button onClick={handleAddItem} disabled={!newItem.title}>追加</button>
                                <button onClick={() => setShowAddForm(false)} className="cancel">キャンセル</button>
                            </div>
                        </div>
                    )}

                    <div className="checklist-items">
                        {filteredItems.length === 0 ? (
                            <div className="no-items">該当項目なし</div>
                        ) : (
                            filteredItems.map(item => (
                                <div
                                    key={item.id}
                                    className={`checklist-item ${item.isChecked ? 'checked' : ''}`}
                                    draggable="true"
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/json', JSON.stringify(item));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                >
                                    <div className="item-main">
                                        {isSelectionMode ? (
                                            <input
                                                type="checkbox"
                                                checked={selectedItemIds.has(item.id)}
                                                onChange={() => toggleSelection(item.id)}
                                                style={{ marginRight: '10px', transform: 'scale(1.2)' }}
                                            />
                                        ) : (
                                            <button
                                                className="check-toggle"
                                                onClick={() => toggleCheck(item)}
                                            >
                                                {item.isChecked ? '✔' : ''}
                                            </button>
                                        )}
                                        <div className="item-content">
                                            <div className="item-title">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span className="item-id">{item.id}</span>
                                                    <span>{item.title}</span>
                                                </div>
                                                <div className="item-controls" style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
                                                    {!isSelectionMode && (
                                                        <>
                                                            <button
                                                                className="merge-btn"
                                                                onClick={(e) => { e.stopPropagation(); mergeWithNext(item); }}
                                                                title="下の項目と合体"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '0.8rem' }}
                                                            >
                                                                🔗
                                                            </button>
                                                            <button
                                                                className="move-btn"
                                                                onClick={(e) => { e.stopPropagation(); moveItem(item, -1); }}
                                                                title="上へ移動"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '0.8rem' }}
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                className="move-btn"
                                                                onClick={(e) => { e.stopPropagation(); moveItem(item, 1); }}
                                                                title="下へ移動"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '0.8rem' }}
                                                            >
                                                                ▼
                                                            </button>
                                                            <button
                                                                className="delete-btn"
                                                                onClick={(e) => { e.stopPropagation(); deleteItem(item); }}
                                                                title="削除"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '0.9rem', marginLeft: '5px' }}
                                                            >
                                                                🗑️
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="item-flow">
                                                <span className="flow-start">🎬 {renderLocationTag(item.attributes['初出'])}</span>
                                                <span className="flow-arrow">➜</span>
                                                <span className="flow-end">🏁 {renderLocationTag(item.attributes['回収予定'])}</span>
                                            </div>
                                            <div className="item-meta">
                                                {Object.entries(item.attributes).map(([k, v]) => {
                                                    if (k === 'タグ' || k === '備考' || k === '初出' || k === '回収予定') return null;
                                                    return (
                                                        <span key={k} className="meta-tag">
                                                            {k}: {v}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            {item.tags.length > 0 && (
                                                <div className="item-tags">
                                                    {item.tags.map(tag => (
                                                        <button
                                                            key={tag}
                                                            className="tag-chip-mini"
                                                            onClick={(e) => { e.stopPropagation(); setManualFilter(tag); }}
                                                        >
                                                            {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {item.attributes['備考'] && (
                                                <div className="item-note">
                                                    {item.attributes['備考']}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ChecklistPanel;
