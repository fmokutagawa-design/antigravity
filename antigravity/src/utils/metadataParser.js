/**
 * Metadata Parser for Obsidian v2.0 format
 * 
 * Format:
 * ```
 * 本文本文本文
 * 
 * ---
 * tags: [タグ1, タグ2]
 * 種別: キャラ
 * 状態: 草稿
 * 作品: 作品名1, 作品名2
 * ---
 * ```
 */

const METADATA_START_TAG = '---';
const METADATA_END_TAG = '---';
const LEGACY_DELIMITER = '---';

// Multi-level safety check for delimiters.
// Standard: --- (Legacy/Minimal)
// Sentinel: ［METADATA］ (Safe for vertical rendering/Japanese novel context)
function isDelimiterLine(line, isStart = true) {
    if (typeof line !== 'string') return false;
    const trimmed = line.trim();
    if (!trimmed) return false;

    // 1. Sentinel style (The most robust for Japanese vertical novels)
    if (isStart && (trimmed === '［METADATA］' || trimmed === '[METADATA]')) return true;
    if (!isStart && (trimmed === '［/METADATA］' || trimmed === '[/METADATA]')) return true;

    // 2. Fallback: strictly 3 or more half-width hyphens (Obsidian standard)
    if (/^-{3,}$/.test(trimmed)) return true;

    return false;
}

/**
 * Known metadata keys to increase parsing confidence
 */
const KNOWN_KEYS = new Set([
    'tags', 'タグ', '種別', '状態', '作品', 'あらすじ', 'summary', 'pov', '視点',
    '場所', '時間', '背景', '作成日', '更新日',
    '年齢', '所属', '役割', '名前', 'name', '外見', '過去', '現在'
]);

/**
 * Parse note content into body and metadata
 * @param {string} content - Full file content
 * @returns {{ body: string, metadata: object }}
 */
export function parseNote(content) {
    if (!content || typeof content !== 'string') {
        return { body: '', metadata: createEmptyMetadata() };
    }

    const lines = content.split(/\r?\n/);
    const metadataBlocks = [];
    let i = 0;

    // Phase 1: Identify potential metadata blocks
    while (i < lines.length) {
        if (isDelimiterLine(lines[i], true)) {
            const startIndex = i;
            let endIndex = -1;
            const isHtmlStyle = lines[i].trim().startsWith('<!--');

            for (let j = i + 1; j < lines.length; j++) {
                if (isDelimiterLine(lines[j], false)) {
                    endIndex = j;
                    break;
                }
            }

            if (endIndex !== -1) {
                const candidateLines = lines.slice(startIndex + 1, endIndex);

                // For HTML style, we are highly confident. For legacy ---, we need verification.
                let propertyCount = 0;
                let knownKeyMatch = false;

                candidateLines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;

                    const colonIndex = trimmed.search(/[:：]/);
                    if (colonIndex > 0 && colonIndex < 30 && !/^[-*•]/.test(trimmed)) {
                        propertyCount++;
                        const key = trimmed.substring(0, colonIndex).trim().toLowerCase();
                        if (KNOWN_KEYS.has(key)) knownKeyMatch = true;
                    }
                });

                // Confident if HTML style OR (known key OR multiple properties)
                if (isHtmlStyle || knownKeyMatch || propertyCount >= 2) {
                    metadataBlocks.push({
                        start: startIndex,
                        end: endIndex,
                        lines: candidateLines
                    });
                    i = endIndex + 1;
                } else {
                    i = startIndex + 1;
                }
            } else {
                i++;
            }
        } else {
            i++;
        }
    }

    if (metadataBlocks.length === 0) {
        return { body: content, metadata: createEmptyMetadata() };
    }

    // Use the LAST valid metadata block
    const lastBlock = metadataBlocks[metadataBlocks.length - 1];
    const { metadata, unparsedLines } = parseMetadataLines(lastBlock.lines);

    // Build the body: Add all text outside metadata blocks, 
    // AND Re-Insert "unparsedLines" from the metadata block to prevent data loss.
    const bodyLines = [];
    let currentIndex = 0;

    for (const block of metadataBlocks) {
        // Add text before the block
        bodyLines.push(...lines.slice(currentIndex, block.start));

        // Extract "unparsed" lines from THIS block. 
        // If it's a misidentified block, all of it will go back to the body.
        const { unparsedLines } = parseMetadataLines(block.lines);
        if (unparsedLines.length > 0) {
            bodyLines.push(...unparsedLines);
        }

        currentIndex = block.end + 1;
    }
    bodyLines.push(...lines.slice(currentIndex));

    const body = bodyLines.join('\n');
    return { body, metadata };
}

