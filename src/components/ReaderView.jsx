// components/ReaderView.jsx
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { parseBlocks, renderInline } from '../utils/readerParser';
import './ReaderView.css';

const ReaderView = ({ text, settings, onClose }) => {
    const containerRef = useRef(null);
    const [showTOC, setShowTOC] = useState(false);

    // ブロック解析（テキスト変更時のみ再計算）
    const blocks = useMemo(() => parseBlocks(text), [text]);

    // 目次（見出しブロックだけ抽出）
    const toc = useMemo(() => {
        return blocks
            .map((b, i) => ({ ...b, index: i }))
            .filter(b => b.isHeader);
    }, [blocks]);

    // 章ジャンプ
    const jumpToChapter = useCallback((index) => {
        const el = document.getElementById(`reader-block-${index}`);
        if (el) {
            el.scrollIntoView({
                behavior: 'smooth',
                ...(settings.isVertical
                    ? { inline: 'start' }
                    : { block: 'start' })
            });
            setShowTOC(false);
        }
    }, [settings.isVertical]);

    // 縦書き時ホイール変換
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !settings.isVertical) return;
        const handler = (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                el.scrollLeft -= e.deltaY;
                e.preventDefault();
            }
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, [settings.isVertical]);

    const fontFamily = settings.fontFamily || 'var(--font-mincho)';
    const fontSize = settings.fontSize || 18;

    return (
        <div className={`reader-overlay ${settings.colorTheme || 'light'}`}>
            {/* ヘッダー */}
            <div className="reader-header">
                {toc.length > 0 && (
                    <button
                        className="reader-toc-btn"
                        onClick={() => setShowTOC(!showTOC)}
                        title="目次"
                    >
                        ☰ 目次
                    </button>
                )}
                <button className="reader-close" onClick={onClose} title="閉じる">
                    ✕ 閉じる
                </button>
            </div>

            {/* 目次パネル */}
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

            {/* 本文 */}
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
                    {blocks.map((block, i) => {
                        if (block.type === 'break') {
                            return <hr key={i} className="reader-break" />;
                        }

                        // タグ決定
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
