import React, { useState, useEffect, useMemo } from 'react';
import { ollamaService } from '../utils/ollamaService';
import './AuditReportWindow.css';

const AuditReportWindow = ({ isOpen, onClose }) => {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [fileFilter, setFileFilter] = useState('all');

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await ollamaService.getAuditReport();
      setReport(data || []);
    } catch (error) {
      console.error('Failed to fetch audit report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReport();
    }
  }, [isOpen]);

  // カテゴリ判定
  const classifyCorrection = (item) => {
    const reason = item.reason || '';
    if (reason.includes('設定資料') || reason.includes('矛盾') || reason.includes('整合性')) return '監査';
    if (reason.includes('誤変換') || reason.includes('誤字')) return '誤字';
    if (reason.includes('文法') || reason.includes('冗長')) return '文法';
    if (reason.includes('文体') || reason.includes('文末') || reason.includes('漢字率')) return '文体';
    return '文法';
  };

  // ユニークなファイルリスト
  const uniqueFiles = useMemo(() => {
    const files = new Set(report.map(item => item.file));
    return [...files].sort();
  }, [report]);

  // フィルタリングと優先度ソート
  const PRIORITY = { '監査': 0, '誤字': 1, '文法': 2, '文体': 3 };

  const processedItems = useMemo(() => {
    let filtered = report.filter(item => {
      if (categoryFilter !== 'all') {
        const category = classifyCorrection(item);
        if (category !== categoryFilter) return false;
      }
      if (fileFilter !== 'all' && item.file !== fileFilter) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const pa = PRIORITY[classifyCorrection(a)] ?? 99;
      const pb = PRIORITY[classifyCorrection(b)] ?? 99;
      return pa - pb;
    });
  }, [report, categoryFilter, fileFilter]);

  const handleJump = (item) => {
    const event = new CustomEvent('nexus-jump-to-text', {
      detail: {
        text: item.original,
        file: item.full_path
      }
    });
    window.dispatchEvent(event);
  };

  if (!isOpen) return null;

  return (
    <div className="audit-report-window">
      <div className="audit-header">
        <h3>📋 校正監査：宿題リスト</h3>
        <div className="header-actions">
          <button onClick={fetchReport} className="refresh-btn">更新</button>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
      </div>

      <div className="audit-filter-bar">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="all">すべて</option>
          <option value="誤字">誤字</option>
          <option value="文法">文法</option>
          <option value="文体">文体</option>
          <option value="監査">設定矛盾</option>
        </select>
        
        <select value={fileFilter} onChange={e => setFileFilter(e.target.value)}>
          <option value="all">すべてのファイル</option>
          {uniqueFiles.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        
        <span className="audit-count">
          {processedItems.length} / {report.length} 件
        </span>
      </div>

      <div className="audit-content">
        {loading ? (
          <div className="loading">監査結果を読み込み中...</div>
        ) : processedItems.length === 0 ? (
          <div className="no-items">
            {report.length === 0 ? "指摘事項はありません。完璧です！" : "フィルタ条件に一致する項目はありません。"}
          </div>
        ) : (
          <ul className="homework-list">
            {processedItems.map((item, index) => {
              const category = classifyCorrection(item);
              return (
                <li key={index} className={`homework-item category-${category}`} onClick={() => handleJump(item)}>
                  <div className="item-meta">
                    <span className={`category-tag category-${category}`}>{category}</span>
                    <span className="file-name">{item.file}</span>
                    <span className="timestamp">{item.timestamp}</span>
                  </div>
                  <div className="item-original">「{item.original}」</div>
                  <div className="item-suggestion">💡 {item.suggested}</div>
                  <div className="item-reason">{item.reason}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AuditReportWindow;
