import { parseRubyToTokens } from './textUtils';

// --- Font Name Map ---
// Short names → full CSS font-family values
export const FONT_MAP = {
    '明朝': 'var(--font-mincho)',
    'ゴシック': 'var(--font-gothic)',
    'ヒラギノ明朝': "'Hiragino Mincho ProN', 'Hiragino Mincho Pro', serif",
    'ヒラギノ角ゴ': "'Hiragino Sans', sans-serif",
    '筑紫A': "'FOT-筑紫Aオールド明朝 Pr6N', 'Tsukushi A Old Mincho', '筑紫Aオールド明朝', serif",
    '筑紫B': "'FOT-筑紫Bオールド明朝 Pr6N', 'Tsukushi B Old Mincho', '筑紫Bオールド明朝', serif",
    '筑紫C': "'FOT-筑紫Cオールド明朝 Pr6N', 'Tsukushi C Old Mincho', '筑紫Cオールド明朝', serif",
    'メイリオ': "'Meiryo', sans-serif",
    '紅道': 'var(--font-hand)',
    'クレー': "'Klee One', cursive",
    '黎ミン': "'A-OTF 黎ミン Pr6N', '黎ミン', serif",
    '秀英にじみ': "'A P-OTF 秀英にじみ明朝 StdN', '秀英にじみ明朝', serif",
    'うつくし明朝': "'02うつくし明朝体', 'うつくし明朝体', serif",
    '毎日新聞': "'A-OTF 毎日新聞明朝 Pro', '毎日新聞明朝', serif",
    'A1明朝': "'A-OTF A1明朝 Std', 'A1明朝', serif",
    'BIZ明朝': "'BIZ UDMincho', serif",
    'キウイ丸': "'Kiwi Maru', serif",
    'Zen明朝': "'Zen Old Mincho', serif",
    'ひな明朝': "'Hina Mincho', serif",
    '解星オプティ': "'Kaisei Opti', serif",
    '解星特ミン': "'Kaisei Tokumin', serif",
    '游明朝': "'YuMincho', 'Yu Mincho', serif",
    'Yuji': "'Yuji Syuku', serif",
    'Noto明朝': "'Noto Serif JP', serif",
    'Notoゴ': "'Noto Sans JP', sans-serif",
};

// Resolve font name to CSS value (case-insensitive partial match)
export const resolveFontName = (name) => {
    if (!name) return null;
    const trimmed = name.trim();
    // Exact match first
    if (FONT_MAP[trimmed]) return FONT_MAP[trimmed];
    // Case-insensitive search
    const lower = trimmed.toLowerCase();
    for (const [key, value] of Object.entries(FONT_MAP)) {
        if (key.toLowerCase() === lower) return value;
    }
    // Partial match
    for (const [key, value] of Object.entries(FONT_MAP)) {
        if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) return value;
    }
    // If no match, treat as raw CSS font-family value
    return trimmed;
};

// --- Configuration & Constants ---

// 1. Gyoto Kinsoku (Forbidden at Line Start)
// These characters should not appear at the start of a line.
// Strategy: "Oidashi" (Move previous character to this line)
const GYOTO_CHARS = new Set([
    '、', '。', '，', '．',
    '！', '？', '!', '?', '‼', '⁇', '⁈', '⁉',
    '）', ']', '｝', '〉', '》', '｣', '』', '】', '〕', '”', '’', '」',
    'っ', 'ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ',
    'ッ', 'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ',
    'ゝ', 'ゞ', '々', 'ー', // 'ー' is debatable but often included
]);

// 2. Gyomatsu Kinsoku (Forbidden at Line End)
// These characters should not appear at the end of a line.
// Strategy: "Tsure-dashi" (Move this character to the next line)
const GYOMATSU_CHARS = new Set([
    '（', '［', '｛', '〈', '《', '｢', '『', '【', '〔',
    '“', '‘', '「'
]);

