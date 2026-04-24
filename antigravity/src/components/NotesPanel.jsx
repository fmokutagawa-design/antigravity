import React, { useState, useEffect, useRef } from 'react';

const NotesPanel = ({
    initialText = '',
    onSave, // Function to save text
    projectHandle // To know if we can save
}) => {
    const [text, setText] = useState(initialText);
    const timeoutRef = useRef(null);

    // Sync if initialText changes (e.g. file loaded externally)
    useEffect(() => {
        setText(initialText);
    }, [initialText]);

    const handleChange = (e) => {
        const newText = e.target.value;
        setText(newText);

        // Auto-save debounce
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (onSave) onSave(newText);
        }, 1000); // 1 sec debounce
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                📝 Notes (Scratchpad)
            </h3>
            <textarea
                value={text}
                onChange={handleChange}
                placeholder="Write quick notes here..."
                style={{
                    flex: 1,
                    width: '100%',
                    resize: 'none',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '8px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                }}
            />
            <div style={{ fontSize: '10px', color: '#999', marginTop: '5px', textAlign: 'right' }}>
                {projectHandle ? 'Auto-saving to _notes.txt' : 'Project not open'}
            </div>
        </div>
    );
};

export default NotesPanel;
