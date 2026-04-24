/**
 * Save text content as a .txt file
 * @param {string} text - The text content to save
 * @param {string} filename - Optional filename (default: novel_YYYYMMDD_HHMMSS.txt)
 */
export const saveTextFile = (text, filename) => {
    // Generate default filename if not provided
    if (!filename) {
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
        filename = `novel_${timestamp}.txt`;
    }

    // Ensure .txt extension
    if (!filename.endsWith('.txt')) {
        filename += '.txt';
    }

    // Create blob and download
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Load text content from a file
 * @param {File} file - The file object to read
 * @returns {Promise<string>} - Promise that resolves with the file content
 */
export const loadTextFile = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file provided'));
            return;
        }

        // Check if it's a text file
        if (!file.name.endsWith('.txt') && !file.type.includes('text')) {
            reject(new Error('Please select a .txt file'));
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            resolve(e.target.result);
        };

        reader.onerror = (e) => {
            reject(new Error('Failed to read file'));
        };

        // Read as UTF-8 text
        reader.readAsText(file, 'UTF-8');
    });
};
