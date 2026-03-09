import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import Toolbar from './components/Toolbar';
import PrizePanel from './components/PrizePanel';
import CandidateBox from './components/CandidateBox';
import Editor from './components/Editor';
import Preview from './components/Preview';
import Stats from './components/Stats';
import AIAssistant from './components/AIAssistant';
import ClipboardHistory from './components/ClipboardHistory';
import ClipboardPanel from './components/ClipboardPanel';
import CandidateBoxPanel from './components/CandidateBoxPanel';
import AIPanel from './components/AIPanel';
import SearchReplace from './components/SearchReplace';
import InputModal from './components/InputModal';
import OutlinePanel from './components/OutlinePanel';
import FileTree from './components/FileTree';
import MaterialsPanel from './components/MaterialsPanel';
import ReferencePanel from './components/ReferencePanel';
import TagPanel from './components/TagPanel';
import LinkPanel from './components/LinkPanel';
import SearchPanel from './components/SearchPanel';
import ProgressTracker from './components/ProgressTracker';
import ChecklistPanel from './components/ChecklistPanel';
import { StoryBoard } from './components/StoryBoardMain';
import SemanticGraph from './components/SemanticGraph';
import MatrixOutliner from './components/MatrixOutliner';
import NotificationToast from './components/NotificationToast';
import CustomConfirmModal from './components/CustomConfirmModal';
import CardCreator from './components/CardCreator';
import SnippetsPanel from './components/SnippetsPanel';
import NavigatePanel from './components/NavigatePanel';
import ProgressPanel from './components/ProgressPanel';
import NotesPanel from './components/NotesPanel';
import TodoPanel from './components/TodoPanel';
import SnapshotPanel from './components/SnapshotPanel';
import { saveSnapshot } from './utils/snapshotStore';
import './components/MaterialsPanel.css';
import './components/LinkPanel.css';

import { saveTextFile, loadTextFile } from './utils/fileUtils';
import { fileSystem, isElectron } from './utils/fileSystem';
import { generateEpub, downloadBlob } from './utils/epubExporter'; // EPUB Exporter
// import {
//   openDirectory,
//   readDirectoryTree,
//   readFileContent,
//   writeFileContent,
//   createFile,
//   createDirectory,
//   isFileSystemAccessSupported
// } from './utils/fileSystemUtils';
import { saveProjectHandle, loadProjectHandle, clearProjectHandle } from './utils/indexedDBUtils';
import { useMaterials } from './hooks/useMaterials';
import { ollamaService } from './utils/ollamaService';
import { parseNote, serializeNote } from './utils/metadataParser';
import { convertToFullWidth, convertQuotesToJapanese, convertMarkdownToNovel } from './utils/typesetting';
import './index.css';

