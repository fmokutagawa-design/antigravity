const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 900,
        backgroundColor: '#ffffff',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
            zoomFactor: 1.1 // 10% larger UI
        },
        titleBarStyle: 'hiddenInset', // Mac-like title bar
    });

    // Customize new window behavior (window.open)
    win.webContents.setWindowOpenHandler(({ url }) => {
        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                parent: null, // Detach from main window to behave as a separate top-level window
                titleBarStyle: 'default',
                frame: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'preload.cjs'), // preload必須: window.api を新ウィンドウでも使えるように
                }
            }
        };
    });

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// --- IPC Handlers for File System ---

ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (canceled) {
        return null;
    } else {
        return filePaths[0];
    }
});

ipcMain.handle('dialog:save', async (event, defaultPath) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: defaultPath,
        properties: ['createDirectory', 'showOverwriteConfirmation'],
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (canceled) {
        return null;
    } else {
        return filePath;
    }
});

function readDirRecursive(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    // Filter out hidden files
    const validEntries = entries.filter(e => !e.name.startsWith('.'));

    return validEntries.map(entry => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            return {
                name: entry.name,
                kind: 'directory',
                path: fullPath,
                handle: fullPath, // Use path as handle
                children: readDirRecursive(fullPath)
            };
        } else {
            return {
                name: entry.name,
                kind: 'file',
                path: fullPath,
                handle: fullPath
            };
        }
    });
}

// Read Directory Structure
ipcMain.handle('fs:readDirectory', async (event, dirPath) => {
    try {
        return readDirRecursive(dirPath);
    } catch (e) {
        console.error(e);
        throw e;
    }
});

// Read File Content
ipcMain.handle('fs:readFile', async (event, filePath) => {
    return fs.readFileSync(filePath, 'utf-8');
});

// Write File Content
ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
    return fs.writeFileSync(filePath, content, 'utf-8');
});

// Create Folder
ipcMain.handle('fs:createFolder', async (event, parentPath, folderName) => {
    const fullPath = path.join(parentPath, folderName);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath);
    }
    return fullPath;
});

// Create File (Empty or with content)
ipcMain.handle('fs:createFile', async (event, parentPath, fileName, content = '') => {
    // Ensure extension
    if (!fileName.includes('.')) fileName += '.txt'; // Default to txt if unspecified

    const fullPath = path.join(parentPath, fileName);
    fs.writeFileSync(fullPath, content, 'utf-8');
    return fullPath;
});

// Rename
ipcMain.handle('fs:rename', async (event, oldPath, newNameOrPath) => {
    let newPath;
    if (path.isAbsolute(newNameOrPath)) {
        newPath = newNameOrPath;
    } else {
        const directory = path.dirname(oldPath);
        newPath = path.join(directory, newNameOrPath);
    }
    fs.renameSync(oldPath, newPath);
    return newPath;
});

// Delete (to trash ideally, but simple delete for now)
ipcMain.handle('fs:delete', async (event, targetPath) => {
    // Check if dir or file
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
        fs.unlinkSync(targetPath);
    }
    return true;
});

// Show in Explorer
ipcMain.handle('fs:showInExplorer', async (event, path) => {
    shell.showItemInFolder(path);
});

// System Fonts
const fontList = require('font-list');
ipcMain.handle('system:getFonts', async () => {
    try {
        const fonts = await fontList.getFonts();
        return fonts.map(f => f.replace(/"/g, ''));
    } catch (e) {
        console.error("Failed to get fonts", e);
        return [];
    }
});
