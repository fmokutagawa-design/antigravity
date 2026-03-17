import React from 'react';

const ExportPanel = ({
  onFormat,
  onPrint,
  onEpubExport,
  onDocxExport,
  onBatchExport,
  colorTheme
}) => {
  const isDark = colorTheme === 'dark';

  const btnStyle = {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: '13px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: isDark ? '#fff' : '#333',
    borderRadius: '4px'
  };

  const sectionStyle = {
    padding: '12px',
    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
  };

  const headingStyle = {
    fontSize: '11px',
    fontWeight: 'bold',
    color: isDark ? '#aaa' : '#888',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', fontFamily: 'var(--font-gothic)' }}>

      {/* 文字整形セクション */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Aa 文字整形</div>
        <button onClick={() => onFormat('fullwidth')} style={btnStyle}
          onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.target.style.background = 'none'}>
          🔤 英数字の全角化
        </button>
        <button onClick={() => onFormat('quotes')} style={btnStyle}
          onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.target.style.background = 'none'}>
          『』引用符の統一
        </button>
        <button onClick={() => onFormat('markdown')} style={btnStyle}
          onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.target.style.background = 'none'}>
          📝 Markdown→『』変換
        </button>
        <button onClick={() => onFormat('double-space-to-newline')} style={btnStyle}
          onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.target.style.background = 'none'}>
          ⏎ スペース2つ→改行
        </button>
        <button onClick={() => onFormat('ellipsis')} style={btnStyle}
          onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.target.style.background = 'none'}>
          … 三点リーダー統一（……）
        </button>
        <button onClick={() => onFormat('dash')} style={btnStyle}
          onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.target.style.background = 'none'}>
          ― ダッシュ統一（――）
        </button>
        <button onClick={() => onFormat('exclamation-space')} style={btnStyle}
          onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.target.style.background = 'none'}>
          ！ 感嘆符・疑問符後スペース挿入
        </button>
        <button onClick={() => onFormat('remove-blank-lines')} style={btnStyle}
          onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.target.style.background = 'none'}>
          🗑 連続空行の圧縮
        </button>
        <button onClick={() => onFormat('indent')} style={btnStyle}
          onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.target.style.background = 'none'}>
          ⬛ 行頭字下げ（会話文除外）
        </button>
      </div>

      {/* 出力セクション */}
      <div style={sectionStyle}>
        <div style={headingStyle}>出力</div>
        <button onClick={onPrint || (() => window.print())} style={btnStyle}
          onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.target.style.background = 'none'}>
          🖨️ PDF / 印刷
        </button>
        {onEpubExport && (
          <button onClick={onEpubExport} style={btnStyle}
            onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
            onMouseLeave={e => e.target.style.background = 'none'}>
            📚 EPUB書き出し
          </button>
        )}
        {onDocxExport && (
          <button onClick={onDocxExport} style={btnStyle}
            onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
            onMouseLeave={e => e.target.style.background = 'none'}>
            📄 Word書き出し
          </button>
        )}
        {onBatchExport && (
          <button onClick={onBatchExport} style={btnStyle}
            onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
            onMouseLeave={e => e.target.style.background = 'none'}>
            📦 一括書き出し
          </button>
        )}
      </div>
    </div>
  );
};

export default ExportPanel;