function App() {
  const [text, setText] = useState('');
  const [settings, setSettings] = useState({
    colorTheme: 'light', // light, dark, blackboard
    paperStyle: 'lined', // plain, lined, grid, manuscript
    fontFamily: 'var(--font-mincho)',
    fontSize: 18,
    lineHeight: 1.65, // Closer to square for grid (User feedback)
    charSpacing: 1.4, // ノート/無地のletter-spacing比率 (1.0=ベタ組み, 1.65=原稿用紙と同じ)
    charsPerLine: 0,
    linesPerPage: 0,
    isVertical: true,
    orientation: 'landscape',
    showGrid: true,
    showLineNumbers: true, // New setting
    defaultReferenceWindowFontSize: 1.1,
    customKeywords: [], // { id, pattern, color, isActive }
    editorSyntaxColors: true, // Show syntax highlight in editor (overlay)
    rubyVisualization: false, // New: Toggle compact ruby display
    previewSyntaxColors: false, // User requested option (default off)
    syntaxColors: {
      conversation: '#e8f6f3',
      link: '#2980b9',
      ruby: '#e67e22',
      comment: '#7f8c8d',
      emphasis: '#c0392b',
      aozora: '#27ae60'
    },
    strictManuscriptMode: false,
    enableGhostText: true, // Ghost Text Toggle
    customCSS: '', // User custom CSS
  });

  const [aiAction, setAiAction] = useState(null);

  const [presets, setPresets] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isRapidMode, setIsRapidMode] = useState(false);
  const [pendingImport, setPendingImport] = useState(null); // Data from Checklist to Board
  const [pendingFileSelect, setPendingFileSelect] = useState(null);


  const [showInputModal, setShowInputModal] = useState(false);
  const [inputModalMode, setInputModalMode] = useState('rename'); // 'rename' | 'create_file' | 'create_folder'
  const [inputModalValue, setInputModalValue] = useState('');
  const [pendingRenameTarget, setPendingRenameTarget] = useState(null);
  const [pendingCreateParent, setPendingCreateParent] = useState(null); // NEW
  const [pendingAIContent, setPendingAIContent] = useState(null); // Content to save from AI
  const [pendingTag, setPendingTag] = useState(null); // Tag for create_file_with_tag
  const [aiOptions, setAiOptions] = useState({}); // New: options for AI (selectedText, etc)
  const [corrections, setCorrections] = useState([]); // AI proofreading markers
  const [ghostText, setGhostText] = useState(''); // AI predictive suggestions (ghostwriting)
  const ghostTextTimer = useRef(null);
  const ghostTextAbortController = useRef(null);
  const cursorStatsRef = useRef({ start: 0, end: 0, total: 0 });

  // AI Model State (Lifted from AIAssistant)
  const [aiModel, setAiModel] = useState('local'); // 'local', 'chatgpt', 'gemini', 'claude', 'genspark'
  const [localModels, setLocalModels] = useState([]);
  const [selectedLocalModel, setSelectedLocalModel] = useState('');
  const [isLocalConnected, setIsLocalConnected] = useState(false);

  const checkLocalConnection = useCallback(async () => {
    try {
      const isConnected = await ollamaService.checkConnection();
      setIsLocalConnected(isConnected);
      if (isConnected) {
        const models = await ollamaService.getModels();
        setLocalModels(models);
        // Auto-select first model if not set or invalid
        if (models.length > 0 && (!selectedLocalModel || !models.includes(selectedLocalModel))) {
          setSelectedLocalModel(models[0]);
        }
      }
    } catch (e) {
      console.error("Ollama connection check failed", e);
      setIsLocalConnected(false);
    }
  }, [selectedLocalModel]);

  // Check connection on mount
  useEffect(() => {
    checkLocalConnection();
    // Poll every 30s? Or just once. Once is fine for start.
  }, []);

  const handleCursorStats = useCallback((stats) => {
    cursorStatsRef.current = stats;
  }, []);

  // Ghost Text Effect
  useEffect(() => {
    // 1. Clear existing ghost text on ANY change
    setGhostText('');

    // 2. Abort previous generation
    if (ghostTextAbortController.current) {
      ghostTextAbortController.current.abort();
    }
    clearTimeout(ghostTextTimer.current);

    // 3. Check preconditions
    if (!settings.enableGhostText) return;
    if (!text || text.length < 10) return; // Don't trigger on empty/short text

    // 4. Debounce Trigger
    ghostTextTimer.current = setTimeout(async () => {
      const { end, total } = cursorStatsRef.current;

      // Only trigger if cursor is at the very end of the file (or we can refine to end of line later)
      // For now, "continue" mode implies appending.
      if (end < total) return;

      // Check connection (Optimistic or check simple flag? Service check is async)
      // We can skip this if we assume user knows status, but better to check
      // to avoid unnecessary errors.
      // However, checkConnection invokes fetch, might be slow.
      // Let's just try generate and handle fail silently.

      ghostTextAbortController.current = new AbortController();

      try {
        // Use last 500 chars for context, with Japanese continuation instruction
        const rawContext = text.slice(-1000);
        const systemPrompt = "以下の日本語の文章の続きを自然に書いてください。説明や翻訳は不要です。続きの文章だけを出力してください。";
        const suggestion = await ollamaService.generateCompletion(rawContext, selectedLocalModel, ghostTextAbortController.current.signal, systemPrompt);

        if (suggestion && suggestion.trim().length > 0) {
          setGhostText(suggestion);
        }
      } catch (e) {
        // Ignore aborts or failures
      }
    }, 1500);

    return () => {
      clearTimeout(ghostTextTimer.current);
      if (ghostTextAbortController.current) {
        ghostTextAbortController.current.abort();
      }
    };
  }, [text, settings.enableGhostText, selectedLocalModel]);


  // Custom UI Management
  const [toasts, setToasts] = useState([]);
  const [notesText, setNotesText] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: false });

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]); // Keep last 5
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const requestConfirm = useCallback((title, message, isDanger = false) => {
    return new Promise((resolve) => {
      setConfirmConfig({
        isOpen: true,
        title,
        message,
        isDanger,
        onConfirm: () => {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  }, []);



  const handleInputModalSubmit = async (value) => {
    setShowInputModal(false);
    try {

      if (inputModalMode === 'rename' && pendingRenameTarget) {
        if (!value || value === pendingRenameTarget.name) return;

        const newPath = await fileSystem.rename(pendingRenameTarget.handle, value);

        // Update Tab if renamed
        if (activeFileHandle && activeFileHandle.handle === pendingRenameTarget.handle) {
          setActiveFileHandle({ ...activeFileHandle, handle: newPath.handle, name: newPath.name });
        }

        // Update Timeline
        // Assuming timelineEvents and refreshMaterials are defined elsewhere in the scope
        // const updatedTimeline = timelineEvents.map(e => 
        //   e.linkedFile === pendingRenameTarget.name ? { ...e, linkedFile: value } : e
        // );
        // setTimelineEvents(updatedTimeline);

        // Refresh
        await refreshMaterials();

      } else if (inputModalMode === 'create_file') {
        if (value) {
          const fullName = value.endsWith('.txt') ? value : `${value}.txt`;
          await handleCreateFileInProject(pendingCreateParent, fullName);
        }
      } else if (inputModalMode === 'create_folder') {
        if (value) {
          await handleCreateFolderInProject(pendingCreateParent, value);
        }
      } else if (inputModalMode === 'save_preset') {
        if (value) {
          handleSavePreset(value);
        }

      } else if (inputModalMode === 'create_file_with_tag') {
        if (value && pendingTag) {
          const fullName = value.trim().endsWith('.txt') ? value.trim() : `${value.trim()}.txt`;
          const tagName = pendingTag;

          try {
            const tagLower = tagName.toLowerCase();
            let rootFolderName = 'materials';
            let subfolderName = '';

            if (['プロット', 'Plot'].some(t => tagLower.includes(t.toLowerCase()))) {
              rootFolderName = 'plots';
            } else {
              if (['登場人物', 'Character', 'キャラ'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'characters';
              else if (['世界観', 'World', '世界'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'world';
              else if (['舞台', 'Location', '場所'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'locations';
              else if (['アイテム', 'Item', '道具'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'items';
              else if (['魔法', 'Magic', 'スキル'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'magic';
            }

            // Ensure folders exist
            let targetHandle = projectHandle;

            // Check/Create root
            let rootHandle;
            try {
              rootHandle = await projectHandle.getDirectoryHandle(rootFolderName, { create: true });
            } catch (e) { console.error(e); }

            if (rootHandle) {
              targetHandle = rootHandle;
              if (subfolderName) {
                try {
                  targetHandle = await rootHandle.getDirectoryHandle(subfolderName, { create: true });
                } catch (e) { console.error(e); }
              }
            }

            // Create File
            const fileHandle = await targetHandle.getFileHandle(fullName, { create: true });

            // Write initial content with tag
            const initialContent = `-- -\ntags: [${tagName}]\n-- -\n# ${fullName.replace('.txt', '')} \n\n`;
            await fileSystem.writeFile(fileHandle, initialContent);

            // Refresh and Open
            await refreshMaterials();
            const tree = await fileSystem.readDirectory(projectHandle);
            setFileTree(tree);

            await handleFileSelect(fileHandle);
            showToast(`「${tagName}」のファイルを自動振り分けで作成しました`);

          } catch (e) {
            console.error(e);
            showToast('ファイルの作成に失敗しました: ' + e.message);
          }
        }
      } else if (inputModalMode === 'ai_create_file') {
        if (value && pendingAIContent) {
          const fullName = value.endsWith('.txt') ? value : `${value}.txt`;
          try {
            // If project mode, save to project
            if (projectHandle) {
              const fileHandle = await projectHandle.getFileHandle(fullName, { create: true });
              await fileSystem.writeFile(fileHandle, pendingAIContent);
              const tree = await fileSystem.readDirectory((projectHandle));
              setFileTree(tree);
              setActiveFileHandle(fileHandle);
              setText(pendingAIContent);
              showToast(`${fullName} に出力しました。`);
            }
          } catch (e) {
            console.error(e);
            showToast('ファイルの作成に失敗しました。');
          }
        }
      } else if (inputModalMode === 'insert_todo') {
        if (value) {
          // Parse "カテゴリ | 内容" or just "内容"
          const parts = value.split('|').map(s => s.trim());
          let todoText;
          if (parts.length >= 2) {
            todoText = `[TODO: ${parts[0]} | ${parts.slice(1).join('|')}]`;
          } else {
            todoText = `[TODO: その他 | ${value}]`;
          }
          // Insert at cursor position via editor ref
          if (editorRef.current?.insertText) {
            editorRef.current.insertText(todoText);
          } else {
            // Fallback: append to text
            setText(prev => prev + todoText);
          }
        }
      }

      setPendingRenameTarget(null);
      setPendingCreateParent(null);
      setPendingAIContent(null);
      setPendingTag(null);

    } catch (error) {
      console.error('Modal action failed:', error);
      showToast('操作に失敗しました: ' + error.message);
    }
  };

  const [showSemanticGraph, setShowSemanticGraph] = useState(false);
  const [showMatrixOutliner, setShowMatrixOutliner] = useState(false);

  const handleAIInsert = async (insertedText, mode = 'current') => {
    if (mode === 'new-file') {
      if (!isProjectMode) {
        showToast('新規ファイルへの出力はプロジェクトモードでのみ可能です。', 'error');
        return;
      }
      setPendingAIContent(insertedText);
      setInputModalMode('ai_create_file');
      setInputModalValue('');
      setShowInputModal(true);
    } else if (mode === 'replace') {
      if (insertedText.original && insertedText.suggested) {
        // From correction
        if (text.includes(insertedText.original)) {
          setText(text.replace(insertedText.original, insertedText.suggested));
        } else {
          showToast('指摘箇所が見つかりませんでした。');
        }
      } else {
        // Simple replace at cursor (used for rewrite)
        editorRef.current?.insertText(insertedText);
      }
    } else if (mode === 'append') {
      // Append content appropriately (used for continue)
      const insertion = typeof insertedText === 'string' ? insertedText : (insertedText.suggested || '');
      setText(prev => prev.trimEnd() + insertion);
    } else if (mode === 'jump') {
      const { original } = insertedText;
      if (!original || !editorRef.current) return;

      const index = text.indexOf(original);
      if (index !== -1) {
        editorRef.current.jumpToPosition(index, index + original.length);
      } else {
        showToast('指摘箇所が見つかりませんでした。');
      }
    } else {
      if (editorRef.current) {
        editorRef.current.insertText(insertedText);
      } else {
        setText(prev => prev + '\n' + insertedText);
      }
    };
  };

  const handleApplyCorrection = (correction) => {
    if (!text.includes(correction.original)) {
      showToast('修正箇所の原文が見つかりませんでした。', 'error');
      return;
    }
    const newText = text.replace(correction.original, correction.suggested);
    setText(newText);
    setCorrections(prev => prev.filter(c => c.id !== correction.id));
    showToast('修正を適用しました');
  };

  const handleDiscardCorrection = (id) => {
    setCorrections(prev => prev.filter(c => c.id !== id));
  };

  const handleApplyAllCorrections = () => {
    let currentText = text;
    let appliedCount = 0;
    const remainingCorrections = [];
    corrections.forEach(c => {
      if (currentText.includes(c.original)) {
        currentText = currentText.replace(c.original, c.suggested);
        appliedCount++;
      } else {
        remainingCorrections.push(c);
      }
    });
    setText(currentText);
    setCorrections(remainingCorrections);
    if (remainingCorrections.length > 0) {
      showToast(`${appliedCount}件適用しましたが、${remainingCorrections.length}件は適用できませんでした。`);
    } else {
      showToast(`${appliedCount}件の修正をすべて適用しました`);
    }
  };


  const handleFormat = (type) => {
    // Safely separate metadata and body to avoid corrupting YAML header
    const { metadata, body } = parseNote(text);
    let newBody = body;
    let changed = false;

    if (type === 'fullwidth') {
      newBody = convertToFullWidth(newBody);
      changed = true;
    } else if (type === 'quotes') {
      newBody = convertQuotesToJapanese(newBody);
      changed = true;
    } else if (type === 'markdown') {
      newBody = convertMarkdownToNovel(newBody);
      changed = true;
    }

    if (changed && newBody !== body) {
      const newText = serializeNote(newBody, metadata);
      setText(newText);
    }
  };

  const handleEpubExport = async (pName, materials) => {
    if (!materials || materials.length === 0) {
      alert('エクスポートするファイルがありません');
      return;
    }
    try {
      const title = pName || 'Untitled';
      const author = '著者名'; // TODO: 設定から取得
      const epubFiles = materials
        .filter(f => f.name.endsWith('.txt') || f.name.endsWith('.md'))
        .filter(f => !f.name.startsWith('.'))
        .map(f => ({ name: f.name, content: f.body || f.content || '' }));

      if (epubFiles.length === 0) {
        alert('テキストファイルが見つかりません');
        return;
      }

      const blob = await generateEpub({
        title,
        author,
        files: epubFiles,
        isVertical: settings.isVertical !== false
      });
      downloadBlob(blob, `${title}.epub`);
      if (showToast) showToast('EPUBを書き出しました');
    } catch (err) {
      console.error('EPUB export failed:', err);
      alert('EPUB書き出しに失敗しました: ' + err.message);
    }
  };

  const handlePrint = () => {
    if (activeTab !== 'preview') {
      const confirmPrint = window.confirm("原稿全体を印刷（PDF化）するにはプレビュー画面を使用します。\nプレビュー画面に切り替えて印刷しますか？");
      if (confirmPrint) {
        setActiveTab('preview');
        // 描画が完了するのを待ってから印刷ダイアログを出す
        setTimeout(() => window.print(), 500);
      }
    } else {
      window.print();
    }
  };

  // Handlers
  const [showMetadata, setShowMetadata] = useState(false); // Default to hiding metadata
  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // Focus Mode Toggle
  const [isWindowMode, setIsWindowMode] = useState(false); // Window Mode State

  // Project management state
  const [sidebarTab, setSidebarTab] = useState('settings'); // 'files', 'tags', 'links', or 'settings'
  const [projectHandle, setProjectHandle] = useState(null);
  const [savedProjectHandle, setSavedProjectHandle] = useState(null); // For resuming session
  const [fileTree, setFileTree] = useState([]);
  const [activeFileHandle, setActiveFileHandle] = useState(null);
  const [isProjectMode, setIsProjectMode] = useState(false);
  const [projectSettings, setProjectSettings] = useState({
    targetPages: 300,     // 目標枚数 (400字詰め)
    chapters: 0,         // 章数 (0 = 自動)
    deadline: null,      // 締切日
    rapidModeDefault: false,
    todoCategories: ['背景', '人物', '心理', '描写', '設定', '伏線', '調査', 'その他'],
  });

  // Reference Panel State
  const [showReference, setShowReference] = useState(false);
  const [referenceContent, setReferenceContent] = useState('');
  const [referenceFileName, setReferenceFileName] = useState('');
  const [referenceWidth, setReferenceWidth] = useState(400); // Default width
  const [isResizing, setIsResizing] = useState(false);
  const [usageStats, setUsageStats] = useState({}); // Track file access frequency

  const [activeTab, setActiveTab] = useState('editor'); // 'editor' or 'preview'
  // const [isAIOpen, setSidebarTab('ai')] = useState(false); // Removed
  // const [showCandidateBox, setSidebarTab('candidates')] = useState(false); // Removed
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showOutline, setShowOutline] = useState(false); // Outline Panel State

  const [lastSaved, setLastSaved] = useState(null);
  const lastSavedTextRef = useRef('');

  const editorRef = React.useRef(null);
  const fileInputRef = useRef(null);
  const [projectContextMenu, setProjectContextMenu] = useState(null); // { x, y }

  const handleLaunchAI = useCallback((mode, options = {}) => {
    const modeNames = {
      rewrite: 'リライト', proofread: '校正', shorten: '短縮',
      describe: '描写追加', analysis: '分析', summarize: '要約',
      relextract: '関係抽出', continue: '続き生成'
    };
    showToast(`🤖 ${modeNames[mode] || mode} を実行中...`);
    setAiAction(mode);
    setAiOptions(options);
    setSidebarTab('ai');
  }, [showToast]);

  const handleShorten = useCallback((text = '') => {
    const selectedText = text || window.getSelection().toString();
    if (selectedText) {
      handleLaunchAI('shorten', { selectedText });
    }
  }, [handleLaunchAI]);

  const handleDescribe = useCallback((text = '') => {
    const selectedText = text || window.getSelection().toString();
    if (selectedText) {
      handleLaunchAI('describe', { selectedText });
    }
  }, [handleLaunchAI]);

  const [showCardCreator, setShowCardCreator] = useState(false);
  const [cardCreatorInitialData, setCardCreatorInitialData] = useState({});
  const [cardCreatorInitialType, setCardCreatorInitialType] = useState('登場人物');

  const handleCreateCardFromSelection = useCallback((text = '') => {
    const selectedText = text || window.getSelection().toString();
    if (selectedText) {
      setCardCreatorInitialData({ description: selectedText });
      setCardCreatorInitialType('登場人物'); // Default to character for now
      setShowCardCreator(true);
    } else {
      setCardCreatorInitialData({});
      setShowCardCreator(true);
    }
  }, []);

  // Input Modal State
  const [inputModal, setInputModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    value: '',
    onConfirm: () => { },
  });

  const openCardCreator = (type = '登場人物') => {
    setCardCreatorInitialType(type);
    setShowCardCreator(true);
  };


  const closeInputModal = () => setInputModal({ ...inputModal, isOpen: false });
  const openInputModal = (title, message, initialValue, onConfirm) => {
    setInputModal({
      isOpen: true,
      title,
      message,
      value: initialValue || '',
      onConfirm: (val) => {
        closeInputModal();
        onConfirm(val);
      }
    });
  };


  // Candidate Box State and Logic
  const [candidates, setCandidates] = useState([]);

  const CANDIDATES_FILE_NAME = '_candidates.json';

  // Load candidates when projectHandle changes
  useEffect(() => {
    const loadCandidates = async () => {
      if (projectHandle) {
        try {
          const fileHandle = await fileSystem.getFileHandle(projectHandle, CANDIDATES_FILE_NAME, { create: false });
          const content = await fileSystem.readFile(fileHandle);
          const parsedCandidates = JSON.parse(content);
          setCandidates(parsedCandidates);
          showToast('候補箱を読み込みました。');
        } catch (e) {
          if (!e.message?.includes('ENOENT') && !e.message?.includes('not found')) {
            console.warn('候補箱の読み込みに失敗:', e.message);
          }
          setCandidates([]);
        }
      } else {
        setCandidates([]); // Clear candidates if no project is open
      }
    };
    loadCandidates();
  }, [projectHandle, showToast]);

  // Save candidates when candidates state changes
  useEffect(() => {
    const saveCandidates = async () => {
      if (projectHandle && candidates.length > 0) {
        try {
          const fileHandle = await fileSystem.getFileHandle(projectHandle, CANDIDATES_FILE_NAME, { create: true });
          await fileSystem.writeFile(fileHandle, JSON.stringify(candidates, null, 2));
          // showToast('候補箱を保存しました。'); // Too frequent, maybe debounce or only on close
        } catch (e) {
          console.error('Failed to save candidates:', e);
          showToast('候補箱の保存に失敗しました。');
        }
      } else if (projectHandle && candidates.length === 0) {
        // If candidates become empty, delete the file
        try {
          await fileSystem.deleteEntry(await fileSystem.getFileHandle(projectHandle, CANDIDATES_FILE_NAME, { create: false }));
        } catch (e) {
          if (!e.message?.includes('ENOENT') && !e.message?.includes('not found')) {
            console.warn('Failed to delete empty candidates file:', e);
          }
        }
      }
    };
    saveCandidates();
  }, [candidates, projectHandle, showToast]);

  // Snippets State and Logic
  const [snippets, setSnippets] = useState([]);
  const SNIPPETS_FILE_NAME = '_snippets.json';

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
      // Debounce saving? For now simple effect.
      if (projectHandle && snippets.length > 0) {
        try {
          const fileHandle = await fileSystem.getFileHandle(projectHandle, SNIPPETS_FILE_NAME, { create: true });
          await fileSystem.writeFile(fileHandle, JSON.stringify(snippets, null, 2));
        } catch (e) {
          console.error("Failed to save snippets", e);
        }
      }
    };
    // Save only if project exists. Note: Deleting handling omitted for simplicity unless user clears all.
    saveSnippets();
  }, [snippets, projectHandle]);

  const handleAddSnippet = (text) => {
    const newSnippet = {
      id: Date.now().toString(),
      content: text,
      createdAt: Date.now()
    };
    setSnippets(prev => [newSnippet, ...prev]);
  };

  const handleDeleteSnippet = (id) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
  };

  const handleCopySnippet = (text) => {
    navigator.clipboard.writeText(text);
    showToast('コピーしました');
  };

  const handleSnippetDragStart = (e, snippet) => {
    e.dataTransfer.setData('text/plain', snippet.content);
    e.dataTransfer.effectAllowed = 'copy';
  };


  const addCandidate = useCallback((newCandidate) => {
    setCandidates(prev => {
      const candidateWithId = { ...newCandidate, id: Date.now(), status: 'pending' };
      return [...prev, candidateWithId];
    });
    showToast('候補を追加しました。');
  }, [showToast]);

  const adoptCandidate = useCallback((id) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: 'adopted' } : c));
    showToast('候補を採用しました。');
  }, [showToast]);

  const discardCandidate = useCallback((id) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: 'discarded' } : c));
    showToast('候補を破棄しました。');
  }, [showToast]);

  const discardAllCandidates = useCallback(() => {
    setCandidates(prev => prev.map(c => c.status === 'pending' ? { ...c, status: 'discarded' } : c));
    showToast('全ての候補を破棄しました。');
  }, [showToast]);



  useEffect(() => {
    localStorage.setItem('novel-editor-presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem('novel-editor-dark-mode', isDarkMode.toString());
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  // OS判定: Windows向けフォント補正クラスを付与
  useEffect(() => {
    const isWindows = navigator.userAgent.includes('Windows');
    if (isWindows) {
      document.body.classList.add('os-windows');
    }
  }, []);

  // UIスケール反映
  useEffect(() => {
    const scale = (settings.uiScale || 100) / 100;
    document.documentElement.style.setProperty('--ui-scale', scale);

    // 以前の方式のクリーンアップ
    const root = document.getElementById('root');
    if (root) {
      root.style.transform = '';
      root.style.transformOrigin = '';
      root.style.width = '';
      root.style.height = '';
    }
    document.body.style.zoom = '';

    // Electron: webFrame.setZoomFactor が最も正確（ブラウザのネイティブズーム相当）
    if (isElectron && window.api && window.api.setZoomFactor) {
      window.api.setZoomFactor(scale);
    } else if (scale !== 1) {
      // ブラウザ: CSS zoom + サイズ補正で余白を防ぐ
      document.body.style.zoom = scale;
      document.documentElement.style.width = `${100 / scale}%`;
      document.documentElement.style.height = `${100 / scale}%`;
    } else {
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';
    }
  }, [settings.uiScale]);

  // Custom CSS injection
  useEffect(() => {
    let styleEl = document.getElementById('nexus-custom-css');
    if (settings.customCSS) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'nexus-custom-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = settings.customCSS;
    } else if (styleEl) {
      styleEl.remove();
    }
  }, [settings.customCSS]);

  // SearchReplace State
  const [searchReplaceInitialTerm, setSearchReplaceInitialTerm] = useState('');
  const [searchReplaceInitialGrepMode, setSearchReplaceInitialGrepMode] = useState(false);

  // Load settings and presets from local storage on mount
  useEffect(() => {
    // ウィンドウモードでファイル指定がある場合、保存テキストの復元をスキップ
    // （対象ファイルはプロジェクト読み込み後に pendingFileSelect で開く）
    const urlParams = new URLSearchParams(window.location.search);
    const isWindowWithFile = urlParams.get('mode') === 'window' && urlParams.get('file');

    const savedText = localStorage.getItem('novel-editor-text');
    if (savedText && !isWindowWithFile) setText(savedText);

    const settingsKey = isWindowMode ? 'novel-editor-settings-window' : 'novel-editor-settings';
    let savedSettings = localStorage.getItem(settingsKey);

    if (!savedSettings && isWindowMode) {
      // 別窓モードで専用設定がない場合、本体の設定をコピーして初期値とする
      savedSettings = localStorage.getItem('novel-editor-settings');
      if (savedSettings) {
        localStorage.setItem(settingsKey, savedSettings);
      }
    }

    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);

        // 1. Theme/Style Migration
        if (!parsed.colorTheme) {
          if (parsed.theme === 'blackboard') parsed.colorTheme = 'blackboard';
          else if (parsed.theme === 'dark') parsed.colorTheme = 'dark';
          else parsed.colorTheme = 'light';
        }
        if (!parsed.paperStyle) {
          if (parsed.theme === 'notebook') parsed.paperStyle = 'lined';
          else if (parsed.mode === 'manuscript') parsed.paperStyle = 'grid';
          else parsed.paperStyle = 'plain';
        }

        // 2. Default Syntax Colors Migration (V24/V25 Update)
        if (!parsed.syntaxColors) {
          parsed.syntaxColors = {
            conversation: '#e8f6f3',
            link: '#2980b9',
            ruby: '#e67e22',
            comment: '#7f8c8d',
            emphasis: '#2c3e50'
          };
        } else {
          if (!parsed.syntaxColors.conversation || parsed.syntaxColors.conversation === '#2c3e50' || parsed.syntaxColors.conversation === '#f0f0f0') {
            parsed.syntaxColors.conversation = '#e8f6f3';
          }
          if (!parsed.syntaxColors.ruby || parsed.syntaxColors.ruby === '#3498db' || parsed.syntaxColors.ruby === '#e67e22') {
            parsed.syntaxColors.ruby = '#e67e22';
          }
          if (!parsed.syntaxColors.emphasis || parsed.syntaxColors.emphasis === '#000000' || parsed.syntaxColors.emphasis === '#2c3e50') {
            parsed.syntaxColors.emphasis = '#c0392b';
          }
          if (!parsed.syntaxColors.comment || parsed.syntaxColors.comment === '#888888') {
            parsed.syntaxColors.comment = '#7f8c8d';
          }
          if (!parsed.syntaxColors.aozora) {
            parsed.syntaxColors.aozora = '#27ae60';
          }
        }

        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }

    // Live Sync for Window Mode - Prevent infinite loop by checking for changes
    const handleStorageChange = (e) => {
      // 別窓モード（isWindowMode）の場合は、他タブからの設定同期を無視する
      if (isWindowMode) return;

      if (e.key === 'novel-editor-settings' && e.newValue) {
        try {
          const newSettings = JSON.parse(e.newValue);
          setSettings(prev => {
            if (JSON.stringify(prev) === JSON.stringify(newSettings)) return prev;
            return { ...prev, ...newSettings };
          });
        } catch (err) { console.error('Failed to sync settings:', err); }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleOpenGraph = () => setShowSemanticGraph(true);
    const handleOpenOutliner = () => setShowMatrixOutliner(true);
    window.addEventListener('openSemanticGraph', handleOpenGraph);
    window.addEventListener('openMatrixOutliner', handleOpenOutliner);

    const savedPresets = localStorage.getItem('novel-editor-presets');
    if (savedPresets) {
      try { setPresets(JSON.parse(savedPresets)); } catch (err) { console.error('Failed to parse presets', err); setPresets([]); }
    }

    const savedDarkMode = localStorage.getItem('novel-editor-dark-mode');
    if (savedDarkMode) setIsDarkMode(savedDarkMode === 'true');

    loadProjectHandle().then((handle) => { if (handle) setSavedProjectHandle(handle); });

    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'window') {
      setIsWindowMode(true);
      setIsSidebarVisible(false);
      const targetTab = params.get('tab');
      if (targetTab) setActiveTab(targetTab);

      // Electron: filepath パラメータがあればファイルを直接読み込む
      const filePath = params.get('filepath');
      if (filePath && isElectron) {
        (async () => {
          try {
            const content = await fileSystem.readFile(filePath);
            setText(content);
            setActiveFileHandle(filePath);
            setActiveTab('editor');
            // タイトル表示用にファイル名を設定
            const fileName = filePath.split('/').pop().split('\\').pop();
            document.title = `${fileName} - NEXUS`;
          } catch (err) {
            console.error('Failed to read file in window mode:', err);
          }
        })();
        // プロジェクトも読み込む（サイドバー表示用）
        const projectPath = params.get('project');
        if (projectPath) {
          (async () => {
            try {
              setProjectHandle(projectPath);
              const tree = await fileSystem.readDirectory({ handle: projectPath });
              setFileTree(tree);
              setIsProjectMode(true);
            } catch (err) {
              console.error('Failed to load project in window mode:', err);
            }
          })();
        }
      } else {
        // Browser fallback: pendingFileSelect + project auto-resume
        const targetFile = params.get('file');
        if (targetFile) setPendingFileSelect(targetFile);
        loadProjectHandle().then(async (handle) => {
          if (!handle) return;
          try {
            if (handle.requestPermission) {
              const permission = await handle.requestPermission({ mode: 'readwrite' });
              if (permission === 'granted') {
                setProjectHandle(handle);
                const tree = await fileSystem.readDirectory(handle);
                setFileTree(tree);
                setIsProjectMode(true);
              }
            }
          } catch (err) {
            console.error('Failed to auto-resume project in window mode:', err);
          }
        });
      }

      document.body.classList.add('window-mode');
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('openSemanticGraph', handleOpenGraph);
      window.removeEventListener('openMatrixOutliner', handleOpenOutliner);
    };
  }, [isWindowMode]);

  // CRITICAL: Sync attributes to Body for CSS Selectors
  useEffect(() => {
    document.body.dataset.colorTheme = settings.colorTheme || 'light';
    const paperStyle = settings.paperStyle || 'plain';
    document.body.dataset.paperStyle = paperStyle === 'grid' ? 'manuscript' : paperStyle;
  }, [settings.colorTheme, settings.paperStyle]);

  // Determine effective settings for rendering
  // If in Window Mode, override fontSize with reference window specific size
  const effectiveSettings = React.useMemo(() => {
    // 'isVertical' is already inside 'settings'.
    // No need to merge external variable (which doesn't exist).

    if (isWindowMode) {
      // windowモードでは settings.fontSize をそのまま使う
      // fontSize が未設定の場合のみ defaultReferenceWindowFontSize から算出
      const fontSize = settings.fontSize || Math.round((settings.defaultReferenceWindowFontSize || 1.1) * 12);
      return {
        ...settings,
        fontSize
      };
    }
    return settings;
  }, [settings, isWindowMode]);

  const handlePopOutTab = (tabName, fileHandle = null) => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'window');
    url.searchParams.set('tab', tabName);
    if (fileHandle) {
      // Electron: fileHandle is a string path → pass full path for direct read
      // Browser: fileHandle is a FileSystemHandle → pass name for pendingFileSelect
      if (typeof fileHandle === 'string') {
        url.searchParams.set('filepath', fileHandle); // Full path for Electron direct read
        url.searchParams.set('file', fileHandle.split('/').pop().split('\\').pop());
      } else {
        url.searchParams.set('file', fileHandle.name);
      }
    }
    // Electron: pass project path so new window can auto-load
    if (isElectron && projectHandle) {
      url.searchParams.set('project', typeof projectHandle === 'string' ? projectHandle : '');
    }
    window.open(url.toString(), '_blank', 'width=1000,height=800,menubar=no,toolbar=no');
  };

  const handleResumeProject = async () => {
    if (!savedProjectHandle) return;

    try {
      if (isElectron) {
        // Electron: savedProjectHandle is string path, no permission API needed
        // Robustness: Handle if DB has object wrapper
        const projectPath = savedProjectHandle;

        setProjectHandle(projectPath);
        const tree = await fileSystem.readDirectory({ handle: projectPath }); // Ensure format
        setFileTree(tree);
        setIsProjectMode(true);
        setSavedProjectHandle(null);
      } else {
        // Browser: FileSystemHandle
        // Request permission (must be triggered by user action)
        if (savedProjectHandle.requestPermission) {
          const permission = await savedProjectHandle.requestPermission({ mode: 'readwrite' });
          if (permission === 'granted') {
            setProjectHandle(savedProjectHandle);
            const tree = await fileSystem.readDirectory(savedProjectHandle);
            setFileTree(tree);
            setIsProjectMode(true); // Ensure project mode is active
            setSavedProjectHandle(null); // Clear saved handle as it's now active
          } else {
            showToast('権限が許可されませんでした。');
          }
        } else {
          // Fallback if handle is malformed
          console.error("Invalid handle format", savedProjectHandle);
          showToast("プロジェクト情報の復元に失敗しました。再度フォルダを開いてください。");
          setSavedProjectHandle(null);
        }
      }
    } catch (error) {
      console.error('Failed to resume project:', error);
      showToast('プロジェクトの再開に失敗しました。');
      await clearProjectHandle();
      setSavedProjectHandle(null);
    }
  };



  const {
    materialsTree,
    allMaterialFiles,
    tags: availableTags,
    linkGraph,
    refreshMaterials,
    isLoading: isMaterialsLoading
  } = useMaterials(projectHandle);




  // Update fileTree when materialsTree changes
  // Update fileTree when materialsTree changes
  useEffect(() => {
    // Always update fileTree, even if empty, to reflect current project state
    setFileTree(materialsTree);

    if (projectHandle) {
      setIsProjectMode(true);
      // Only switch tab if we have files and aren't already on files tab
      /* Removed auto-switch to prevent annoying jumps
      if (materialsTree.length > 0 && sidebarTab !== 'files') {
        setSidebarTab('files');
      }
      */
    }
  }, [materialsTree, projectHandle]);

  // Session Stats State
  const [sessionStartTotal, setSessionStartTotal] = useState(null);
  const [currentSessionChars, setCurrentSessionChars] = useState(0);

  // Calculate total characters in all files (including current edits)
  const calculateTotalChars = useCallback(() => {
    if (!allMaterialFiles) return 0;

    // Sum all files
    let total = 0;
    for (const file of allMaterialFiles) {
      if (activeFileHandle && file.handle && activeFileHandle.isSameEntry && file.handle.isSameEntry(activeFileHandle)) {
        // This is the active file, use 'text' processing
        // Note: text includes metadata if showMetadata is true? 
        // parseNote handles stripping metadata for char count
        total += (parseNote(text).body?.length || 0);
      } else {
        total += (file.body?.length || 0);
      }
    }
    return total;
  }, [allMaterialFiles, activeFileHandle, text]);

  // Initialize session start total
  useEffect(() => {
    if (allMaterialFiles && allMaterialFiles.length > 0 && sessionStartTotal === null) {
      // Initial load
      setSessionStartTotal(calculateTotalChars());
    }
  }, [calculateTotalChars]);

  // Update session chars whenever text or files change
  useEffect(() => {
    if (sessionStartTotal !== null) {
      const currentTotal = calculateTotalChars();
      setCurrentSessionChars(currentTotal - sessionStartTotal);
    }
  }, [calculateTotalChars, sessionStartTotal]);

  const handleResetSession = () => {
    setSessionStartTotal(calculateTotalChars());
    setCurrentSessionChars(0);
  };

  // Helper to read file content (Common for Editor, New Window, etc.)
  const readFileContent = async (handle) => {
    return await fileSystem.readFile(handle);
  };

  const handleOpenFile = useCallback(async (fileHandle, fileName, options = {}) => {
    try {
      // FIX: Resolve handle from name if null (Called from StoryView)
      let targetHandle = fileHandle;
      if (!targetHandle && fileName && allMaterialFiles) {
        // Try to find by name or path
        const found = allMaterialFiles.find(f => f.name === fileName || (f.handle && typeof f.handle === 'string' && f.handle.endsWith(fileName)));
        if (found) {
          targetHandle = found.handle;
        } else {
          // Try appending .txt
          const foundTxt = allMaterialFiles.find(f => f.name === `${fileName}.txt`);
          if (foundTxt) targetHandle = foundTxt.handle;
        }
      }

      if (!targetHandle) {
        console.warn(`File not found: ${fileName} (handle is null)`);
        showToast(`ファイル "${fileName}" が見つかりませんでした。`);
        return;
      }

      // Use abstracted fileSystem to support both Electron and Browser
      const content = await readFileContent(targetHandle);

      setText(content);
      lastSavedTextRef.current = content;
      setActiveFileHandle(targetHandle);
      setActiveTab('editor');

      // Track usage
      try {
        const usageKey = `file_usage_${projectHandle ? projectHandle.name : 'default'} `;

        // Try to find full path
        let filePath = fileName;
        if (options.path) {
          filePath = options.path;
        } else {
          // Try to find in allMaterialFiles
          const matched = allMaterialFiles.find(f => f.name === fileName);
          if (matched) filePath = matched.path;
        }

        const newStats = { ...usageStats, [filePath]: (usageStats[filePath] || 0) + 1 };
        setUsageStats(newStats);
        localStorage.setItem(usageKey, JSON.stringify(newStats));
      } catch (e) {
        console.error('Failed to track usage:', e);
      }

      // If position is provided, set cursor position after a brief delay
      if (options.position !== undefined && editorRef.current) {
        setTimeout(() => {
          if (editorRef.current && editorRef.current.setCursorPosition) {
            editorRef.current.setCursorPosition(options.position);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Failed to open file:', error);
      showToast('ファイルを開けませんでした。');
    }
  }, [allMaterialFiles, projectHandle, usageStats, showToast]);

  // Handle auto-opening file from URL parameter
  useEffect(() => {
    if (pendingFileSelect && allMaterialFiles && allMaterialFiles.length > 0) {
      const target = allMaterialFiles.find(f => f.name === pendingFileSelect || (f.handle && f.handle.name === pendingFileSelect));
      if (target) {
        handleOpenFile(target.handle, target.name);
        setPendingFileSelect(null); // Clear after opening
      }
    }
  }, [allMaterialFiles, pendingFileSelect, handleOpenFile]);



  const handleTextChange = (newContent) => {
    if (showMetadata) {
      setText(newContent);
    } else {
      // newContent is just the body, preserve metadata
      const { metadata } = parseNote(text);
      const newFullText = serializeNote(newContent, metadata);
      setText(newFullText);
    }
  };

  const handleMetadataUpdate = async (newMetadata) => {
    if (!activeFileHandle) return;

    try {
      // Import metadata utilities
      const { parseNote, serializeNote } = await import('./utils/metadataParser');

      // Use current text from editor
      const { body } = parseNote(text);

      // Serialize with new metadata
      const newContent = serializeNote(body, newMetadata);

      // Write back to current file
      await fileSystem.writeFile(activeFileHandle, newContent);

      // Auto-Organization Logic
      const newHandle = await autoOrganizeFile(activeFileHandle, newMetadata);
      if (newHandle && newHandle !== activeFileHandle) {
        setActiveFileHandle(newHandle);
      }

      // Update text in editor
      setText(newContent);
      await refreshMaterials();

    } catch (e) {
      console.error("Metadata update failed:", e);
      showToast(`メタデータの更新に失敗しました: ${e.message} `);
    }
  };


  /* Fix for Stale Closure: Use Ref to track projectHandle */
  const projectHandleRef = React.useRef(projectHandle);
  React.useEffect(() => {
    projectHandleRef.current = projectHandle;
  }, [projectHandle]);

  const handleOpenLink = async (linkTarget) => {
    try {
      if (!allMaterialFiles) {
        console.warn('allMaterialFiles is not available');
        return;
      }

      // Normalize link target (trim spaces)
      const normalizedTarget = linkTarget.trim();

      const targetFile = allMaterialFiles.find(f => {
        const nameWithoutExt = f.name.replace(/\.[^/.]+$/, "");
        const matches = (
          f.name === normalizedTarget ||
          f.name === `${normalizedTarget}.txt` ||
          nameWithoutExt === normalizedTarget
        );
        return matches;
      });

      if (targetFile) {
        await handleOpenFile(targetFile.handle, targetFile.name);
      } else {
        // Auto-create file if not found
        if (await requestConfirm("確認", `「${linkTarget}」という資料は見つかりませんでした。\n新規作成して開きますか？`)) {
          try {
            // Use Ref to ensure we have the latest handle even if closure is stale
            let currentHandle = projectHandleRef.current;

            // Auto-Recovery (Robust)
            if (!currentHandle) {
              try {
                let sourcePath = null;

                // Priority 1: Active File (Single File Mode context)
                if (activeFileHandle) {
                  sourcePath = typeof activeFileHandle === 'string' ? activeFileHandle : (activeFileHandle.handle || null);
                }
                // Priority 2: Any Material File (Zombie Project context)
                else if (allMaterialFiles && allMaterialFiles.length > 0) {
                  const sample = allMaterialFiles[0];
                  sourcePath = typeof sample.handle === 'string' ? sample.handle : (sample.handle?.handle || null);
                }

                if (sourcePath) {
                  const pathSeparator = sourcePath.includes('\\') ? '\\' : '/';
                  const lastSepIndex = sourcePath.lastIndexOf(pathSeparator);

                  if (lastSepIndex > 0) {
                    const inferredPath = sourcePath.substring(0, lastSepIndex);
                    console.warn("ProjectHandle auto-recovered:", inferredPath);
                    currentHandle = inferredPath;
                    setProjectHandle(inferredPath); // Restore/Promote global state
                  }
                }
              } catch (e) {
                console.error("ProjectHandle recovery failed", e);
              }
            }

            if (!currentHandle && projectHandle) {
              // Fallback to active state if ref is somehow behind
              currentHandle = projectHandle;
            }

            if (!currentHandle) {
              console.error("ProjectHandle missing in handleOpenLink. Ref:", projectHandleRef.current, "State:", projectHandle);

              // Improved guidance
              showToast("リンク先のファイルを作成できませんでした。\n\n原因: プロジェクトフォルダが認識できていません。\n\n対策: サイドバーの「ファイル」タブからプロジェクトフォルダを開き直すか、現在のファイルを保存（Ctrl+S）した状態でリロードをお試しください。");
              return;
            }

            // Create in root directory by default
            const fileName = normalizedTarget.endsWith('.txt') ? normalizedTarget : `${normalizedTarget}.txt`;

            // Initialize with title
            const initialContent = `# ${normalizedTarget} \n\n`;

            // Use fileSystem abstraction for cross-platform compatibility
            const fileHandle = await fileSystem.createFile(currentHandle, fileName, initialContent);

            // Refresh materials
            await refreshMaterials();

            // Open the new file
            await handleOpenFile(fileHandle, fileName);
            setActiveTab('editor'); // Explicitly ensure we are on the editor tab

          } catch (createError) {
            console.error("Failed to auto-create file:", createError);
            showToast("ファイルの作成に失敗しました: " + createError.message);
          }
        }
      }
    } catch (error) {
      console.error('Error in handleOpenLink:', error);
      showToast('リンクを開く際にエラーが発生しました。');
    }
  };

  const handleCreateFileWithTag = async (tagName) => {
    if (!projectHandle) return;

    if (openInputModal) {
      openInputModal('新規ファイル作成', `タグ「${tagName}」を持つ新規ファイルを作成します。\nファイル名を入力してください:`, '', (fileName) => {
        if (!fileName) return;
        const finalName = fileName.trim().endsWith('.txt') ? fileName.trim() : `${fileName.trim()}.txt`;
        // Move the logic inside the callback
        (async () => {
          try {
            const tagLower = tagName.toLowerCase();
            let rootFolderName = 'materials';
            let subfolderName = '';

            if (['プロット', 'Plot'].some(t => tagLower.includes(t.toLowerCase()))) {
              rootFolderName = 'plots';
            } else {
              if (['登場人物', 'Character', 'キャラ'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'characters';
              else if (['世界観', 'World', '世界'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'world';
              else if (['舞台', 'Location', '場所'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'locations';
              else if (['アイテム', 'Item', '道具'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'items';
              else if (['魔法', 'Magic', 'スキル'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'magic';
            }

            // Ensure folders exist
            let targetHandle = projectHandle;

            // Check/Create root
            let rootHandle;
            try {
              rootHandle = await projectHandle.getDirectoryHandle(rootFolderName, { create: true });
            } catch (e) { console.error(e); }

            if (rootHandle) {
              targetHandle = rootHandle;
              if (subfolderName) {
                try {
                  targetHandle = await rootHandle.getDirectoryHandle(subfolderName, { create: true });
                } catch (e) { console.error(e); }
              }
            }

            // Create File
            const fileHandle = await targetHandle.getFileHandle(finalName, { create: true });

            // Write initial content with tag
            const initialContent = `-- -\ntags: [${tagName}]\n-- -\n# ${finalName.replace('.txt', '')} \n\n`;
            await fileSystem.writeFile(fileHandle, initialContent);

            // Refresh and Open
            await refreshMaterials();
            const tree = await fileSystem.readDirectory(projectHandle);
            setFileTree(tree);

            await handleFileSelect(fileHandle);
            showToast(`「${tagName}」のファイルを自動振り分けで作成しました`);

          } catch (e) {
            console.error(e);
            showToast('ファイルの作成に失敗しました: ' + e.message);
          }
        })();
      });
      return;
    }

    const fileNamePrompt = window.prompt(`タグ「${tagName}」を持つ新規ファイルを作成します。\nファイル名を入力してください: `);
    if (!fileNamePrompt) return;

    const fileName = fileNamePrompt.trim().endsWith('.txt') ? fileNamePrompt.trim() : `${fileNamePrompt.trim()}.txt`;

    try {
      const tagLower = tagName.toLowerCase();
      let rootFolderName = 'materials';
      let subfolderName = '';

      if (['プロット', 'Plot'].some(t => tagLower.includes(t.toLowerCase()))) {
        rootFolderName = 'plots';
      } else {
        if (['登場人物', 'Character', 'キャラ'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'characters';
        else if (['世界観', 'World', '世界'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'world';
        else if (['用語', 'Item', 'アイテム'].some(t => tagLower.includes(t.toLowerCase()))) subfolderName = 'items';
      }

      let targetDirHandle;
      try {
        targetDirHandle = await fileSystem.createFolder(projectHandle, rootFolderName);
        if (subfolderName) {
          targetDirHandle = await fileSystem.createFolder(targetDirHandle, subfolderName);
        }
      } catch (e) {
        console.warn("Could not navigate/create folder, using project root", e);
        targetDirHandle = projectHandle;
      }

      const content = `# ${fileName.replace('.txt', '')} \n\n#${tagName} \n`;
      const fileHandle = await fileSystem.createFile(targetDirHandle, fileName, content);

      await refreshMaterials();
      await handleOpenFile(fileHandle, fileName);
    } catch (error) {
      console.error("Failed to create tagged file:", error);
      showToast("ファイル作成に失敗しました。");
    }
  };

  // Batch Copy for AI
  const handleBatchCopy = async (filesToCopy) => {
    if (!filesToCopy || filesToCopy.length === 0) return;

    let clipboardText = "以下の資料を参考にしてください:\n\n";

    for (const file of filesToCopy) {
      // filesToCopy contains { name, content, ... } or just handles?
      // MaterialsPanel has full file data including content in allMaterialFiles
      // We assume we get the full objects. 'body' is used in other places.
      const body = file.body || file.content || "";

      clipboardText += `## Filename: ${file.name} \n${body} \n\n-- -\n\n`;
    }

    try {
      await navigator.clipboard.writeText(clipboardText);
      showToast(`${filesToCopy.length} 件のファイルをクリップボードにコピーしました！`);
    } catch (e) {
      console.error("Copy failed", e);
      showToast("コピーに失敗しました。");
    }
  };



  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('novel-editor-text', text);
    setLastSaved(new Date());
  }, [text, calculateTotalChars]);

  useEffect(() => {
    const settingsKey = isWindowMode ? 'novel-editor-settings-window' : 'novel-editor-settings';
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  }, [settings, isWindowMode]);

  useEffect(() => {
    localStorage.setItem('novel-editor-presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    // Apply theme and style to body dataset for clean CSS
    document.body.dataset.colorTheme = settings.colorTheme || 'light';
    const paperStyle = settings.paperStyle || 'plain';
    document.body.dataset.paperStyle = paperStyle === 'grid' ? 'manuscript' : paperStyle;

    // Keep legacy class for dark mode compatibility if needed elsewhere
    if (settings.colorTheme === 'dark' || settings.colorTheme === 'blackboard') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    // Clean up old classes
    document.body.classList.remove('theme-blackboard', 'theme-notebook');
  }, [settings.colorTheme, settings.paperStyle]);

  // Load project handle from IndexedDB on mount
  useEffect(() => {
    const loadSavedProject = async () => {
      try {
        const savedHandle = await loadProjectHandle();
        if (savedHandle) {
          // Verify permission
          const permission = await savedHandle.queryPermission({ mode: 'readwrite' });
          if (permission === 'granted') {
            setProjectHandle(savedHandle);
            // The file tree and project mode will be set by the useMaterials hook and its effects
          } else {
            // Permission not granted, clear saved handle
            await clearProjectHandle();
          }
        }
      } catch (error) {
        console.error('Failed to load saved project:', error);
        await clearProjectHandle();
      }
    };

    loadSavedProject();
  }, []);

  // Save project handle to IndexedDB when it changes
  useEffect(() => {
    if (projectHandle) {
      saveProjectHandle(projectHandle).catch(error => {
        console.error('Failed to save project handle:', error);
      });
    }
  }, [projectHandle]);

  // Resizing logic
  const startResizing = React.useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = React.useCallback((mouseMoveEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - mouseMoveEvent.clientX;
      if (newWidth > 200 && newWidth < window.innerWidth - 300) {
        setReferenceWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const handleSavePreset = (name) => {
    // If name is not provided (event object or empty), open modal
    if (!name || typeof name !== 'string') {
      setInputModalMode('save_preset');
      setInputModalValue('');
      setShowInputModal(true);
      return;
    }

    const newPreset = {
      id: Date.now().toString(),
      name,
      settings: { ...settings }
    };
    setPresets(prev => [...prev, newPreset]);
  };

  const handleLoadPreset = (presetId) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setSettings(preset.settings);
    }
  };

  const handleDeletePreset = async (presetId) => {
    if (await requestConfirm("確認", 'このプリセットを削除しますか？')) {
      setPresets(prev => prev.filter(p => p.id !== presetId));
    }
  };

  // Keyboard shortcuts (Cmd/Ctrl + F: search, Cmd+Shift+R: rapid mode, Cmd+S: save, Cmd+T: TODO)
  const handleSaveFileRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      // Cmd+S: Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (handleSaveFileRef.current) handleSaveFileRef.current();
      }
      // Cmd+Shift+R: Toggle rapid writing mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        setIsRapidMode(prev => !prev);
      }
      // Cmd+T: Insert TODO
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        setInputModalMode('insert_todo');
        setInputModalValue('');
        setShowInputModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ウィンドウを閉じる前に未保存チェック
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isProjectMode && text !== lastSavedTextRef.current) {
        // 最後の変更を即座に保存試行
        if (activeFileHandle) {
          try {
            fileSystem.writeFile(activeFileHandle, text);
          } catch { /* best effort */ }
        }
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  });

  const handleContextMenu = (event) => {
    // Prevent default context menu
    event.preventDefault();
    // Implement custom context menu logic here if needed
    // For now, just prevent default
  };

  const handleInsertLink = (term, index) => {
    // This function is called from LinkPanel to insert a link at a specific index
    // Note: index is based on the current text content
    // We need to be careful if text has changed, but LinkPanel debounces updates

    const before = text.substring(0, index);
    const after = text.substring(index + term.length);
    const newText = `${before} [[${term}]]${after} `;

    handleTextChange(newText);
  };


  const autoOrganizeFile = async (handle, metadata) => {
    if (!handle || !projectHandle) return handle;

    const type = metadata.種別 || "";
    const tags = metadata.tags || [];
    let targetFolder = "";

    // Debug: Check if tags are detected
    // console.log("AutoOrganize Check:", type, tags);




    const isCharacter = type === '登場人物' || tags.includes('Character') || tags.includes('キャラ');
    const isOrganization = type === '組織' || tags.includes('Organization') || tags.includes('組織');
    const isWorld = type === '世界観' || tags.includes('World') || tags.includes('世界');
    const isGadget = type === 'ガジェット' || tags.includes('Gadget');
    const isItem = type === '用語' || type === 'アイテム' || tags.includes('Item') || tags.includes('アイテム');
    const isLocation = type === '地理' || type === '場所' || tags.includes('Location') || tags.includes('地理') || tags.includes('場所');
    const isEvent = type === '事件' || type === 'イベント' || tags.includes('Event') || tags.includes('事件') || tags.includes('イベント');
    const isPlot = type === 'プロット' || tags.includes('Plot');
    const isTimeline = type === '時系列' || tags.includes('Timeline') || tags.includes('History') || tags.includes('年表');
    const isManuscript = type === '原稿' || tags.includes('Manuscript') || tags.includes('Draft');

    if (isCharacter) targetFolder = 'characters';
    else if (isOrganization) targetFolder = 'organizations';
    else if (isWorld) targetFolder = 'world';
    else if (isGadget) targetFolder = 'gadgets';
    else if (isItem) targetFolder = 'items';
    else if (isLocation) targetFolder = 'locations';
    else if (isEvent) targetFolder = 'events';
    else if (isPlot) targetFolder = 'plots';
    else if (isTimeline) targetFolder = 'timelines';
    else if (isManuscript) targetFolder = 'manuscripts';

    if (targetFolder) {
      try {
        const pathParts = await fileSystem.resolvePath(projectHandle, handle);
        if (pathParts) {
          const currentRoot = pathParts[0]; // Top level folder

          // Debug Check
          // showToast(`PathParts: ${ JSON.stringify(pathParts) } \nTarget: ${ targetFolder } `);

          let isInCorrectFolder = false;
          if (pathParts.length > 1) {
            isInCorrectFolder = (currentRoot === targetFolder);
          }

          if (!isInCorrectFolder) {
            console.log(`Auto - organizing: Moving ${handle.name} to ${targetFolder} `);
            // showToast(`移動を開始します: ${ handle.name } -> ${ targetFolder } `);

            const targetDirHandle = await fileSystem.createFolder(projectHandle, targetFolder);

            let sourceDirHandle = projectHandle;
            if (pathParts.length > 1) {
              const parentParts = pathParts.slice(0, -1);
              sourceDirHandle = await fileSystem.getDirectoryHandleFromPath(projectHandle, parentParts);
            }

            const newHandle = await fileSystem.moveFileWithContext(handle, sourceDirHandle, targetDirHandle);
            return newHandle;
          }
        } else {
          console.warn("Path resolution failed");
          // If strictly needed, alert user to re-open project
          // showToast("自動移動エラー: ファイルパスがプロジェクト外か解決できません。");
        }
      } catch (e) {
        console.error("Auto-organize failed", e);
        showToast(`自動移動エラー: ${e.message} `);
      }
    }
    return handle;
  };

  // 一括結合エクスポート
  const handleBatchExport = async () => {
    if (!allMaterialFiles || allMaterialFiles.length === 0) {
      showToast('プロジェクトファイルがありません。');
      return;
    }
    try {
      const { parseNote } = await import('./utils/metadataParser');
      // 原稿ファイルを収集（種別が原稿、またはmanuscriptsフォルダ内のファイル）
      const manuscriptFiles = allMaterialFiles.filter(f => {
        const type = f.metadata?.種別 || '';
        const name = f.name || '';
        const isManuscript = type === '原稿' || name.includes('原稿') || name.includes('本原稿');
        return isManuscript && name.endsWith('.txt');
      });
      const targetFiles = manuscriptFiles.length > 0 ? manuscriptFiles : allMaterialFiles.filter(f => (f.name || '').endsWith('.txt'));
      if (targetFiles.length === 0) {
        showToast('書き出し対象のファイルが見つかりません。');
        return;
      }
      // ファイル名順にソート
      targetFiles.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
      // 結合
      const parts = [];
      for (const file of targetFiles) {
        const content = file.body || file.content || '';
        if (content.trim()) {
          parts.push(content);
        }
      }
      const merged = parts.join('\n\n［＃改ページ］\n\n');
      // 保存
      if (isElectron) {
        const defaultPath = (projectHandle?.handle || projectHandle || '') + '/exported.txt';
        const savePath = await window.api.fs.saveFile(defaultPath);
        if (savePath) {
          await fileSystem.writeFile({ handle: savePath, name: 'exported.txt' }, merged);
          showToast(`${targetFiles.length}ファイルを結合して書き出しました。`);
        }
      } else {
        // ブラウザ: Blobでダウンロード
        const blob = new Blob([merged], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exported.txt';
        a.click();
        URL.revokeObjectURL(url);
        showToast(`${targetFiles.length}ファイルを結合して書き出しました。`);
      }
    } catch (e) {
      console.error('Batch export failed:', e);
      showToast('一括書き出しに失敗しました: ' + e.message);
    }
  };

  const handleSaveFile = async () => {
    if (activeFileHandle && projectHandle) {
      try {
        // Import parser
        const { parseNote } = await import('./utils/metadataParser');
        const { metadata } = parseNote(text);

        await fileSystem.writeFile(activeFileHandle, text);

        // Trigger Auto-Organize
        const newHandle = await autoOrganizeFile(activeFileHandle, metadata);
        if (newHandle && (newHandle !== activeFileHandle)) {
          setActiveFileHandle(newHandle);
          await refreshMaterials();
        }
        setLastSaved(new Date());
        lastSavedTextRef.current = text;
        showToast('💾 保存しました');

      } catch (error) {
        console.error('Failed to save file:', error);
        showToast('ファイルの保存に失敗しました。');
      }
    } else {
      // Fallback to download
      try {
        saveTextFile(text);
      } catch (error) {
        console.error('Failed to save file:', error);
        showToast('ファイルの保存に失敗しました。');
      }
    }
  };
  handleSaveFileRef.current = handleSaveFile;

  const handleUpdateFile = async (handle, newContent) => {
    try {
      await fileSystem.writeFile(handle, newContent);
      // Refresh to update graph and file list
      await refreshMaterials();
      // If updating active file, also update editor text
      if (activeFileHandle && (activeFileHandle.handle === handle || activeFileHandle === handle)) {
        setText(newContent);
      }
      return true;
    } catch (e) {
      console.error("Failed to update file:", e);
      return false;
    }
  };

  const handleLoadFile = async (file) => {
    try {
      const content = await loadTextFile(file);
      setText(content);
    } catch (error) {
      console.error('Failed to load file:', error);
      showToast('ファイルの読み込みに失敗しました。\n' + error.message);
    }
  };

  // Duplicate (Save As) handler
  const handleDuplicateFile = async (handleToDup = activeFileHandle) => {
    if (!handleToDup) return;

    let contentToSave = text;
    // If we are duplicating something that is NOT the active file, we should ideally read it.
    // However, for "Save As", it usually means current editor content.
    // Let's assume footer call uses current text, and tree call uses disk content.
    if (handleToDup !== activeFileHandle) {
      try {
        contentToSave = await fileSystem.readFile(handleToDup);
      } catch (err) {
        console.error("Failed to read file for duplication", err);
      }
    }


    // Default name generation
    const currentName = typeof handleToDup === 'string'
      ? handleToDup.split(/[/\\]/).pop()
      : handleToDup.name;
    const extIndex = currentName.lastIndexOf('.');
    const baseName = extIndex !== -1 ? currentName.substring(0, extIndex) : currentName;
    const ext = extIndex !== -1 ? currentName.substring(extIndex) : '.txt';
    const defaultNewName = `${baseName}_copy${ext} `;

    try {
      if (isElectron) {
        // Native Save Dialog
        // Use current file path as base for default path
        const currentPath = typeof handleToDup === 'string' ? handleToDup : null;
        let defaultPath = defaultNewName;
        if (currentPath) {
          const sep = currentPath.includes('\\') ? '\\' : '/';
          const parentDir = currentPath.substring(0, currentPath.lastIndexOf(sep));
          defaultPath = `${parentDir}${sep}${defaultNewName} `;
        }

        const newPath = await window.api.fs.saveFile(defaultPath);
        if (!newPath) return; // Cancelled

        // Write content
        await fileSystem.writeFile(newPath, contentToSave);

        // If inside project, refresh tree
        // We can check if newPath starts with projectHandle (path)
        const projectPath = typeof projectHandle === 'string' ? projectHandle : projectHandle?.handle;

        if (projectPath) {
          await refreshMaterials();
        }

        // Open the new file
        await handleFileSelect(newPath);
        showToast(`「${newPath.split(/[/\\]/).pop()}」として保存しました。`);

      } else if (window.showSaveFilePicker) {
        // Chrome / Edge Native File System API
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultNewName,
          types: [{
            description: 'Text Files',
            accept: { 'text/plain': ['.txt'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();

        // Cannot easily refresh tree or open file unless it's inside project and we rescan
        // But we can open it as active file
        setActiveFileHandle(handle); // This handles the view
        // Refreshing tree might not show it if we picked outside, but that's expected
        if (projectHandle) await refreshMaterials();

        showToast('保存しました。');
      } else {
        if (openInputModal) {
          openInputModal('保存', '新しいファイル名を入力してください:', defaultNewName, async (newName) => {
            if (!newName) return;
            await handleCreateFileInProject(null, newName, text);
            showToast('プロジェクトルートに保存しました（ブラウザ制限のため場所指定不可）。');
          });
          return;
        }
        // Fallback for Firefox/others
        const newName = window.prompt('新しいファイル名を入力してください:', defaultNewName);
        if (!newName) return;
        // Fallback acts as "Branching in place"
        await handleCreateFileInProject(null, newName, text);
        showToast('プロジェクトルートに保存しました（ブラウザ制限のため場所指定不可）。');
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e);
        showToast('保存に失敗しました。');
      }
    }
  };

  // Project management handlers
  const handleOpenProject = async () => {
    // Check support only if not Electron
    if (!isElectron && !window.showDirectoryPicker) {
      showToast('お使いのブラウザはフォルダ機能に対応していません。\nChrome、Edge、Operaをお使いください。');
      return;
    }

    try {
      const dirHandle = await fileSystem.openProjectDialog();
      if (!dirHandle) return; // User cancelled

      setProjectHandle(dirHandle);

      // Save handle to IndexedDB (Works for both Serialized Handle and Path String)
      try {
        await saveProjectHandle(dirHandle);
      } catch (e) { console.warn("Could not save project handle to DB", e); }

      // The file tree and project mode will be set by the useMaterials hook and its effects
    } catch (error) {
      console.error('Failed to open project:', error);
      showToast('プロジェクトフォルダを開けませんでした。');
    }
  };

  const handleFileSelect = async (fileHandle) => {
    try {
      const fileName = (typeof fileHandle === 'string')
        ? fileHandle.split(/[/\\]/).pop()
        : fileHandle.name;

      await handleOpenFile(fileHandle, fileName);
    } catch (error) {
      console.error('Failed to select file:', error);
    }
  };

  // Auto-save to active file in project mode
  useEffect(() => {
    if (isProjectMode && activeFileHandle && text !== undefined) {
      const saveTimeout = setTimeout(async () => {
        try {
          await fileSystem.writeFile(activeFileHandle, text);
          setLastSaved(new Date());
          lastSavedTextRef.current = text;
        } catch (error) {
          console.error('Failed to auto-save:', error);
          showToast('⚠️ 自動保存に失敗しました');
        }
      }, 1000); // Debounce 1 second

      return () => clearTimeout(saveTimeout);
    }
  }, [text, isProjectMode, activeFileHandle]);

  // Auto-snapshot: 5分間隔 or 500文字以上の変更で自動スナップショット
  const lastSnapshotRef = useRef({ text: '', time: 0 });
  useEffect(() => {
    if (!isProjectMode || !activeFileHandle || !text) return;

    const filePath = typeof activeFileHandle === 'string'
      ? activeFileHandle
      : (activeFileHandle.handle || activeFileHandle.name || 'unknown');

    const INTERVAL = 5 * 60 * 1000; // 5分
    const CHAR_THRESHOLD = 500;

    const timer = setInterval(() => {
      const now = Date.now();
      const lastText = lastSnapshotRef.current.text;
      const lastTime = lastSnapshotRef.current.time;
      const charDiff = Math.abs(text.length - lastText.length);
      const timeDiff = now - lastTime;

      if (timeDiff >= INTERVAL || charDiff >= CHAR_THRESHOLD) {
        if (text !== lastText) {
          saveSnapshot(filePath, text, text.length).catch(e =>
            console.warn('Snapshot save failed:', e)
          );
          lastSnapshotRef.current = { text, time: now };
        }
      }
    }, 30000); // 30秒ごとにチェック

    return () => clearInterval(timer);
  }, [text, isProjectMode, activeFileHandle]);

  // ファイル切替時にスナップショットの基準をリセット＋初回保存
  useEffect(() => {
    lastSnapshotRef.current = { text: text || '', time: Date.now() };
    // ファイルを開いた時に初回スナップショットを保存
    if (isProjectMode && activeFileHandle && text) {
      const fp = typeof activeFileHandle === 'string'
        ? activeFileHandle
        : (activeFileHandle.handle || activeFileHandle.name || '');
      if (fp) {
        saveSnapshot(fp, text, text.length).catch(e =>
          console.warn('Initial snapshot failed:', e)
        );
      }
    }
  }, [activeFileHandle]);

  // Load nexus-project.json when project opens
  useEffect(() => {
    if (!projectHandle) return;
    (async () => {
      try {
        const settingsHandle = await fileSystem.getFile(projectHandle, 'nexus-project.json');
        if (settingsHandle) {
          const content = await fileSystem.readFile(settingsHandle);
          const parsed = JSON.parse(content);
          setProjectSettings(prev => ({ ...prev, ...parsed }));
          // Apply rapidModeDefault
          if (parsed.rapidModeDefault) setIsRapidMode(true);
        }
      } catch {
        // File doesn't exist yet — create with defaults on first save
        console.log('nexus-project.json not found, will create on first settings save');
      }
    })();
  }, [projectHandle]);

  // Save project settings helper
  const saveProjectSettings = useCallback(async (newSettings) => {
    const updated = { ...projectSettings, ...newSettings };
    setProjectSettings(updated);
    if (projectHandle) {
      try {
        const handle = await fileSystem.getOrCreateFile(projectHandle, 'nexus-project.json');
        await fileSystem.writeFile(handle, JSON.stringify(updated, null, 2));
      } catch (e) {
        console.warn('Could not save nexus-project.json:', e);
      }
    }
  }, [projectHandle, projectSettings]);

  const handleCreateNewProject = async () => {
    if (!isElectron && !window.showDirectoryPicker) {
      showToast('お使いのブラウザはフォルダ機能に対応していません。\nChrome、Edge、Operaをお使いください。');
      return;
    }

    const confirmed = await requestConfirm(
      '新規プロジェクト作成',
      '新規プロジェクトを作成します。\n\n' +
      '手順:\n' +
      '1. Finderで新しいフォルダを作成してください\n' +
      '2. 「OK」を押すと、そのフォルダを選択する画面が開きます\n' +
      '3. 作成したフォルダを選択してください\n' +
      '4. アプリが自動的に初期ファイルを作成します\n\n' +
      '続けますか？'
    );

    if (!confirmed) return;

    try {
      const dirHandle = await fileSystem.openProjectDialog();
      if (!dirHandle) return;

      // Create initial project structure
      // Create welcome file
      const welcomeContent =
        '# 新規プロジェクトへようこそ\n\n' +
        'このフォルダがあなたの小説プロジェクトです。\n' +
        'サブフォルダを作成して章ごとに整理したり、\n' +
        '複数のテキストファイルを自由に管理できます。\n\n' +
        '左のファイルツリーから編集したいファイルを選択してください。\n' +
        'すべてのファイルは自動的に保存されます。';

      // fileSystem.createFile returns the new handle
      const welcomeFile = await fileSystem.createFile(dirHandle, 'はじめに.txt', welcomeContent);

      setProjectHandle(dirHandle);
      try {
        await saveProjectHandle(dirHandle);
      } catch (err) {
        console.warn("Could not save project handle to DB", err);
      }

      // Open the welcome file
      setActiveFileHandle(welcomeFile);
      setText(welcomeContent);

      showToast('プロジェクトを作成しました！\n「はじめに.txt」を開いています。');
    } catch (error) {
      console.error('Failed to create project:', error);
      showToast('プロジェクトの作成に失敗しました。');
    }
  };


  const handleCreateFileInProject = async (parentHandleArg, fileName, initialContent = null) => {
    console.log('handleCreateFileInProject CALLED', { parentHandleArg, fileName });
    // Default to project root if parentHandleArg is null/undefined
    const parentHandle = parentHandleArg || projectHandle;

    // DEBUG LOG
    console.log("Create File Request:", { parentHandleArg, projectHandle, parentHandle, fileName });

    if (!projectHandle) {
      showToast("プロジェクトフォルダが開かれていません。");
      return;
    }

    // DEBUG: Verify inputs
    // showToast(`DEBUG Create File: Parent = ${ parentHandle } \nName = ${ fileName } `);

    try {
      let contentToWrite = '';
      if (initialContent !== null) {
        contentToWrite = initialContent;
      } else {
        // Auto-tag logic
        try {
          // For Electron, parentHandle is string path, projectHandle is string path.
          // For Browser, they are objects.
          // We need a uniform way to check equality or root status.
          const isRoot = (typeof projectHandle === 'string')
            ? (parentHandle === projectHandle || (parentHandle.handle && parentHandle.handle === projectHandle.handle))
            : (parentHandle === projectHandle || (parentHandle.isSameEntry && await parentHandle.isSameEntry(projectHandle)));

          if (!isRoot) {
            const folderName = parentHandle.name || (typeof parentHandle === 'string' ? parentHandle.split(/[/\\]/).pop() : '');
            const metadata = {
              tags: [folderName],
              種別: '',
              概要: '',
              importance: 3,
            };
            contentToWrite = serializeNote(metadata, `\n# ${fileName.replace(/\.txt$/, '')} \n\n`);
          } else {
            contentToWrite = ''; // No default header
          }
        } catch (e) {
          console.warn("Folder tag auto-detect failed", e);
          contentToWrite = ''; // No default header
        }
      }

      // Use fileSystem adapter
      const newFile = await fileSystem.createFile(parentHandle, fileName, contentToWrite);

      // Refresh
      const tree = await fileSystem.readDirectory(projectHandle);
      setFileTree(tree);

      // Return consistency check
      if (isElectron && newFile && newFile.handle) {
        return newFile.handle;
      }
      return newFile;
    } catch (error) {
      console.error('Failed to create file:', error);
      showToast(`ファイルの作成に失敗しました: ${error.message} `);
    }
  };

  const handleCreateFolderInProject = async (parentHandleArg, folderName) => {
    const parentHandle = parentHandleArg || projectHandle;
    try {
      await fileSystem.createFolder(parentHandle, folderName);

      // Refresh tree
      const tree = await fileSystem.readDirectory(projectHandle);
      setFileTree(tree);
    } catch (error) {
      console.error('Failed to create folder:', error);
      showToast('フォルダの作成に失敗しました。');
    }
  };

  const handleOpenReference = async (fileHandle) => {
    try {
      const content = await fileSystem.readFile(fileHandle);
      setReferenceContent(content);
      setReferenceFileName(fileHandle.name);
      setShowReference(true);
      // setActiveTab('reference'); // Don't switch tab, allow split view
    } catch (error) {
      console.error('Failed to read reference file:', error);
      showToast('参照ファイルの読み込みに失敗しました。');
    }
  };

  const handleOpenInNewWindow = async (fileHandle) => {
    // Unify: Use the same dynamic window mode as the "Window" button
    handlePopOutTab('editor', fileHandle);

  };

  const handleCloseReference = () => {
    setShowReference(false);
    setReferenceContent('');
    setReferenceFileName('');
  };


  // Handle pending navigation
  const [pendingNavigation, setPendingNavigation] = useState(null);
  useEffect(() => {
    if (pendingNavigation && editorRef.current && text.includes(pendingNavigation.tag)) {
      const idx = text.indexOf(pendingNavigation.tag);
      if (idx !== -1) {
        editorRef.current.jumpToPosition(idx, idx + pendingNavigation.tag.length);
        setPendingNavigation(null); // Clear
      }
    }
  }, [text, pendingNavigation]);

  const handleNavigate = async (tag) => {
    if (!tag) return;

    // 1. Search in current file
    const currentIdx = text.indexOf(tag);
    if (currentIdx !== -1) {
      if (editorRef.current) {
        // Focus and scroll
        setActiveTab('editor');
        editorRef.current.jumpToPosition(currentIdx, currentIdx + tag.length);
      }
      return;
    }

    // 2. Search in all files
    if (!allMaterialFiles) return;

    const foundFile = allMaterialFiles.find(f => f.body && f.body.includes(tag));

    if (foundFile) {
      // Open file
      await handleOpenFile(foundFile);
      setPendingNavigation({ tag: tag, timestamp: Date.now() });
      setActiveTab('editor');
    } else {
      showToast(`タグ "${tag}" が見つかりませんでした。`);
    }
  };

  // File/Folder Handlers
  const handleRename = async (handle, newName, itemType) => {
    console.log('handleRename called', { handle, newName, itemType, projectHandle });
    try {
      if (isElectron) {
        // Check if renaming project root
        // projectHandle is object { handle: path, ... } in Electron
        // handle passed from FileTree could be object (root) or string (child)
        const projectPath = typeof projectHandle === 'string' ? projectHandle : projectHandle.handle;
        const targetPath = typeof handle === 'string' ? handle : handle.handle;

        console.log('Checking root rename:', { projectPath, targetPath, match: projectPath === targetPath });

        if (targetPath === projectPath) {
          const newHandle = await fileSystem.rename(projectHandle, newName);
          console.log('Renamed root result:', newHandle);
          if (newHandle) {
            setProjectHandle(newHandle);
            await saveProjectHandle(newHandle);
            showToast('プロジェクト名を変更しました。');
            return;
          }
        }

        await fileSystem.rename(handle, newName);
        await refreshMaterials(); // or re-read tree
      } else {
        showToast(
          'ファイル名の変更は技術的な制約により、現在サポートされていません。\n\n' +
          'デスクトップ版アプリをお使いください。'
        );
      }
    } catch (error) {
      console.error('Failed to rename:', error);
      showToast('名前の変更に失敗しました。');
    }
  };

  const handleMoveItem = async (source, target) => {
    console.log('handleMoveItem CALLED', { source, target });
    try {
      if (!projectHandle) return;

      // 1. Resolve Source Handle
      let sourceHandle = source;
      const sourceName = (typeof source === 'string') ? source : source.name;

      if (typeof source === 'string') { // DnD passes string name
        // allMaterialFiles is available in scope (from useMaterials hook)
        const fileObj = allMaterialFiles.find(f => f.name === sourceName);
        if (fileObj) sourceHandle = fileObj.handle;
        else {
          console.error("Source file not found in registry:", sourceName);
          return;
        }
      }

      const targetHandle = target;

      // 2. Resolve Source Parent (Required for Browser move logic)
      // Use abstraction to avoid .values() crash in Electron
      const pathParts = await fileSystem.resolvePath(projectHandle, sourceHandle);
      let sourceParentHandle = projectHandle;

      if (pathParts && pathParts.length > 1) {
        const parentParts = pathParts.slice(0, -1);
        sourceParentHandle = await fileSystem.getDirectoryHandleFromPath(projectHandle, parentParts);
      }

      // 3. Execute Move
      await fileSystem.moveFileWithContext(sourceHandle, sourceParentHandle, targetHandle);

      // Refresh
      await refreshMaterials();

    } catch (e) {
      console.error("Move failed", e);
      showToast("移動に失敗しました: " + e.message);
    }
  };

  const handleDelete = async (handle, itemType, parentHandle) => {
    try {
      // Handle can be object (Browser) or string (Electron)
      const itemName = (typeof handle === 'string')
        ? handle.split(/[/\\\\]/).pop()
        : handle.name;

      // Check if root
      if (isElectron && handle === projectHandle) {
        showToast('プロジェクトルート自体は削除できません。Finder/Explorerから削除してください。');
        return;
      }

      const confirmed = await requestConfirm("確認", `「${itemName}」を削除しますか？\nこの操作は取り消せません。`);
      if (!confirmed) return;

      if (isElectron) {
        await fileSystem.deleteEntry(handle);
      } else {
        // Browser needs parent.
        if (parentHandle) {
          await fileSystem.deleteEntryWithParent(handle, parentHandle);
        } else {
          showToast("ブラウザ版では親フォルダのコンテキストが必要です。");
          return;
        }
      }

      await refreshMaterials();
    } catch (error) {
      console.error('Failed to delete:', error);
      showToast('削除に失敗しました。');
    }
  };

  const handleProjectReplace = async (changes) => {
    console.log("handleProjectReplace called with", changes);
    if (!changes || changes.length === 0) {
      showToast("変更対象がありません。");
      return;
    }

    // 1. Group changes by fileName
    const uniqueFiles = new Map(); // Map<FileName, { handle, changes[] }>

    for (const change of changes) {
      if (!uniqueFiles.has(change.fileName)) {
        uniqueFiles.set(change.fileName, { handle: change.fileHandle, changes: [] });
      }
      uniqueFiles.get(change.fileName).changes.push(change);
    }

    let successFileCount = 0;
    let failFileCount = 0;
    let skipLineCount = 0;
    const errors = [];
    const debugMismatches = [];
    let firstMismatchDiff = '';

    // 2. Process each file
    for (const [fileName, fileData] of uniqueFiles) {
      try {
        const { handle, changes: fileChanges } = fileData;

        // Read fresh content from disk to ensure safety
        const fileObj = await fileSystem.readFile(handle);
        // fileSystem.readFile returns string in Electron (fs.readFile with encoding) 
        // or File object in Browser (requires .text()).
        const content = (typeof fileObj === 'string') ? fileObj : await fileObj.text();
        const lines = content.split('\n');

        let modified = false;

        // Apply changes (Reverse order to avoid index shift issues? No, we replace line content, indices are stable provided strict match)
        // Check conflicts? If multiple replacements in same line? SearchPanel should handle?
        // SearchPanel gives us line indices.

        for (const change of fileChanges) {
          const currentLine = lines[change.lineIndex];
          const expectedLine = change.lineContent;

          // Safety Check: Ensure the line hasn't changed since the search
          // Relaxed Check: Trim '\r' to avoid CRLF mismatch if any
          const cleanCurrent = currentLine ? currentLine.replace(/\r$/, '') : '';
          const cleanExpected = expectedLine ? expectedLine.replace(/\r$/, '') : '';

          if (cleanCurrent !== cleanExpected) {
            // Check if already replaced (safe skip)
            const cleanNew = change.newContent ? change.newContent.replace(/\r$/, '') : '';
            if (cleanCurrent === cleanNew) {
              continue;
            }

            console.warn(`Mismatch in ${fileName} line ${change.lineIndex + 1} `);
            console.warn(`Exp: ${JSON.stringify(cleanExpected)} `);
            console.warn(`Got: ${JSON.stringify(cleanCurrent)} `);
            debugMismatches.push(`${fileName}:${change.lineIndex + 1} `);
            if (!firstMismatchDiff) {
              firstMismatchDiff = `\nFile: ${fileName}:${change.lineIndex + 1} \nExp: [${cleanExpected}]\nGot: [${cleanCurrent}]`;
            }
            skipLineCount++;
            continue;
          }

          if (lines[change.lineIndex] !== change.newContent) {
            lines[change.lineIndex] = change.newContent;
            modified = true;
          }
        }

        if (modified) {
          const newContent = lines.join('\n');
          await fileSystem.writeFile(handle, newContent);
          successFileCount++;

          // 3. Sync Active State
          if (activeFileHandle && activeFileHandle.name === fileName) {
            setText(newContent);
          }
        }

      } catch (err) {
        console.error(`Failed to replace in ${fileName}: `, err);
        failFileCount++;
        errors.push(`${fileName}: ${err.message} `);
      }
    }

    // Report result
    let msg = `置換完了: ${successFileCount} ファイルを更新しました。`;
    if (skipLineCount > 0) {
      msg += `\n⚠ 安全のため ${skipLineCount} 箇所の変更がスキップされました。`;
      msg += `\n(詳細: ${debugMismatches.join(', ')})`;
    }
    if (failFileCount > 0) msg += `\n❌ ${failFileCount} ファイルでエラーが発生しました。`;

    showToast(msg);
  };

  const handleRenameProject = async () => {
    if (!projectHandle) return;

    const currentName = typeof projectHandle === 'string'
      ? projectHandle.split(/[/\\]/).pop()
      : projectHandle.name;

    if (openInputModal) {
      openInputModal('プロジェクト名変更', 'プロジェクト名（フォルダ名）を変更しますか？', currentName, async (newName) => {
        if (!newName || newName === currentName) return;

        if (isElectron) {
          try {
            // Rename directory
            const newHandle = await fileSystem.rename(projectHandle, newName);
            if (newHandle) {
              setProjectHandle(newHandle);
              await saveProjectHandle(newHandle);
              // setProjectHandle triggers useMaterials useEffect, so no need to call refreshMaterials manually
              showToast('プロジェクト名を変更しました。');
            }
          } catch (e) {
            console.error(e);
            showToast('プロジェクト名の変更に失敗しました。');
          }
        } else {
          showToast('ブラウザ版ではプロジェクトフォルダのリネームはサポートされていません。', 'error');
        }
      });
      return;
    }



    const newName = window.prompt('プロジェクト名（フォルダ名）を変更しますか？', currentName);
    if (!newName || newName === currentName) return;

    if (isElectron) {
      try {
        // Rename directory
        const newHandle = await fileSystem.rename(projectHandle, newName);
        if (newHandle) {
          setProjectHandle(newHandle);
          await saveProjectHandle(newHandle);
          // setProjectHandle triggers useMaterials useEffect, so no need to call refreshMaterials manually
          showToast('プロジェクト名を変更しました。');
        }
      } catch (e) {
        console.error(e);
        showToast('名前の変更に失敗しました。');
      }
    } else {
      showToast('ブラウザ版ではプロジェクト（ルートフォルダ）の名前変更はサポートされていません。Finder/Explorerで直接変更して、再度開いてください。');
    }
  };

  const handleMoveProject = async () => {
    if (!isElectron) {
      showToast('プロジェクトの移動はデスクトップ版のみ対応しています。');
      return;
    }
    if (!projectHandle) return;

    const currentPath = typeof projectHandle === 'string' ? projectHandle : projectHandle.handle;
    const currentName = typeof projectHandle === 'string' ? projectHandle.split(/[/\\]/).pop() : projectHandle.name;

    // Select destination folder
    showToast('移動先のフォルダを選択してください。');
    const newParentPath = await fileSystem.openProjectDialog(); // Returns handle object or null
    if (!newParentPath) return;
    // openProjectDialog returns object { handle, name, ... }. We need the path string (handle.handle).
    const newParentDir = typeof newParentPath === 'string' ? newParentPath : newParentPath.handle;

    if (isElectron) {
      try {
        // Construct new full path
        const sep = currentPath.includes('\\') ? '\\' : '/';
        const newPath = newParentDir + sep + currentName;

        if (newPath === currentPath) {
          showToast('同じ場所には移動できません。');
          return;
        }

        const confirmMove = await requestConfirm("確認", `「${currentName}」\nを\n「${newPath}」\nへ移動しますか？`);
        if (!confirmMove) return;

        // Rename (Move)
        // fileSystem.rename expects handle (object or string) and NEW NAME (just name) or NEW FULL PATH?
        // Wait, fileSystem.rename implementation:
        // window.api.fs.rename(handle.handle || handle, newName);
        // And electron main.cjs:
        // ipcMain.handle('fs:rename', async (event, oldPath, newName) => {
        //    const directory = path.dirname(oldPath);
        //    const newPath = path.join(directory, newName);

        // It ONLY renames within the SAME directory! It DOES NOT support moving.

        showToast("現在、移動機能は実装中のため使用できません。（フォルダをFinder/Explorerで移動させてください）");
        return;

      } catch (e) {
        console.error(e);
        showToast('移動に失敗しました。');
      }
    }
  };



  const handleOutlineJump = (lineIndex) => {
    if (!editorRef.current) return;
    const lines = text.split('\n');
    let pos = 0;
    for (let i = 0; i < lineIndex && i < lines.length; i++) {
      pos += lines[i].length + 1;
    }
    editorRef.current.setCursorPosition(pos);
    // Also insure focus? setCursorPosition does focus.
  };

  // Card Creator Handler
  const handleCreateCard = async (filename, content) => {
    // Create file in root or specific folder?
    // For now, let's create in root, and let AutoOrganize move it.
    // AutoOrganize is triggered on SAVE, or we can reuse `handleCreateFileInProject` logic?
    // handleCreateFileInProject takes (folderHandle, name).
    // We want to write specific CONTENT (with metadata).
    // So:
    // 1. Create file.
    // 2. Write content.
    // 3. Auto Organize.

    if (!projectHandle) {
      showToast('プロジェクトが開かれていません');
      return;
    }

    try {
      const newHandle = await fileSystem.createFile(projectHandle, filename);
      await fileSystem.writeFile(newHandle, content);

      // Trigger Auto-Organize
      // Parse metadata again strictly? Or just pass what we know?
      // autoOrganizeFile takes (handle, metadata).
      // We can parse the content we just generated.
      const { parseNote } = await import('./utils/metadataParser');
      const { metadata } = parseNote(content);

      const organizedHandle = await autoOrganizeFile(newHandle, metadata);

      await refreshMaterials();
      setActiveFileHandle(organizedHandle);
      setText(content);
      showToast(`カード「${filename}」を作成しました`);

    } catch (e) {
      console.error("Card creation failed", e);
      showToast("作成に失敗しました: " + e.message);
    }
  };



  // Load persistent notes when tab is opened
  useEffect(() => {
    if (sidebarTab === 'notes' && projectHandle && allMaterialFiles) {
      const noteFile = allMaterialFiles.find(f => f.name === '_notes.txt');
      if (noteFile) {
        fileSystem.readFile(noteFile.handle).then(content => {
          setNotesText(content);
        }).catch(err => console.error("Failed to load notes:", err));
      } else {
        setNotesText(''); // Reset if no file
      }
    }
  }, [sidebarTab, projectHandle, allMaterialFiles]);

  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------
  return (
    <div className={`app-container ${isDarkMode ? 'dark-mode' : ''} ${isRapidMode ? 'rapid-mode' : ''}`} style={{
      backgroundColor: settings.theme === 'dark' ? 'var(--bg-dark)' : 'var(--bg-paper)',
      color: settings.theme === 'dark' ? 'var(--text-dark)' : 'var(--text-paper)',
      flexDirection: 'column' /* Stack title bar and workspace */
    }}>

      {/* Electron Title Bar (Hide in Window Mode) */}
      {isElectron && !isWindowMode && (
        <div className="electron-title-bar">
        </div>
      )}

      {/* Main Workspace (Sidebar + Content) */}
      <div className="app-workspace" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>

        {isSidebarVisible && (
          <aside className="sidebar" style={{ width: '400px' }}>
            <div className="sidebar-nav">
              <div
                className={`sidebar-nav-item ${sidebarTab === 'files' ? 'active' : ''} `}
                onClick={() => setSidebarTab('files')}
                title="ファイル"
              >
                📁
              </div>
              <div
                className={`sidebar-nav-item ${sidebarTab === 'navigate' ? 'active' : ''} `}
                onClick={() => setSidebarTab('navigate')}
                title="ナビゲート (タグ/リンク/検索)"
              >
                🔗
              </div>
              <div
                className={`sidebar-nav-item ${sidebarTab === 'progress' ? 'active' : ''} `}
                onClick={() => setSidebarTab('progress')}
                title="執筆捗・チェック"
              >
                📊
              </div>
              <div
                className={`sidebar-nav-item ${sidebarTab === 'todo' ? 'active' : ''}`}
                onClick={() => setSidebarTab('todo')}
                title="TODO管理"
                style={{ position: 'relative' }}
              >
                📋
                {(() => { const c = (text.match(/\[TODO:/g) || []).length; return c > 0 ? <span style={{ position: 'absolute', top: '2px', right: '2px', fontSize: '8px', background: '#e65100', color: '#fff', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{c}</span> : null; })()}
              </div>
              <div
                className={`sidebar-nav-item ${sidebarTab === 'ai' ? 'active' : ''}`}
                onClick={() => setSidebarTab(sidebarTab === 'ai' ? null : 'ai')}
                title="AIアシスタント"
              >
                🤖
              </div>
              <div
                className={`sidebar-nav-item ${sidebarTab === 'notes' ? 'active' : ''}`}
                onClick={() => setSidebarTab('notes')}
                title="メモ (Notes)"
              >
                📝
              </div>
              <div
                className={`sidebar-nav-item ${sidebarTab === 'prizes' ? 'active' : ''}`}
                onClick={() => setSidebarTab('prizes')}
                title="新人賞"
              >
                🏆
              </div>
              <div
                className={`sidebar-nav-item ${sidebarTab === 'snapshots' ? 'active' : ''}`}
                onClick={() => setSidebarTab('snapshots')}
                title="スナップショット履歴"
              >
                📸
              </div>
              <div
                className={`sidebar-nav-item ${sidebarTab === 'settings' ? 'active' : ''} `}
                onClick={() => setSidebarTab('settings')}
                title="設定"
              >
                ⚙️
              </div>


              <div style={{ flex: 1 }}></div>

              {/* --- View Section (Bottom) --- */}
              <div
                className={`sidebar-nav-item ${activeTab === 'materials' ? 'active' : ''} `}
                onClick={() => setActiveTab('materials')}
                title="資料一覧"
              >
                📚
              </div>

              <div
                className={`sidebar-nav-item ${activeTab === 'storyboard' ? 'active' : ''} `}
                onClick={() => setActiveTab('storyboard')}
                title="ストーリーボード"
              >
                🧩
              </div>
              {projectHandle && (
                <div
                  className="sidebar-nav-item"
                  onClick={async () => {
                    if (await requestConfirm("確認", 'プロジェクトを閉じますか？')) {
                      setProjectHandle(null);
                      setFileTree([]);
                      setActiveFileHandle(null);
                      setText('');
                      setIsProjectMode(false);
                    }
                  }}
                  title="プロジェクトを閉じる"
                  style={{ color: '#d32f2f' }}
                >
                  ✖️
                </div>
              )}
            </div>

            <div className="sidebar-body">
              {settings.showLogo !== false && (
                <div className="sidebar-header" style={{ marginBottom: '0.1rem', display: 'flex', justifyContent: 'center', padding: '10px 10px 5px', borderBottom: 'none' }}>
                  <img src="/nexus-logo-wide.png" alt="NEXUS" className="nexus-logo-wide" style={{ maxWidth: '90%', height: 'auto', display: 'block' }} />
                </div>
              )}

              {/* Sidebar Tab Content */}
              <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {sidebarTab === 'files' ? (
                  <>
                    {projectHandle && (
                      <div className="project-tree-container" style={{ display: 'flex', flexDirection: 'column' }}>
                        {projectContextMenu && ReactDOM.createPortal(
                          <>
                            <div
                              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998 }}
                              onClick={() => setProjectContextMenu(null)}
                            />
                            <div className="context-menu" style={{
                              position: 'fixed',
                              top: projectContextMenu.y,
                              left: projectContextMenu.x,
                              zIndex: 99999
                            }}>
                              <div className="context-menu-item" onClick={() => {
                                handleRenameProject();
                                setProjectContextMenu(null);
                              }}>
                                ✏️ 名前を変更
                              </div>
                              <div className="context-menu-item" onClick={() => {
                                handleMoveProject();
                                setProjectContextMenu(null);
                              }}>
                                🚚 移動
                              </div>
                              <div style={{ padding: '0', height: '1px', background: '#eee', margin: '4px 0' }}></div>
                              <div className="context-menu-item" onClick={async () => {
                                setProjectHandle(null);
                                setFileTree([]);
                                setActiveFileHandle(null);
                                setText('');
                                setIsProjectMode(false);
                                setProjectContextMenu(null);
                              }} style={{ color: '#d32f2f' }}>
                                ✖️ プロジェクトを閉じる
                              </div>
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    )}

                    {!projectHandle && (
                      <div className="project-welcome-section" style={{ padding: '10px' }}>
                        <button className="btn-open-project" onClick={handleCreateNewProject}>
                          ✨ 新規プロジェクト作成
                        </button>
                        {savedProjectHandle && (
                          <button
                            className="btn-open-project"
                            onClick={handleResumeProject}
                            style={{ background: '#2196f3' }}
                          >
                            📂 {savedProjectHandle.name} を再開
                          </button>
                        )}
                        <button
                          className="btn-open-project"
                          onClick={handleOpenProject}
                          style={{ background: '#6c757d' }}
                        >
                          📂 フォルダを開く
                        </button>
                      </div>
                    )}

                    {sidebarTab === 'files' && (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)' }}>
                          <button
                            onClick={() => setShowCardCreator(true)}
                            style={{
                              width: '100%',
                              padding: '6px',
                              background: 'var(--accent-color)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              fontWeight: 'bold',
                              fontSize: '13px'
                            }}
                          >
                            cards 🃏 新規カード作成
                          </button>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto' }}>
                          {projectHandle ? (
                            isMaterialsLoading ? (
                              <div style={{ padding: '1rem', color: '#666', fontSize: '0.85rem', textAlign: 'center' }}>
                                読み込み中...
                              </div>
                            ) : fileTree.length > 0 ? (
                              <FileTree
                                tree={fileTree}
                                activeFile={activeFileHandle ? (activeFileHandle.handle || activeFileHandle) : null}
                                onFileSelect={handleFileSelect}
                                onCreateFile={handleCreateFileInProject}
                                onCreateFolder={handleCreateFolderInProject}
                                onRequestCreateFile={(parent) => {
                                  setPendingCreateParent(parent);
                                  setInputModalMode('create_file');
                                  setInputModalValue('');
                                  setShowInputModal(true);
                                }}
                                onRequestCreateFolder={(parent) => {
                                  setPendingCreateParent(parent);
                                  setInputModalMode('create_folder');
                                  setInputModalValue('');
                                  setShowInputModal(true);
                                }}
                                onOpenReference={handleOpenReference}
                                onOpenInNewWindow={handleOpenInNewWindow}
                                onRename={handleRename}
                                onDelete={handleDelete}
                                onDuplicate={handleDuplicateFile}
                                onMove={handleMoveItem}
                              />
                            ) : (
                              <div style={{ padding: '1rem', color: '#999', fontSize: '0.85rem', textAlign: 'center' }}>
                                ファイルが見つかりません
                              </div>
                            )
                          ) : (
                            <div style={{ padding: '1rem', color: '#999', fontSize: '0.85rem', textAlign: 'center' }}>
                              プロジェクトフォルダを開いてください
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Footer Area with File Actions - Refined Grid with Labels */}
                    <div className="sidebar-footer">
                      <div className="file-actions-grid">
                        <button className="action-btn-compact" onClick={handleSaveFile} title="上書き保存">
                          <span className="icon">💾</span>
                          <span className="label">保存</span>
                        </button>
                        <button className="action-btn-compact" onClick={() => handleDuplicateFile()} title="別名で保存">
                          <span className="icon">📑</span>
                          <span className="label">別名</span>
                        </button>
                        <button className="action-btn-compact" onClick={() => fileInputRef.current?.click()} title="読込">
                          <span className="icon">📂</span>
                          <span className="label">読込</span>
                        </button>
                        <button className="action-btn-compact" onClick={() => {
                          navigator.clipboard.writeText(text).then(() => showToast('コピーしました')).catch(e => console.error(e));
                        }} title="本文をコピー">
                          <span className="icon">📋</span>
                          <span className="label">コピー</span>
                        </button>

                        <button className="action-btn-compact" onClick={handlePrint} title="印刷">
                          <span className="icon">🖨️</span>
                          <span className="label">印刷</span>
                        </button>
                        <button
                          className="action-btn-compact"
                          onClick={() => {
                            openInputModal('新規ファイル', 'ファイル名...', '', async (fileName) => {
                              if (fileName) {
                                const fullName = fileName.trim().endsWith('.txt') ? fileName.trim() : `${fileName.trim()}.txt`;
                                try {
                                  const newFile = await handleCreateFileInProject(null, fullName);
                                  if (newFile) await handleFileSelect(newFile);
                                } catch (err) { showToast("作成失敗: " + err.message); }
                              }
                            });
                          }}
                          title="新規ファイル"
                        >
                          <span className="icon">📄</span>
                          <span className="label">新規</span>
                        </button>
                        <button
                          className="action-btn-compact"
                          onClick={() => {
                            openInputModal('新規フォルダ', 'フォルダ名...', '', async (folderName) => {
                              if (folderName) {
                                handleCreateFolderInProject(null, folderName.trim()).catch(err => showToast("作成失敗: " + err.message));
                              }
                            });
                          }}
                          title="新規フォルダ"
                        >
                          <span className="icon">📁</span>
                          <span className="label">フォルダ</span>
                        </button>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".txt,text/plain"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLoadFile(file);
                            e.target.value = '';
                          }}
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>
                  </>
                ) : sidebarTab === 'navigate' ? (
                  <NavigatePanel
                    renderTagPanel={() => (
                      activeFileHandle ? (() => {
                        const { metadata: currentMetadata } = parseNote(text);
                        const allWorks = new Set();
                        try {
                          const savedWorks = localStorage.getItem('savedWorks');
                          if (savedWorks) {
                            try {
                              JSON.parse(savedWorks).forEach(work => allWorks.add(work));
                            } catch (e) { console.error('Failed to parse savedWorks', e); }
                          }
                        } catch (err) { console.error('Error in work list generation', err); }
                        allMaterialFiles?.forEach(file => {
                          if (file.metadata?.作品) {
                            file.metadata.作品.split(',').forEach(work => {
                              const trimmed = work.trim();
                              if (trimmed) allWorks.add(trimmed);
                            });
                          }
                        });
                        try {
                          localStorage.setItem('savedWorks', JSON.stringify(Array.from(allWorks)));
                        } catch (err) { console.error('Error in work list generation', err); }
                        return (
                          <TagPanel
                            currentFile={activeFileHandle}
                            metadata={currentMetadata}
                            onMetadataUpdate={handleMetadataUpdate}
                            allWorks={Array.from(allWorks)}
                            openInputModal={openInputModal}
                          />
                        );
                      })() : (
                        <div style={{ padding: '1rem', color: '#999', fontSize: '0.85rem', textAlign: 'center' }}>
                          ファイルを開いてください
                        </div>
                      )
                    )}
                    renderLinkPanel={() => (
                      <LinkPanel
                        activeFile={activeFileHandle}
                        allFiles={allMaterialFiles}
                        linkGraph={linkGraph}
                        currentText={text}
                        onOpenLink={handleOpenLink}
                        onInsertLink={handleInsertLink}
                      />
                    )}
                    renderSearchPanel={() => (
                      <SearchPanel
                        allFiles={allMaterialFiles}
                        currentText={text}
                        currentFileName={activeFileHandle ? (activeFileHandle.name || (typeof activeFileHandle === 'string' ? activeFileHandle.split(/[/\\]/).pop() : '無題')) : '無題'}
                        strictManuscriptMode={settings.strictManuscriptMode}
                        onOpenFile={handleOpenFile}
                        onProjectReplace={handleProjectReplace}
                        onSwitchToReplace={(query) => {
                          setIsSearchOpen(true);
                          setSearchReplaceInitialTerm(query || '');
                          setSearchReplaceInitialGrepMode(true);
                        }}
                      />
                    )}
                    renderOutlinePanel={() => (
                      <OutlinePanel
                        text={text}
                        onJump={handleOutlineJump}
                        onClose={() => { }}
                        embedded={true}
                      />
                    )}
                  />
                ) : sidebarTab === 'progress' ? (
                  <ProgressPanel
                    renderProgressTracker={() => (
                      <ProgressTracker
                        allMaterialFiles={allMaterialFiles}
                        projectSettings={projectSettings}
                        onUpdateProjectSettings={saveProjectSettings}
                        currentWork={(() => {
                          try {
                            return parseNote(text).metadata?.作品;
                          } catch { return null; }
                        })()}
                        sessionCharDiff={currentSessionChars}
                        onResetSession={handleResetSession}
                      />
                    )}
                    renderChecklistPanel={() => (
                      <ChecklistPanel
                        allFiles={allMaterialFiles}
                        currentWork={(() => {
                          try {
                            return parseNote(text).metadata?.作品;
                          } catch { return null; }
                        })()}
                        activeFileContent={text}
                        onUpdateFile={async (handle, content) => {
                          await fileSystem.writeFile(handle, content);
                          await refreshMaterials();
                        }}
                        onCreateFile={(fileName, content) => {
                          if (projectHandle) {
                            return handleCreateFileInProject(projectHandle, fileName, content);
                          }
                        }}
                        onNavigate={handleNavigate}
                        onInsert={(text) => {
                          if (editorRef.current) {
                            editorRef.current.insertText(text);
                            setActiveTab('editor');
                          }
                        }}
                      />
                    )}
                    renderClipboardHistory={() => (
                      <ClipboardPanel
                        history={editorRef.current?.clipboardHistory || []}
                        onPaste={(text) => {
                          editorRef.current?.pasteFromHistory(text);
                        }}
                      />
                    )}
                  />
                ) : sidebarTab === 'todo' ? (
                  <TodoPanel
                    text={text}
                    activeFileName={activeFileHandle ? (typeof activeFileHandle === 'string' ? activeFileHandle.split(/[/\\]/).pop() : activeFileHandle.name) : null}
                    onJumpToIndex={(index) => {
                      if (editorRef.current?.jumpToIndex) {
                        editorRef.current.jumpToIndex(index);
                      }
                    }}
                    onInsertTodo={() => {
                      setInputModalMode('insert_todo');
                      setInputModalValue('');
                      setShowInputModal(true);
                    }}
                  />
                ) : sidebarTab === 'ai' ? (
                  <AIPanel
                    text={text}
                    onInsert={handleAIInsert}
                    isOpen={true}
                    onClose={() => setSidebarTab(null)}
                    allFiles={allMaterialFiles}
                    addCandidate={addCandidate}
                    activeFile={activeFileHandle}
                    initialAction={aiAction}
                    initialOptions={aiOptions}
                    corrections={corrections}
                    setCorrections={setCorrections}
                    onApplyCorrection={handleApplyCorrection}
                    onDiscardCorrection={handleDiscardCorrection}
                    onApplyAllCorrections={handleApplyAllCorrections}
                    projectId={typeof projectHandle === 'string' ? projectHandle : projectHandle?.name}
                    aiModel={aiModel}
                    setAiModel={setAiModel}
                    localModels={localModels}
                    selectedLocalModel={selectedLocalModel}
                    setSelectedLocalModel={setSelectedLocalModel}
                    isLocalConnected={isLocalConnected}
                    checkLocalConnection={checkLocalConnection}
                    renderCandidateBoxPanel={() => (
                      <CandidateBoxPanel
                        candidates={candidates}
                        onAdopt={adoptCandidate}
                        onDiscard={discardCandidate}
                        onDiscardAll={discardAllCandidates}
                        onCreateCard={handleCreateCardFromSelection}
                      />
                    )}
                    renderSnippetsPanel={() => (
                      <SnippetsPanel
                        snippets={snippets}
                        onAdd={handleAddSnippet}
                        onDelete={handleDeleteSnippet}
                        onCopy={handleCopySnippet}
                        onDragStart={handleSnippetDragStart}
                      />
                    )}
                  />
                ) : sidebarTab === 'notes' ? (
                  <NotesPanel
                    key={notesText ? 'loaded' : 'empty'}
                    initialText={notesText}
                    onSave={async (content) => {
                      if (projectHandle && allMaterialFiles) {
                        const noteFile = allMaterialFiles.find(f => f.name === '_notes.txt');
                        if (noteFile) {
                          await fileSystem.writeFile(noteFile.handle, content);
                        } else {
                          await handleCreateFileInProject(projectHandle, '_notes.txt', content);
                        }
                        if (!noteFile) await refreshMaterials();
                      }
                    }}
                    projectHandle={projectHandle}
                  />
                ) : sidebarTab === 'prizes' ? (
                  <PrizePanel
                    projectSettings={projectSettings}
                    onApplyPrize={(prizeData) => {
                      setProjectSettings(prev => ({
                        ...prev,
                        targetPages: prizeData.targetPages,
                        deadline: prizeData.deadline,
                        prizeName: prizeData.prizeName,
                        prizeId: prizeData.prizeId
                      }));
                      // 賞の原稿形式に合わせてエディタ設定を自動変更
                      if (prizeData.editorFormat && (prizeData.editorFormat.charsPerLine > 0 || prizeData.editorFormat.linesPerPage > 0)) {
                        setSettings(prev => ({
                          ...prev,
                          charsPerLine: prizeData.editorFormat.charsPerLine || prev.charsPerLine,
                          linesPerPage: prizeData.editorFormat.linesPerPage || prev.linesPerPage,
                          paperStyle: 'manuscript',  // 原稿用紙モードに切替
                        }));
                      }
                    }}
                  />
                ) : sidebarTab === 'snapshots' ? (
                  <SnapshotPanel
                    filePath={activeFileHandle ? (typeof activeFileHandle === 'string' ? activeFileHandle : (activeFileHandle.handle || activeFileHandle.name || null)) : null}
                    currentText={text}
                    onRestore={(content) => setText(content)}
                    showToast={showToast}
                    onSaveNow={async () => {
                      const fp = activeFileHandle ? (typeof activeFileHandle === 'string' ? activeFileHandle : (activeFileHandle.handle || activeFileHandle.name || '')) : '';
                      if (fp && text) await saveSnapshot(fp, text, text.length);
                    }}
                  />
                ) : sidebarTab === 'settings' ? (
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <Toolbar
                      settings={settings}
                      setSettings={setSettings}
                      presets={presets}
                      onFormat={handleFormat}
                      onEpubExport={() => handleEpubExport(null, allMaterialFiles)}
                      onSavePreset={handleSavePreset}
                      onLoadPreset={handleLoadPreset}
                      onDeletePreset={handleDeletePreset}
                      isDarkMode={isDarkMode}
                      setIsDarkMode={setIsDarkMode}
                      showMetadata={showMetadata}
                      setShowMetadata={setShowMetadata}
                      showOutline={sidebarTab === 'navigate'}
                      onToggleOutline={() => setSidebarTab(sidebarTab === 'navigate' ? null : 'navigate')}
                      aiModel={aiModel}
                      setAiModel={setAiModel}
                      localModels={localModels}
                      selectedLocalModel={selectedLocalModel}
                      setSelectedLocalModel={setSelectedLocalModel}
                      isLocalConnected={isLocalConnected}
                      checkLocalConnection={checkLocalConnection}
                      onBatchExport={handleBatchExport}
                      onPrint={handlePrint}
                    />
                  </div>
                ) : null}
              </div> {/* sidebar-content */}
            </div> {/* sidebar-body */}
          </aside>
        )}

        <div className="content-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <main className={`main-content ${showReference && activeTab !== 'reference' ? 'split-view' : ''}`} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div className="editor-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

              {/* StoryBoard: Always mounted, usually hidden */}
              <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden', display: activeTab === 'storyboard' ? 'block' : 'none' }}>
                <StoryBoard
                  projectHandle={projectHandle}
                  allFiles={allMaterialFiles}
                  onOpenFile={handleOpenFile}
                  pendingImport={pendingImport}
                  onImportComplete={() => setPendingImport(null)}
                  onCreateCard={openCardCreator}
                />
              </div>

              {/* Editor: Always mounted, usually hidden */}
              <div style={{ flex: 1, display: activeTab === 'editor' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
                <Editor
                  ref={editorRef}
                  value={showMetadata ? text : parseNote(text).body}
                  onChange={handleTextChange}
                  settings={effectiveSettings}
                  onSave={handleSaveFile}
                  isVertical={settings.isVertical}
                  onOpenLink={handleOpenLink}
                  availableTags={availableTags}
                  fontSize={effectiveSettings.fontSize}
                  fontFamily={effectiveSettings.fontFamily}
                  onContextMenu={handleContextMenu}
                  allFiles={allMaterialFiles}
                  onLaunchAI={handleLaunchAI}
                  corrections={corrections}
                  ghostText={ghostText}
                  setGhostText={setGhostText}
                  onCursorStats={handleCursorStats}
                  onShorten={handleShorten}
                  onDescribe={handleDescribe}
                  onCardCreate={handleCreateCardFromSelection}
                  onInsertRuby={() => editorRef.current?.insertRuby()}
                  onInsertLink={() => {
                    const textarea = editorRef.current?.textareaRef?.current;
                    if (!textarea) return;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const selectedText = text.substring(start, end);
                    const insertion = selectedText ? `[[${selectedText}]]` : '[[]]';
                    const newText = text.substring(0, start) + insertion + text.substring(end);
                    handleTextChange(newText);
                    setTimeout(() => {
                      textarea.focus();
                      const newCursorPos = selectedText ? start + insertion.length : start + 2;
                      textarea.setSelectionRange(newCursorPos, newCursorPos);
                    }, 0);
                  }}
                />

              </div>


              {activeTab === 'materials' ? (
                <MaterialsPanel
                  projectHandle={projectHandle}
                  onOpenFile={handleOpenFile}
                  onOpenInNewWindow={handleOpenInNewWindow}
                  currentFile={activeFileHandle}
                  currentFileContent={text}
                  onRefresh={refreshMaterials}
                  materialsTree={materialsTree}
                  allMaterialFiles={allMaterialFiles}
                  availableTags={availableTags}
                  isLoading={isMaterialsLoading}
                  usageStats={usageStats}
                  onCreateFileWithTag={handleCreateFileWithTag}
                  onBatchCopy={handleBatchCopy}
                />
              ) : activeTab === 'preview' ? (
                <Preview
                  text={text}
                  settings={effectiveSettings}
                  mode={effectiveSettings.mode}
                  onOpenLink={handleOpenLink}
                />
              ) : activeTab === 'reference' ? (
                /* Full-screen Reference Panel */
                <ReferencePanel
                  content={referenceContent}
                  fileName={referenceFileName}
                  onClose={() => {
                    setReferenceContent('');
                    setReferenceFileName('');
                    setActiveTab('editor');
                  }}
                  isFullPage={true}
                />
              ) : null}
            </div>



            {showReference && activeTab !== 'reference' && (
              <div className="reference-panel-wrapper" style={{ width: referenceWidth }}>
                <div
                  className={`resize - handle ${isResizing ? 'resizing' : ''} `}
                  onMouseDown={startResizing}
                />
                <ReferencePanel
                  content={referenceContent}
                  fileName={referenceFileName}
                  onClose={handleCloseReference}
                />
              </div>
            )}
          </main>

          {/* Status Bar / Footer */}
          <footer className="footer">
            <div className="footer-content">
              <div className="status-left">
                <button
                  onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                  title={isSidebarVisible ? "サイドバーを隠す" : "サイドバーを表示"}
                  className="footer-btn"
                  style={{ marginRight: '8px' }}
                >
                  {isSidebarVisible ? '◀' : '▶'}
                </button>
                <span style={{ marginRight: '8px', fontWeight: 'bold' }}>
                  {activeFileHandle ? (typeof activeFileHandle === 'string' ? activeFileHandle.split(/[/\\]/).pop() : activeFileHandle.name) : '無題'}
                </span>
                {isElectron && activeFileHandle && (
                  <button
                    onClick={() => fileSystem.showInExplorer(activeFileHandle)}
                    className="footer-btn"
                    title="Finder / エクスプローラーで表示"
                    style={{ marginRight: '4px', fontSize: '12px' }}
                  >
                    📂
                  </button>
                )}
                {isRapidMode && (
                  <span style={{ marginRight: '8px', padding: '1px 8px', background: '#2e7d32', color: '#fff', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>🚀 爆速</span>
                )}
                <span style={{ opacity: 0.6 }}>{text.length} 文字</span>
                <span style={{ margin: '0 8px', opacity: 0.2 }}>|</span>
                <span style={{ opacity: 0.6 }}>原稿用紙 {Math.ceil(text.length / 400)} 枚</span>
                <span style={{ margin: '0 8px', opacity: 0.2 }}>|</span>
                <span style={{ opacity: 0.6 }}>
                  {text !== lastSavedTextRef.current && lastSaved ? (
                    <span style={{ color: '#e67e22' }}>● 未保存</span>
                  ) : (
                    <>保存: {lastSaved ? lastSaved.toLocaleTimeString() : '---'}</>
                  )}
                </span>
                <span style={{ margin: '0 8px', opacity: 0.2 }}>|</span>
                <span style={{ opacity: 0.6 }}>本日: {currentSessionChars >= 0 ? `+ ${currentSessionChars} ` : currentSessionChars} 文字</span>
                {(() => { const todoCount = (text.match(/\[TODO:/g) || []).length; return todoCount > 0 ? (<><span style={{ margin: '0 8px', opacity: 0.2 }}>|</span><span style={{ opacity: 0.8, color: '#e65100' }}>📋 TODO: {todoCount}件</span></>) : null; })()}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="tool-group">
                  <button
                    className="footer-btn"
                    onClick={() => setSettings(s => ({ ...s, fontSize: Math.max(8, s.fontSize - 1) }))}
                    title="文字縮小"
                    style={{ fontSize: '10px', padding: '2px 4px' }}
                  >A-</button>
                  <span style={{ fontSize: '10px', opacity: 0.6, minWidth: '28px', textAlign: 'center' }}>{effectiveSettings.fontSize}</span>
                  <button
                    className="footer-btn"
                    onClick={() => setSettings(s => ({ ...s, fontSize: Math.min(72, s.fontSize + 1) }))}
                    title="文字拡大"
                    style={{ fontSize: '10px', padding: '2px 4px', marginRight: '4px' }}
                  >A+</button>
                  <button
                    className="footer-btn"
                    onClick={() => setIsRapidMode(prev => !prev)}
                    title={isRapidMode ? "爆速モード OFF (⌘⇧R)" : "爆速モード ON (⌘⇧R)"}
                    style={{
                      marginRight: '4px',
                      fontWeight: isRapidMode ? 'bold' : 'normal',
                      background: isRapidMode ? 'rgba(46, 125, 50, 0.3)' : 'none',
                      borderRadius: '4px'
                    }}
                  >
                    🚀
                  </button>
                  <select
                    value={settings.paperStyle || 'plain'}
                    onChange={(e) => setSettings(s => ({ ...s, paperStyle: e.target.value }))}
                    style={{
                      fontSize: '11px',
                      padding: '2px 4px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      background: 'var(--bg-paper)',
                      color: 'var(--text-main)',
                      marginRight: '4px'
                    }}
                  >
                    <option value="plain">無地</option>
                    <option value="grid">原稿用紙</option>
                    <option value="lined">ノート</option>
                    <option value="clean">クリーン</option>
                  </select>
                  {settings.paperStyle === 'clean' && (
                    <select
                      value={settings.cleanFontFamily || 'var(--font-mincho)'}
                      onChange={(e) => setSettings(s => ({ ...s, cleanFontFamily: e.target.value }))}
                      style={{
                        fontSize: '11px',
                        padding: '2px 4px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        background: 'var(--bg-paper)',
                        color: 'var(--text-main)',
                        marginRight: '4px',
                        maxWidth: '90px'
                      }}
                    >
                      <option value="var(--font-mincho)">明朝</option>
                      <option value="var(--font-gothic)">ゴシック</option>
                      <option value="'Hiragino Mincho ProN', 'Hiragino Mincho Pro', 'ヒラギノ明朝 ProN', 'ヒラギノ明朝 Pro', serif">ヒラギノ明朝</option>
                      <option value="'Hiragino Sans', '游ゴシック', sans-serif">ヒラギノ角ゴ</option>
                      <option value="'FOT-筑紫Aオールド明朝 Pr6N', 'FOT-筑紫Aオールド明朝 Pr6', 'Tsukushi A Old Mincho', '筑紫Aオールド明朝', '筑紫Aオールド明朝 Pr6N', serif">筑紫Aオールド明朝</option>
                      <option value="'FOT-筑紫Bオールド明朝 Pr6N', 'FOT-筑紫Bオールド明朝 Pr6', 'Tsukushi B Old Mincho', '筑紫Bオールド明朝', '筑紫Bオールド明朝 Pr6N', serif">筑紫Bオールド明朝</option>
                      <option value="'FOT-筑紫Cオールド明朝 Pr6N', 'FOT-筑紫Cオールド明朝 Pr6', 'Tsukushi C Old Mincho', '筑紫Cオールド明朝', '筑紫Cオールド明朝 Pr6N', serif">筑紫Cオールド明朝</option>
                      <option value="'Meiryo', sans-serif">メイリオ</option>
                      <option value="var(--font-hand)">紅道</option>
                      <option value="'Klee One', cursive">クレー</option>
                      <option value="'A-OTF 黎ミン Pr6N', 'A-OTF 黎ミン Pro', '黎ミン', serif">モリサワ 黎ミン</option>
                      <option value="'A P-OTF 秀英にじみ明朝 StdN', 'A P-OTF 秀英にじみ明朝 Std', '秀英にじみ明朝', serif">秀英にじみ明朝</option>
                      <option value="'02うつくし明朝体', 'うつくし明朝体', serif">うつくし明朝体</option>
                      <option value="'A-OTF 毎日新聞明朝 Pro', '毎日新聞明朝', serif">毎日新聞明朝</option>
                      <option value="'A-OTF A1明朝 Std', 'A1明朝', serif">A1明朝</option>
                      <option value="'BIZ UDMincho', serif">BIZ UD明朝</option>
                      <option value="'Kiwi Maru', serif">キウイ丸</option>
                      <option value="'Zen Old Mincho', serif">Zenオールド明朝</option>
                      <option value="'Hina Mincho', serif">ひな明朝</option>
                      <option value="'Kaisei Opti', serif">解星オプティ</option>
                      <option value="'Kaisei Tokumin', serif">解星特ミン</option>
                      <option value="'YuMincho', 'Yu Mincho', serif">游明朝</option>
                      <option value="'Yuji Syuku', serif">Yuji Syuku</option>
                      <option value="'Noto Serif JP', serif">Noto Serif</option>
                      <option value="'Noto Sans JP', sans-serif">Noto Sans</option>
                    </select>
                  )}

                  <button
                    className="footer-btn"
                    onClick={() => setSettings(prev => ({ ...prev, isVertical: !prev.isVertical }))}
                    title={settings.isVertical ? "横書きに切り替え" : "縦書きに切り替え"}
                  >
                    {settings.isVertical ? "縦" : "横"}
                  </button>

                  <button
                    className={`footer-btn ${activeTab === 'preview' ? 'active' : ''}`}
                    onClick={() => setActiveTab(activeTab === 'preview' ? 'editor' : 'preview')}
                    title="エディタ/プレビュー切替"
                    style={{ fontWeight: activeTab === 'preview' ? 'bold' : 'normal' }}
                  >
                    {activeTab === 'preview' ? 'エディタ' : 'プレビュー'}
                  </button>

                  <button
                    className="footer-btn"
                    onClick={() => handlePopOutTab(activeTab)}
                    title="新しいウィンドウで開く"
                    style={{ marginLeft: '4px' }}
                  >
                    ❐
                  </button>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div > {/* Close app-workspace */}

      {/* Clipboard History Popup */}










      <InputModal
        isOpen={showInputModal}
        title={
          inputModalMode === 'insert_todo' ? 'TODO挿入' :
            inputModalMode === 'create_file' ? '新規ファイル作成' :
              inputModalMode === 'create_folder' ? '新規フォルダ作成' :
                inputModalMode === 'save_preset' ? 'プリセット保存' :
                  inputModalMode === 'ai_create_file' ? 'AI生成テキストの保存' :
                    inputModalMode === 'create_file_with_tag' ? `新規ファイル作成(${pendingTag})` :
                      '名前の変更'
        }
        message={
          inputModalMode === 'insert_todo' ? '「カテゴリ | 内容」の形式で入力（例: 背景 | 部屋の詳細描写）' :
            inputModalMode === 'create_file' ? 'ファイル名を入力してください（拡張子は自動で付与されます）' :
              inputModalMode === 'create_folder' ? 'フォルダ名を入力してください' :
                inputModalMode === 'save_preset' ? 'プリセット名を入力してください' :
                  inputModalMode === 'ai_create_file' ? '保存するファイル名を入力してください' :
                    inputModalMode === 'create_file_with_tag' ? 'ファイル名を入力してください（自動的に分類されます）' :
                      '新しい名前を入力してください'
        }
        initialValue={inputModalValue}
        placeholder={inputModalMode === 'insert_todo' ? '背景 | 部屋の詳細描写' : inputModalMode === 'rename' ? '' : '名前を入力...'}
        onConfirm={handleInputModalSubmit}
        onCancel={() => setShowInputModal(false)}
      />

      {/* Card Creator Modal */}
      {showCardCreator && (
        <React.Suspense fallback={null}>
          <CardCreator
            isOpen={showCardCreator}
            onClose={() => setShowCardCreator(false)}
            onSave={handleCreateCard}
            initialType={cardCreatorInitialType}
            initialDescription={cardCreatorInitialData.description}
          />
        </React.Suspense>
      )}

      {/* Generic InputModal for openInputModal() calls (TagPanel, etc.) */}
      <InputModal
        isOpen={inputModal.isOpen}
        title={inputModal.title}
        message={inputModal.message}
        initialValue={inputModal.value}
        placeholder=""
        onConfirm={inputModal.onConfirm}
        onCancel={closeInputModal}
      />

      {
        showSemanticGraph && (
          <SemanticGraph
            allFiles={allMaterialFiles}
            linkGraph={linkGraph}
            activeFile={activeFileHandle}
            onUpdateFile={handleUpdateFile}
            onClose={() => setShowSemanticGraph(false)}
          />
        )
      }

      {
        showMatrixOutliner && (
          <MatrixOutliner
            allFiles={allMaterialFiles}
            onClose={() => setShowMatrixOutliner(false)}
            onOpenFile={handleOpenFile}
          />
        )
      }
      {/* Search Replace Panel */}
      <SearchReplace
        text={text}
        onReplace={(newText) => setText(newText)}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        editorRef={editorRef}
        allFiles={allMaterialFiles}
        onOpenFile={handleOpenFile}
        onProjectReplace={handleProjectReplace}
        initialTerm={searchReplaceInitialTerm}
        initialIsGrepMode={searchReplaceInitialGrepMode}
        showToast={showToast}
        requestConfirm={requestConfirm}
      />

      {/* Custom UI Overlays for non-blocking notifications and modern dialogs */}
      <NotificationToast toasts={toasts} onRemove={removeToast} />
      <CustomConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={confirmConfig.onCancel}
        isDanger={confirmConfig.isDanger}
      />

    </div >
  );
}

export default App;
