#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { recordJournal, readJournal, rotateJournalIfNeeded } = require('./journal.cjs');

let passed = 0, failed = 0;
function expect(name, cond, detail) {
    if (cond) {
        passed++;
        console.log(`  ✓ ${name}`);
    } else {
        failed++;
        console.error(`  ✗ ${name} ${detail ? ': ' + detail : ''}`);
    }
}

async function withTempProject(fn) {
    const tmpDir = path.join(os.tmpdir(), `nexus-test-journal-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
        await fn(tmpDir);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

async function testRecordAndRead() {
    console.log('\ntestRecordAndRead');
    await withTempProject(async (projectRoot) => {
        const entry = { ts: new Date().toISOString(), op: 'test.op', path: 'test.txt' };
        await recordJournal(projectRoot, entry);
        const entries = await readJournal(projectRoot);
        expect('1 entry read', entries.length === 1);
        expect('entry matches', entries[0].op === 'test.op');
    });
}

async function testDirectoryAutoCreate() {
    console.log('\ntestDirectoryAutoCreate');
    await withTempProject(async (projectRoot) => {
        const entry = { ts: new Date().toISOString(), op: 'test.op', path: 'test.txt' };
        await recordJournal(projectRoot, entry);
        const journalDir = path.join(projectRoot, '.nexus-project');
        expect('directory exists', fs.existsSync(journalDir));
    });
}

async function testAppendOnly() {
    console.log('\ntestAppendOnly');
    await withTempProject(async (projectRoot) => {
        await recordJournal(projectRoot, { op: 'op1' });
        await recordJournal(projectRoot, { op: 'op2' });
        const entries = await readJournal(projectRoot);
        expect('2 entries read', entries.length === 2);
        expect('order is correct', entries[0].op === 'op1' && entries[1].op === 'op2');
    });
}

async function testSilentFailOnMissingParent() {
    console.log('\ntestSilentFailOnMissingParent');
    await withTempProject(async (projectRoot) => {
        const fakeRoot = path.join(projectRoot, 'missing', 'dir');
        // This should not throw
        let threw = false;
        try {
            await recordJournal(fakeRoot, { op: 'op1' });
        } catch (err) {
            threw = true;
        }
        expect('did not throw', threw === false);
    });
}

async function testJsonlFormat() {
    console.log('\ntestJsonlFormat');
    await withTempProject(async (projectRoot) => {
        await recordJournal(projectRoot, { op: 'op1' });
        await recordJournal(projectRoot, { op: 'op2' });
        const rawContent = fs.readFileSync(path.join(projectRoot, '.nexus-project', 'journal.log'), 'utf8');
        const lines = rawContent.split('\n').filter(l => l.length > 0);
        expect('2 lines in raw text', lines.length === 2);
        expect('valid json lines', lines.every(l => {
            try { JSON.parse(l); return true; } catch { return false; }
        }));
    });
}

async function testRotateBySize() {
    console.log('\ntestRotateBySize');
    await withTempProject(async (projectRoot) => {
        const journalDir = path.join(projectRoot, '.nexus-project');
        fs.mkdirSync(journalDir);
        const journalPath = path.join(journalDir, 'journal.log');
        // create a large file (approx 101 MB)
        const buf = Buffer.alloc(101 * 1024 * 1024, 'a');
        fs.writeFileSync(journalPath, buf);
        
        // Mock the lastRotationCheck by manually calling rotateJournalIfNeeded
        // To bypass the 60s throttling, we can just edit the file and check or we can test the function directly
        // We need to require a fresh instance to avoid the 60s throttle
        delete require.cache[require.resolve('./journal.cjs')];
        const freshJournal = require('./journal.cjs');
        let { rotated } = await freshJournal.rotateJournalIfNeeded(projectRoot, journalDir);
        expect('rotated because of size', rotated === true);
    });
}

async function testRotateByMonth() {
    console.log('\ntestRotateByMonth');
    await withTempProject(async (projectRoot) => {
        const journalDir = path.join(projectRoot, '.nexus-project');
        fs.mkdirSync(journalDir);
        const journalPath = path.join(journalDir, 'journal.log');
        fs.writeFileSync(journalPath, '{"op":"old"}\n');
        
        // change mtime to last month
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        fs.utimesSync(journalPath, lastMonth, lastMonth);
        
        delete require.cache[require.resolve('./journal.cjs')];
        const freshJournal = require('./journal.cjs');
        let { rotated } = await freshJournal.rotateJournalIfNeeded(projectRoot, journalDir);
        expect('rotated because of month', rotated === true);
    });
}

async function testReadWithTimeFilter() {
    console.log('\ntestReadWithTimeFilter');
    await withTempProject(async (projectRoot) => {
        await recordJournal(projectRoot, { ts: '2026-04-19T10:00:00Z', op: 'old' });
        await recordJournal(projectRoot, { ts: '2026-04-19T11:00:00Z', op: 'new' });
        
        const entries = await readJournal(projectRoot, { sinceTs: '2026-04-19T10:30:00Z' });
        expect('only new entry', entries.length === 1 && entries[0].op === 'new');
    });
}

async function testConcurrentWrites() {
    console.log('\ntestConcurrentWrites');
    await withTempProject(async (projectRoot) => {
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(recordJournal(projectRoot, { op: `concurrent-${i}` }));
        }
        await Promise.all(promises);
        
        const entries = await readJournal(projectRoot);
        expect('10 entries written', entries.length === 10);
    });
}

// Ensure tests pass reliably without being blocked by throttle
const journalModule = require('./journal.cjs');
// We override the throttle limit temporarily using a mock or adjusting timestamp? 
// No obvious way in vanilla node without changing the source to allow test injection.
// We'll just run testRotateByMonth and testRotateBySize directly, accepting they might fail if throttle is active, 
// so let's reset the module cache to clear lastRotationCheck!

async function main() {
    const tests = [
        testRecordAndRead,
        testDirectoryAutoCreate,
        testAppendOnly,
        testSilentFailOnMissingParent,
        testJsonlFormat,
        testRotateBySize,
        testRotateByMonth,
        testReadWithTimeFilter,
        testConcurrentWrites,
    ];
    for (const t of tests) await t();
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
}
main();
