import { useState, useEffect, useCallback } from 'react';
import { fileSystem } from '../utils/fileSystem';

const SNIPPETS_FILE_NAME = '_snippets.json';

export function useSnippets(projectHandle, showToast) {
  const [snippets, setSnippets] = useState([]);

  // Load snippets
  useEffect(() => {
    const loadSnippets = async () => {
      if (projectHandle) {
        try {
          const fileHandle = await fileSystem.getFileHandle(projectHandle, SNIPPETS_FILE_NAME, { create: false });
          const content = await fileSystem.readFile(fileHandle);
          const parsed = JSON.parse(content);
          setSnippets(parsed);
        } catch (error) {
          // Silent fail for first time
          setSnippets([]);
        }
      } else {
        setSnippets([]);
      }
    };
    loadSnippets();
  }, [projectHandle]);

  // Save snippets
  useEffect(() => {
    const saveSnippets = async () => {
      if (projectHandle && snippets.length > 0) {
        try {
          const fileHandle = await fileSystem.getFileHandle(projectHandle, SNIPPETS_FILE_NAME, { create: true });
          await fileSystem.writeFile(fileHandle, JSON.stringify(snippets, null, 2));
        } catch (e) {
          console.error("Failed to save snippets", e);
        }
      }
    };
    saveSnippets();
  }, [snippets, projectHandle]);

  const handleAddSnippet = useCallback((text) => {
    const newSnippet = {
      id: Date.now().toString(),
      content: text,
      createdAt: Date.now()
    };
    setSnippets(prev => [newSnippet, ...prev]);
  }, []);

  const handleDeleteSnippet = useCallback((id) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleCopySnippet = useCallback((text) => {
    navigator.clipboard.writeText(text);
    showToast('コピーしました');
  }, [showToast]);

  const handleSnippetDragStart = useCallback((e, snippet) => {
    e.dataTransfer.setData('text/plain', snippet.content);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  return {
    snippets,
    handleAddSnippet,
    handleDeleteSnippet,
    handleCopySnippet,
    handleSnippetDragStart,
  };
}