// 3. Hanging Punctuation (Allowed to hang outside line)
// If these cause an overflow, they are allowed to stay on the current line (visually exceeding width).
const HANGING_CHARS = new Set([
    '、', '。', '，', '．'
]);

// --- Helper Functions ---

/**
 * Preprocess text for standardized formatting.
 * Non-destructive policy: Only normalize essential spacing for display.
 */
export const preprocessText = (text) => {
    if (!text) return '';

    const lines = text.split('\n');
    const processedLines = lines.map(line => {
        let l = line;

        // Note: We do NOT strip indentation here to protect user's manual layout.

        // Smart Space rule: Add space after ! ? unless followed by specific chars
        // Regex: lookbehind is not fully supported in all environments, so we use replace with capturing group.
        // Target: (! or ?) followed by NOT (Space, Newline, Closing Bracket, Punctuation)
        // Actually, simple regex: /([！？])(?![ \u3000\s」』）\]｝〉》】〕、。])/g
        l = l.replace(/([！？])(?![ \u3000\s」』）\]｝〉》】〕、。])/g, '$1\u3000');

        return l;
    });

    return processedLines.join('\n');
};

/**
 * Tokenize line into atomic renderable units.
 * Ensures "Block Protection" for specific patterns.
 */
export const tokenizeLine = (lineText) => {
    const tokens = [];

    // --- Inline Font Tag Preprocessing ---
    // Parse {font:NAME}text{/font} into segments with fontFamily metadata
    const INLINE_FONT_REGEX = /\{font[:：](.+?)\}([\s\S]*?)\{\/font\}/g;
    const segments = [];
    let lastIdx = 0;
    let fontMatch;

    while ((fontMatch = INLINE_FONT_REGEX.exec(lineText)) !== null) {
        // Text before font tag
        if (fontMatch.index > lastIdx) {
            segments.push({ text: lineText.slice(lastIdx, fontMatch.index), fontFamily: null });
        }
        // Font-tagged text
        segments.push({ text: fontMatch[2], fontFamily: resolveFontName(fontMatch[1]) });
        lastIdx = INLINE_FONT_REGEX.lastIndex;
    }
    // Remaining text
    if (lastIdx < lineText.length) {
        segments.push({ text: lineText.slice(lastIdx), fontFamily: null });
    }
    // If no font tags found, single segment
    if (segments.length === 0) {
        segments.push({ text: lineText, fontFamily: null });
    }

    // Tokenize each segment and apply fontFamily
    for (const segment of segments) {
        const segTokens = tokenizeSegment(segment.text);
        if (segment.fontFamily) {
            segTokens.forEach(t => { t.fontFamily = segment.fontFamily; });
        }
        tokens.push(...segTokens);
    }

    return tokens;
};

/**
 * Internal: Tokenize a text segment into atomic renderable units.
 * Ensures "Block Protection" for specific patterns.
 */
