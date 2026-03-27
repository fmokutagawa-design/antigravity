import { useState, useEffect, useCallback } from 'react';

export function useReferencePanel() {
  const [showReference, setShowReference] = useState(false);
  const [referenceContent, setReferenceContent] = useState('');
  const [referenceFileName, setReferenceFileName] = useState('');
  const [referenceWidth, setReferenceWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((mouseMoveEvent) => {
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

  return {
    showReference,
    setShowReference,
    referenceContent,
    setReferenceContent,
    referenceFileName,
    setReferenceFileName,
    referenceWidth,
    startResizing,
  };
}
