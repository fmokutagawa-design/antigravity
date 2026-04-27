/**
 * NEXUS Integrated Proofreading Engine (textlint based)
 * Bridges the frontend to the high-performance linguistic hub in Electron Main process.
 */
export const textlintService = {
    /**
     * Analyzes the given text using the integrated linguistic hub (LanguageTool, RedPen, Tomarigi rules).
     * @param {string} text - The text to proofread.
     * @returns {Promise<Array>} - Array of proofreading results (messages).
     */
    async proofread(text) {
        if (!window.api || !window.api.textlint) {
            console.error("textlint API is not available in this environment.");
            return [];
        }

        try {
            return await window.api.textlint.proofread(text);
        } catch (error) {
            console.error("textlint proofread failed:", error);
            return [];
        }
    }
};