const tokenizeSegment = (lineText) => {
    const tokens = [];

    // Strategy: RegEx to capture all "Blocks" first, then split the rest into chars.
    // Blocks:
    // 1. Links: [[...]]
    // 2. Ruby: (Handled via parseRubyToTokens, but we might treat the whole group as a block?)
    //    Actually, parseRubyToTokens returns a structure. We need to respect that.
    //    But for "Block Protection", we want [[Link]] to be ONE token for kinsoku purposes?
    //    User Spec: "[[...]] should not be split".
    // 3. TCY: Single digits? No, usually 2-3 digits. But simple logic: \d{2,3} ? 
    //    Let's stick to explicit TCY syntax or simple heuristics. Users often use plain numbers.
    //    Let's handle TCY as matches of 2-4 digits.
    // 4. Continuous Punctuation: ……, ――, ！！, ！？ etc.

    // Regex construction
    // Regex construction
    const LINK_PATTERN = /\[\[.*?\]\]|［［.*?］］/g;
    const TCY_PATTERN = /\d{1,4}/g; // 1-4 digits -> TCY block (Spec 5.1)
    const DASH_ELLIPSIS_PATTERN = /(—{2,}|…{2,}|―{2,}|ー{2,})/g;
    const REPEATED_PUNCT_PATTERN = /([！？!?]){2,}/g;

    let cursor = 0;
    const text = lineText;
    let isInsideQuote = false;

    while (cursor < text.length) {
        const sub = text.slice(cursor);

        let bestMatch = null;
        let matchType = '';

        const checkMatch = (regex, type) => {
            regex.lastIndex = 0;
            const m = regex.exec(sub);
            if (m) {
                if (!bestMatch || m.index < bestMatch.index) {
                    bestMatch = m;
                    matchType = type;
                }
            }
        };

        checkMatch(/\[\[.*?\]\]|［［.*?］］/, 'link');
        checkMatch(/\d{1,4}/, 'tcy'); // Updated for 1-4 digits
        checkMatch(/(—{2,}|…{2,}|―{2,}|ー{2,})/, 'dash');
        checkMatch(/([！？!?]){2,}/, 'punct');

        if (bestMatch && bestMatch.index === 0) {
            const content = bestMatch[0];

            if (matchType === 'link') {
                const targetRaw = content.replace(/^(\[\[|［［)/, '').replace(/(\]\]|］］)$/, '');
                // Normalize Space to Full Width for Vertical Consistency in Display
                const targetDisplay = targetRaw.replace(/ /g, '　');

                Array.from(targetDisplay).forEach(c => {
                    tokens.push({ type: 'char', char: c, length: 1, linkTarget: targetRaw, isBold: isInsideQuote });
                });
            }
            else if (matchType === 'tcy') {
                tokens.push({ type: 'tcy', content: content, length: 1, isBold: isInsideQuote });
            }
            else if (matchType === 'dash' || matchType === 'punct') {
                tokens.push({ type: 'text', content: content, length: content.length, block: true, isBold: isInsideQuote });
            }

            cursor += bestMatch[0].length;
        } else if (bestMatch) {
            // Match exists but later. Process text until match.
            const textChunk = sub.slice(0, bestMatch.index);
            const rubyParsed = parseRubyToTokens(textChunk);
            rubyParsed.forEach(rt => {
                if (typeof rt === 'string') {
                    Array.from(rt).forEach(c => {
                        if (c === '『') isInsideQuote = true;
                        tokens.push({ type: 'char', char: c, length: 1, isBold: isInsideQuote });
                        if (c === '』') isInsideQuote = false;
                    });
                } else {
                    tokens.push({ type: 'ruby', base: rt.base, ruby: rt.ruby, length: Math.max(rt.base.length, 1), isBold: isInsideQuote });
                }
            });
            cursor += bestMatch.index;
        } else {
            const rubyParsed = parseRubyToTokens(sub);
            rubyParsed.forEach(rt => {
                if (typeof rt === 'string') {
                    Array.from(rt).forEach(c => {
                        if (c === '『') isInsideQuote = true;
                        tokens.push({ type: 'char', char: c, length: 1, isBold: isInsideQuote });
                        if (c === '』') isInsideQuote = false;
                    });
                } else {
                    tokens.push({ type: 'ruby', base: rt.base, ruby: rt.ruby, length: Math.max(rt.base.length, 1), isBold: isInsideQuote });
                }
            });
            cursor += sub.length;
        }
    }

    return tokens;
};

// ... (Maintain parseAozoraStructure as is)

