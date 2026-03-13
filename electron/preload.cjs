const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('api', {
    fs: {
        selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
        saveFile: (defaultPath) => ipcRenderer.invoke('dialog:save', defaultPath),
        readDirectory: (path) => ipcRenderer.invoke('fs:readDirectory', path),
        readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
        writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
        createFolder: (parentPath, name) => ipcRenderer.invoke('fs:createFolder', parentPath, name),
        createFile: (parentPath, name, content) => ipcRenderer.invoke('fs:createFile', parentPath, name, content),
        rename: (oldPath, newName) => ipcRenderer.invoke('fs:rename', oldPath, newName),
        delete: (path) => ipcRenderer.invoke('fs:delete', path),
        showInExplorer: (path) => ipcRenderer.invoke('fs:showInExplorer', path),
    },
    system: {
        getFonts: () => ipcRenderer.invoke('system:getFonts')
    },
    // Generic invoke for settings/persistence
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    // UIスケール用: webFrame.setZoomFactor でビューポート全体を正しくズーム
    setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
    isElectron: true
});
