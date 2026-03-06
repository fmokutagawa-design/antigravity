/**
 * Link Analyzer for [[WikiLink]] format
 * 
 * Extracts outbound links and finds backlinks (inbound links)
 */

const LINK_REGEX = /\[\[([^\]]+)\]\]/g;

/**
 * Extract all [[links]] from text
 * @param {string} text - Text content
 * @returns {string[]} - Array of link targets
 */
export function extractLinks(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const links = [];
    const regex = new RegExp(LINK_REGEX);
    let match;

    while ((match = regex.exec(text)) !== null) {
        const linkTarget = match[1].trim();
        if (linkTarget && !links.includes(linkTarget)) {
            links.push(linkTarget);
        }
    }

    return links;
}

/**
 * Find all files that link to a specific target
 * @param {string} targetName - Target file name (without extension)
 * @param {Array} allFiles - All material files with { name, body, ... }
 * @returns {Array} - Files that link to target
 */
export function findBacklinks(targetName, allFiles) {
    if (!targetName || !allFiles) {
        return [];
    }

    // Normalize target name (remove .txt extension if present)
    const normalizedTarget = targetName.replace(/\.txt$/, '');

    const backlinks = [];

    for (const file of allFiles) {
        const links = extractLinks(file.body || '');

        // Check if any link matches the target
        const hasLink = links.some(link => {
            const normalizedLink = link.replace(/\.txt$/, '');
            return normalizedLink === normalizedTarget;
        });

        if (hasLink) {
            backlinks.push({
                name: file.name,
                handle: file.handle,
                path: file.path
            });
        }
    }

    return backlinks;
}

/**
 * Build a complete link graph for all files
 * @param {Array} allFiles - All material files
 * @returns {Map} - Map of fileName -> { outLinks: [], backlinks: [] }
 */
export function buildLinkGraph(allFiles) {
    const graph = new Map();

    // First pass: extract all outbound links
    for (const file of allFiles) {
        const fileName = file.name.replace(/\.txt$/, '');
        const outLinks = extractLinks(file.body || '');

        graph.set(fileName, {
            outLinks,
            backlinks: []
        });
    }

    // Second pass: build backlinks
    for (const file of allFiles) {
        const fileName = file.name.replace(/\.txt$/, '');
        const outLinks = graph.get(fileName)?.outLinks || [];

        for (const linkTarget of outLinks) {
            const normalizedTarget = linkTarget.replace(/\.txt$/, '');

            // Add this file as a backlink to the target
            if (graph.has(normalizedTarget)) {
                const targetNode = graph.get(normalizedTarget);
                if (!targetNode.backlinks.includes(fileName)) {
                    targetNode.backlinks.push(fileName);
                }
            }
        }
    }

    return graph;
}

/**
 * Get link info for a specific file
 * @param {string} fileName - File name
 * @param {Map} linkGraph - Link graph from buildLinkGraph
 * @returns {{ outLinks: string[], backlinks: string[] }}
 */
export function getLinkInfo(fileName, linkGraph) {
    const normalizedName = fileName.replace(/\.txt$/, '');
    return linkGraph.get(normalizedName) || { outLinks: [], backlinks: [] };
}

/**
 * Find orphan files (files with no links in or out)
 * @param {Map} linkGraph - Link graph
 * @returns {string[]} - Array of orphan file names
 */
export function findOrphans(linkGraph) {
    const orphans = [];

    for (const [fileName, linkInfo] of linkGraph.entries()) {
        if (linkInfo.outLinks.length === 0 && linkInfo.backlinks.length === 0) {
            orphans.push(fileName);
        }
    }

    return orphans;
}

/**
 * Check if a link target exists in the file list
 * @param {string} linkTarget - Link target name
 * @param {Array} allFiles - All material files
 * @returns {boolean}
 */
export function linkTargetExists(linkTarget, allFiles) {
    const normalizedTarget = linkTarget.replace(/\.txt$/, '');

    return allFiles.some(file => {
        const normalizedFileName = file.name.replace(/\.txt$/, '');
        return normalizedFileName === normalizedTarget;
    });
}
