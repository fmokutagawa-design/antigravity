import { useState, useCallback } from 'react';
import { fileSystem, isNative } from '../utils/fileSystem';
import {
    createSplitPlan,
    removeSegment,
    rebuildSegmentContents,
    updateDisplayName,
    resolveFileNameCollision,
} from '../utils/splitByChapters';

/**
 * 分割を実行する。
 */
async function performSplit({ plan, activeFileHandle, projectHandle, sourceText }) {
    // Step 1: ディレクトリ特定
    let parentDirHandle;
    if (isNative) {
        const filePath = typeof activeFileHandle === 'string'
            ? activeFileHandle
            : (activeFileHandle.handle || activeFileHandle.path);
        if (typeof filePath !== 'string') {
            throw new Error('cannot determine file path in native mode');
        }
        const sep = filePath.includes('\\') ? '\\' : '/';
        const parentPath = filePath.substring(0, filePath.lastIndexOf(sep));
        parentDirHandle = { handle: parentPath, name: parentPath.split(sep).pop(), kind: 'directory' };
    } else {
        // Web API Mode
        try {
            const pathParts = await fileSystem.resolvePath(projectHandle, activeFileHandle);
            if (pathParts && pathParts.length > 0) {
                pathParts.pop();
                parentDirHandle = await fileSystem.getDirectoryHandleFromPath(projectHandle, pathParts);
            } else {
                parentDirHandle = projectHandle;
            }
        } catch (e) {
            parentDirHandle = projectHandle;
        }
    }

    // Step 2: バックアップ作成
    let backupDirHandle;
    try {
        backupDirHandle = await fileSystem.createFolder(parentDirHandle, '.backup');
    } catch (e) {
        if (isNative) {
            const pPath = parentDirHandle.handle || parentDirHandle.path || parentDirHandle;
            const sep = pPath.includes('\\') ? '\\' : '/';
            const cleanP = pPath.endsWith(sep) ? pPath.slice(0, -1) : pPath;
            backupDirHandle = { handle: `${cleanP}${sep}.backup`, name: '.backup', kind: 'directory' };
        } else {
            throw e;
        }
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `${plan.baseName}_original_${ts}${plan.extension}`;
    await fileSystem.createFile(backupDirHandle, backupFileName, sourceText);

    // Step 3: 既存ファイル一覧を取得して衝突チェック
    const existingEntries = await fileSystem.readDirectory(parentDirHandle);
    const existingNames = (existingEntries || [])
        .filter(e => e.kind === 'file')
        .map(e => e.name);

    // Step 4: 新ファイル群を atomic write で作成
    const createdHandles = [];
    try {
        for (const segment of plan.segments) {
            const targetName = resolveFileNameCollision(segment.proposedFileName, existingNames);
            const targetHandle = await fileSystem.createFile(parentDirHandle, targetName, segment.content);
            createdHandles.push(targetHandle);
            existingNames.push(targetName);  // 次の衝突チェックに反映
        }
    } catch (err) {
        // Step 5: ロールバック
        console.error('[split] error, rolling back:', err);
        for (const h of createdHandles) {
            try {
                if (isNative) {
                    await fileSystem.deleteEntry(h);
                } else {
                    await fileSystem.deleteEntryWithParent(h, parentDirHandle);
                }
            } catch (e) {
                console.warn('[split] rollback delete failed for', h, e);
            }
        }
        throw err;
    }

    return { createdCount: createdHandles.length, backupPath: backupFileName };
}

/**
 * useSplitByChapters
 *
 * 章ごと分割機能のフック。
 * - モーダルの開閉管理
 * - 現在の計画 (SplitPlan) を保持
 * - 分割実行（バックアップ → 新ファイル作成 → ロールバック）
 */
export function useSplitByChapters({
    activeFileHandle,   // 現在開いているファイル
    text,               // そのファイルの本文
    projectHandle,      // プロジェクトルート
    refreshMaterials,   // 再読み込み
    showToast,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [plan, setPlan] = useState(null);
    const [sourceText, setSourceText] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);

    const openModal = useCallback(() => {
        if (!activeFileHandle || !text) {
            showToast('ファイルが開かれていません');
            return;
        }
        const fileName = typeof activeFileHandle === 'string'
            ? activeFileHandle.split(/[/\\]/).pop()
            : (activeFileHandle.name || 'untitled.txt');
        const newPlan = createSplitPlan(text, fileName);
        setSourceText(text);
        setPlan(newPlan);
        setIsOpen(true);
    }, [activeFileHandle, text, showToast]);

    const closeModal = useCallback(() => {
        setIsOpen(false);
        setPlan(null);
        setSourceText('');
    }, []);

    const handleRemoveSegment = useCallback((index) => {
        if (!plan) return;
        let next = removeSegment(plan, index);
        next = rebuildSegmentContents(next, sourceText);
        setPlan(next);
    }, [plan, sourceText]);

    const handleRenameSegment = useCallback((index, newName) => {
        if (!plan) return;
        setPlan(updateDisplayName(plan, index, newName));
    }, [plan]);

    const executeSplit = useCallback(async () => {
        if (!plan || !activeFileHandle || !projectHandle) return;
        setIsExecuting(true);

        try {
            await performSplit({ plan, activeFileHandle, projectHandle, sourceText });
            showToast(`${plan.segments.length} ファイルに分割しました`);
            if (refreshMaterials) {
                await refreshMaterials();
            }
            closeModal();
        } catch (e) {
            console.error('[split] failed:', e);
            showToast(`分割に失敗しました: ${e.message}`);
        } finally {
            setIsExecuting(false);
        }
    }, [plan, activeFileHandle, projectHandle, sourceText, showToast, refreshMaterials, closeModal]);

    return {
        isOpen,
        plan,
        isExecuting,
        openModal,
        closeModal,
        handleRemoveSegment,
        handleRenameSegment,
        executeSplit,
    };
}
