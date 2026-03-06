import React, { useState } from 'react';

const SectionHeader = ({ title, isOpen, onClick, icon }) => (
    <div
        onClick={onClick}
        style={{
            padding: '10px 15px',
            cursor: 'pointer',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            userSelect: 'none'
        }}
    >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {icon} {title}
        </span>
        <span>{isOpen ? '▼' : '▶'}</span>
    </div>
);

const ProgressPanel = ({
    // Render props or components for each section
    renderProgressTracker,
    renderChecklistPanel,
    renderClipboardHistory
}) => {
    // We can use accordion style or tabs. Plan mentions "sub-sections (collapsible accordion)".
    // Let's implement simple collapsible sections.

    const [sections, setSections] = useState({
        progress: true,
        checklist: false,
        clipboard: false
    });

    const toggleSection = (section) => {
        setSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Progress Section */}
            <SectionHeader
                title="Session Progress"
                icon="📊"
                isOpen={sections.progress}
                onClick={() => toggleSection('progress')}
            />
            {sections.progress && (
                <div style={{ padding: '0', borderBottom: '1px solid var(--border-color)' }}>
                    {renderProgressTracker && renderProgressTracker()}
                </div>
            )}

            {/* Checklist Section */}
            <SectionHeader
                title="Checklist"
                icon="✅"
                isOpen={sections.checklist}
                onClick={() => toggleSection('checklist')}
            />
            {sections.checklist && (
                <div style={{ padding: '0', borderBottom: '1px solid var(--border-color)' }}>
                    {renderChecklistPanel && renderChecklistPanel()}
                </div>
            )}

            {/* Clipboard Section */}
            <SectionHeader
                title="Clipboard History"
                icon="📋"
                isOpen={sections.clipboard}
                onClick={() => toggleSection('clipboard')}
            />
            {sections.clipboard && (
                <div style={{ padding: '0', borderBottom: '1px solid var(--border-color)', flex: 1, overflowY: 'auto', minHeight: '200px' }}>
                    {renderClipboardHistory && renderClipboardHistory()}
                </div>
            )}
        </div>
    );
};

export default ProgressPanel;