// Helper: Full-width to Half-width numbers
const toHalfWidth = (str) => {
    return str.replace(/[０-９]/g, (s) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
};

/**
 * Parses Aozora Bunko-style text into structured blocks.
 * This function is assumed to exist in the user's full code.
 */
export const parseAozoraStructure = (text) => {
    const blocks = [];
    const lines = text.split('\n');

    // State for block-level styles (e.g., indent block, width block, font block)
    const blockState = {
        inBlockIndent: false,
        indent: 0,
        inBlockWidth: false,
        maxLength: null,
        inBlockFont: false,
        fontFamily: null,
    };

    // Regex for Aozora Bunko tags (simplified for this example)
    const TAG_CENTER = /［＃中央揃え］|［＃ページの左右中央］/;
    const TAG_PAGE_BREAK = /^\s*----------\s*$|［＃改ページ］/;
    const TAG_SMALL_START = /［＃１段階小さな文字］/;
    const TAG_SMALL_END = /［＃小さな文字終わり］/;
    const TAG_INDENT_BLOCK_START = /［＃ここから([0-9０-９]+)字下げ］/;
    const TAG_INDENT_BLOCK_END = /［＃ここで字下げ終わり］/;
    const TAG_INDENT_LINE = /［＃([0-9０-９]+)字下げ］/;
    const TAG_WIDTH_BLOCK_START = /［＃ここから([0-9０-９]+)字詰め］/;
    const TAG_WIDTH_BLOCK_END = /［＃ここで字詰め終わり］/;
    const TAG_WIDTH_LINE = /［＃([0-9０-９]+)字詰め］/;
    const TAG_HEADING_LARGE_START = /［＃大見出し］/;
    const TAG_HEADING_LARGE_END = /［＃大見出し終わり］/;
    const TAG_HEADING_MEDIUM_START = /［＃中見出し］/;
    const TAG_HEADING_MEDIUM_END = /［＃中見出し終わり］/;
    const TAG_FONT_BLOCK_START = /［＃ここからフォント[：:](.+?)］/;
    const TAG_FONT_BLOCK_END = /［＃フォント終わり］|［＃ここでフォント終わり］/;
    const TAG_FONT_LINE = /［＃フォント[：:](.+?)］/;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // 0. Page Break Check (Immediate Block)
        if (TAG_PAGE_BREAK.test(line)) {
            blocks.push({ type: 'break' });
            continue;
        }

        let currentIndent = blockState.inBlockIndent ? blockState.indent : 0;
        let currentMaxLength = blockState.inBlockWidth ? blockState.maxLength : null;
        let align = 'start';
        let headingType = null;
        let isSmall = false;
        let currentFontFamily = blockState.inBlockFont ? blockState.fontFamily : null;

        // --- Process Block End Tags ---
        let processedTagEnd = false;
        if (blockState.inBlockIndent && TAG_INDENT_BLOCK_END.test(line)) {
            blockState.inBlockIndent = false;
            blockState.indent = 0;
            line = line.replace(TAG_INDENT_BLOCK_END, '');
            processedTagEnd = true;
        }
        if (blockState.inBlockWidth && TAG_WIDTH_BLOCK_END.test(line)) {
            blockState.inBlockWidth = false;
            blockState.maxLength = null;
            line = line.replace(TAG_WIDTH_BLOCK_END, '');
            processedTagEnd = true;
        }
        if (blockState.inBlockFont && TAG_FONT_BLOCK_END.test(line)) {
            blockState.inBlockFont = false;
            blockState.fontFamily = null;
            line = line.replace(TAG_FONT_BLOCK_END, '');
            processedTagEnd = true;
        }
        // If line became empty just from End Tag, skipping is unsafe if it also had content? 
        // Aozora tags are usually on their own line.
        if (processedTagEnd && line.length === 0) continue;


        // --- Process Block Start / Line Tags iteratively (Order matters? usually tags are at start) ---
        // We use a loop to consume multiple tags at start of line
        let tagFound = true;

        while (tagFound) {
            tagFound = false;

            // Indent Block
            const matchIndentBlock = line.match(TAG_INDENT_BLOCK_START);
            if (matchIndentBlock) {
                const val = parseInt(toHalfWidth(matchIndentBlock[1]), 10);
                blockState.inBlockIndent = true;
                blockState.indent = val;
                currentIndent = val;
                line = line.replace(TAG_INDENT_BLOCK_START, '');
                tagFound = true;
                continue;
            }

            // Indent Line
            const matchIndentLine = line.match(TAG_INDENT_LINE);
            if (matchIndentLine) {
                const val = parseInt(toHalfWidth(matchIndentLine[1]), 10);
                currentIndent = val;
                line = line.replace(TAG_INDENT_LINE, '');
                tagFound = true;
                // Indent Line usually applies TO content on the same line. 
                // IF there is content, it is NOT a pure control line.
                // We mark it, but we check line length later.
                continue;
            }

            // Width Block
            const matchWidthBlock = line.match(TAG_WIDTH_BLOCK_START);
            if (matchWidthBlock) {
                const val = parseInt(toHalfWidth(matchWidthBlock[1]), 10);
                blockState.inBlockWidth = true;
                blockState.maxLength = val;
                currentMaxLength = val;
                line = line.replace(TAG_WIDTH_BLOCK_START, '');
                tagFound = true;
                continue;
            }

            // Width Line
            const matchWidthLine = line.match(TAG_WIDTH_LINE);
            if (matchWidthLine) {
                const val = parseInt(toHalfWidth(matchWidthLine[1]), 10);
                currentMaxLength = val;
                line = line.replace(TAG_WIDTH_LINE, '');
                tagFound = true;
                continue;
            }

            // Center
            if (TAG_CENTER.test(line)) {
                align = 'center';
                line = line.replace(TAG_CENTER, '');
                tagFound = true;
                continue;
            }

            // Small Text
            if (TAG_SMALL_START.test(line)) {
                isSmall = true;
                line = line.replace(TAG_SMALL_START, '');
                tagFound = true;
                continue;
            }
            if (TAG_SMALL_END.test(line)) {
                line = line.replace(TAG_SMALL_END, '');
                tagFound = true;
                continue;
            }

            // Font Block Start
            const matchFontBlock = line.match(TAG_FONT_BLOCK_START);
            if (matchFontBlock) {
                const fontName = matchFontBlock[1].trim();
                blockState.inBlockFont = true;
                blockState.fontFamily = resolveFontName(fontName);
                line = line.replace(TAG_FONT_BLOCK_START, '');
                tagFound = true;
                continue;
            }

            // Font Line (single line)
            const matchFontLine = line.match(TAG_FONT_LINE);
            if (matchFontLine) {
                const fontName = matchFontLine[1].trim();
                currentFontFamily = resolveFontName(fontName);
                line = line.replace(TAG_FONT_LINE, '');
                tagFound = true;
                continue;
            }
        }

        // --- Re-check Block End Tags (same-line open+close) ---
        // If start AND end tags are on the same line (e.g. ［＃ここから４字下げ］text［＃ここで字下げ終わり］),
        // the first end-tag check (above) ran before the state was set. Check again now.
        if (blockState.inBlockIndent && TAG_INDENT_BLOCK_END.test(line)) {
            blockState.inBlockIndent = false;
            blockState.indent = 0;
            line = line.replace(TAG_INDENT_BLOCK_END, '');
        }
        if (blockState.inBlockWidth && TAG_WIDTH_BLOCK_END.test(line)) {
            blockState.inBlockWidth = false;
            blockState.maxLength = null;
            line = line.replace(TAG_WIDTH_BLOCK_END, '');
        }

        // --- Process Headings (Pattern: ［＃大見出し］Title［＃大見出し終わり］) ---
        // Assuming the tag wraps the content or denotes the line style.
        // User example: ［＃大見出し］第一巻［＃大見出し終わり］
        if (TAG_HEADING_LARGE_START.test(line)) {
            headingType = 'large';
            line = line.replace(TAG_HEADING_LARGE_START, '').replace(TAG_HEADING_LARGE_END, '');
        } else if (TAG_HEADING_MEDIUM_START.test(line)) {
            headingType = 'medium';
            line = line.replace(TAG_HEADING_MEDIUM_START, '').replace(TAG_HEADING_MEDIUM_END, '');
        } else if (line.includes('［＃同行中見出し］')) {
            // Compat with previous impl
            headingType = 'medium'; // Approx
            line = line.replace(/［＃同行中見出し］/g, '').replace(/［＃同行中見出し終わり］/g, '');
        }

        // --- Create Block ---
        // Strip any remaining unrecognized Aozora tags ［＃...］
        // This handles annotations, notes, and other tags not explicitly parsed above.
        line = line.replace(/［＃[^］]*］/g, '');
        // CRITICAL FIX: If the line became empty AND it was a control line (e.g. Block Start), SKIP it.
        // A user-written blank line (originally empty) should be preserved (length===0 && !isControlLine).
        // But if isControlLine is true, and length is 0, it means it was JUST a tag.

        // HOWEVER, 'isControlLine' logic above is imperfect. 
        // 'Indent Line' tag usually accompanies text. If text exists, line.length > 0.
        // 'Block Start' tag is usually alone.

        // Simple heuristic: 
        // If line is now empty, AND the original line was NOT empty (meaning we stripped something),
        // we assume it was a control line and skip it.
        // Unless it was a heading?? Headings remove tags but leave Title.
        // If Title is empty? Then it's an empty heading. Skip.

        if (line.length === 0 && lines[i].length > 0) {
            // We stripped tags and nothing is left. It was a control line.
            continue;
        }
        // If line.length === 0 and lines[i].length === 0 -> It's a blank line. Keep it.

        blocks.push({
            type: 'text',
            content: line,
            styles: {
                indent: currentIndent,
                maxLength: currentMaxLength,
                align: align,
                heading: headingType,
                small: isSmall,
                fontFamily: currentFontFamily
            }
        });
    }

    return blocks;
};

