import React from 'react';

/**
 * ManuscriptPanel
 * プロジェクト内のファイル一覧を章として表示し、
 * 章選択・章分割操作を提供するサイドバーパネル。
 */
const ManuscriptPanel = ({
  allFiles = [],
  activeFile,
  onChapterSelect,
  onSplitDocument,
}) => {
  const txtFiles = allFiles.filter(f => {
    const name = typeof f === 'string' ? f : (f.name || '');
    return name.endsWith('.txt');
  });

  const activeId = activeFile
    ? (typeof activeFile === 'string' ? activeFile : (activeFile.handle || activeFile.name || null))
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>原稿管理</span>
        {onSplitDocument && (
          <button
            onClick={onSplitDocument}
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              cursor: 'pointer',
              background: 'transparent',
              border: '1px solid #888',
              borderRadius: '4px',
            }}
            title="章ごとにファイル分割"
          >
            章分割
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {txtFiles.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#888', padding: '4px' }}>
            ファイルがありません
          </div>
        ) : (
          txtFiles.map((f, i) => {
            const name = typeof f === 'string' ? f : (f.name || '');
            const handle = typeof f === 'string' ? f : (f.handle || f);
            const isActive = activeId && (
              activeId === (typeof handle === 'string' ? handle : (handle?.name || ''))
              || activeId === name
            );
            return (
              <div
                key={i}
                onClick={() => onChapterSelect && onChapterSelect(handle)}
                style={{
                  padding: '5px 8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  borderRadius: '4px',
                  marginBottom: '2px',
                  background: isActive ? 'rgba(100,140,255,0.2)' : 'transparent',
                  fontWeight: isActive ? 'bold' : 'normal',
                }}
              >
                {name}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ManuscriptPanel;
