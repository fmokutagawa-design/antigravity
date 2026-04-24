import { useState, useEffect, useCallback } from 'react';
import { fileSystem } from '../utils/fileSystem';
import { parseNote, serializeNote } from '../utils/metadataParser';
import { HERO_JOURNEY_TEMPLATE, OTSUKA_QUESTIONS, HOLLYWOOD_TEMPLATE, SIMPLE_TEMPLATE } from '../data/otsukaQuestions';

export const useStoryBoard = (projectHandle) => {
    const [boardData, setBoardData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // --- Data Loading (Keep order consistent) ---
    useEffect(() => {
        const loadBoard = async () => {
            if (!projectHandle) return;
            setIsLoading(true);
            try {
                let content = null;
                try {
                    const fileHandle = await fileSystem.getFileHandle(projectHandle, 'board.json', { create: false });
                    content = await fileSystem.readFile(fileHandle);
                } catch {
                    content = null;
                }

                if (content) {
                    const loadedData = JSON.parse(content);
                    if (!loadedData.connections) loadedData.connections = [];
                    setBoardData(loadedData);
                } else {
                    setBoardData(HOLLYWOOD_TEMPLATE);
                }
            } catch (err) {
                console.error("Failed to load board.json", err);
                setBoardData(HOLLYWOOD_TEMPLATE);
            } finally {
                setIsLoading(false);
            }
        };
        loadBoard();
    }, [projectHandle]);

    // --- Core Data Helpers (wrap everything in useCallback) ---

    const saveBoardToDisk = useCallback(async (newData) => {
        if (!projectHandle) return;
        try {
            await fileSystem.createFile(projectHandle, 'board.json', JSON.stringify(newData, null, 2));
        } catch (e) {
            console.error("Failed to save board.json", e);
            alert("ボードの保存に失敗しました。詳細: " + e.message);
        }
    }, [projectHandle]);

    const saveBoard = useCallback(async (newData) => {
        setBoardData(newData);
        await saveBoardToDisk(newData);
    }, [saveBoardToDisk]);

    // --- Dynamic Sync (Scrivener Fusion) ---

    const syncWithFolder = useCallback(async (folderPath) => {
        if (!projectHandle || !folderPath) return;
        setIsLoading(true);
        try {
            const parts = folderPath.split('/').filter(p => p);
            const folderHandle = await fileSystem.getDirectoryHandleFromPath(projectHandle, parts);
            const entries = await fileSystem.readDirectory(folderHandle);

            const newScenes = [];
            const newCards = {};

            const subfolders = entries.filter(e => e.kind === 'directory');

            if (subfolders.length === 0) {
                const sceneId = 'ms-root';
                newScenes.push({ id: sceneId, title: folderHandle.name || '原稿', act: '', description: 'ファイル同期モード' });
                newCards[sceneId] = [];

                for (const file of entries.filter(e => e.kind === 'file')) {
                    const content = await fileSystem.readFile(file.handle || file);
                    const { metadata } = parseNote(content);
                    newCards[sceneId].push({
                        id: `file-${file.name}`,
                        title: file.name.replace(/\.[^/.]+$/, ""),
                        content: metadata.あらすじ || metadata.summary || file.name,
                        type: 'file',
                        linkedFile: `${folderPath}/${file.name}`,
                        metadata: metadata
                    });
                }
            } else {
                for (const folder of subfolders) {
                    const sceneId = `ms-${folder.name}`;
                    newScenes.push({ id: sceneId, title: folder.name, act: '', description: '' });
                    newCards[sceneId] = [];

                    const subEntries = await fileSystem.readDirectory(folder.handle || folder);
                    for (const file of subEntries.filter(e => e.kind === 'file')) {
                        const content = await fileSystem.readFile(file.handle || file);
                        const { metadata } = parseNote(content);
                        newCards[sceneId].push({
                            id: `file-${folder.name}-${file.name}`,
                            title: file.name.replace(/\.[^/.]+$/, ""),
                            content: metadata.あらすじ || metadata.summary || file.name,
                            type: 'file',
                            linkedFile: `${folderPath}/${folder.name}/${file.name}`,
                            metadata: metadata
                        });
                    }
                }
            }

            const newData = {
                ...boardData,
                scenes: newScenes,
                cards: newCards,
                linkedFolder: folderPath,
                connections: boardData?.connections || []
            };
            setBoardData(newData);
            await saveBoardToDisk(newData);
        } catch (err) {
            console.error("Fusion Sync failed", err);
        } finally {
            setIsLoading(false);
        }
    }, [projectHandle, boardData, saveBoardToDisk]);

    const reorderFilesOnDisk = useCallback(async (newCardsMap) => {
        if (!projectHandle || !boardData?.linkedFolder) return newCardsMap;

        const updatedCardsMap = { ...newCardsMap };
        const allFileCards = [];

        // 全シーンを巡回してファイルタイプのカードを収集
        boardData.scenes.forEach(scene => {
            const cards = updatedCardsMap[scene.id] || [];
            cards.forEach((card, index) => {
                if (card.type === 'file' && card.linkedFile) {
                    allFileCards.push({ card, sceneId: scene.id, index });
                }
            });
        });

        for (let i = 0; i < allFileCards.length; i++) {
            const { card, sceneId, index } = allFileCards[i];
            const prefix = (i + 1).toString().padStart(3, '0') + '_';

            const currentPath = card.linkedFile;
            const pathParts = currentPath.split('/');
            const oldFileName = pathParts.pop();
            const parentFolderPath = pathParts.join('/');

            // 既存の番号を削除して新しい番号を付与 (例: 001_Chapter.md)
            const baseName = oldFileName.replace(/^\d+_/, '');
            const newFileName = `${prefix}${baseName}`;

            if (oldFileName !== newFileName) {
                try {
                    const fileHandle = await fileSystem.getFileHandle(projectHandle, currentPath);
                    const result = await fileSystem.rename(fileHandle, newFileName);

                    // カードの情報を更新
                    const updatedCard = { ...card, linkedFile: `${parentFolderPath}/${result.name}` };
                    updatedCardsMap[sceneId][index] = updatedCard;
                } catch (e) {
                    console.error("Fusion: Rename failed", oldFileName, "->", newFileName, e);
                }
            }
        }
        return updatedCardsMap;
    }, [projectHandle, boardData]);

    const syncFileMetadata = useCallback(async (cardId, updates) => {
        if (!projectHandle || !boardData) return;

        let targetCard = null;
        Object.values(boardData.cards).forEach(column => {
            const c = column.find(item => item.id === cardId);
            if (c) targetCard = c;
        });

        if (targetCard && targetCard.type === 'file' && targetCard.linkedFile) {
            try {
                const fileHandle = await fileSystem.getFileHandle(projectHandle, targetCard.linkedFile);
                const content = await fileSystem.readFile(fileHandle);
                const { body, metadata } = parseNote(content);

                // カードのメインテキストをメタデータの「あらすじ」に反映
                if (updates.content || updates.title) {
                    metadata.あらすじ = updates.content || updates.title;
                }

                // メタデータフィールド自体の更新があれば適用
                if (updates.metadata) {
                    Object.assign(metadata, updates.metadata);
                }

                const newContent = serializeNote(body, metadata);
                await fileSystem.writeFile(fileHandle, newContent);
            } catch (e) {
                console.error("Fusion: File sync failed", e);
            }
        }
    }, [projectHandle, boardData]);

    // --- Standard Board Helpers ---

    const addCard = useCallback((columnId, contentOrTemplate, type = 'event') => {
        if (!boardData) return;

        let newCard;
        if (typeof contentOrTemplate === 'object' && contentOrTemplate !== null) {
            newCard = {
                id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                content: contentOrTemplate.defaultTitle,
                title: contentOrTemplate.defaultTitle,
                type: contentOrTemplate.type || 'event',
                plot: contentOrTemplate.defaultPlot || '',
                color: contentOrTemplate.color,
                icon: contentOrTemplate.icon,
                linkedFile: contentOrTemplate.linkedFile || '',
                characters: contentOrTemplate.characters || '',
                time: contentOrTemplate.time || '',
                place: contentOrTemplate.place || '',
                foreshadow: contentOrTemplate.foreshadow || '',
                notes: contentOrTemplate.notes || ''
            };
        } else {
            newCard = {
                id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                content: contentOrTemplate,
                type,
                title: contentOrTemplate
            };
        }

        const newCards = { ...boardData.cards };
        if (!newCards[columnId]) newCards[columnId] = [];
        newCards[columnId] = [...newCards[columnId], newCard];

        const newData = { ...boardData, cards: newCards };
        saveBoard(newData);
    }, [boardData, saveBoard]);

    const moveCard = useCallback(async (newCardsMap) => {
        if (!boardData) return;

        let finalCardsMap = newCardsMap;
        if (boardData.linkedFolder) {
            finalCardsMap = await reorderFilesOnDisk(newCardsMap);
        }

        const newData = { ...boardData, cards: finalCardsMap };
        await saveBoard(newData);
    }, [boardData, saveBoard, reorderFilesOnDisk]);

    const updateCard = useCallback(async (cardId, updates) => {
        if (!boardData) return;

        // ファイル同期モードなら実ファイルにも反映
        if (boardData.linkedFolder) {
            await syncFileMetadata(cardId, updates);
        }

        const newCards = { ...boardData.cards };
        let cardFound = false;
        Object.keys(newCards).forEach(columnId => {
            const index = newCards[columnId].findIndex(c => c.id === cardId);
            if (index !== -1) {
                newCards[columnId][index] = { ...newCards[columnId][index], ...updates };
                cardFound = true;
            }
        });

        if (cardFound) {
            const newData = { ...boardData, cards: newCards };
            await saveBoard(newData);
        }
    }, [boardData, saveBoard, syncFileMetadata]);

    const moveCardToColumn = useCallback(async (cardId, targetColId) => {
        if (!boardData) return;
        const newCards = { ...boardData.cards };
        let cardItem = null;
        let sourceCol = null;

        Object.keys(newCards).forEach(colId => {
            const idx = newCards[colId].findIndex(c => c.id === cardId);
            if (idx !== -1) {
                sourceCol = colId;
                [cardItem] = newCards[colId].splice(idx, 1);
            }
        });

        if (cardItem) {
            if (sourceCol === targetColId) return;
            if (!newCards[targetColId]) newCards[targetColId] = [];
            newCards[targetColId].push(cardItem);

            let finalCards = newCards;
            if (boardData.linkedFolder) {
                finalCards = await reorderFilesOnDisk(newCards);
            }

            const newData = { ...boardData, cards: finalCards };
            await saveBoard(newData);
        }
    }, [boardData, saveBoard, reorderFilesOnDisk]);

    const deleteCard = useCallback((cardId) => {
        if (!boardData) return;
        const newCards = { ...boardData.cards };
        let cardFound = false;

        Object.keys(newCards).forEach(columnId => {
            const initialLength = newCards[columnId].length;
            newCards[columnId] = newCards[columnId].filter(c => c.id !== cardId);
            if (newCards[columnId].length !== initialLength) cardFound = true;
        });

        if (cardFound) {
            const newConnections = boardData.connections.filter(c => c.source !== cardId && c.target !== cardId);
            const newData = { ...boardData, cards: newCards, connections: newConnections };
            saveBoard(newData);
        }
    }, [boardData, saveBoard]);

    const addCards = useCallback((columnId, newCardsList) => {
        if (!boardData) return;
        const newCardsMap = { ...boardData.cards };
        if (!newCardsMap[columnId]) newCardsMap[columnId] = [];

        const timestamp = Date.now();
        const cardsToAdd = newCardsList.map((c, i) => ({
            id: `card-${timestamp}-${i}-${Math.random().toString(36).substr(2, 5)}`,
            type: c.type || 'event',
            title: c.title || 'No Title',
            content: c.content || c.title || '',
            plot: c.plot || '',
            characters: c.characters || '',
            place: c.place || '',
            time: c.time || '',
            foreshadow: c.foreshadow || '',
            notes: c.notes || ''
        }));

        newCardsMap[columnId] = [...newCardsMap[columnId], ...cardsToAdd];
        const newData = { ...boardData, cards: newCardsMap };
        saveBoard(newData);
    }, [boardData, saveBoard]);

    const addConnection = useCallback((sourceId, targetId, type = 'default') => {
        if (!boardData) return;
        const exists = boardData.connections.find(c => c.source === sourceId && c.target === targetId);
        if (exists) return;
        const newConnection = { id: `conn-${Date.now()}`, source: sourceId, target: targetId, type };
        const newData = { ...boardData, connections: [...boardData.connections, newConnection] };
        saveBoard(newData);
    }, [boardData, saveBoard]);

    const removeConnection = useCallback((connId) => {
        if (!boardData) return;
        const newData = { ...boardData, connections: boardData.connections.filter(c => c.id !== connId) };
        saveBoard(newData);
    }, [boardData, saveBoard]);

    const generateBoardFromWizard = useCallback((answers) => {
        const newBoard = JSON.parse(JSON.stringify(HERO_JOURNEY_TEMPLATE));
        if (!newBoard.connections) newBoard.connections = [];

        OTSUKA_QUESTIONS.forEach(q => {
            const answer = answers[q.id];
            if (answer && answer.trim() !== '') {
                const targetColumn = q.target;
                if (newBoard.cards[targetColumn]) {
                    newBoard.cards[targetColumn].push({
                        id: `wiz-${q.id}`,
                        content: answer,
                        title: q.label || `Q${q.id}`,
                        type: q.type || 'event',
                        plot: answer,
                        notes: `Q${q.id}: ${q.text}`
                    });
                }
            }
        });

        saveBoard(newBoard);
    }, [saveBoard]);

    const applyTemplate = useCallback((templateType) => {
        let templateBase;
        if (templateType === 'hollywood') templateBase = HOLLYWOOD_TEMPLATE;
        else if (templateType === 'simple') templateBase = SIMPLE_TEMPLATE;
        else templateBase = HERO_JOURNEY_TEMPLATE;

        const newBoard = JSON.parse(JSON.stringify(templateBase));
        if (!newBoard.connections) newBoard.connections = boardData?.connections || [];

        // ... mapping logic could be added here if needed, but for now simple swap
        saveBoard(newBoard);
    }, [boardData, saveBoard]);

    const resetToHollywood = useCallback(() => {
        const newData = JSON.parse(JSON.stringify(HOLLYWOOD_TEMPLATE));
        if (!newData.connections) newData.connections = [];
        saveBoard(newData);
    }, [saveBoard]);

    const addScene = useCallback((title = 'New Chapter') => {
        setBoardData(prev => {
            if (!prev) return prev;
            const newId = `custom-${Date.now()}`;
            const newScene = { id: newId, title, act: '', description: '' };
            const nextScenes = [...prev.scenes, newScene];
            const nextCards = { ...prev.cards, [newId]: [] };
            const newData = { ...prev, scenes: nextScenes, cards: nextCards };
            saveBoardToDisk(newData);
            return newData;
        });
    }, [saveBoardToDisk]);

    const deleteScene = useCallback((sceneId) => {
        if (!confirm('この章（カラム）を削除してもよろしいですか？')) return;
        setBoardData(prev => {
            if (!prev) return prev;
            const nextScenes = prev.scenes.filter(s => s.id !== sceneId);
            const { [sceneId]: _, ...nextCards } = prev.cards;
            const newData = { ...prev, scenes: nextScenes, cards: nextCards };
            saveBoardToDisk(newData);
            return newData;
        });
    }, [saveBoardToDisk]);

    const updateScene = useCallback((sceneId, updates) => {
        setBoardData(prev => {
            if (!prev) return prev;
            const nextScenes = prev.scenes.map(s => s.id === sceneId ? { ...s, ...updates } : s);
            const newData = { ...prev, scenes: nextScenes };
            saveBoardToDisk(newData);
            return newData;
        });
    }, [saveBoardToDisk]);

    return {
        boardData,
        isLoading,
        setBoardData,
        saveBoard,
        addCard,
        addCards,
        updateCard,
        deleteCard,
        moveCard,
        moveCardToColumn,
        addConnection,
        removeConnection,
        generateBoardFromWizard,
        addScene,
        deleteScene,
        updateScene,
        resetToHollywood,
        applyTemplate,
        syncWithFolder
    };
};
