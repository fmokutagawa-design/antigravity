// components/ReaderView.jsx
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { parseBlocks, renderInline } from '../utils/readerParser';
import './ReaderView.css';

const FONT_OPTIONS = [
    { label: '明朝', value: 'var(--font-mincho)' },
    { label: 'ゴシック', value: 'var(--font-gothic)' },
    { label: 'ヒラギノ明朝', value: "'Hiragino Mincho ProN', serif" },
    { label: '游明朝', value: "'YuMincho', 'Yu Mincho', serif" },
    { label: 'Noto Serif', value: "'Noto Serif JP', serif" },
    { label: 'クレー', value: "'Klee One', cursive" },
];

const SIZE_OPTIONS = [14, 16, 18, 20, 22, 24, 28, 32];

const ReaderView = ({ text, settings, onClose }) => {
    const containerRef = useRef(null);
    const [showTOC, setShowTOC] = useState(false);
    const [showToolbar, setShowToolbar] = useState(true);

    // リーダー独自の表示設定（親の settings を初期値に使う）
    const [readerFont, setReaderFont] = useState(settings.fontFamily || 'var(--font-mincho)');
    const [readerSize, setReaderSize] = useState(settings.fontSize || 18);
    const [readerVertical, setReaderVertical] = useState(settings.isVertical ?? true);
    const [readerTheme, setReaderTheme] = useState(settings.colorTheme || 'light');

    // ブロック解析
    const blocks = useMemo(() => parseBlocks(text), [text]);

    // 目次
    const toc = useMemo(() => {
        return blocks
            .map((b, i) => ({ ...b, index: i }))
            .filter(b => b.isHeader);
    }, [blocks]);

    // 章ジャンプ
    const jumpToChapter = useCallback((index) => {
        const el = document.getElementById(`reader-block-${index}`);
        if (!el) return;

        if (readerVertical) {
            const container = containerRef.current;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                const offset = elRect.right - containerRect.right;
                container.scrollBy({ left: offset + 40, behavior: 'smooth' });
            }
        } else {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setShowTOC(false);
    }, [readerVertical]);

    // 縦書き時ホイール変換
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !readerVertical) return;
        const handler = (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                el.scrollLeft -= e.deltaY;
                e.preventDefault();
            }
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, [readerVertical]);

    // ツールバー自動非表示（3秒操作なしで隠す）
    const hideTimerRef = useRef(null);
    const handleMouseMove = useCallback(() => {
        setShowToolbar(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setShowToolbar(false), 3000);
    }, []);

    useEffect(() => {
        return () => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, []);

    // Escキーで閉じる
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div
            className={`reader-overlay theme-${readerTheme}`}
            onMouseMove={handleMouseMove}
        >
            {/* ===== ツールバー ===== */}
            <div className={`reader-toolbar ${showToolbar ? 'visible' : 'hidden'}`}>
                <div className="reader-toolbar-left">
                    {toc.length > 0 && (
                        <button
                            className="reader-btn"
                            onClick={() => setShowTOC(!showTOC)}
                        >
                            ☰ 目次
                        </button>
                    )}
                </div>

                <div className="reader-toolbar-center">
                    <select
                        className="reader-select"
                        value={readerFont}
                        onChange={(e) => setReaderFont(e.target.value)}
                    >
                        {FONT_OPTIONS.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                    </select>

                    <select
                        className="reader-select"
                        value={readerSize}
                        onChange={(e) => setReaderSize(Number(e.target.value))}
                    >
                        {SIZE_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}px</option>
                        ))}
                    </select>

                    <button
                        className="reader-btn"
                        onClick={() => setReaderVertical(v => !v)}
                    >
                        {readerVertical ? '横書き' : '縦書き'}
                    </button>

                    <button
                        className="reader-btn"
                        onClick={() => {
                            const themes = ['light', 'dark', 'sakura'];
                            const idx = themes.indexOf(readerTheme);
                            setReaderTheme(themes[(idx + 1) % themes.length]);
                        }}
                    >
                        {readerTheme === 'light' ? '☀ ライト' : readerTheme === 'dark' ? '🌙 ダーク' : '🌸 桜'}
                    </button>
                </div>

                <div className="reader-toolbar-right">
                    <button className="reader-btn reader-btn-close" onClick={onClose}>
                        ✕ 閉じる
                    </button>
                </div>
            </div>

            {/* ===== 目次パネル ===== */}
            {showTOC && (
                <div className="reader-toc-panel">
                    <div className="reader-toc-title">目次</div>
                    {toc.map((entry, i) => (
                        <div
                            key={i}
                            className={`reader-toc-item level-${entry.heading}`}
                            onClick={() => jumpToChapter(entry.index)}
                        >
                            {entry.content}
                        </div>
                    ))}
                </div>
            )}

            {/* ===== 本文 ===== */}
            <div
                ref={containerRef}
                className={`reader-container ${readerVertical ? 'vertical' : 'horizontal'}`}
                style={{
                    writingMode: readerVertical ? 'vertical-rl' : 'horizontal-tb',
                    fontFamily: `${readerFont}, serif`,
                    fontSize: `${readerSize}px`,
                }}
            >
                <div className="reader-body">
                    {blocks.map((block, i) => {
                        if (block.type === 'break') {
                            return <hr key={i} className="reader-break" />;
                        }

                        const Tag = block.heading === 'large' || block.heading === 'chapter' ? 'h2'
                                  : block.heading === 'medium' ? 'h3'
                                  : block.heading === 'small' ? 'h4'
                                  : 'p';

                        const style = {};
                        if (block.indent) {
                            style.paddingInlineStart = `${block.indent}em`;
                        }
                        if (block.font) {
                            style.fontFamily = block.font;
                        }
                        if (block.align === 'center') {
                            style.textAlign = 'center';
                        }

                        const content = block.content || '\u00A0';

                        return (
                            <Tag
                                key={i}
                                id={`reader-block-${i}`}
                                className={`reader-paragraph ${block.isHeader ? 'reader-heading' : ''}`}
                                style={style}
                            >
                                {renderInline(content)}
                            </Tag>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ReaderView;
