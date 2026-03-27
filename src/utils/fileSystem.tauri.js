/**
 * fileSystem.tauri.js
 * Tauri backend for fileSystem adapter.
 *
 * Uses @tauri-apps/api invoke() to call Rust commands.
 * This is a scaffold — each method needs a corresponding Rust command in src-tauri.
 *
 * Tauri invoke pattern:
 *   const result = await invoke('command_name', { arg1: value1, arg2: value2 });
 */

// Lazy import to avoid errors when Tauri is not present
let invoke = null;
async function getInvoke() {
  if (!invoke) {
    try {
      // Dynamic path construction to prevent Rollup from resolving this
      // when @tauri-apps/api is not installed
      const pkg = '@tauri-apps/api';
      const mod = await import(/* @vite-ignore */ `${pkg}/core`);
      invoke = mod.invoke;
    } catch {
      throw new Error('Tauri API not available');
    }
  }
  return invoke;
}

function extractName(p) {
  return p.split('/').pop().split('\\').pop();
}

export const tauriFileSystem = {
  async openProjectDialog() {
    const inv = await getInvoke();
    // Expects Rust command: open_project_dialog() -> Option<String>
    const path = await inv('open_project_dialog');
    if (!path) return null;
    return { handle: path, name: extractName(path), kind: 'directory' };
  },

  async readDirectory(dirHandle) {
    const inv = await getInvoke();
    // Expects Rust command: read_directory(path: String) -> Vec<FileEntry>
    return await inv('read_directory', { path: dirHandle.handle || dirHandle });
  },

  async getFileHandle(dirHandle, fileName, _options = {}) {
    const dirPath = dirHandle.handle || dirHandle;
    const separator = dirPath.includes('\\') ? '\\' : '/';
    const filePath = `${dirPath}${separator}${fileName}`;
    return { handle: filePath, name: fileName, kind: 'file' };
  },

  async getFile(dirHandle, fileName) {
    const inv = await getInvoke();
    const dirPath = dirHandle.handle || dirHandle;
    const separator = dirPath.includes('\\') ? '\\' : '/';
    const filePath = `${dirPath}${separator}${fileName}`;
    try {
      await inv('read_file', { path: filePath });
      return { handle: filePath, name: fileName, kind: 'file' };
    } catch {
      return null;
    }
  },

  async getOrCreateFile(dirHandle, fileName) {
    const handle = await this.getFile(dirHandle, fileName);
    if (handle) return handle;
    return await this.createFile(dirHandle, fileName, '');
  },

  async readFile(fileHandle) {
    const inv = await getInvoke();
    return await inv('read_file', { path: fileHandle.handle || fileHandle });
  },

  async writeFile(fileHandle, content) {
    const inv = await getInvoke();
    return await inv('write_file', { path: fileHandle.handle || fileHandle, content });
  },

  async createFile(parentHandle, fileName, content = '') {
    const inv = await getInvoke();
    const path = await inv('create_file', {
      parentPath: parentHandle.handle || parentHandle,
      fileName,
      content,
    });
    return { handle: path, name: extractName(path), kind: 'file' };
  },

  async createFolder(parentHandle, folderName) {
    const inv = await getInvoke();
    const path = await inv('create_folder', {
      parentPath: parentHandle.handle || parentHandle,
      folderName,
    });
    return { handle: path, name: folderName, kind: 'directory' };
  },

  async rename(handle, newName) {
    const inv = await getInvoke();
    const newPath = await inv('rename_entry', {
      oldPath: handle.handle || handle,
      newName,
    });
    return { handle: newPath, name: extractName(newPath), kind: handle.kind };
  },

  async deleteEntry(handle) {
    const inv = await getInvoke();
    return await inv('delete_entry', { path: handle.handle || handle });
  },

  async deleteEntryWithParent(handle, _parentHandle) {
    return this.deleteEntry(handle);
  },

  async moveFile(sourceHandle, targetDirHandle) {
    const inv = await getInvoke();
    const newPath = await inv('move_file', {
      sourcePath: sourceHandle.handle || sourceHandle,
      targetDir: targetDirHandle.handle || targetDirHandle,
    });
    return { handle: newPath, name: extractName(newPath), kind: sourceHandle.kind || 'file' };
  },

  async moveFileWithContext(sourceHandle, _sourceParentHandle, targetDirHandle) {
    return this.moveFile(sourceHandle, targetDirHandle);
  },

  async resolvePath(rootHandle, targetHandle) {
    const rootPath = (rootHandle.handle || rootHandle).replace(/\\/g, '/');
    const targetPath = (targetHandle.handle || targetHandle).replace(/\\/g, '/');

    if (!targetPath.toLowerCase().startsWith(rootPath.toLowerCase())) {
      return null;
    }

    const relative = targetPath.substring(rootPath.length);
    return relative.split('/').filter(p => p.length > 0);
  },

  async getDirectoryHandleFromPath(rootHandle, pathParts) {
    const rootPath = rootHandle.handle || rootHandle;
    const separator = rootPath.includes('\\') ? '\\' : '/';
    const fullPath = [rootPath, ...pathParts].join(separator);
    const name = pathParts.length > 0 ? pathParts[pathParts.length - 1] : rootHandle.name;
    return { handle: fullPath, name, kind: 'directory' };
  },

  async showInExplorer(handle) {
    const inv = await getInvoke();
    await inv('show_in_explorer', { path: handle.handle || handle });
  },

  async saveFile(defaultPath) {
    const inv = await getInvoke();
    return await inv('save_file_dialog', { defaultPath });
  },
};
