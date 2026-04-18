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

// ★ snapshot は localStorage に 全文 × 最大50世代 を保存する。
//    42万字 × 50世代 = 最大21MB、しかも localStorage は同期 API。
//    JSON.stringify → setItem の間、メインスレッドがブロックされる。
//    大規模テキストではスキップする。
const SNAPSHOT_CHAR_LIMIT = 100000;

export async function saveSnapshot(filePath, content, charCount) {
    if (content && content.length > SNAPSHOT_CHAR_LIMIT) {
        // 大規模テキストは localStorage に載せない
        return;
    }
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
