/**
 * atomicWrite.cjs の動作確認テスト。
 * 
 * node electron/atomicWrite.test.cjs で実行。
 * 通常の単体テストフレームワークは使わず、Electron 不要で直接走らせる。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    atomicWriteTextFile,
    atomicWriteBinaryFile,
    validateTextPayload,
    classifyShrink,
    ValidationError,
} = require('./atomicWrite.cjs');

let passed = 0;
let failed = 0;

function expect(name, cond, detail) {
    if (cond) {
        passed++;
        console.log(`  ✓ ${name}`);
    } else {
        failed++;
        console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
    }
}

async function withTempDir(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomicwrite-test-'));
    try {
        return await fn(dir);
    } finally {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
}

// ============================================================
async function testBasicWrite() {
    console.log('testBasicWrite');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'hello.txt');
        const result = await atomicWriteTextFile(target, 'hello world');
        const readBack = fs.readFileSync(target, 'utf8');
        expect('content matches', readBack === 'hello world');
        expect('returns hash', typeof result.hash === 'string' && result.hash.length === 64);
        expect('returns bytes', result.bytes === 11);
        expect('returns shrinkClass', result.shrinkClass === 'normal');
    });
}

async function testOverwrite() {
    console.log('testOverwrite');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'hello.txt');
        fs.writeFileSync(target, 'original content');
        await atomicWriteTextFile(target, 'updated content');
        const readBack = fs.readFileSync(target, 'utf8');
        expect('overwrite succeeded', readBack === 'updated content');
    });
}

async function testRejectEmpty() {
    console.log('testRejectEmpty');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'hello.txt');
        fs.writeFileSync(target, 'original content');
        let threw = null;
        try {
            await atomicWriteTextFile(target, '');
        } catch (err) {
            threw = err;
        }
        expect('threw ValidationError', threw instanceof ValidationError);
        expect('code V-1', threw?.code === 'V-1');
        const readBack = fs.readFileSync(target, 'utf8');
        expect('original preserved', readBack === 'original content');
    });
}

async function testAllowEmpty() {
    console.log('testAllowEmpty');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'hello.txt');
        await atomicWriteTextFile(target, '', { allowEmpty: true });
        expect('empty file created', fs.existsSync(target));
        expect('is empty', fs.readFileSync(target, 'utf8') === '');
    });
}

async function testRejectNonString() {
    console.log('testRejectNonString');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'hello.txt');
        let threw = null;
        try {
            await atomicWriteTextFile(target, 12345);
        } catch (err) {
            threw = err;
        }
        expect('threw ValidationError', threw instanceof ValidationError);
        expect('code V-2', threw?.code === 'V-2');
    });
}

async function testRejectNullChar() {
    console.log('testRejectNullChar');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'hello.txt');
        let threw = null;
        try {
            await atomicWriteTextFile(target, 'abc\u0000def');
        } catch (err) {
            threw = err;
        }
        expect('threw ValidationError', threw instanceof ValidationError);
        expect('code V-4', threw?.code === 'V-4');
    });
}

async function testExtremeShrinkNotBlocked() {
    console.log('testExtremeShrinkNotBlocked');
    // 95%超縮小でも、strictShrink指定がない限りは書き込まれる
    // （呼び出し側の判断で警告ダイアログを出す設計）
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'hello.txt');
        fs.writeFileSync(target, 'x'.repeat(1000));
        const result = await atomicWriteTextFile(target, 'short');
        expect('write succeeded', fs.readFileSync(target, 'utf8') === 'short');
        expect('shrinkClass reports extreme', result.shrinkClass === 'extreme-shrink');
    });
}

async function testStrictShrinkBlocks() {
    console.log('testStrictShrinkBlocks');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'hello.txt');
        const original = 'x'.repeat(1000);
        fs.writeFileSync(target, original);
        let threw = null;
        try {
            await atomicWriteTextFile(target, 'short', { strictShrink: true });
        } catch (err) {
            threw = err;
        }
        expect('threw ValidationError', threw instanceof ValidationError);
        expect('code V-3b', threw?.code === 'V-3b');
        const readBack = fs.readFileSync(target, 'utf8');
        expect('original preserved', readBack === original);
    });
}

async function testModerateShrinkNotBlocked() {
    console.log('testModerateShrinkNotBlocked');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'hello.txt');
        fs.writeFileSync(target, 'x'.repeat(1000));
        const result = await atomicWriteTextFile(target, 'y'.repeat(400), { strictShrink: true });
        expect('moderate shrink passes', fs.readFileSync(target, 'utf8').length === 400);
        expect('shrinkClass moderate', result.shrinkClass === 'moderate-shrink');
    });
}

async function testNoTempFileLeft() {
    console.log('testNoTempFileLeft');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'hello.txt');
        await atomicWriteTextFile(target, 'content');
        const entries = fs.readdirSync(dir);
        const temps = entries.filter(n => /\.tmp\./.test(n));
        expect('no leftover temp files', temps.length === 0, `found: ${temps.join(', ')}`);
    });
}

async function testLargeContent() {
    console.log('testLargeContent');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'big.txt');
        // 420000字の日本語テキスト（「あ」の繰り返し）
        const big = 'あ'.repeat(420000);
        const result = await atomicWriteTextFile(target, big);
        const readBack = fs.readFileSync(target, 'utf8');
        expect('content identical', readBack === big);
        expect('bytes correct', result.bytes === Buffer.byteLength(big, 'utf8'));
    });
}

async function testJapaneseContent() {
    console.log('testJapaneseContent');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'jp.txt');
        const jp = '吾輩は猫である。名前はまだ無い。\nどこで生れたか頓と見当がつかぬ。\n《ルビ》や［＃タグ］もあり。';
        await atomicWriteTextFile(target, jp);
        const readBack = fs.readFileSync(target, 'utf8');
        expect('japanese preserved', readBack === jp);
    });
}

async function testBinaryWrite() {
    console.log('testBinaryWrite');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'img.bin');
        const buf = Buffer.from([0, 1, 2, 3, 4, 0xff, 0xfe, 0xfd]);
        await atomicWriteBinaryFile(target, buf);
        const readBack = fs.readFileSync(target);
        expect('binary preserved', Buffer.compare(readBack, buf) === 0);
    });
}

async function testBinaryRejectEmpty() {
    console.log('testBinaryRejectEmpty');
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'empty.bin');
        let threw = null;
        try {
            await atomicWriteBinaryFile(target, Buffer.alloc(0));
        } catch (err) {
            threw = err;
        }
        expect('threw ValidationError', threw instanceof ValidationError);
    });
}

async function testClassifyShrink() {
    console.log('testClassifyShrink');
    expect('normal (no prev)', classifyShrink(null, 100) === 'normal');
    expect('normal (zero prev)', classifyShrink(0, 100) === 'normal');
    expect('normal (growth)', classifyShrink(100, 200) === 'normal');
    expect('normal (minor shrink)', classifyShrink(100, 90) === 'normal');
    expect('moderate', classifyShrink(1000, 400) === 'moderate-shrink');
    expect('extreme', classifyShrink(1000, 40) === 'extreme-shrink');
    expect('boundary 50%', classifyShrink(1000, 499) === 'moderate-shrink');
    expect('boundary 95%', classifyShrink(1000, 49) === 'extreme-shrink');
}

async function testValidateHelper() {
    console.log('testValidateHelper');
    let threw;
    try { validateTextPayload(''); } catch (e) { threw = e; }
    expect('empty rejected', threw?.code === 'V-1');

    threw = null;
    try { validateTextPayload('hello', { allowEmpty: true }); } catch (e) { threw = e; }
    expect('non-empty with allowEmpty OK', threw === null);

    threw = null;
    try { validateTextPayload('', { allowEmpty: true }); } catch (e) { threw = e; }
    expect('empty with allowEmpty OK', threw === null);

    threw = null;
    try { validateTextPayload('abc\u0000'); } catch (e) { threw = e; }
    expect('null char rejected', threw?.code === 'V-4');
}

// ============================================================

async function main() {
    const tests = [
        testBasicWrite,
        testOverwrite,
        testRejectEmpty,
        testAllowEmpty,
        testRejectNonString,
        testRejectNullChar,
        testExtremeShrinkNotBlocked,
        testStrictShrinkBlocks,
        testModerateShrinkNotBlocked,
        testNoTempFileLeft,
        testLargeContent,
        testJapaneseContent,
        testBinaryWrite,
        testBinaryRejectEmpty,
        testClassifyShrink,
        testValidateHelper,
    ];

    for (const t of tests) {
        try {
            await t();
        } catch (err) {
            failed++;
            console.error(`  ✗ ${t.name} threw unexpected:`, err.message);
        }
    }

    console.log('');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
}

main();
