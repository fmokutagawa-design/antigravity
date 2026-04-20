const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const {
    atomicWriteTextFile,
    atomicWriteBinaryFile,
    ValidationError,
} = require('./atomicWrite.cjs');

const isDev = !app.isPackaged;

// Mac用Editメニュー設定
const template = [
    ...(process.platform === 'darwin' ? [{
        label: app.name,
        submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    }] : []),
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' }
        ]
    },
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    }
];

function createWindow() {
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

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

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
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

// Read File Content (Text)
ipcMain.handle('fs:readFile', async (event, filePath) => {
    return fs.readFileSync(filePath, 'utf-8');
});

// Read File Content (Binary)
ipcMain.handle('fs:readFileBinary', async (event, filePath) => {
    return fs.readFileSync(filePath); // Returns Buffer
});

// Write File Content (Text)
// ★ atomic write 経由で書き込む。途中クラッシュで半端なファイルが残らない。
//    空文字列や NULL 文字は事前検証で弾く（原稿消失事故の防止）。
// ★ 呼び出し側が意図的に空ファイルを作りたい場合は fs:createFile を使う。
//    fs:writeFile は既存ファイルの更新を想定しており、空を書くのはまず不正。
ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
    try {
        const projectRoot = globalProjectRoot || path.dirname(filePath);
        await atomicWriteTextFile(filePath, content, { projectRoot });
        return { ok: true };
    } catch (err) {
        if (err instanceof ValidationError) {
            // 原稿を守るために書き込みを拒否した場合は、呼び出し側が認識できる形で返す
            console.warn(`[atomicWrite] rejected: ${err.message}`, { filePath, code: err.code });
            throw new Error(`VALIDATION_FAILED:${err.code}:${err.message}`);
        }
        throw err;
    }
});

// Write File Content (Binary)
ipcMain.handle('fs:writeFileBinary', async (event, filePath, buffer) => {
    try {
        const projectRoot = globalProjectRoot || path.dirname(filePath);
        await atomicWriteBinaryFile(filePath, Buffer.from(buffer), { projectRoot });
        return { ok: true };
    } catch (err) {
        if (err instanceof ValidationError) {
            console.warn(`[atomicWrite] binary rejected: ${err.message}`, { filePath });
            throw new Error(`VALIDATION_FAILED:${err.code}:${err.message}`);
        }
        throw err;
    }
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
// ★ 新規ファイル作成は atomic write を使うが、空文字列で作ることを許可する
//    （allowEmpty: true）。すでに同名ファイルがある場合の上書き時も同じ経路を通る。
ipcMain.handle('fs:createFile', async (event, parentPath, fileName, content = '') => {
    // Ensure extension
    if (!fileName.includes('.')) fileName += '.txt'; // Default to txt if unspecified

    const fullPath = path.join(parentPath, fileName);
    try {
        const projectRoot = globalProjectRoot || parentPath;
        await atomicWriteTextFile(fullPath, content, { allowEmpty: true, projectRoot });
    } catch (err) {
        if (err instanceof ValidationError) {
            throw new Error(`VALIDATION_FAILED:${err.code}:${err.message}`);
        }
        throw err;
    }
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

// --- Persistence and Caching ---
const SETTINGS_FILE = path.join(app.getPath('userData'), 'user_settings.json');
const FONT_CACHE_FILE = path.join(app.getPath('userData'), 'font_cache.json');

let globalProjectRoot = null;

// Get Application Settings
ipcMain.handle('app:getSettings', async () => {
    if (fs.existsSync(SETTINGS_FILE)) {
        try {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
            if (settings && settings.projectPath) {
                globalProjectRoot = typeof settings.projectPath === 'string'
                    ? settings.projectPath
                    : (settings.projectPath.handle || settings.projectPath.path);
            }
            return settings;
        } catch (e) {
            console.error("Failed to parse settings file", e);
        }
    }
    return null;
});

// Save Application Settings
ipcMain.handle('app:saveSettings', async (event, settings) => {
    if (settings && settings.projectPath) {
        globalProjectRoot = typeof settings.projectPath === 'string'
            ? settings.projectPath
            : (settings.projectPath.handle || settings.projectPath.path);
    }
    try {
        await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error("Failed to save settings file", e);
        return false;
    }
});

// System Fonts with Persistent Cache
const { exec } = require('child_process');
let memoryFontCache = null;

// Background scan worker
const scanFontsInternal = () => new Promise((resolve, reject) => {
    const jxaScript = `
        ObjC.import("AppKit");
        var fm = $.NSFontManager.sharedFontManager;
        if (!fm) throw new Error("Could not get sharedFontManager");
        var fList = fm.availableFontFamilies;
        var res = [];
        for (var i = 0; i < fList.count; i++) {
            var fam = fList.objectAtIndex(i);
            if (!fam) continue;
            var members = fm.availableMembersOfFontFamily(fam);
            var mList = [];
            if (members && members.count) {
                for (var j = 0; j < members.count; j++) {
                    var m = members.objectAtIndex(j);
                    if (m && m.count >= 2) {
                        mList.push({ps: m.objectAtIndex(0).js, weight: m.objectAtIndex(1).js});
                    }
                }
            }
            res.push({family: fam.js, fonts: mList});
        }
        JSON.stringify(res);
    `.replace(/\n/g, ' ');

    exec(`osascript -l JavaScript -e '${jxaScript}'`, { maxBuffer: 15 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
            // Fallback to simple scan if JXA fails
            const fontList = require('font-list');
            fontList.getFonts({ maxBuffer: 10 * 1024 * 1024 })
                .then(fonts => {
                    const legacyData = fonts.map(f => {
                        const name = f.replace(/"/g, '');
                        return { family: name, fonts: [{ ps: name, weight: 'Regular' }] };
                    });
                    resolve(legacyData);
                })
                .catch(reject);
        } else {
            try {
                resolve(JSON.parse(stdout));
            } catch (e) {
                reject(e);
            }
        }
    });
});

ipcMain.handle('system:getFonts', async () => {
    // 1. Return memory cache immediately if available
    if (memoryFontCache) return memoryFontCache;

    // 2. Try to load from persistent cache file
    if (fs.existsSync(FONT_CACHE_FILE)) {
        try {
            const cached = JSON.parse(fs.readFileSync(FONT_CACHE_FILE, 'utf-8'));
            if (cached && cached.length > 0) {
                memoryFontCache = cached;
                // Kick off background scan to keep cache fresh without blocking
                console.log("Returning cached fonts, updating in background...");
                scanFontsInternal().then(freshData => {
                    memoryFontCache = freshData;
                    fs.writeFileSync(FONT_CACHE_FILE, JSON.stringify(freshData), 'utf-8');
                }).catch(e => console.error("Background font scan failed", e));
                return cached;
            }
        } catch (e) {
            console.error("Failed to read font cache", e);
        }
    }

    // 3. No cache available, must block for initial scan
    console.log("No font cache, performing initial scan...");
    try {
        const data = await scanFontsInternal();
        memoryFontCache = data;
        fs.writeFileSync(FONT_CACHE_FILE, JSON.stringify(data), 'utf-8');
        return data;
    } catch (e) {
        console.error("Initial font scan failed", e);
        return [];
    }
});
