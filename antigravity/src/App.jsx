import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { perfNow, perfMeasure } from './utils/perfProbe';
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
import ExportPanel from './components/ExportPanel';
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
import ReaderView from './components/ReaderView';
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
import AIKnowledgeManager from './components/AIKnowledgeManager';
import { saveSnapshot } from './utils/snapshotStore';
import './components/LinkPanel.css';
import KnowledgeSuggestionBanner from './components/KnowledgeSuggestionBanner';
import AuditReportWindow from './components/AuditReportWindow';
import { ollamaService } from './utils/ollamaService';

import { saveTextFile, loadTextFile } from './utils/fileUtils';
import { fileSystem, isElectron, isNative, isTauri } from './utils/fileSystem';
import ManuscriptPanel from './components/ManuscriptPanel';
import { generateEpub, downloadBlob } from './utils/epubExporter'; // EPUB Exporter
import { generateDocx, downloadBlob as downloadDocxBlob } from './utils/docxExporter'; // DOCX Exporter
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
import { useSnippets } from './hooks/useSnippets';
import { useCandidates } from './hooks/useCandidates';
import { useToastConfirm } from './hooks/useToastConfirm';
import { useGhostText } from './hooks/useGhostText';
import { useAIConnection } from './hooks/useAIConnection';
import { useSessionStats } from './hooks/useSessionStats';
import { useReferencePanel } from './hooks/useReferencePanel';
import { parseNote, serializeNote } from './utils/metadataParser';
import { applyFormat } from './utils/formatText';
import './index.css';
import { useFileOperations } from './hooks/useFileOperations';
import { useAutoSave } from './hooks/useAutoSave';
import { useProjectActions } from './hooks/useProjectActions';
import { useSplitByChapters } from './hooks/useSplitByChapters';
import { useWorkText } from './hooks/useWorkText';
import { useExport } from './hooks/useExport';
import { useCorrections } from './hooks/useCorrections';
import { usePersistentData } from './hooks/usePersistentData';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePresets } from './hooks/usePresets';
import { useSettingsSync } from './hooks/useSettingsSync';
import { useStatePersistence } from './hooks/useStatePersistence';
import { SidebarFilesTab } from './components/SidebarFilesTab';
import SplitByChaptersModal from './components/SplitByChaptersModal';
import ImportChaptersModal from './components/ImportChaptersModal';

