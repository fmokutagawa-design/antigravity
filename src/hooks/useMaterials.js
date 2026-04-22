import { useState, useEffect, useCallback } from 'react';
import { fileSystem, isNative } from '../utils/fileSystem';
import { parseNote } from '../utils/metadataParser';
import { buildLinkGraph } from '../utils/linkAnalyzer';

export const useMaterials = (projectHandle) => {
    const [materialsTree, setMaterialsTree] = useState([]);
    const [allMaterialFiles, setAllMaterialFiles] = useState([]);
    const [tags, setTags] = useState(new Set());
    const [linkGraph, setLinkGraph] = useState(new Map());
    const [isLoading, setIsLoading] = useState(false);

    // Cache for file contents: Map<filePath, { lastModified, data }>
    const [fileCache, setFileCache] = useState(new Map());

    const loadMaterials = useCallback(async () => {
        if (!projectHandle) {
            setMaterialsTree([]);
            setAllMaterialFiles([]);
            setTags(new Set());
            setLinkGraph(new Map());
            return;
        }

        setIsLoading(true);
        try {
            // 1. Read the whole tree structure first
            const tree = await fileSystem.readDirectory(projectHandle);

            // Filter out .nexus folders recursively for the sidebar tree
            const filterTree = (items) => {
                return items
                    .filter(item => !(item.kind === 'directory' && (item.name === '.nexus' || item.name.endsWith('.nexus'))))
                    .map(item => {
                        if (item.kind === 'directory' && item.children) {
                            return { ...item, children: filterTree(item.children) };
                        }
                        return item;
                    });
            };
            const filteredTree = filterTree(tree);

            const rootItem = {
                name: projectHandle.name || 'Project',
                kind: 'directory',
                handle: projectHandle,
                children: filteredTree
            };
            setMaterialsTree([rootItem]);

            // 2. Flatten files for processing
            const fileEntries = [];
            const collectFiles = (items, pathPrefix = '') => {
                for (const item of items) {
                    if (item.kind === 'file') {
                        const filePath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name;
                        // Only process text files
                        if (item.name.endsWith('.txt') || item.name.endsWith('.md')) {
                            fileEntries.push({ item, filePath });
                        }
                    } else if (item.kind === 'directory') {
                        if (item.name === '.nexus' || item.name.endsWith('.nexus')) continue;
                        if (item.children) {
                            collectFiles(item.children, pathPrefix ? `${pathPrefix}/${item.name}` : item.name);
                        }
                    }
                }
            };
            collectFiles(tree);

            // 3. Process files with concurrency limit
            const flatList = [];
            const newTags = new Set();
            const newCache = new Map(fileCache);
            let cacheUpdated = false;
            const CONCURRENCY = 8;

            const processFile = async ({ item, filePath }) => {
                try {
                    const lastModified = item.lastModified || 0;
                    
                    // Cache check
                    if (newCache.has(filePath) && newCache.get(filePath).lastModified === lastModified) {
                        const cached = newCache.get(filePath).data;
                        if (cached.metadata?.tags) cached.metadata.tags.forEach(t => newTags.add(t));
                        if (cached.tags) cached.tags.forEach(t => newTags.add(t));
                        return { ...cached, path: filePath };
                    }

                    // Partial read for scanning (Fix #7)
                    const scanContent = await fileSystem.readFile(item.handle, { length: 4096 });
                    
                    // Parse metadata/tags
                    const { metadata } = parseNote(scanContent);
                    const fileTags = new Set();
                    
                    if (metadata.tags && Array.isArray(metadata.tags)) {
                        metadata.tags.forEach(tag => {
                            newTags.add(tag);
                            fileTags.add(tag);
                        });
                    }

                    const tagRegex = /#[\w\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]+/g;
                    const matches = scanContent.match(tagRegex);
                    if (matches) {
                        matches.forEach(tag => {
                            if (/^#ch\d+$/i.test(tag)) return;
                            if (/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/.test(tag)) return;
                            newTags.add(tag);
                            fileTags.add(tag);
                        });
                    }

                    const fileData = {
                        ...item,
                        path: filePath,
                        metadata,
                        tags: Array.from(fileTags),
                        lastModified
                    };

                    newCache.set(filePath, { lastModified, data: fileData });
                    cacheUpdated = true;
                    return fileData;
                } catch (e) {
                    console.error(`[useMaterials] Skip file due to error: ${filePath}`, e);
                    return null;
                }
            };

            // Limit parallel execution
            for (let i = 0; i < fileEntries.length; i += CONCURRENCY) {
                const chunk = fileEntries.slice(i, i + CONCURRENCY);
                const results = await Promise.all(chunk.map(processFile));
                results.forEach(res => {
                    if (res) flatList.push(res);
                });
            }

            setAllMaterialFiles(flatList);
            setTags(newTags);

            if (cacheUpdated) {
                setFileCache(newCache);
            }

            // Build link graph
            const graph = buildLinkGraph(flatList);
            setLinkGraph(graph);

        } catch (error) {
            console.error('Failed to load materials:', error);
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectHandle]);

    // Initial load
    useEffect(() => {
        loadMaterials();
    }, [projectHandle, loadMaterials]);

    return {
        materialsTree,
        allMaterialFiles,
        tags,
        linkGraph,
        isLoading,
        refreshMaterials: loadMaterials
    };
};