/**
 * Compose tokens into lines following Kinsoku rules.
 * Implements Spec v1.0: Hanging, Oidashi, Line-End Prohibition.
 */
export const composeLines = (blocks, charsPerLine) => {
    const lines = [];

    blocks.forEach(block => {
        if (block.type === 'break') {
            lines.push([{ type: 'page_break' }]);
            return;
        }

        const { content, styles } = block;
        const indent = styles.indent || 0;

        let maxLen = charsPerLine - indent;
        if (styles.maxLength) {
            maxLen = Math.min(maxLen, styles.maxLength);
        }
        maxLen = Math.max(1, maxLen);

        const tokens = tokenizeLine(content);
        let currentLine = [];

        const addIndent = () => {
            for (let k = 0; k < indent; k++) {
                currentLine.push({ type: 'spacer', length: 1 });
            }
        };

        addIndent();
        let currentLen = indent;
        const totalLimit = indent + maxLen;

        const pushLine = () => {
            if (styles.align === 'center' && currentLine.length > 0) {
                let contentLen = 0;
                currentLine.forEach(t => contentLen += (t.length || 1));
                const remaining = charsPerLine - contentLen;
                if (remaining > 0) {
                    const leftPad = Math.floor(remaining / 2);
                    const pad = Array(leftPad).fill({ type: 'spacer', length: 1 });
                    currentLine = [...pad, ...currentLine];
                }
            }
            lines.push([...currentLine]);
            currentLine = [];
            addIndent();
            currentLen = indent;
        };

        if (tokens.length === 0) {
            if (content.length === 0) {
                lines.push([]);
            }
        }

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (token.type === 'char' && token.char === '\n') {
                pushLine();
                continue;
            }

            if (styles.heading) {
                token.heading = styles.heading;
            }
            if (styles.small) {
                token.small = true;
            }
            if (styles.fontFamily) {
                token.fontFamily = styles.fontFamily;
            }

            const tokenLen = token.length || 1;

            // --- Block Token Splitting (dashes/ellipsis) ---
            // Long sequences like ―――...――― (70+ chars) must be split at line boundaries.
            // Each chunk renders as a continuous line segment within its cell.
            if (token.type === 'text' && token.block && tokenLen > 1) {
                const remaining = totalLimit - currentLen;
                if (tokenLen > remaining && remaining > 0) {
                    // Split: put what fits on current line
                    const fitContent = token.content.slice(0, remaining);
                    currentLine.push({ ...token, content: fitContent, length: remaining });
                    currentLen += remaining;
                    pushLine();

                    // Split rest into maxLen-sized chunks
                    let rest = token.content.slice(remaining);
                    while (rest.length > maxLen) {
                        const chunk = rest.slice(0, maxLen);
                        currentLine.push({ ...token, content: chunk, length: maxLen });
                        currentLen += maxLen;
                        pushLine();
                        rest = rest.slice(maxLen);
                    }
                    // Remaining piece on new line
                    if (rest.length > 0) {
                        currentLine.push({ ...token, content: rest, length: rest.length });
                        currentLen += rest.length;
                    }
                    continue;
                } else if (tokenLen > remaining && remaining <= 0) {
                    // No space on current line at all, push to next
                    pushLine();
                    // Re-process: split into maxLen chunks
                    let rest = token.content;
                    while (rest.length > maxLen) {
                        const chunk = rest.slice(0, maxLen);
                        currentLine.push({ ...token, content: chunk, length: maxLen });
                        currentLen += maxLen;
                        pushLine();
                        rest = rest.slice(maxLen);
                    }
                    if (rest.length > 0) {
                        currentLine.push({ ...token, content: rest, length: rest.length });
                        currentLen += rest.length;
                    }
                    continue;
                }
                // else: fits on current line, fall through to normal placement
            }

            // Tentative placement
            if (currentLen + tokenLen <= totalLimit) {
                // Fits in line
                currentLine.push(token);
                currentLen += tokenLen;

                // Post-placement Check: Line End Prohibition (Priority A)
                // If we exactly hit the limit, check if the LAST char is forbidden at end.
                if (currentLen === totalLimit) {
                    const charStr = getCharForCheck(token);
                    if (GYOMATSU_CHARS.has(charStr)) {
                        // Prohibition: Should not end line.
                        // Action: Force wrap (Push to next line).
                        currentLine.pop();
                        pushLine();
                        currentLine.push(token);
                        currentLen = indent + tokenLen;
                    }
                }
            } else {
                // Overflow (Does not fit)
                const charStr = getCharForCheck(token);

                // Check 1: Hanging Punctuation (Priority A)
                // If it's a hanging char (、。), allow it to stay as overflow (limit+1)
                // Only if it's the 1st overflow char.
                if (HANGING_CHARS.has(charStr)) {
                    currentLine.push(token);
                    // Force push line after hanging
                    pushLine();
                    // No need to reset currentLen specifically as pushLine does it,
                    // but we consumed the token.
                    // Loop continues to next token.
                    continue;
                }

                // Check 2: Gyoto Kinsoku (Line Block Prohibition)
                // If the character is forbidden at start of NEXT line,
                // we must pull someone from THIS line to join it (Oidashi).
                if (GYOTO_CHARS.has(charStr)) {
                    // Oidashi logic
                    if (currentLine.length > indent) {
                        const separateToken = currentLine.pop();
                        pushLine();
                        currentLine.push(separateToken);
                        currentLine.push(token);
                        currentLen = indent + (separateToken.length || 1) + tokenLen;
                    } else {
                        // Cannotoidashi (maybe empty line or just indent)
                        pushLine();
                        currentLine.push(token);
                        currentLen = indent + tokenLen;
                    }
                } else {
                    // Standard Wrap (No prohibition)
                    pushLine();
                    currentLine.push(token);
                    currentLen = indent + tokenLen;
                }
            }
        }

        // Final flush
        if (currentLine.length > indent) {
            pushLine();
        } else if (content.length === 0 && lines.length === 0) {
            lines.push([]);
        }
    });

    return lines;
};

