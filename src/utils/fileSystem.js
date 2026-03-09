export const isElectron = window.api && window.api.isElectron;

export const fileSystem = {
    // Open Project Directory
    async openProjectDialog() {
        if (isElectron) {
            const path = await window.api.fs.selectFolder();
            if (!path) return null;
            // In Electron, the "handle" is just the path string
            // But to be consistent with browser handle structure (which has .name), we wrap it or just use path
            // Actually browser handle has .name. Path string doesn't.
            const name = path.split('/').pop().split('\\').pop(); // Handle both separators
            return {
                handle: path,
                name: name,
                kind: 'directory'
            };
        } else {
            try {
                const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
                return handle; // handle.name exists
            } catch (e) {
                if (e.name !== 'AbortError') console.error(e);
                return null;
            }
        }
    },

    // Read Directory Structure
    async readDirectory(dirHandle) {
        if (isElectron) {
            // In Electron, handle is path string
            return await window.api.fs.readDirectory(dirHandle.handle || dirHandle);
        } else {
            // Browser: recursively scan
            return await scanDirectory(dirHandle);
        }
    },

    // Get File Handle (Get or Create)
    async getFileHandle(dirHandle, fileName, options = { create: false }) {
        if (isElectron) {
            const dirPath = dirHandle.handle || dirHandle;
            // Native path join? We don't have it on frontend.
            // Assumption: window.api.fs methods handle paths or we construct it.
            // Since we can't easily check existence without an API, we mimic browser behavior.
            // For Electron, we'll return a constructed handle object.
            // We rely on the backend to throw if file doesn't exist during read.
            // Separator: try to guess or just use slash (Node handles mixed usually, or we use a preload helper).
            // Actually, the existing `createFile` returns a full path.
            // We'll define the file path manually assuming '/' works or use an API if available.
            // Let's assume standard slash for now or that the backend handles it.
            // Wait, we can use a new API exposed if needed, but let's try to infer.
            const separator = dirPath.includes('\\') ? '\\' : '/';
            const filePath = `${dirPath}${separator}${fileName}`;
            return {
                handle: filePath,
                name: fileName,
                kind: 'file'
            };
        } else {
            return await dirHandle.getFileHandle(fileName, options);
        }
    },

    // Read File Content
    async readFile(fileHandle) {
        if (isElectron) {
            return await window.api.fs.readFile(fileHandle.handle || fileHandle);
        } else {
            const file = await fileHandle.getFile();
            return await file.text();
        }
    },

    // Write File Content
    async writeFile(fileHandle, content) {
        if (isElectron) {
            return await window.api.fs.writeFile(fileHandle.handle || fileHandle, content);
        } else {
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
        }
    },

    // Create File
    // Parent is: Directory Handle (Browser) or Path String (Electron)
    async createFile(parentHandle, fileName, content = '') {
        if (isElectron) {
            const path = await window.api.fs.createFile(parentHandle.handle || parentHandle, fileName, content);
            // Return a "handle" equivalent
            const name = path.split('/').pop().split('\\').pop();
            return { handle: path, name: name, kind: 'file' };
        } else {
            const newHandle = await parentHandle.getFileHandle(fileName, { create: true });
            const writable = await newHandle.createWritable();
            await writable.write(content);
            await writable.close();
            return newHandle;
        }
    },

    // Create Folder
    async createFolder(parentHandle, folderName) {
        if (isElectron) {
            // Backend call to create folder
            // We ignore the returned path because it might be malformed (double-absolute)
            // We reconstruct the trusted path ourselves.
            await window.api.fs.createFolder(parentHandle.handle || parentHandle, folderName);

            const parentPath = parentHandle.handle || parentHandle;
            const separator = parentPath.includes('\\') ? '\\' : '/';
            const cleanParent = parentPath.endsWith(separator) ? parentPath.slice(0, -1) : parentPath;
            // Ensure folderName doesn't have leading slash if we add separator
            const cleanFolder = folderName.replace(/^[/\\]/, '');

            const constructedPath = `${cleanParent}${separator}${cleanFolder}`;

            // Debug logging removed
            // console.log(`DEBUG CreateFolder: Result=${constructedPath}`);

            return { handle: constructedPath, name: cleanFolder, kind: 'directory' };
        } else {
            return await parentHandle.getDirectoryHandle(folderName, { create: true });
        }
    },

    // Rename (Only Electron can natively do this easily, Browser needs Copy+Delete workaround or not supported)
    async rename(handle, newName) {
        if (isElectron) {
            const newPath = await window.api.fs.rename(handle.handle || handle, newName);
            const name = newPath.split('/').pop().split('\\').pop();
            return { handle: newPath, name: name, kind: handle.kind };
        } else {
            alert("ブラウザ版ではリネームに対応していません");
            throw new Error("Rename not supported in browser");
        }
    },

    // Delete
    async deleteEntry(handle) {
        if (isElectron) {
            return await window.api.fs.delete(handle.handle || handle);
        } else {
            // Browser requires PARENT handle to remove entry.
            // Since our handle object doesn't know its parent, this is hard.
            // Abstraction Leak: Browser version requires parent. Electron takes path.
            // Solution: Pass parent handle if available.
            alert("ブラウザ版では直接削除に対応していません");
            throw new Error("Delete requires parent in browser");
        }
    },

    // Special Delete for Browser Compatibility (App.jsx logic usually has parent)
    async deleteEntryWithParent(handle, parentHandle) {
        if (isElectron) {
            return this.deleteEntry(handle);
        } else {
            // parentHandle must be DirectoryHandle
            // handle must be FileSystemHandle (File or Directory)
            if (!parentHandle || !parentHandle.removeEntry) {
                throw new Error("Invalid parent handle");
            }
            await parentHandle.removeEntry(handle.name, { recursive: true });
        }
    },

    // Move File (Key requested feature)
    async moveFile(sourceHandle, targetDirHandle) {
        if (isElectron) {
            const oldPath = sourceHandle.handle || sourceHandle;
            const dirPath = targetDirHandle.handle || targetDirHandle;

            // Robust Filename Extraction
            // Fixes bug where sourceHandle.name might be a full path or undefined
            let fileName;
            if (typeof oldPath === 'string') {
                const sep = oldPath.includes('\\') ? '\\' : '/';
                fileName = oldPath.split(sep).pop();
            } else {
                fileName = sourceHandle.name;
            }

            // Brute Force Path Stripping
            // Remove any path separators and take the last segment
            if (fileName) {
                fileName = fileName.replace(/\\/g, '/').split('/').pop();
            }

            if (!fileName) throw new Error("Cannot determine filename for move");

            // DEBUG: Catch Bad Paths BEFORE execution
            // const separator = ... (below)


            const separator = dirPath.includes('\\') ? '\\' : '/';
            const cleanDirPath = dirPath.endsWith(separator) ? dirPath.slice(0, -1) : dirPath;
            const absoluteNewPath = `${cleanDirPath}${separator}${fileName}`;

            // Revert to using Absolute Path now that createFolder input is trusted.
            // Earlier "Double Path" error was likely due to createFolder returning malformed path,/
            // not backend logic prepending root.

            try {
                await window.api.fs.rename(oldPath, absoluteNewPath);
            } catch (e) {
                console.error("FS Rename Error args:", oldPath, "->", absoluteNewPath);
                throw e;
            }

            return {
                handle: absoluteNewPath,
                name: fileName,
                kind: sourceHandle.kind || 'file'
            };
        } else {
            // Browser: Copy and Delete
            // 1. Read source content
            const file = await sourceHandle.getFile();
            const content = await file.text();

            // 2. Create in target
            const newHandle = await targetDirHandle.getFileHandle(sourceHandle.name, { create: true });
            const writable = await newHandle.createWritable();
            await writable.write(content);
            await writable.close();

            // 3. Delete source (Requires parent handle!)
            // We cannot delete source without parent handle in browser.
            // This is a blocker for pure handle-based move without parent context.
            // The App must pass parent handle to move logic or we throw.
            throw new Error("Browser move requires context (parent) which is not available in simple handle move. Use App level logic.");
        }
    },

    // Move File with Context (Browser safe)
    async moveFileWithContext(sourceHandle, sourceParentHandle, targetDirHandle) {
        if (isElectron) {
            return this.moveFile(sourceHandle, targetDirHandle);
        } else {
            // Browser: Copy and Delete
            // 1. Read source
            const file = await sourceHandle.getFile();
            const content = await file.text();

            // 2. Create in target
            const newHandle = await targetDirHandle.getFileHandle(sourceHandle.name, { create: true });
            const writable = await newHandle.createWritable();
            await writable.write(content);
            await writable.close();

            // 3. Delete from source parent
            await sourceParentHandle.removeEntry(sourceHandle.name);
            return newHandle;
        }
    },

    // Resolve Path (Return array of parts from root to target)
    // Root: DirectoryHandle (or {handle: path...})
    // Target: FileSystemHandle (or {handle: path...})
    async resolvePath(rootHandle, targetHandle) {
        if (isElectron) {
            const rootPath = rootHandle.handle || rootHandle;
            const targetPath = targetHandle.handle || targetHandle;

            // Normalize separators
            const normalize = p => p.replace(/\\/g, '/');
            // Case-insensitive check (essential for Mac/Windows)
            const rootNorm = normalize(rootPath).toLowerCase();
            const targetNorm = normalize(targetPath).toLowerCase();

            if (!targetNorm.startsWith(rootNorm)) {
                console.warn(`Path mismatch: ${rootNorm} vs ${targetNorm}`);
                return null;
            }

            // Extract relative path (preserving original casing of the tail)
            const rootLen = normalize(rootPath).length;
            const relative = normalize(targetPath).substring(rootLen);

            return relative.split('/').filter(p => p.length > 0);
        } else {
            return await rootHandle.resolve(targetHandle);
        }
    },

    // Get Directory Handle From Path (Traverse from root)
    async getDirectoryHandleFromPath(rootHandle, pathParts) {
        if (isElectron) {
            const rootPath = rootHandle.handle || rootHandle;
            const separator = rootPath.includes('\\') ? '\\' : '/';
            // Simple join, assuming clean parts
            const fullPath = [rootPath, ...pathParts].join(separator);
            const name = pathParts.length > 0 ? pathParts[pathParts.length - 1] : rootHandle.name;
            return {
                handle: fullPath,
                name: name,
                kind: 'directory'
            };
        } else {
            let current = rootHandle;
            for (const part of pathParts) {
                current = await current.getDirectoryHandle(part);
            }
            return current;
        }
    },

    // Show in Explorer/Finder
    async showInExplorer(handle) {
        if (isElectron) {
            await window.api.fs.showInExplorer(handle.handle || handle);
        } else {
            alert(
                'ブラウザ版ではFinder/エクスプローラーで表示できません。\n' +
                'Electron版をお使いください。'
            );
        }
    }
};

// Browser Helper
async function scanDirectory(dirHandle) {
    const values = [];
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
            if (!entry.name.startsWith('.') && (entry.name.endsWith('.txt') || entry.name.endsWith('.md'))) {
                values.push({
                    name: entry.name,
                    kind: 'file',
                    handle: entry
                });
            }
        } else if (entry.kind === 'directory') {
            if (!entry.name.startsWith('.')) {
                values.push({
                    name: entry.name,
                    kind: 'directory',
                    handle: entry,
                    children: await scanDirectory(entry)
                });
            }
        }
    }
    // Sort: Folders first, then files
    values.sort((a, b) => {
        if (a.kind === b.kind) return a.name.localeCompare(b.name);
        return a.kind === 'directory' ? -1 : 1;
    });
    return values;
}
