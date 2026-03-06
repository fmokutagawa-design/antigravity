
/**
 * Find unlinked mentions of file names in text
 * @param {string} text - The text to scan
 * @param {Array} allFiles - List of all files in the project
 * @returns {Array} - List of mentions { term, index, context }
 */
export function findUnlinkedMentions(text, allFiles) {
    if (!text || !allFiles) return [];

    const mentions = [];
    const fileNames = allFiles
        .map(f => f.name.replace(/\.[^/.]+$/, "")) // Remove extension
        .filter(n => n.length >= 2); // Ignore single char names to avoid noise

    // Sort by length desc to match longest first
    fileNames.sort((a, b) => b.length - a.length);

    // Create a set for fast lookup
    const nameSet = new Set(fileNames);

    // Helper to check if index is inside [[...]]
    // This is a naive implementation. For huge texts, we might need a better parser.
    const isInsideLink = (index, fullText) => {
        const before = fullText.substring(0, index);
        const after = fullText.substring(index);
        const lastOpen = before.lastIndexOf('[[');
        const lastClose = before.lastIndexOf(']]');
        const nextClose = after.indexOf(']]');
        const nextOpen = after.indexOf('[[');

        // If we have an opening bracket before us that hasn't been closed yet
        if (lastOpen > lastClose) {
            // And there is a closing bracket after us before any new opening bracket
            if (nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen)) {
                return true;
            }
        }
        return false;
    };

    // We scan the text for each filename
    // Note: This is O(N*M) where N=files, M=text length. 
    // For 1000 files and typical novel length, it might be slow if done on every keystroke.
    // Should be done on demand or debounced.

    fileNames.forEach(name => {
        // Escape regex special chars
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedName, 'g');

        let match;
        while ((match = regex.exec(text)) !== null) {
            // Check if already linked
            if (!isInsideLink(match.index, text)) {
                // Get context (surrounding text)
                const start = Math.max(0, match.index - 10);
                const end = Math.min(text.length, match.index + name.length + 10);
                const context = text.substring(start, end);

                mentions.push({
                    term: name,
                    index: match.index,
                    context: `...${context}...`
                });
            }
        }
    });

    // Remove duplicates (overlapping matches)
    // If "Super Hero" matches, "Hero" might also match at the same place.
    // We prefer the longer match.
    // Since we sorted fileNames by length, the first match at a given index is the longest.

    const uniqueMentions = [];
    const coveredIndices = new Set();

    // Sort mentions by index
    mentions.sort((a, b) => a.index - b.index);

    for (const m of mentions) {
        let isCovered = false;
        for (let i = 0; i < m.term.length; i++) {
            if (coveredIndices.has(m.index + i)) {
                isCovered = true;
                break;
            }
        }

        if (!isCovered) {
            uniqueMentions.push(m);
            for (let i = 0; i < m.term.length; i++) {
                coveredIndices.add(m.index + i);
            }
        }
    }

    return uniqueMentions;
}
