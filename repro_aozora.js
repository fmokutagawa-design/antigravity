
import { parseAozoraStructure, composeLines, tokenizeLine, preprocessText } from './src/utils/typesetting.js';

// Mock Text Utils dependency since we are running in node
// We need to polyfill existing imports if we run this with node directly, 
// OR we can rely on the environment having the files.
// Since 'typesetting.js' imports 'parseRubyToTokens' from './textUtils', we need that too.

const testText = `［＃ページの左右中央］
タイトル

［＃６字下げ］［＃同行中見出し］序詞［＃同行中見出し終わり］（祇園精舎）

［＃ここから４字下げ］
これは４字下げのブロックです。
長い文章でも４文字分下がった状態で折り返されます。
［＃ここで字下げ終わり］

通常に戻る。`;

console.log("--- Testing Aozora Parsing ---");

try {
    const processed = preprocessText(testText);
    console.log("Preprocessed:", processed);

    const blocks = parseAozoraStructure(processed);
    console.log("Blocks:", JSON.stringify(blocks, null, 2));

    const lines = composeLines(blocks, 20);
    console.log("Composed Lines Count:", lines.length);
    console.log("First Line Tokens:", JSON.stringify(lines[0], null, 2));

    console.log("SUCCESS: No crash detected.");
} catch (e) {
    console.error("CRASH DETECTED:", e);
}
