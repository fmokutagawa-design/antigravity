import React from 'react';
import AIAssistant from './AIAssistant';

const AIPanel = ({ renderNotesPanel, ...props }) => {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Reuse existing AIAssistant but strictly controls style to fit sidebar */}
            <AIAssistant
                {...props}
                renderNotesPanel={renderNotesPanel}
                isSidebarMode={true}
                isOpen={true}
                onClose={() => { }} // No close button in sidebar mode
                style={{
                    position: 'static',
                    width: '100%',
                    height: '100%',
                    boxShadow: 'none',
                    border: 'none',
                    borderRadius: 0,
                    transform: 'none',
                    maxWidth: 'none',
                    maxHeight: 'none'
                }}
            />
        </div>
    );
};

export default AIPanel;
