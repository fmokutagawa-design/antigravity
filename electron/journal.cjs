/**
 * journal.cjs
 * Append-only JSONL logger for file mutations.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

let lastRotationCheck = 0;

/**
 * Determine the project root for a given file path.
 * 
 * If projectRoot is null/undefined, no journal is written.
 */
async function ensureJournalDir(projectRoot) {
    if (!projectRoot) return null;
    const journalDir = path.join(projectRoot, '.nexus-project');
    try {
        await fsp.mkdir(journalDir, { recursive: true });
        return journalDir;
    } catch (err) {
        console.warn(`[journal] failed to create journal directory: ${err.message}`);
        return null;
    }
}

/**
 * Rotate the journal if it exceeds size or age thresholds.
 */
async function rotateJournalIfNeeded(projectRoot, journalDir) {
    const now = Date.now();
    // Throttle rotation checks to at most once per minute
    if (now - lastRotationCheck < 60000) return { rotated: false };
    lastRotationCheck = now;

    const journalPath = path.join(journalDir, 'journal.log');
    
    let stats;
    try {
        stats = await fsp.stat(journalPath);
    } catch (err) {
        if (err.code === 'ENOENT') return { rotated: false };
        console.warn(`[journal] failed to stat journal: ${err.message}`);
        return { rotated: false };
    }

    const currentMonthStr = new Date(now).toISOString().slice(0, 7); // YYYY-MM
    const fileMonthStr = new Date(stats.mtime || stats.ctime || now).toISOString().slice(0, 7);
    
    const isOverSize = stats.size > 100 * 1024 * 1024; // 100MB
    const isDifferentMonth = currentMonthStr !== fileMonthStr;

    if (isOverSize || isDifferentMonth) {
        try {
            const archiveDir = path.join(journalDir, 'journal.archive');
            await fsp.mkdir(archiveDir, { recursive: true });
            const archivePath = path.join(archiveDir, `${fileMonthStr}.log`);
            
            // Note: simple rename. If the file already exists, it will be overwritten.
            // A more robust approach might append instead of unlinking, but simple rename is fine for now as per minimal requirements.
            // Actually, if we rotate within the same month (due to size), we might overwrite. Let's append timestamp if it exists.
            let finalArchivePath = archivePath;
            try {
                await fsp.access(archivePath);
                // File exists, append a timestamp
                finalArchivePath = path.join(archiveDir, `${fileMonthStr}_${now}.log`);
            } catch {
                // Doesn't exist, which is the expected case
            }

            await fsp.rename(journalPath, finalArchivePath);
            return { rotated: true, archivePath: finalArchivePath };
        } catch (err) {
            console.warn(`[journal] failed to rotate journal: ${err.message}`);
            return { rotated: false };
        }
    }
    
    return { rotated: false };
}

/**
 * Record an entry in the journal.
 * 
 * @param {string} projectRoot - Absolute path to project root
 * @param {object} entry - Entry to log. Must have at least { op, path }.
 * @returns {Promise<void>}
 */
async function recordJournal(projectRoot, entry) {
    if (!projectRoot || !entry) return;

    try {
        const journalDir = await ensureJournalDir(projectRoot);
        if (!journalDir) return;

        await rotateJournalIfNeeded(projectRoot, journalDir);

        const journalPath = path.join(journalDir, 'journal.log');
        const line = JSON.stringify(entry) + '\n';
        
        await fsp.appendFile(journalPath, line, 'utf8');
    } catch (err) {
        console.warn(`[journal] failed to record entry: ${err.message}`, { entry });
    }
}

/**
 * Read all journal entries (for debugging / recovery).
 * 
 * @param {string} projectRoot
 * @param {object} options - { sinceTs?: string } で時刻フィルタ可
 * @returns {Promise<object[]>} entry の配列
 */
async function readJournal(projectRoot, options = {}) {
    if (!projectRoot) return [];
    
    const journalPath = path.join(projectRoot, '.nexus-project', 'journal.log');
    let content = '';
    try {
        content = await fsp.readFile(journalPath, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }

    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const entries = [];
    for (const line of lines) {
        try {
            const entry = JSON.parse(line);
            if (options.sinceTs) {
                if (entry.ts && entry.ts >= options.sinceTs) {
                    entries.push(entry);
                }
            } else {
                entries.push(entry);
            }
        } catch (e) {
            // Ignore parse errors for individual lines
            console.warn(`[journal] failed to parse journal line: ${e.message}`);
        }
    }

    return entries;
}

module.exports = {
    recordJournal,
    readJournal,
    rotateJournalIfNeeded,
    ensureJournalDir,
};
