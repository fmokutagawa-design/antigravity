import React, { useRef, useEffect, useMemo } from 'react';
import { parseRuby } from '../utils/textUtils';
import './ReaderView.css';

const ReaderView = ({ text, settings, onClose }) => {
    const containerRef = useRef(null);

    // 記法の除去（リンク、フォントタグ、注記、強調など）
    const processLine = (line) => {
        if (!line) return '';
        let processed = line;
        
        // [[リンク]] → リンクテキストだけ表示
        processed = processed.replace(/\[\[(.*?)\]\]/g, '$1');
        
        // {font:...}...{/font} → 中身だけ
        processed = processed.replace(/\{font[:：].*?\}/g, '');
        processed = processed.replace(/\{\/font\}/g, '');
        
        // ［＃...］ 青空文庫注記は非表示
        processed = processed.replace(/［＃.*?］/g, '');
        
        // **強調** → 中身だけ
        processed = processed.replace(/\*\*(.*?)\*\*/g, '$1');
        
        return processed;
    };

    // テキストを段落単位で分割
    const paragraphs = useMemo(() => {
        if (!text) return [];
        return text.split('\n').map((line, i) => ({
            key: i,
            content: processLine(line) || '\u00A0' // 空行は高さ確保のため非破壊スペース
        }));
    }, [text]);

    // 縦書き時: ホイールスクロールを横スクロールに変換
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !settings.isVertical) return;
        
        const handleWheel = (e) => {
            // deltaY が支配的な場合に横スクロールへ（OSやデバイス設定に依存しすぎないよう調整）
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                el.scrollLeft -= e.deltaY;
                e.preventDefault();
            }
        };
        
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [settings.isVertical]);

    const fontFamily = settings.fontFamily || 'var(--font-mincho)';
    const fontSize = settings.fontSize || 18;

    return (
        <div className={`reader-overlay ${settings.colorTheme || 'light'}`}>
            <button className="reader-close" onClick={onClose} title="エディタに戻る">
                ✕ 閉じる
            </button>

            <div
                ref={containerRef}
                className={`reader-container ${settings.isVertical ? 'vertical' : 'horizontal'}`}
                style={{
                    writingMode: settings.isVertical ? 'vertical-rl' : 'horizontal-tb',
                    fontFamily: `${fontFamily}, serif`,
                    fontSize: `${fontSize}px`,
                }}
            >
                <div className="reader-body">
                    {paragraphs.map(p => (
                        <p key={p.key} className="reader-paragraph">
                            {parseRuby(p.content)}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ReaderView;
