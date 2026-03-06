import { useState, useEffect, useCallback } from 'react';
import { fileSystem, isElectron } from '../utils/fileSystem';
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
        if (!projectHandle) return;

        setIsLoading(true);
        try {
            // Read tree using adapter
            const tree = await fileSystem.readDirectory(projectHandle);

            // Wrap in root folder for UI display
            const rootItem = {
                name: projectHandle.name,
                kind: 'directory',
                handle: projectHandle,
                children: tree
            };
            setMaterialsTree([rootItem]);

            // Create flat list and extract metadata
            const flatList = [];
            const newTags = new Set();
            const newCache = new Map(fileCache); // Copy existing cache
            let cacheUpdated = false;

            const traverse = async (items, pathPrefix = '') => {
                for (const item of items) {
                    if (item.kind === 'file') {
                        const filePath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name;
                        try {
                            // Unified read
                            let content = '';
                            let lastModified = 0;

                            if (isElectron) {
                                content = await fileSystem.readFile(item.handle);
                                // No cache usage for Electron v1 for simplicity (local is fast)
                            } else {
                                // Browser: Use Cache if possible to avoid slow disk access
                                const file = await item.handle.getFile();
                                lastModified = file.lastModified;

                                if (newCache.has(filePath) && newCache.get(filePath).lastModified === lastModified) {
                                    // Use cached data
                                    const cachedData = newCache.get(filePath).data;
                                    flatList.push(cachedData);

                                    // Extract tags (re-add to Set)
                                    if (cachedData.metadata?.tags) cachedData.metadata.tags.forEach(t => newTags.add(t));
                                    // Note: we don't re-regex but it should be fine if metadata is correct
                                    continue; // Skip reading
                                }
                                content = await file.text();
                            }

                            // Parse note into body and metadata
                            const { body, metadata } = parseNote(content);

                            const fileData = {
                                ...item,
                                content,
                                body,
                                metadata,
                                path: filePath
                            };

                            if (!isElectron) {
                                newCache.set(filePath, { lastModified, data: fileData });
                                cacheUpdated = true;
                            }

                            flatList.push(fileData);

                            // Extract tags from metadata
                            if (fileData.metadata.tags && Array.isArray(fileData.metadata.tags)) {
                                fileData.metadata.tags.forEach(tag => newTags.add(tag));
                            }

                            // Also extract old-style #tags for backward compatibility
                            const tagRegex = /#[\w\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]+/g;
                            const matches = fileData.content.match(tagRegex);
                            if (matches) {
                                matches.forEach(tag => {
                                    // Exclude #chXX format (often used for plot structure, not categorization)
                                    if (/^#ch\d+$/i.test(tag)) return;

                                    // Exclude Hex Colors (e.g. #E3F2FD, #FFF)
                                    // Users confusingly see color codes as tags if they have CSS or color refs in notes
                                    if (/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/.test(tag)) return;

                                    newTags.add(tag);
                                });
                            }
                        } catch (e) {
                            console.error('Error reading file for tags:', item.name, e);
                            flatList.push({
                                ...item,
                                content: '',
                                body: '',
                                metadata: { tags: [], 種別: '', 状態: '', 作品: '' },
                                path: filePath
                            });
                        }
                    } else if (item.kind === 'directory') {
                        if (item.children) {
                            await traverse(item.children, pathPrefix ? `${pathPrefix}/${item.name}` : item.name);
                        }
                    }
                }
            };

            await traverse(tree);
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
    }, [projectHandle, fileCache]); // Add fileCache to dependencies

    // Initial load
    useEffect(() => {
        loadMaterials();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectHandle]); // dependencies reduced

    return {
        materialsTree,
        allMaterialFiles,
        tags,
        linkGraph,
        isLoading,
        refreshMaterials: loadMaterials
    };
};
