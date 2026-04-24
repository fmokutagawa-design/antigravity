import React, { useState, useEffect } from 'react';
import { ollamaService } from '../utils/ollamaService';
import './AuditReportWindow.css';

const AuditReportWindow = ({ isOpen, onClose }) => {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const handleJump = (item) => {
    // エディタへジャンプするためのカスタムイベントを発行
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
      <div className="audit-content">
        {loading ? (
          <div className="loading">監査結果を読み込み中...</div>
        ) : report.length === 0 ? (
          <div className="no-items">指摘事項はありません。完璧です！</div>
        ) : (
          <ul className="homework-list">
            {report.map((item, index) => (
              <li key={index} className="homework-item" onClick={() => handleJump(item)}>
                <div className="item-meta">
                  <span className="file-name">{item.file}</span>
                  <span className="timestamp">{item.timestamp}</span>
                </div>
                <div className="item-original">「{item.original}」</div>
                <div className="item-suggestion">💡 {item.suggested}</div>
                <div className="item-reason">{item.reason}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AuditReportWindow;
