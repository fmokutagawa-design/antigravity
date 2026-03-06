/**
 * snapshotStore.js
 * 
 * localStorage を使ったスナップショット保存。
 * ファイルごとに最大50世代保持（FIFO）。
 * 同期的に動作するのでハングしない。
 */

const MAX_SNAPSHOTS = 50;
const LS_PREFIX = 'nexus-snap-';

function makeKey(filePath) {
    try {
        return LS_PREFIX + btoa(unescape(encodeURIComponent(filePath))).replace(/=/g, '');
    } catch {
        return LS_PREFIX + filePath.replace(/[^a-zA-Z0-9]/g, '_');
    }
}

function readList(filePath) {
    try {
        const raw = localStorage.getItem(makeKey(filePath));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function writeList(filePath, list) {
    try {
        localStorage.setItem(makeKey(filePath), JSON.stringify(list));
    } catch (e) {
        // localStorage full — trim to 10
        console.warn('localStorage full, trimming snapshots:', e.message);
        try {
            localStorage.setItem(makeKey(filePath), JSON.stringify(list.slice(-10)));
        } catch { /* give up */ }
    }
}

export async function saveSnapshot(filePath, content, charCount) {
    const list = readList(filePath);
    list.push({
        id: Date.now(),
        filePath,
        content,
        charCount,
        timestamp: Date.now()
    });
    if (list.length > MAX_SNAPSHOTS) {
        list.splice(0, list.length - MAX_SNAPSHOTS);
    }
    writeList(filePath, list);
}

export async function getSnapshots(filePath) {
    const list = readList(filePath);
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
}

export async function clearSnapshots(filePath) {
    try {
        localStorage.removeItem(makeKey(filePath));
    } catch { /* ignore */ }
}
