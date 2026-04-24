import React from 'react';
import { calculateStats } from '../utils/textUtils';

const Stats = ({ text, settings, lastSaved }) => {
    const stats = calculateStats(text, settings.charsPerLine, settings.linesPerPage);

    return (
        <div className="stats-container">
            <div className="stat-item">
                <span className="stat-label">文字数</span>
                <span className="stat-value">{stats.charCount}</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">原稿用紙</span>
                <span className="stat-value">{stats.paperCount}</span>
                <span className="stat-unit">枚</span>
            </div>
            <div className="stat-detail">
                <small>({settings.charsPerLine}字 × {settings.linesPerPage}行)</small>
            </div>
            {lastSaved && (
                <div className="stat-detail" style={{ marginTop: '10px', color: '#888' }}>
                    <small>自動保存: {lastSaved.toLocaleTimeString()}</small>
                </div>
            )}
        </div>
    );
};

export default Stats;
