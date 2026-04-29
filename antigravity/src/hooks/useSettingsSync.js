import { useEffect } from 'react';

export function useSettingsSync({
  presets,
  isDarkMode,
  settings,
  isElectron,
}) {
  // presets → localStorage
  useEffect(() => {
    localStorage.setItem('novel-editor-presets', JSON.stringify(presets));
  }, [presets]);

  // darkMode → localStorage + DOM
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
  }, [settings.uiScale, isElectron]);

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
}
