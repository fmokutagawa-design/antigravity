import React, { useState, useEffect, useRef } from 'react';

const InputModal = ({ isOpen, title, message, initialValue = '', placeholder = '', onConfirm, onCancel }) => {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(value);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000
        }} onClick={onCancel}>
            <div style={{
                backgroundColor: 'var(--bg-paper, #fff)',
                color: 'var(--text-color, #333)',
                padding: '24px',
                borderRadius: '8px',
                width: '400px',
                maxWidth: '90%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                border: '1px solid var(--border-color, #ccc)'
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1.2rem' }}>{title}</h3>
                {message && <p style={{ marginBottom: '16px', fontSize: '0.9rem', color: '#666' }}>{message}</p>}

                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder={placeholder}
                        style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '1rem',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            marginBottom: '20px',
                            boxSizing: 'border-box'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={onCancel}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                background: 'transparent',
                                cursor: 'pointer'
                            }}
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            style={{
                                padding: '8px 16px',
                                borderRadius: '4px',
                                border: 'none',
                                background: 'var(--primary-color, #2196f3)',
                                color: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            OK
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InputModal;
