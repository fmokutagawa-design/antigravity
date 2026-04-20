import React from 'react';
import { getContextAroundOffset } from '../utils/splitByChapters';
import './SplitByChaptersModal.css';

/**
 * SplitByChaptersModal
 *
 * 分割計画の確認モーダル。
 */
export default function SplitByChaptersModal({
    isOpen,
    plan,
    sourceText,
    isExecuting,
    onClose,
    onRemoveSegment,
    onRenameSegment,
    onExecute,
}) {
    if (!isOpen || !plan) return null;

    const noBoundaryFound = plan.segments.length <= 1;

    return (
        <div className="split-modal-overlay" onClick={isExecuting ? undefined : onClose}>
            <div className="split-modal" onClick={e => e.stopPropagation()}>
                <div className="split-modal-header">
                    <h2>章ごとに分割</h2>
                    <button
                        className="split-modal-close"
                        onClick={onClose}
                        disabled={isExecuting}
                    >✕</button>
                </div>

                <div className="split-modal-body">
                    {noBoundaryFound ? (
                        <div className="split-empty">
                            章境界（■、第N章、Markdown見出し、青空文庫タグ）が
                            見つかりませんでした。分割できません。
                        </div>
                    ) : (
                        <>
                            <div className="split-summary">
                                元ファイル: <strong>{plan.sourceFileName}</strong> ({plan.stats.totalChars.toLocaleString()} 字)
                                → <strong>{plan.segments.length}</strong> ファイルに分割予定
                            </div>

                            <div className="split-segments">
                                {plan.segments.map((seg, i) => (
                                    <SegmentCard
                                        key={i}
                                        segment={seg}
                                        sourceText={sourceText}
                                        onRemove={() => onRemoveSegment(i)}
                                        onRename={(name) => onRenameSegment(i, name)}
                                        canRemove={i > 0}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="split-modal-footer">
                    <button
                        className="btn-cancel"
                        onClick={onClose}
                        disabled={isExecuting}
                    >キャンセル</button>
                    <button
                        className="btn-execute"
                        onClick={onExecute}
                        disabled={isExecuting || noBoundaryFound}
                    >
                        {isExecuting ? '分割中…' : '分割する'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SegmentCard({ segment, sourceText, onRemove, onRename, canRemove }) {
    const { before, after } = getContextAroundOffset(sourceText, segment.startOffset, 400);
    // 先頭セグメント（index 0）は境界がないので before 表示不要
    const showBefore = segment.index > 0;

    return (
        <div className="split-segment-card">
            <div className="split-segment-head">
                <span className="seg-index">#{segment.index + 1}</span>
                <input
                    className="seg-title"
                    type="text"
                    value={segment.displayName}
                    onChange={(e) => onRename(e.target.value)}
                    placeholder="章タイトル"
                />
                <span className="seg-charcount">
                    {segment.charCount.toLocaleString()} 字
                </span>
                {canRemove && (
                    <button
                        className="seg-remove"
                        onClick={onRemove}
                        title="この境界を削除（前の章と結合）"
                    >除外</button>
                )}
            </div>
            {showBefore && (
                <div className="seg-context">
                    <div className="seg-context-label">境界直前（前の章の末尾）</div>
                    <pre className="seg-context-text before">{before.slice(-400)}</pre>
                </div>
            )}
            <div className="seg-context">
                <div className="seg-context-label">
                    {showBefore ? 'この章の冒頭' : '冒頭'}
                </div>
                <pre className="seg-context-text after">{after.slice(0, 400)}</pre>
            </div>
            <div className="seg-filename">
                → <code>{segment.proposedFileName}</code>
            </div>
        </div>
    );
}
