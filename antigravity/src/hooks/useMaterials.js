import { useState, useEffect, useCallback } from 'react';
import { fileSystem, isNative } from '../utils/fileSystem';
import { parseNote } from '../utils/metadataParser';
import { buildLinkGraph } from '../utils/linkAnalyzer';

// --- 全局 I/O セマフォ ---
// 同時発行数を「物理的に3つ」に制限するカウンター
let activeQueries = 0;
const MAX_CONCURRENT_IO = 3;

const throttledRead = async (handle, options = {}) => {
  while (activeQueries >= MAX_CONCURRENT_IO) {
    await new Promise(r => setTimeout(r, 50));
  }
  activeQueries++;
  try {
    return await fileSystem.readFile(handle, options);
  } finally {
    activeQueries--;
  }
};

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

            // 3. Process files with concurrency limit (Fix: I/O Throttling)
            const flatList = [];
            const newTags = new Set();
            const newCache = new Map(fileCache);
            let cacheUpdated = false;
            const BATCH_SIZE = 2; // 指示書に基づき 2 件ずつ処理 (IPC負荷軽減の極大化)

            const processFile = async ({ item, filePath }) => {
                // 指示に基づき、初期ロード時はファイルの中身を読み込まない。
                // 雲マークのファイル（OneDrive等）がスタックしてアプリ全体を道連れにするのを防ぐため。
                const lastModified = item.lastModified || 0;
                
                const fileData = {
                    ...item,
                    path: filePath,
                    metadata: {}, // 後で読み込まれる
                    tags: [],     // 後で読み込まれる
                    lastModified
                };

                return fileData;
            };

            // バッチ処理（構造は維持するが、中身は読まないので高速）
            for (let i = 0; i < fileEntries.length; i += BATCH_SIZE) {
                const batch = fileEntries.slice(i, i + BATCH_SIZE);
                // processFile が Promise を返すため Promise.all を使用
                const results = await Promise.all(batch.map(processFile));
                
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
