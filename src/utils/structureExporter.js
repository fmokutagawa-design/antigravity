import { fileSystem, isNative } from './fileSystem';
import { parseNote } from './metadataParser';

/**
 * Generates a structure JSON for the project suitable for LLM analysis.
 * 
 * @param {Object} projectHandle - The root project handle
 * @param {Array} allMaterialFiles - Flat list of all files with handles and content (if loaded)
 * @param {Object} boardData - The board.json data (story board state)
 * @returns {Object} The structure data object
 */
export const generateStructureData = async (projectHandle, allMaterialFiles, boardData) => {

    // 1. Scenes (from boardData)
    const rawCards = Array.isArray(boardData?.cards) ? boardData.cards : [];
    const scenes = rawCards.map((card, index) => {
        // Find corresponding file path if any
        let filePath = null;
        if (card.filePath) filePath = card.filePath; // If already stored
        else {
            // Try to find by title?
            // Or maybe we don't have it linked yet.
        }

        return {
            id: card.id,
            chapter: card.group || "未定", // Assuming group is chapter name
            order: index, // Simplified order
            title: card.title,
            summary: (card.content || "").substring(0, 100),
            timeId: card.timeId || null,
            location: card.location || extractTagValue(card.content, 'Location') || "不明",
            filePath: filePath
        };
    });

    // 2. Characters
    // Filter from allMaterialFiles where folder is 'characters' or tag is 'Character'
    // We need to async load content if not present?
    // allMaterialFiles in useMaterials usually loads basic info. content might be missing.
    // If content missing, we can't check internal tags easily without reading.
    // We assume 'characters' folder is the main source.
    const characters = [];

    // Helper to extract ID
    const generateId = (prefix, index) => `${prefix}${String(index + 1).padStart(2, '0')}`;

    let charIndex = 0;
    // Defensive check for allMaterialFiles
    const files = Array.isArray(allMaterialFiles) ? allMaterialFiles : [];

    for (const file of files) {
        // Check folder path
        // file.path should be 'characters/name.txt' or similar if we have path info
        // If not, we rely on name or reading content?
        // Let's assume folder structure convention first.
        const isCharFolder = file.name.includes('/characters/') || (file.path && file.path.includes('characters/'));
        // Or check tags if content available

        let isChar = isCharFolder;
        if (!isChar && file.body) {
            const { metadata } = parseNote(file.body);
            if (metadata.tags?.includes('Character') || metadata.種別 === '登場人物') {
                isChar = true;
            }
        }

        if (isChar) {
            characters.push({
                id: generateId('C', charIndex++),
                name: file.name.replace('.txt', ''),
                filePath: file.path || file.name // Path relative to project root
            });
        }
    }

    // 3. Times
    // Extract from boardData timeline markers
    const rawTimeMarkers = Array.isArray(boardData?.timeMarkers) ? boardData.timeMarkers : [];
    const times = rawTimeMarkers.map(tm => ({
        id: tm.id,
        label: tm.label,
        absolute: tm.datetime || null
    }));

    // 4. Participations (Char x Scene)
    // From boardData.matrix ?
    // Assuming structure: { [sceneId]: { [charId]: role } } or similar
    const participations = [];
    if (boardData?.matrix && typeof boardData.matrix === 'object') {
        Object.entries(boardData.matrix).forEach(([sceneId, chars]) => {
            if (!chars || typeof chars !== 'object') return;
            Object.entries(chars).forEach(([charName, role]) => {
                // Map charName to CharID?
                const charObj = characters.find(c => c.name === charName);
                if (charObj) {
                    participations.push({
                        sceneId: sceneId,
                        charId: charObj.id,
                        role: role || "登場"
                    });
                }
            });
        });
    }

    // 5. Foreshadows
    const foreshadows = [];
    let foreIndex = 0;
    // Scan all materials for type="伏線"
    for (const file of allMaterialFiles) {
        if (file.body) {
            const { metadata } = parseNote(file.body);
            if (metadata.種別 === '伏線' || metadata.tags?.includes('伏線') || metadata.tags?.includes('Foreshadow')) {
                foreshadows.push({
                    id: generateId('F', foreIndex++),
                    name: file.name.replace('.txt', ''),
                    introSceneId: null, // Need analysis
                    hintSceneIds: [],
                    resolveSceneId: null,
                    note: metadata.summary || ""
                });
            }
        }
    }

    return {
        workTitle: typeof boardData?.title === 'string' ? boardData.title : "無題のプロジェクト",
        scenes,
        characters,
        times,
        participations,
        foreshadows
    };
};

// Helper
const extractTagValue = (text, tagName) => {
    if (!text) return null;
    const match = text.match(new RegExp(`#${tagName}:?\\s*(\\S+)`));
    return match ? match[1] : null;
};
