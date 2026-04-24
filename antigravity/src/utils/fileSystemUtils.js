// File System Access API utilities

/**
 * Open a directory picker and return the directory handle
 */
export async function openDirectory() {
    try {
        const dirHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });
        return dirHandle;
    } catch (err) {
        if (err.name === 'AbortError') {
            return null; // User cancelled
        }
        throw err;
    }
}

/**
 * Recursively read directory structure
 */
export async function readDirectoryTree(dirHandle, level = 0) {
    const tree = [];

    for await (const entry of dirHandle.values()) {
        // Skip non-.txt files
        if (entry.kind === 'file' && !entry.name.endsWith('.txt')) {
            continue;
        }

        const item = {
            name: entry.name,
            kind: entry.kind,  // Changed from 'type' to 'kind'
            handle: entry
        };

        if (entry.kind === 'directory') {
            item.children = await readDirectoryTree(entry, level + 1);
            // Only skip empty directories if NOT at root level (level 0)
            if (item.children.length === 0 && level > 0) {
                continue;
            }
        }

        tree.push(item);
    }

    // Sort: directories first, then files, alphabetically
    tree.sort((a, b) => {
        if (a.kind !== b.kind) {  // Changed from 'type' to 'kind'
            return a.kind === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    return tree;
}

/**
 * Read file content from file handle
 */
export async function readFileContent(fileHandle) {
    const file = await fileHandle.getFile();
    const text = await file.text();
    return text;
}

/**
 * Write content to file handle
 */
export async function writeFileContent(fileHandle, content) {
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}

/**
 * Create a new file in directory
 */
export async function createFile(dirHandle, fileName) {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    return fileHandle;
}

/**
 * Create a new directory
 */
export async function createDirectory(dirHandle, dirName) {
    const newDirHandle = await dirHandle.getDirectoryHandle(dirName, { create: true });
    return newDirHandle;
}

/**
 * Delete a file or directory
 */
export async function deleteEntry(dirHandle, entryName) {
    await dirHandle.removeEntry(entryName, { recursive: true });
}

/**
 * Move a file from source directory to target directory
 * Since 'move' is not directly supported, we copy and delete.
 * Returns the new file handle.
 */
export async function moveFile(sourceDirHandle, fileName, targetDirHandle) {
    // 1. Read source
    const sourceFileHandle = await sourceDirHandle.getFileHandle(fileName);
    const file = await sourceFileHandle.getFile();
    const content = await file.text();

    // 2. Create target (overwrite if exists, or handle collision?)
    // For now, overwrite is default behavior of createWritable but getFileHandle doesn't overwrite.
    const newFileHandle = await targetDirHandle.getFileHandle(fileName, { create: true });
    const writable = await newFileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    // 3. Delete source
    await sourceDirHandle.removeEntry(fileName);

    return newFileHandle;
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported() {
    return 'showDirectoryPicker' in window;
}
