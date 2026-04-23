import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const AIChatView = ({
    messages = [],
    onSendMessage,
    isGenerating = false,
    contextFiles = [],
    onClearChat,
    useRAG = false,
    setUseRAG
}) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isGenerating]);

    const handleSend = () => {
        if (!input.trim() || isGenerating) return;
        onSendMessage(input);
        setInput('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            // Prevent sending during IME composition (Japanese conversion)
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* AI Control Bar */}
            <div style={{
                padding: '8px 12px',
                background: '#f8f9fa',
                borderBottom: '1px solid #eee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                flexShrink: 0
            }}>
                {/* Context Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {contextFiles.length > 0 ? (
                        <span style={{ color: '#0d47a1', background: '#e3f2fd', padding: '2px 8px', borderRadius: '10px' }}>
                            📚 本文コンテキスト: {contextFiles.length}
                        </span>
                    ) : (
                        <span style={{ color: '#999' }}>コンテキスト未選択</span>
                    )}
                </div>

                {/* RAG Toggle */}
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: useRAG ? 'var(--accent-color, #2196f3)' : '#666',
                    fontWeight: useRAG ? 'bold' : 'normal'
                }}>
                    <input
                        type="checkbox"
                        checked={useRAG}
                        onChange={(e) => setUseRAG(e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-color, #2196f3)' }}
                    />
                    <span>過去の全原稿DBから検索</span>
                </label>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#999', marginTop: '40px', fontSize: '14px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>💬</div>
                        AIとチャットして<br />アイデアを広げましょう
                    </div>
                )}

                {messages.map((msg, index) => (
                    <div key={index} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '100%'
                    }}>
                        <div style={{
                            maxWidth: '85%',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                            borderTopLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
                            backgroundColor: msg.role === 'user' ? 'var(--accent-color, #2196f3)' : '#f5f5f5',
                            color: msg.role === 'user' ? '#fff' : '#333',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                            {msg.role === 'user' ? (
                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                            ) : (
                                <div className="markdown-body" style={{ fontSize: '13px' }}>
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#999', marginTop: '4px', padding: '0 4px' }}>
                            {msg.role === 'user' ? 'You' : 'AI'}
                        </div>
                    </div>
                ))}

                {isGenerating && (
                    <div style={{ alignSelf: 'flex-start', padding: '10px', color: '#999', fontSize: '12px', fontStyle: 'italic' }}>
                        AIが入力中...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '12px', borderTop: '1px solid #eee', background: '#fff' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <button
                        onClick={onClearChat}
                        title="チャット履歴をクリア"
                        style={{ padding: '8px', borderRadius: '50%', border: 'none', background: '#f5f5f5', cursor: 'pointer', color: '#666' }}
                    >
                        🗑️
                    </button>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="メッセージを入力... (Enterで送信)"
                        style={{
                            flex: 1,
                            borderRadius: '20px',
                            border: '1px solid #ddd',
                            padding: '10px 16px',
                            resize: 'none',
                            height: '44px',
                            maxHeight: '120px',
                            fontFamily: 'inherit',
                            fontSize: '14px',
                            outline: 'none'
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isGenerating}
                        style={{
                            padding: '10px 16px',
                            borderRadius: '20px',
                            border: 'none',
                            background: input.trim() && !isGenerating ? 'var(--accent-color, #2196f3)' : '#e0e0e0',
                            color: '#fff',
                            cursor: input.trim() && !isGenerating ? 'pointer' : 'default',
                            fontWeight: 'bold',
                            height: '44px'
                        }}
                    >
                        送信
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIChatView;
