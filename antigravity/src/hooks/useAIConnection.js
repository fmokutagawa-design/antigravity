import { useState, useEffect, useCallback } from 'react';
import { ollamaService } from '../utils/ollamaService';

export function useAIConnection({
  showToast,
  setAiAction,
  setAiOptions,
  setSidebarTab,
  setActiveTab,
} = {}) {
  const [aiModel, setAiModel] = useState('local');
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
  }, []);

  const handleLaunchAI = useCallback((mode, options = {}) => {
    const modeNames = {
      rewrite: 'リライト', proofread: '校正', shorten: '短縮',
      describe: '描写追加', analysis: '分析', summarize: '要約',
      relextract: '関係抽出', continue: '続き生成'
    };
    if (showToast) showToast(`🤖 ${modeNames[mode] || mode} を実行中...`);
    if (setAiAction) setAiAction(mode);
    if (setAiOptions) setAiOptions(options);
    if (setSidebarTab) setSidebarTab('ai');
  }, [showToast, setAiAction, setAiOptions, setSidebarTab]);

  return {
    aiModel,
    setAiModel,
    localModels,
    selectedLocalModel,
    setSelectedLocalModel,
    isLocalConnected,
    checkLocalConnection,
    handleLaunchAI,
  };
}
