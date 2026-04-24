import { useState, useEffect, useCallback } from 'react';
import { ollamaService } from '../utils/ollamaService';

export function useAIConnection() {
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

  return {
    aiModel,
    setAiModel,
    localModels,
    selectedLocalModel,
    setSelectedLocalModel,
    isLocalConnected,
    checkLocalConnection,
  };
}
