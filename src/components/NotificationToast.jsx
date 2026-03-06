import React, { useEffect } from 'react';

const NotificationToast = ({ toasts, onRemove }) => {
    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 110000,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none'
        }}>
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
};

const ToastItem = ({ toast, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, toast.duration || 3000);
        return () => clearTimeout(timer);
    }, [toast, onRemove]);

    const getColors = () => {
        switch (toast.type) {
            case 'success': return { bg: '#2ecc71', color: '#fff' };
            case 'error': return { bg: '#e74c3c', color: '#fff' };
            default: return { bg: '#3498db', color: '#fff' };
        }
    };

    const colors = getColors();

    return (
        <div style={{
            backgroundColor: colors.bg,
            color: colors.color,
            padding: '12px 20px',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '0.9rem',
            fontWeight: '500',
            minWidth: '200px',
            maxWidth: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'auto',
            animation: 'slideIn 0.3s ease-out'
        }}>
            <style>
                {`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                `}
            </style>
            <span>{toast.message}</span>
            <button
                onClick={() => onRemove(toast.id)}
                style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    marginLeft: '12px',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    padding: '0 4px'
                }}
            >
                ✕
            </button>
        </div>
    );
};

export default NotificationToast;