const getCharForCheck = (token) => {
    if (token.type === 'char') return token.char;
    if (token.type === 'ruby') return token.base[0]; // Check first char of base
    if (token.type === 'tcy') return '1'; // Count as digit
    if (token.type === 'text') return token.content[0]; // Check first char
    if (token.type === 'link') return '['; // Treat as bracket-like? Or neutral?
    return '';
};

/**
 * Convert Half-width Alphanumeric to Full-width.
 * Used to align text with Grid.
 */
export const convertToFullWidth = (text) => {
    if (!text) return '';

    // V112: CRITICAL - Force \n normalization to match browser textarea behavior
    // This prevents index drift caused by invisible \r\n vs \n differences.
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const kanaMap = {
        '｡': '。', '｢': '「', '｣': '」', '､': '、', '･': '・',
        'ｦ': 'ヲ', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
        'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ', 'ｰ': 'ー',
        'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
        'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
        'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
        'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
        'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
        'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
        'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
        'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
        'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
        'ﾜ': 'ワ', 'ﾝ': 'ン', 'ﾞ': '゛', 'ﾟ': '゜'
    };

    return normalizedText
        // 1. Normalize Bullets (•, ·, ･) to Japanese Middle Dot (・)
        .replace(/[•·･]/g, '・')
        // 2. Convert Half-width Alphanumerics to Full-width
        .replace(/[!-~]/g, (c) => {
            return String.fromCharCode(c.charCodeAt(0) + 0xFEE0);
        })
        // 3. Convert Half-width Kana
        .replace(/[｡-ﾟ]/g, (c) => kanaMap[c] || c)
        // 4. Space -> Ideographic Space
        .replace(/ /g, '\u3000')
        // 5. Normalize other Lines/Dashes to 1 Full-width Dash (Fix thickness)
        .replace(/[━─—–−－-]/g, '\u2015');
};