/**
 * Parse metadata lines into object
 * @param {string[]} lines - Metadata lines
 * @returns {{ metadata: object, unparsedLines: string[] }}
 */
function parseMetadataLines(lines) {
    const metadata = {};
    const unparsedLines = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            unparsedLines.push(line);
            continue;
        }

        const halfColonIndex = trimmed.indexOf(':');
        const fullColonIndex = trimmed.indexOf('：');

        let colonIndex = -1;
        if (halfColonIndex !== -1 && fullColonIndex !== -1) {
            colonIndex = Math.min(halfColonIndex, fullColonIndex);
        } else if (halfColonIndex !== -1) {
            colonIndex = halfColonIndex;
        } else if (fullColonIndex !== -1) {
            colonIndex = fullColonIndex;
        }

        // FAIL-SAFE: If no colon is found, preserve the line instead of discarding it.
        if (colonIndex === -1) {
            unparsedLines.push(line);
            continue;
        }

        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        const lowerKey = key.toLowerCase();

        if (lowerKey === 'tags' || lowerKey === 'ｔａｇｓ' || lowerKey === 'タグ') {
            metadata.tags = parseTagsArray(value);
        } else if (trimmed.startsWith('#') || trimmed.startsWith('＃')) {
            // Support for # Name or ＃ 名前 (Novel style header)
            metadata.name = trimmed.replace(/^[#＃]\s*/, '').trim();
        } else {
            metadata[key] = value;
        }
    }

    return { metadata, unparsedLines };
}

/**
 * Parse tags array from string
 * @param {string} str - Tags string like "[タグ1, タグ2]"
 * @returns {string[]} - Array of tags
 */
function parseTagsArray(str) {
    if (!str) return [];
    const cleaned = str
        .replace(/^[[［]/, '')
        .replace(/[\]］]$/, '')
        .trim();
    if (!cleaned) return [];
    return cleaned.split(/[,,，]/).map(tag => tag.trim()).filter(tag => tag.length > 0);
}

/**
 * Serialize note body and metadata into file content
 * @param {string} body - Note body
 * @param {object} metadata - Metadata object
 * @returns {string} - Complete file content
 */
export function serializeNote(body, metadata) {
    const metadataStr = formatMetadata(metadata);

    if (!metadataStr) {
        return body;
    }

    let separator = '\n\n';
    if (body.endsWith('\n\n')) {
        separator = '';
    } else if (body.endsWith('\n')) {
        separator = '\n';
    } else if (body === '') {
        separator = '';
    }

    // Use Sentinel for the best cross-platform stability in vertical mode
    const startTag = '［METADATA］';
    const endTag = '［/METADATA］';

    return `${body}${separator}${startTag}\n${metadataStr}\n${endTag}\n`;
}

/**
 * Format metadata object into string
 * @param {object} metadata - Metadata object
 * @returns {string} - Formatted metadata string
 */
function formatMetadata(metadata) {
    const lines = [];

    // 1. Name Header (Novel style)
    if (metadata.name) {
        lines.push(`＃ ${metadata.name}`);
    }

    // 2. Tags
    if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
        lines.push(`tags: [${metadata.tags.join(', ')}]`);
    }

    // 3. Other properties
    Object.entries(metadata).forEach(([key, value]) => {
        if (key === 'tags' || key === 'name') return;
        if (value !== undefined && value !== null && value !== '') {
            lines.push(`${key}： ${value}`); // Use full-width colon for visual consistency if preferred
        }
    });

    return lines.join('\n');
}

/**
 * Create empty metadata object
 * @returns {object}
 */
function createEmptyMetadata() {
    return {
        tags: []
    };
}

/**
 * Update metadata with new values
 * @param {object} metadata - Current metadata
 * @param {object} updates - Updates to apply
 * @returns {object} - Updated metadata
 */
export function updateMetadata(metadata, updates) {
    return {
        ...metadata,
        ...updates
    };
}

/**
 * Add tag to metadata
 * @param {object} metadata - Current metadata
 * @param {string} tag - Tag to add
 * @returns {object} - Updated metadata
 */
export function addTag(metadata, tag) {
    const tags = [...metadata.tags];
    if (!tags.includes(tag)) {
        tags.push(tag);
    }
    return { ...metadata, tags };
}

/**
 * Remove tag from metadata
 * @param {object} metadata - Current metadata
 * @param {string} tag - Tag to remove
 * @returns {object} - Updated metadata
 */
export function removeTag(metadata, tag) {
    const tags = metadata.tags.filter(t => t !== tag);
    return { ...metadata, tags };
}
