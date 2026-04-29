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

const RUBY_FONT_OPTIONS = [
    { label: 'ルビ: 本文と同じ', value: 'inherit' },
    ...FONT_OPTIONS
];

const SIZE_OPTIONS = [14, 16, 18, 20, 22, 24, 28, 32];

const ReaderView = ({ text, settings, onClose, cursorOffset = 0, onJumpToEditor, workText, isNexusFile, workTitle, resolveOffset, onOpenSegmentFile }) => {
    const containerRef = useRef(null);
    const [showTOC, setShowTOC] = useState(false);
    const [showToolbar, setShowToolbar] = useState(true);
    const [showFullWork, setShowFullWork] = useState(false);

    // リーダー独自の表示設定（親の settings を初期値に使う）
    const [readerFont, setReaderFont] = useState(settings.fontFamily || 'var(--font-mincho)');
    const [readerRubyFont, setReaderRubyFont] = useState(settings.rubyFontFamily || 'inherit');
    const [readerSize, setReaderSize] = useState(settings.fontSize || 18);
    const [readerVertical, setReaderVertical] = useState(settings.isVertical ?? true);
    const [readerTheme, setReaderTheme] = useState(settings.colorTheme || 'light');

    // 検索
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResultIndex, setSearchResultIndex] = useState(0);

    // ブロック解析
    const displayText = (showFullWork && isNexusFile && workText) ? workText : text;
    const blocks = useMemo(() => parseBlocks(displayText), [displayText]);

    // 目次
    const toc = useMemo(() => {
        return blocks
            .map((b, i) => ({ ...b, index: i }))
            .filter(b => b.isHeader);
    }, [blocks]);

    // 検索結果（ブロックインデックス配列）
    const searchResults = useMemo(() => {
        if (!searchTerm) return [];
        const lower = searchTerm.toLowerCase();
        return blocks.reduce((acc, b, i) => {
            if (b.content && b.content.toLowerCase().includes(lower)) acc.push(i);
            return acc;
        }, []);
    }, [blocks, searchTerm]);

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

    // 初回マウント時：cursorOffset に最も近いブロックにスクロール
    useEffect(() => {
        if (!blocks.length) return;
        // cursorOffset に最も近い（超えない最大の textOffset を持つ）ブロックを探す
        let closestIdx = 0;
        for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].textOffset != null && blocks[i].textOffset <= cursorOffset) {
                closestIdx = i;
            }
        }
        // 少し遅延させてDOMが揃ってからスクロール
        const timer = setTimeout(() => jumpToChapter(closestIdx), 100);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 初回のみ

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

    // 検索ナビゲーション
    const searchPrev = useCallback(() => {
        if (!searchResults.length) return;
        const idx = (searchResultIndex - 1 + searchResults.length) % searchResults.length;
        setSearchResultIndex(idx);
        jumpToChapter(searchResults[idx]);
    }, [searchResults, searchResultIndex, jumpToChapter]);

    const searchNext = useCallback(() => {
        if (!searchResults.length) return;
        const idx = (searchResultIndex + 1) % searchResults.length;
        setSearchResultIndex(idx);
        jumpToChapter(searchResults[idx]);
    }, [searchResults, searchResultIndex, jumpToChapter]);

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
                    {/* 検索バー */}
                    <div className="reader-search-bar">
                        <input
                            type="text"
                            className="reader-search-input"
                            placeholder="検索..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setSearchResultIndex(0); }}
                        />
                        {searchResults.length > 0 && (
                            <span className="reader-search-count">
                                {searchResultIndex + 1}/{searchResults.length}
                            </span>
                        )}
                        <button className="reader-btn" onClick={searchPrev} disabled={!searchResults.length}>↑</button>
                        <button className="reader-btn" onClick={searchNext} disabled={!searchResults.length}>↓</button>
                    </div>
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
                        value={readerRubyFont}
                        onChange={(e) => setReaderRubyFont(e.target.value)}
                        title="ルビのフォント"
                    >
                        {RUBY_FONT_OPTIONS.map(f => (
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
                    {isNexusFile && (
                        <button
                            onClick={() => setShowFullWork(v => !v)}
                            className="reader-btn"
                            style={{
                                background: showFullWork ? 'var(--accent-color, #4a9eff)' : 'transparent',
                                color: showFullWork ? '#fff' : 'inherit',
                                borderRadius: '16px',
                                padding: '4px 12px',
                            }}
                            title={showFullWork ? '現在の章のみ表示' : '作品全体を表示'}
                        >
                            {showFullWork ? `📖 全体${workTitle ? ` (${workTitle})` : ''}` : '📖 全体'}
                        </button>
                    )}
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
                    '--reader-ruby-font': readerRubyFont,
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

                        const isSearchHit = searchTerm && searchResults.includes(i);
                        const content = block.content || '\u00A0';

                        return (
                            <Tag
                                key={i}
                                id={`reader-block-${i}`}
                                className={`reader-paragraph ${block.isHeader ? 'reader-heading' : ''} ${isSearchHit ? 'reader-search-hit' : ''}`}
                                style={{
                                    ...style,
                                    cursor: (onJumpToEditor || (showFullWork && onOpenSegmentFile)) ? 'pointer' : undefined,
                                }}
                                onClick={() => {
                                    if (showFullWork && resolveOffset && onOpenSegmentFile) {
                                        // 作品全体表示中: 該当章ファイルを開く
                                        const resolved = resolveOffset(block.textOffset ?? 0);
                                        if (resolved) {
                                            onOpenSegmentFile(resolved.file, resolved.localOffset);
                                            onClose(); // リーダーを閉じる
                                        }
                                    } else if (onJumpToEditor) {
                                        // 通常表示: 従来の Editor ジャンプ
                                        onJumpToEditor(block.textOffset ?? 0);
                                    }
                                }}
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