/**
 * Convert Full-width Alphanumeric to Half-width.
 * Used to restore data from Display-only full-width transformation.
 */
export const convertToHalfWidth = (text) => {
    if (!text) return '';

    // V112: Symmetry normalization
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return normalizedText
        // 1. Full-width Alphanumerics to Half-width
        .replace(/[！-～]/g, (c) => {
            return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
        })
        // 2. Ideographic Space to regular space
        .replace(/\u3000/g, ' ');
};

/**
 * Convert Straight/Smart Quotes to Japanese Brackets 『』.
 * Target: "..." or “...”
 */
export const convertQuotesToJapanese = (text) => {
    if (!text) return '';
    // Handle "" first
    let t = text.replace(/"([^"]*?)"/g, '『$1』');
    // Handle “” (Smart quotes)
    t = t.replace(/“([^”]*?)”/g, '『$1』');
    return t;
};

/**
 * Convert Markdown Bold (**text**) to Novel Style 『text』.
 */
export const convertMarkdownToNovel = (text) => {
    if (!text) return '';
    // Match **...**
    return text.replace(/\*\*(.*?)\*\*/g, '『$1』');
};

/**
 * Wrap a single line into chunks.
 */
export const wrapLine = (line, charsPerLine) => {
    if (line.length <= charsPerLine) return [line];

    const chunks = [];
    let remaining = line;
    while (remaining.length > 0) {
        chunks.push(remaining.slice(0, charsPerLine));
        remaining = remaining.slice(charsPerLine);
    }
    return chunks;
};

/**
 * Apply Hard Wrap to text based on charsPerLine.
 * Splits long lines into multiple lines separated by \n.
 * Maintains existing paragraph breaks.
 * V116: Optimized to use simple loop.
 */
export const applyHardWrap = (text, charsPerLine) => {
    if (!text) return '';
    if (!charsPerLine || charsPerLine <= 0) return text;

    // Normalize newlines
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let hasChange = false;

    // Optimization: Check if any line needs wrapping first? 
    // Just map is lazily fast.
    const wrapped = lines.flatMap(line => {
        if (line.length > charsPerLine) {
            hasChange = true;
            return wrapLine(line, charsPerLine);
        }
        return [line];
    });

    // Return distinct flag or text? simpler to return text.
    // If we want to optimize React Render, strict equality check is good.
    if (!hasChange) return text;

    return wrapped.join('\n');
};