function App() {
  const [text, setText] = useState('');
  const [debouncedText, setDebouncedText] = useState('');
  const textRef = useRef(''); // ★ 最新テキストへの即時アクセス用
  const debouncedTextRef = useRef(''); // ★ 最新のデバウンス済みテキスト
  const latestMetadataRef = useRef({ tags: [] }); // ★ 最新のメタデータ
  const activeFileHandleRef = useRef(null); // ★ 最新のハンドル (Bug B, F 対策)

  // Refs を常に同期 (activeFileHandle は宣言後に同期)
  useEffect(() => { textRef.current = text; }, [text]);
  useEffect(() => { debouncedTextRef.current = debouncedText; }, [debouncedText]);

  useEffect(() => {
    const scheduledAt = perfNow();
    const timer = setTimeout(() => {
      const t0 = perfNow();
      setDebouncedText(text);
      perfMeasure('App.setDebouncedText.timeoutFired', t0, {
        textLength: text.length,
        scheduledDelayMs: perfNow() - scheduledAt,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [text]);
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
    enableJournaling: true, // ジャーナリング (操作ログ) のオン・オフ
    enablePerfLogging: false, // 開発・分析用ログ (PERF) のオン・オフ
    customCSS: '', // User custom CSS
  });

  const [aiAction, setAiAction] = useState(null);

  const [presets, setPresets] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isRapidMode, setIsRapidMode] = useState(false);
  const [pendingImport, setPendingImport] = useState(null); // Data from Checklist to Board
  const [pendingFileSelect, setPendingFileSelect] = useState(null);

  // Perf Toggle Sync
  useEffect(() => {
    window.ENABLE_PERF_LOGGING = settings.enablePerfLogging === true;
  }, [settings.enablePerfLogging]);


  const [showInputModal, setShowInputModal] = useState(false);
  const [inputModalMode, setInputModalMode] = useState('rename'); // 'rename' | 'create_file' | 'create_folder'
  const [inputModalValue, setInputModalValue] = useState('');
  const [pendingRenameTarget, setPendingRenameTarget] = useState(null);
  const [pendingCreateParent, setPendingCreateParent] = useState(null); // NEW
  const [pendingAIContent, setPendingAIContent] = useState(null); // Content to save from AI
  const [pendingTag, setPendingTag] = useState(null); // Tag for create_file_with_tag
  const [aiOptions, setAiOptions] = useState({}); // New: options for AI (selectedText, etc)
  const [corrections, setCorrections] = useState([]); // AI proofreading markers

  // Project management state
  const [showMetadata, setShowMetadata] = useState(false); // Default to hiding metadata
  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // Focus Mode Toggle
  const [isWindowMode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') === 'window';
  }); // Window Mode State

  const [isKnowledgeMode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') === 'knowledge';
  });

  const [sidebarTab, setSidebarTab] = useState('settings'); // 'files', 'tags', 'links', or 'settings'
  const [projectHandle, setProjectHandle] = useState(null);
  const [savedProjectHandle, setSavedProjectHandle] = useState(null); // For resuming session
  const [fileTree, setFileTree] = useState([]);
  const [activeFileHandle, setActiveFileHandle] = useState(null);
  const [isProjectMode, setIsProjectMode] = useState(false);

  // Bug 1 修正: 宣言後に Ref を同期させる
  useEffect(() => { activeFileHandleRef.current = activeFileHandle; }, [activeFileHandle]);
  const [showReader, setShowReader] = useState(false);
  const [projectSettings, setProjectSettings] = useState({
    targetPages: 300,     // 目標枚数 (400字詰め)
    chapters: 0,         // 章数 (0 = 自動)
    deadline: null,      // 締切日
    rapidModeDefault: false,
    todoCategories: ['背景', '人物', '心理', '描写', '設定', '伏線', '調査', 'その他'],
  });

  const [showSemanticGraph, setShowSemanticGraph] = useState(false);
  const [showMatrixOutliner, setShowMatrixOutliner] = useState(false);

  // Memoize editor value to avoid re-parsing on every render and stabilize reference for React.memo
  // ★ parseNote は debouncedText ベース → 毎キー入力での14万字パースを回避
  //    Editor 側は localText で即時描画するため、ここが debounce でも体感遅延はない
  const parsedNote = useMemo(() => {
    try { return parseNote(debouncedText); } catch { return { body: debouncedText, metadata: {} }; }
  }, [debouncedText]);

  const editorValue = useMemo(() => {
    return showMetadata ? debouncedText : parsedNote.body;
  }, [parsedNote, showMetadata, debouncedText]);

  // AI Connection (hook)
  const { aiModel, setAiModel, localModels, selectedLocalModel, setSelectedLocalModel, isLocalConnected, checkLocalConnection } = useAIConnection();

  // Ghost Text (hook)
  const { ghostText, setGhostText, handleCursorStats } = useGhostText(text, debouncedText, settings.enableGhostText, selectedLocalModel);


  // Custom UI Management
  const { toasts, showToast, removeToast, confirmConfig, requestConfirm } = useToastConfirm();
  const [notesText, setNotesText] = useState('');



  const handleImageDrop = useCallback(async (imageFile) => {
    if (!isProjectMode || !projectHandle) {
      showToast('画像の挿入はプロジェクトモードでのみ使用できます。');
      return null;
    }
    
    try {
      let imagesDir;
      const isElectron = !!window.api;
      
      if (isElectron && typeof projectHandle === 'string') {
        // Electron: パスベース
        try {
            await window.api.fs.createFolder(projectHandle, 'images');
        } catch (e) {
            // ignore if exists
        }
        imagesDir = projectHandle + '/images';
        
        const fileName = imageFile.name;
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer); // buffer compatibility

        const filePath = imagesDir + '/' + fileName;
        await window.api.fs.writeFileBinary(filePath, buffer);
        showToast(`画像 "${fileName}" を保存しました。`);
        return fileName;

      } else {
        // Browser: File System Access API
        imagesDir = await projectHandle.getDirectoryHandle('images', { create: true });
        
        const fileName = imageFile.name;
        const fileHandle = await imagesDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(imageFile);
        await writable.close();
        
        showToast(`画像 "${fileName}" を保存しました。`);
        return fileName;
      }
    } catch (err) {
      console.error('Image drop failed:', err);
      showToast('画像の保存に失敗しました: ' + err.message);
      return null;
    }
  }, [isProjectMode, projectHandle, showToast]);

  // Handlers

  // Reference Panel (hook)
  const { showReference, setShowReference, referenceContent, setReferenceContent, referenceFileName, setReferenceFileName, referenceWidth, startResizing, isResizing } = useReferencePanel();
  const [usageStats, setUsageStats] = useState({}); // Track file access frequency

  const [activeTab, setActiveTab] = useState('editor'); // 'editor' or 'preview'
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showOutline, setShowOutline] = useState(false); // Outline Panel State

  const [lastSaved, setLastSaved] = useState(null);
  const lastSavedTextRef = useRef('');

  const editorRef = React.useRef(null);
  const fileInputRef = useRef(null);
  const [projectContextMenu, setProjectContextMenu] = useState(null); // { x, y }
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const {
    materialsTree,
    allMaterialFiles,
    tags: availableTags,
    linkGraph,
    refreshMaterials,
    isLoading: isMaterialsLoading
  } = useMaterials(projectHandle);

  // Update fileTree when materialsTree changes
  useEffect(() => {
    setFileTree(materialsTree);
    if (projectHandle) {
      setIsProjectMode(true);
    }
  }, [materialsTree, projectHandle]);

  // Session Stats (hook)
  const { currentSessionChars, handleResetSession } = useSessionStats(allMaterialFiles, activeFileHandle, editorValue);



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



  const [showCardCreator, setShowCardCreator] = useState(false);

  const [cardCreatorInitialType, setCardCreatorInitialType] = useState('登場人物');



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


  // Candidate Box (hook)
  const { candidates, addCandidate, adoptCandidate, discardCandidate, discardAllCandidates } = useCandidates(projectHandle, showToast);

  // Snippets (hook)
  const { snippets, handleAddSnippet, handleDeleteSnippet, handleCopySnippet, handleSnippetDragStart } = useSnippets(projectHandle, showToast);



  // SearchReplace State
  const [searchReplaceInitialTerm, setSearchReplaceInitialTerm] = useState('');
  const [searchReplaceInitialGrepMode, setSearchReplaceInitialGrepMode] = useState(false);

  // --- Knowledge Window Mode ---
  if (isKnowledgeMode) {
    return (
      <div className={`app-container ${isDarkMode ? 'dark-mode' : 'light'}`} style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <AIKnowledgeManager />
        <NotificationToast toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  // Load settings and presets from local storage on mount
  // 校正監査からのジャンプリクエストを購読するリスナー
  // AuditReportWindow が発行する 'nexus-jump-to-text' イベントを受け取り、
  // 対象ファイルを開いて該当行へスクロールする
  useEffect(() => {
    const handleJumpEvent = async (e) => {
        const { file, line, path } = e.detail;
        console.log(`[JumpRequest] File: ${file}, Line: ${line}, Path: ${path}`);

        const targetFile = allMaterialFiles.find(f =>
            (path && f.path === path) || f.name === file || f.name === `${file}.txt`
        );

        if (targetFile) {
            await handleOpenFile(targetFile.handle, targetFile.name, { path: targetFile.path });

            const tryJumpToLine = (attempts = 0) => {
                if (editorRef.current?.jumpToLine) {
                    editorRef.current.jumpToLine(line);
                } else if (attempts < 20) {
                    setTimeout(() => tryJumpToLine(attempts + 1), 100);
                }
            };
            setTimeout(() => tryJumpToLine(0), 300);
        } else {
            showToast(`ジャンプ先のファイル "${file}" が見会えませんでした。`, 'error');
        }
    };

    window.addEventListener('nexus-jump-to-text', handleJumpEvent);
    return () => window.removeEventListener('nexus-jump-to-text', handleJumpEvent);
  }, [allMaterialFiles, handleOpenFile, showToast]);


  // (colorTheme/paperStyle sync は下方の統合版に集約)

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
    // Native: pass project path so new window can auto-load
    if (isNative && projectHandle) {
      url.searchParams.set('project', typeof projectHandle === 'string' ? projectHandle : '');
    }
    window.open(url.toString(), '_blank', 'width=1000,height=800,menubar=no,toolbar=no');
  };








  // --- Extracted Hooks ---
  useSettingsSync({ presets, isDarkMode, settings, isElectron });
  useStatePersistence({ debouncedText, activeFileHandle, isProjectMode, isWindowMode, settings, projectHandle, setProjectHandle, setLastSaved });

  const { handleFormat, handleEpubExport, handleDocxExport, handlePrint } = useExport(
    text, setText, activeFileHandle, projectHandle, settings, allMaterialFiles, showToast, activeTab, setActiveTab
  );

  const { handleAIInsert, handleApplyCorrection, handleDiscardCorrection, handleApplyAllCorrections } = useCorrections(
    text, setText, corrections, setCorrections, editorRef, showToast, isProjectMode, setPendingAIContent, setInputModalMode, setInputModalValue, setShowInputModal
  );

  usePersistentData({
    isWindowMode,
    isElectron,
    isNative,
    isTauri,
    setText,
    setSettings,
    setIsDarkMode,
    setProjectHandle,
    setFileTree,
    setIsProjectMode,
    handleOpenFile,
    setShowSemanticGraph,
    setShowMatrixOutliner,
    setPresets,
    setSavedProjectHandle,
    setIsSidebarVisible,
    setActiveTab,
    setActiveFileHandle,
    setPendingFileSelect,
    fileSystem
  });

  useKeyboardShortcuts({
    setIsSearchOpen,
    handleSaveFileRef,
    setIsRapidMode,
    setShowReader,
    setInputModalMode,
    setInputModalValue,
    setShowInputModal
  });

  const { handleSavePreset, handleInputModalSubmit, handleLoadPreset, handleDeletePreset } = usePresets({
    setInputModalMode, setInputModalValue, setShowInputModal, settings, setPresets, inputModalMode, pendingRenameTarget, fileSystem, activeFileHandle, setActiveFileHandle, refreshMaterials, pendingCreateParent, handleCreateFileInProject, handleCreateFolderInProject, pendingTag, projectHandle, latestMetadataRef, setFileTree, handleFileSelect, showToast, pendingAIContent, setText, editorRef, setPendingRenameTarget, setPendingCreateParent, setPendingAIContent, setPendingTag, presets, setSettings, requestConfirm
  });

  const handleLaunchOneDrive = React.useCallback(async () => {
    if (!window.api?.system?.launchApp) {
      showToast('デスクトップ版でのみ利用可能です。', 'error');
      return;
    }
    const path = '/Applications/OneDrive.app';
    const success = await window.api.system.launchApp(path);
    if (success) {
      showToast('OneDriveを起動しています...');
    } else {
      showToast('OneDriveの起動に失敗しました。手動で起動してください。', 'error');
    }
  }, [showToast]);

  const {
    saveProjectSettings,
    autoOrganizeFile,
    handleOpenProject,
    handleFileSelect,
    handleCreateNewProject,
    handleCreateFileInProject,
    handleCreateFolderInProject,
    handleOpenReference,
    handleOpenInNewWindow,
    handleCloseReference,
    handleNavigate,
    handleOutlineJump,
    handleRename,
    handleMoveItem,
    handleDelete,
    handleProjectReplace,
    handleRenameProject,
    handleMoveProject,
    handleResumeProject,
    handleCreateCard,
    handleOpenLink,
    handleCreateFileWithTag,
    handleMetadataUpdate,
    handleRefreshTree,
  } = useProjectActions({
    text,
    setText,
    textRef, // 追加
    latestMetadataRef, // 追加
    projectHandle,
    setProjectHandle,
    fileTree,
    setFileTree,
    activeFileHandle,
    setActiveFileHandle,
    isProjectMode,
    setIsProjectMode,
    projectSettings,
    setProjectSettings,
    debouncedText,
    setDebouncedText,
    savedProjectHandle,
    setSavedProjectHandle,
    allMaterialFiles,
    refreshMaterials,
    showToast,
    requestConfirm,
    openInputModal,
    handleOpenFile,
    handlePopOutTab,
    editorRef,
    setActiveTab,
    setShowReference,
    setReferenceContent,
    setReferenceFileName,
  });

  const {
    handleSaveFile,
    handleSaveFileRef,
    handleUpdateFile,
    handleLoadFile,
    handleDuplicateFile,
    handleBatchCopy,
    handleBatchExport,
    handleOpenFile,
    handleOpenSegmentFile,
  } = useFileOperations({
    text,
    setText,
    activeFileHandle,
    setActiveFileHandle,
    projectHandle,
    allMaterialFiles,
    refreshMaterials,
    setLastSaved,
    lastSavedTextRef,
    showToast,
    setFileTree,
    setActiveTab,
    autoOrganizeFile,
    handleCreateFileInProject,
    openInputModal,
    settings,
    editorRef,
    handleLaunchOneDrive,
    requestConfirm,
    latestMetadataRef,
    setDebouncedText,
    setCursorPosition: undefined,
    setIsProjectMode,
    saveProjectHandle,
    setProjectHandle,
    setUsageStats,
  });

  const splitChapters = useSplitByChapters({
    activeFileHandle,
    text,
    projectHandle,
    refreshMaterials,
    showToast,
  });

  const workTextData = useWorkText({
    activeFileHandle,
    projectHandle,
    currentText: debouncedText,
  });

  useAutoSave({
    text,
    debouncedText,
    isProjectMode,
    activeFileHandle,
    projectHandle,
    setLastSaved,
    lastSavedTextRef,
    showToast,
    setProjectSettings,
    setIsRapidMode,
    activeFileHandleRef, // 追加
    debouncedTextRef, // 追加
    settings, // 追加
  });


  const handleTextChange = useCallback((newContent) => {
    if (showMetadata) {
      setText(newContent);
    } else {
      // latestMetadataRef.current は handleOpenFile 等で常に最新に同期されていることを前提とする。
      const content = serializeNote(newContent, latestMetadataRef.current);
      setText(content);
    }
  }, [showMetadata]);

  const handleConfirmKnowledge = useCallback(async (metadata) => {
    if (!activeFileHandle) return;
    
    // 現在のテキストの冒頭に YAML Frontmatter を注入
    const yaml = `-- -\ntags: ${JSON.stringify(metadata.tags)}\ndoc_type: ${metadata.doc_type}\nproject: ${metadata.project}\nimportance: ${metadata.importance}\nentities: ${metadata.entities.join(',')}\n-- -\n`;
    
    let newText = text;
    if (text.startsWith('-- -')) {
        // 既存のFrontmatterを置換
        newText = text.replace(/^-- -[\s\S]*?-- -\n?/, yaml);
    } else {
        newText = yaml + text;
    }
    
    setText(newText);
    showToast(`${metadata.project} の知識として登録しました（アンドゥ可能です）`);
    
    // DB にも即時通知
    try {
        await ollamaService.updateDBItemTags(activeFileHandle.path || activeFileHandle.handle, metadata.tags);
    } catch (e) {
        console.error("Failed to sync tags to DB:", e);
    }
  }, [activeFileHandle, text, showToast]);





  // Batch Copy for AI



  // Save settings and state to persistent storage (Electron)
  useEffect(() => {
    if (!isElectron || !window.api) return;
    if (isWindowMode) return; // 子ウィンドウの設定は共有設定に書かない

    const saveTimeout = setTimeout(async () => {
      const persistentData = {
        settings,
        activeFile: activeFileHandle,
        projectPath: projectHandle,
        isDarkMode,
        // Optional: cursor position could be added here if editorRef supports getting it
      };
      await window.api.invoke('app:saveSettings', persistentData);
    }, 5500); // Debounce save slightly

    return () => clearTimeout(saveTimeout);
  }, [settings, activeFileHandle, projectHandle, isDarkMode]);

  // ★ フッター統計をメモ化（10万字のTODO正規表現を毎レンダリングで走らせない）
  const footerStats = useMemo(() => {
    const len = debouncedText.length;
    const pages = Math.ceil(len / 400);
    const todoMatches = debouncedText.match(/\[TODO:/g);
    const todoCount = todoMatches ? todoMatches.length : 0;
    
    // 全原稿ファイルの合計文字数（サイドバー等で使用。重いのでここに統合）
    let totalManuscript = 0;
    if (allMaterialFiles) {
      totalManuscript = allMaterialFiles
        .filter(f => f.path && f.path.startsWith('manuscript/'))
        .reduce((sum, f) => sum + (f.content?.length || 0), 0);
    }
    
    return { len, pages, todoCount, totalManuscript };
  }, [debouncedText, allMaterialFiles]);

  // Keyboard shortcuts (Cmd/Ctrl + F: search, Cmd+Shift+R: rapid mode, Cmd+S: save, Cmd+T: TODO)

  // ウィンドウを閉じる前に未保存チェック
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Bug B 対策: 引数の text ではなく Ref の最新値を使う
      const currentText = textRef.current;
      if (isProjectMode && currentText !== lastSavedTextRef.current) {
        if (activeFileHandleRef.current) {
          try {
            fileSystem.writeFile(activeFileHandleRef.current, currentText);
          } catch { /* best effort */ }
        }
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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



  // 一括結合エクスポート




  // Duplicate (Save As) handler

  // Project management handlers



  // Auto-snapshot: 5分間隔 or 500文字以上の変更で自動スナップショット











  // Handle pending navigation


  // File/Folder Handlers









  // Card Creator Handler



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

        {useMemo(() => {
          if (!isSidebarVisible) return null;
          return (
            <aside className="sidebar" style={{ width: '400px' }}>
              <div className="sidebar-nav">
                <div
                  className={`sidebar-nav-item ${sidebarTab === 'manuscript' ? 'active' : ''} `}
                  onClick={() => setSidebarTab('manuscript')}
                  title="原稿管理"
                >
                  📖
                </div>

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
                  className={`sidebar-nav-item ${sidebarTab === 'ai' ? 'active' : ''}`}
                  onClick={() => setSidebarTab(sidebarTab === 'ai' ? null : 'ai')}
                  title="AIアシスタント"
                >
                  🤖
                </div>

                <div
                  className={`sidebar-nav-item ${sidebarTab === 'prizes' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('prizes')}
                  title="新人賞"
                >
                  🏆
                </div>
                <div
                  className={`sidebar-nav-item ${sidebarTab === 'clipboard' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('clipboard')}
                  title="クリップボード"
                >
                  📋
                </div>
                <div
                  className={`sidebar-nav-item ${sidebarTab === 'export' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('export')}
                  title="出力・整形"
                >
                  📤
                </div>
                <div
                  className={`sidebar-nav-item ${sidebarTab === 'audit' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('audit')}
                  title="校正監査"
                >
                  🔍
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
                    <img src="./nexus-logo-wide.png" alt="NEXUS" className="nexus-logo-wide" style={{ maxWidth: '90%', height: 'auto', display: 'block' }} />
                  </div>
                )}

                {/* Sidebar Tab Content */}
                <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  {sidebarTab === 'files' ? (
                    <SidebarFilesTab
                      projectHandle={projectHandle}
                      projectContextMenu={projectContextMenu}
                      setProjectContextMenu={setProjectContextMenu}
                      handleRenameProject={handleRenameProject}
                      handleMoveProject={handleMoveProject}
                      setProjectHandle={setProjectHandle}
                      setFileTree={setFileTree}
                      setActiveFileHandle={setActiveFileHandle}
                      setText={setText}
                      setIsProjectMode={setIsProjectMode}
                      handleCreateNewProject={handleCreateNewProject}
                      savedProjectHandle={savedProjectHandle}
                      handleResumeProject={handleResumeProject}
                      handleOpenProject={handleOpenProject}
                      setShowCardCreator={setShowCardCreator}
                      handleRefreshTree={handleRefreshTree}
                      isMaterialsLoading={isMaterialsLoading}
                      fileTree={fileTree}
                      activeFileHandle={activeFileHandle}
                      handleFileSelect={handleFileSelect}
                      handleCreateFileInProject={handleCreateFileInProject}
                      handleCreateFolderInProject={handleCreateFolderInProject}
                      setPendingCreateParent={setPendingCreateParent}
                      setInputModalMode={setInputModalMode}
                      setInputModalValue={setInputModalValue}
                      setShowInputModal={setShowInputModal}
                      handleOpenReference={handleOpenReference}
                      handleOpenInNewWindow={handleOpenInNewWindow}
                      handleRename={handleRename}
                      handleDelete={handleDelete}
                      handleDuplicateFile={handleDuplicateFile}
                      handleMoveItem={handleMoveItem}
                      handleSaveFile={handleSaveFile}
                      fileInputRef={fileInputRef}
                      debouncedText={debouncedText}
                      showToast={showToast}
                      handlePrint={handlePrint}
                      openInputModal={openInputModal}
                      handleLoadFile={handleLoadFile}
                    />
                  ) : sidebarTab === 'navigate' ? (
                    <NavigatePanel
                      renderTagPanel={() => (
                        activeFileHandle ? (() => {
                          const currentMetadata = parsedNote.metadata || {};
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
                          currentText={debouncedText}
                          onOpenLink={handleOpenLink}
                          onInsertLink={handleInsertLink}
                        />
                      )}
                      renderSearchPanel={() => (
                        <SearchPanel
                          allFiles={allMaterialFiles}
                          currentText={debouncedText}
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
                          text={debouncedText}
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
                          currentWork={parsedNote.metadata?.作品 || null}
                          sessionCharDiff={currentSessionChars}
                          onResetSession={handleResetSession}
                        />
                      )}
                      renderChecklistPanel={() => (
                        <ChecklistPanel
                          allFiles={allMaterialFiles}
                          currentWork={parsedNote.metadata?.作品 || null}
                          activeFileContent={debouncedText}
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
                          onInsert={(insText) => {
                            if (editorRef.current) {
                              editorRef.current.insertText(insText);
                              setActiveTab('editor');
                            }
                          }}
                        />
                      )}
                      renderTodoPanel={() => (
                        <TodoPanel
                          text={debouncedText}
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
                      )}
                    />

                  ) : sidebarTab === 'clipboard' ? (
                    <ClipboardPanel
                      history={editorRef.current?.clipboardHistory || []}
                      onPaste={(pasteText) => {
                        editorRef.current?.pasteFromHistory(pasteText);
                      }}
                    />

                  ) : sidebarTab === 'export' ? (
                    <ExportPanel
                      onFormat={handleFormat}
                      onPrint={handlePrint}
                      onEpubExport={() => handleEpubExport(null, allMaterialFiles)}
                      onDocxExport={handleDocxExport}
                      onBatchExport={handleBatchExport}
                      onSplitByChapters={splitChapters.openModal}
                      colorTheme={settings.colorTheme}
                    />

                  ) : sidebarTab === 'ai' ? (
                    <AIPanel
                      text={debouncedText}
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
                          onCreateCard={() => openCardCreator()}
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
                      renderNotesPanel={() => (
                        <NotesPanel
                          key={notesText}
                          initialText={notesText}
                          onSave={async (newText) => {
                            setNotesText(newText);
                            if (projectHandle) {
                              try {
                                let notesFileHandle;
                                try {
                                  notesFileHandle = await projectHandle.getFileHandle('_notes.txt');
                                } catch {
                                  notesFileHandle = await projectHandle.getFileHandle('_notes.txt', { create: true });
                                }
                                const writable = await notesFileHandle.createWritable();
                                await writable.write(newText);
                                await writable.close();
                                refreshMaterials();
                              } catch (err) {
                                console.error('Failed to save notes:', err);
                              }
                            }
                          }}
                          projectHandle={projectHandle}
                        />
                      )}
                    />

                  ) : sidebarTab === 'manuscript' ? (
                    <>
                    <ManuscriptPanel
                      allFiles={allMaterialFiles}
                      activeFile={activeFileHandle}
                      onChapterSelect={async (handle) => {
                        // オートセーブを待ってから切り替え
                        if (activeFileHandle) await handleSaveFile();
                        handleFileSelect(handle);
                      }}
                      onSplitDocument={() => {
                        if (activeFileHandle && text) {
                          splitChapters.openModal();
                        } else {
                          showToast('分割するファイルが開かれていません');
                        }
                      }}
                      onImportChapters={() => setIsImportModalOpen(true)}
                    />

                  </>

                  ) : sidebarTab === 'prizes' ? (
                    <PrizePanel
                      projectSettings={projectSettings}
                      editorText={debouncedText}
                      onApplyPrize={(prizeData) => {
                        setProjectSettings(prev => ({
                          ...prev,
                          targetPages: prizeData.targetPages,
                          deadline: prizeData.deadline,
                          prizeName: prizeData.prizeName,
                          prizeId: prizeData.prizeId,
                          prizeCharsPerLine: prizeData.editorFormat?.charsPerLine || 0,
                          prizeLinesPerPage: prizeData.editorFormat?.linesPerPage || 0,
                          pageCountBasis: prizeData.pageCountBasis || '400-page',
                          targetChars: prizeData.targetChars || 0
                        }));
                        // エディタ設定は変更しない（印刷準備時に別途変更）
                      }}
                      onApplyFormat={(formatData) => {
                        setSettings(prev => ({
                          ...prev,
                          charsPerLine: formatData.charsPerLine || prev.charsPerLine,
                          linesPerPage: formatData.linesPerPage || prev.linesPerPage,
                        }));
                      }}
                      showToast={showToast}
                    />
                  ) : sidebarTab === 'snapshots' ? (
                    <SnapshotPanel
                      filePath={activeFileHandle ? (typeof activeFileHandle === 'string' ? activeFileHandle : (activeFileHandle.handle || activeFileHandle.name || null)) : null}
                      currentText={debouncedText}
                      onRestore={(content) => setText(content)}
                      showToast={showToast}
                      onSaveNow={async () => {
                        const fp = activeFileHandle ? (typeof activeFileHandle === 'string' ? activeFileHandle : (activeFileHandle.handle || activeFileHandle.name || '')) : '';
                        if (fp && debouncedText) await saveSnapshot(fp, debouncedText, debouncedText.length);
                      }}
                    />
                  ) : sidebarTab === 'settings' ? (
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      <Toolbar
                        settings={settings}
                        setSettings={setSettings}
                        presets={presets}
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
                      />
                      {/* クラウド同期サポートセクション */}
                      <div style={{ padding: '15px', borderTop: '1px solid #eee' }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#666', fontWeight: 'bold' }}>クラウド同期サポート</h4>
                        <button
                          onClick={handleLaunchOneDrive}
                          style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: '#0078d4',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005a9e'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0078d4'}
                        >
                          ☁️ OneDrive を起動
                        </button>
                        <p style={{ margin: '10px 0 0', fontSize: '0.7rem', color: '#888', lineHeight: '1.5' }}>
                          ファイルが開けない、同期待ちが発生している場合にクリックしてください。
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div> {/* sidebar-content */}
              </div> {/* sidebar-body */}
            </aside>
          );
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isSidebarVisible, sidebarTab, activeTab, projectHandle, fileTree, activeFileHandle, isProjectMode, settings, projectContextMenu, savedProjectHandle, showCardCreator, isMaterialsLoading, allMaterialFiles, linkGraph, projectSettings, currentSessionChars, aiAction, aiOptions, corrections, aiModel, localModels, selectedLocalModel, isLocalConnected, candidates, snippets, notesText, presets, isDarkMode, showMetadata, debouncedText])}

        <div className="content-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <main className={`main-content ${showReference && activeTab !== 'reference' ? 'split-view' : ''}`} style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: 'column' }}>
            <KnowledgeSuggestionBanner 
              activeFile={activeFileHandle}
              currentText={debouncedText}
              onConfirm={handleConfirmKnowledge}
            />
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
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
              <div style={{ flex: 1, display: activeTab === 'editor' ? 'flex' : 'none', flexDirection: 'column', minHeight: 0 }}>
                <Editor
                  ref={editorRef}
                  fileId={activeFileHandle?.path || activeFileHandle?.name || String(activeFileHandle || 'default')}
                  value={editorValue}
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
                  onImageDrop={handleImageDrop}

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
                  currentFileContent={debouncedText}
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
                  projectHandle={projectHandle}
                  workText={workTextData.workText}
                  isNexusFile={workTextData.isNexusFile}
                  workTitle={workTextData.workTitle}
                  resolveOffset={workTextData.resolveOffset}
                  onOpenSegmentFile={handleOpenSegmentFile}
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
                {isNative && activeFileHandle && (
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
                <span style={{ opacity: 0.6 }}>
                  {footerStats.len} 文字
                  {footerStats.totalManuscript > 0 && (
                    <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}> (全体: {footerStats.totalManuscript.toLocaleString()}字)</span>
                  )}
                </span>
                <span style={{ margin: '0 8px', opacity: 0.2 }}>|</span>
                <span style={{ opacity: 0.6 }}>原稿用紙 {footerStats.pages} 枚</span>
                <span style={{ margin: '0 8px', opacity: 0.2 }}>|</span>
                <span style={{ opacity: 0.6 }}>
                  {debouncedText !== lastSavedTextRef.current && lastSaved ? (
                    <span style={{ color: '#e67e22' }}>● 未保存</span>
                  ) : (
                    <>保存: {lastSaved ? lastSaved.toLocaleTimeString() : '---'}</>
                  )}
                </span>
                <span style={{ margin: '0 8px', opacity: 0.2 }}>|</span>
                <span style={{ opacity: 0.6 }}>本日: {currentSessionChars >= 0 ? `+ ${currentSessionChars} ` : currentSessionChars} 文字</span>
                {projectSettings?.prizeName && (
                  <>
                    <span style={{ margin: '0 8px', opacity: 0.2 }}>|</span>
                    <span style={{ opacity: 0.8, color: '#8e44ad' }}>
                      🏆 {projectSettings.prizeName}: {(() => {
                        const basis = projectSettings.pageCountBasis || '400-page';
                        if (basis === 'char-count') {
                          const target = projectSettings.targetChars || 0;
                          return `${footerStats.len.toLocaleString()}字${target ? ` / ${target.toLocaleString()}字` : ''}`;
                        } else if (basis === 'format-page') {
                          const cpl = projectSettings.prizeCharsPerLine || 20;
                          const lpp = projectSettings.prizeLinesPerPage || 20;
                          return `${Math.ceil(footerStats.len / (cpl * lpp))}枚 / ${projectSettings.targetPages}枚`;
                        } else {
                          return `${Math.ceil(footerStats.len / 400)}枚 / ${projectSettings.targetPages}枚`;
                        }
                      })()}
                    </span>
                  </>
                )}
                {footerStats.todoCount > 0 && (<><span style={{ margin: '0 8px', opacity: 0.2 }}>|</span><span style={{ opacity: 0.8, color: '#e65100' }}>📋 TODO: {footerStats.todoCount}件</span></>)}
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
                    onClick={() => setShowReader(true)}
                    title="リーダーモードで表示 (Alt+R)"
                    style={{ marginLeft: '4px', background: 'rgba(142,68,173,0.15)', borderColor: '#8e44ad' }}
                  >
                    📖 リーダー
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
            initialDescription=""
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

      {showReader && (
        <ReaderView
          text={editorValue}
          settings={settings}
          onClose={() => setShowReader(false)}
          cursorOffset={editorRef.current?.textareaRef?.current?.selectionStart ?? 0}
          onJumpToEditor={(offset) => {
            setShowReader(false);
            const tryJump = (attempts = 0) => {
              if (editorRef.current?.jumpToIndex) {
                editorRef.current.jumpToIndex(offset);
              } else if (attempts < 5) {
                setTimeout(() => tryJump(attempts + 1), 100);
              }
            };
            setTimeout(() => tryJump(0), 50);
          }}
          workText={workTextData.workText}
          isNexusFile={workTextData.isNexusFile}
          workTitle={workTextData.workTitle}
          resolveOffset={workTextData.resolveOffset}
          onOpenSegmentFile={handleOpenSegmentFile}
        />
      )}

      <SplitByChaptersModal
        isOpen={splitChapters.isOpen}
        plan={splitChapters.plan}
        sourceText={text}
        isExecuting={splitChapters.isExecuting}
        onClose={splitChapters.closeModal}
        onRemoveSegment={splitChapters.handleRemoveSegment}
        onRenameSegment={splitChapters.handleRenameSegment}
        onExecute={splitChapters.executeSplit}
        useNexusFolder={splitChapters.useNexusFolder}
        onToggleNexusFolder={splitChapters.setUseNexusFolder}
      />

      <ImportChaptersModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectHandle={projectHandle}
        allFiles={allMaterialFiles}
        refreshMaterials={refreshMaterials}
        showToast={showToast}
      />

      <AuditReportWindow 
        isOpen={sidebarTab === 'audit'} 
        onClose={() => setSidebarTab('none')} 
        currentText={text}
        activeFile={activeFileHandle}
      />
    </div >
  );
}

export default App;
