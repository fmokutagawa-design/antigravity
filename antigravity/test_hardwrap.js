
/**
 * Hard Wrap Logic.
 * 
 * Rules:
 * 1. Maintain existing Paragraphs (split by \n).
 * 2. Force Wrap lines that exceed charsPerLine.
 * 3. Do not merge lines (simplification for safety).
 * 
 * Ideally, we should "Unwrap" hard-wrapped lines before re-wrapping to handle editing in the middle.
 * But "Unwrap" is ambiguous (User hard return vs Auto hard return).
 * 
 * Strategy v1: "Greedy Wrap"
 * Treat input text as "Correct Logic".
 * If a line is > Limit, split it.
 * This effectively prevents soft-wrap.
 * But if user edits a hard-wrapped line, it won't reflow back up.
 * 
 * Strategy v2: "Reflowing Wrap"
 * We need to know which \n are "Soft (Hard for browser)".
 * 
 * Compromise for this iteration:
 * We will normalize ALL single \n to "Space" (or Join) IF AND ONLY IF they appear to be flowable? 
 * No, that's dangerous.
 * 
 * Let's implement Strategy v1 first, as requested "Enforce strict limit".
 * "Browser shall not wrap." -> We insert \n at limit.
 * 
 * Problem: Reflow.
 * User types 21 chars. Wrap -> "20 chars\n1 char".
 * User deletes char 10. -> "19 chars\n1 char".
 * Grid expects "20 chars".
 * 
 * So we MUST join lines to reflow.
 * 
 * Reflow Logic:
 * Join ALL lines into a single stream? No, Paragraphs.
 * We need distinct Separator for Paragraphs.
 * 
 * Let's assume:
 * Input comes from Textarea. Textarea contains \n.
 * If we use Hard Wrap, Textarea will contain MANY \n.
 * 
 * How do we distinguish Paragraph Break?
 * Case: "A...A\nB...B" (Wrap)
 * Case: "A...A\nB...B" (Paragraph)
 * 
 * Convention: "Indent" or "Blank Line".
 * If we strictly follow "Indent = Paragrah", we can merge everything else.
 * 
 * Let's try "Aggressive Merge":
 * Join all lines with Null string, then split by "IndentChar"?
 * Too risky.
 * 
 * Let's rely on "Double Newline" as paragraph break for safe reflow?
 * Or simply:
 * "Wrappable \n" are those at exactly index = charsPerLine.
 * 
 * Proposed Logic:
 * 1. Normalize \r\n -> \n.
 * 2. Split by \n.
 * 3. Iterate lines.
 *    If line[i] + line[i+1] fits in charsPerLine? 
 *    Or simply: Join ALL, then re-split?
 *    
 *    If we Join ALL:
 *    "Par1...\nPar2..." -> "Par1...Par2..." -> Wrap -> "Par1...P\nar2..."
 *    We lost the paragraph break!
 *    
 *    So we need explicit paragraph breaks.
 *    
 *    If the user has been writing with Soft Wraps, their data only has \n at Paragraphs.
 *    If we switch to Hard Wrap, we insert \n.
 *    
 *    Next time we read, we have mixed \n.
 *    
 *    Maybe we assume: "Any line starting with 'Fullwidth Space' is a new paragraph".
 *    (Standard Japanese typesetting rule).
 *    
 *    If yes:
 *    1. Split by `\n`.
 *    2. Group lines: New Group starts if line starts with `\u3000`.
 *    3. Join lines within Group.
 *    4. Wrap Group.
 *    5. Join Groups.
 *    
 *    This handles standard novels well.
 *    Fallback: If no indent?
 *    Then everything is one paragraph? Bad.
 *    
 *    Alternate: "Empty Line" as separator.
 *    
 *    Let's implement the "Simple Greedy" first.
 *    It splits long lines. It does NOT reflow short lines up.
 *    This fulfills "Prevent Browser SoftWrap".
 *    Reflow is a feature request for later.
 *    Priority: "Selection Accuracy".
 *    If we split long lines, selection accuracy is perfect.
 *    The only downside is "Editing in the middle leaves short lines".
 *    
 *    User: "Implementation first, fix logical later".
 *    So Strategy v1 is the correct path.
 */

const applyHardWrap = (text, charsPerLine) => {
    if (!text) return '';
    if (!charsPerLine || charsPerLine <= 0) return text;

    // Normalize
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    const wrappedLines = lines.flatMap(line => {
        if (line.length <= charsPerLine) return [line];

        const chunks = [];
        let remaining = line;
        while (remaining.length > 0) {
            chunks.push(remaining.slice(0, charsPerLine));
            remaining = remaining.slice(charsPerLine);
        }
        return chunks;
    });

    return wrappedLines.join('\n');
};

console.log(applyHardWrap("1234567890", 5));
// Expected: "12345\n67890"

console.log(applyHardWrap("12345678901", 5));
// Expected: "12345\n67890\n1"

console.log(applyHardWrap("123\n456", 5));
// Expected: "123\n456" (No merge)

console.log(applyHardWrap("123456\n789", 5));
// Expected: "12345\n6\n789"
