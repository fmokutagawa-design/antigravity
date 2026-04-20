import { useState, useCallback } from 'react';
import { fileSystem } from '../utils/fileSystem';
import {
    createSplitPlan,
    removeSegment,
    rebuildSegmentContents,
    updateDisplayName,
    resolveFileNameCollision,
} from '../utils/splitByChapters';

/**
 * 分割を実行する。
 *
 * 1. 元ファイルのディレクトリと基本情報を特定
 * 2. 元ファイルを <dir>/.backup/<name>_original_<ts>.txt にコピー（atomic）
 * 3. 新ファイル群を atomic write で順次作成
 *    - 既存ファイル名と衝突したら自動回避（resolveFileNameCollision）
 * 4. 途中で失敗したら、これまで作った新ファイルを削除（ロールバック）
 *    - バックアップは残す（ユーザーが手動で復元可能）
 * 5. 全部成功したら resolve
 *
 * 元ファイルは削除しない。両方存在する。
 */
async function performSplit({ plan, activeFileHandle, projectHandle, sourceText }) {
    // Step 1: ディレクトリ特定
    const filePath = typeof activeFileHandle === 'string'
        ? activeFileHandle
        : (activeFileHandle.handle || activeFileHandle.path);
    if (typeof filePath !== 'string') {
        throw new Error('cannot determine file path');
    }
    const sep = filePath.includes('\\') ? '\\' : '/';
    const parentDir = filePath.substring(0, filePath.lastIndexOf(sep));

    // Step 2: バックアップ作成
    //   .backup/ ディレクトリが無ければ作る
    const backupDirPath = `${parentDir}${sep}.backup`;
    try {
        await fileSystem.createFolder(
            { handle: parentDir, name: parentDir.split(sep).pop(), kind: 'directory' },
            '.backup'
        );
    } catch (e) {
        // 既にある場合は無視
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `${plan.baseName}_original_${ts}${plan.extension}`;
    const backupPath = `${backupDirPath}${sep}${backupFileName}`;
    await fileSystem.writeFile(
        { handle: backupPath, name: backupFileName, kind: 'file' },
        sourceText
    );

    // Step 3: 既存ファイル一覧を取得して衝突チェック
    const parentDirHandle = { handle: parentDir, name: parentDir.split(sep).pop(), kind: 'directory' };
    const existingEntries = await fileSystem.readDirectory(parentDirHandle);
    const existingNames = (existingEntries || [])
        .filter(e => e.kind === 'file')
        .map(e => e.name);

    // Step 4: 新ファイル群を atomic write で作成
    const createdPaths = [];
    try {
        for (const segment of plan.segments) {
            const targetName = resolveFileNameCollision(segment.proposedFileName, existingNames);
            const targetPath = `${parentDir}${sep}${targetName}`;
            await fileSystem.writeFile(
                { handle: targetPath, name: targetName, kind: 'file' },
                segment.content
            );
            createdPaths.push(targetPath);
            existingNames.push(targetName);  // 次の衝突チェックに反映
        }
    } catch (err) {
        // Step 5: ロールバック
        console.error('[split] error, rolling back:', err);
        for (const p of createdPaths) {
            try {
                await fileSystem.deleteEntry({ handle: p, name: p.split(sep).pop(), kind: 'file' });
            } catch (e) {
                console.warn('[split] rollback delete failed for', p, e);
            }
        }
        // バックアップは残す（復元の手がかり）
        throw err;
    }

    // Step 6: 成功。元ファイルは削除せずそのまま。
    return { createdCount: createdPaths.length, backupPath };
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
