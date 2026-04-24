import React, { useState } from 'react';
import { OTSUKA_QUESTIONS, SIMPLE_QUESTIONS } from '../data/otsukaQuestions';

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
};

const modalStyle = {
    backgroundColor: 'var(--bg-paper)',
    color: 'var(--text-primary)',
    width: '600px',
    maxWidth: '90%',
    maxHeight: '90vh',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    overflow: 'hidden'
};

const headerStyle = {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-main)'
};

const contentStyle = {
    padding: '24px',
    flex: 1,
    overflowY: 'auto'
};

const footerStyle = {
    padding: '16px 20px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-main)'
};

export const StoryWizard = ({ onExampleComplete, onCancel }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({});
    const [isSimpleMode, setIsSimpleMode] = useState(true);

    const questions = isSimpleMode ? SIMPLE_QUESTIONS : OTSUKA_QUESTIONS;
    const question = questions[currentStep] || questions[0];

    const isFirst = currentStep === 0;
    const isLast = currentStep === questions.length - 1;

    const toggleMode = () => {
        setIsSimpleMode(!isSimpleMode);
        setCurrentStep(0);
    };

    const handleChange = (e) => {
        setAnswers({
            ...answers,
            [question.id]: e.target.value
        });
    };

    const handleNext = () => {
        if (!isLast) setCurrentStep(prev => prev + 1);
    };

    const handlePrev = () => {
        if (!isFirst) setCurrentStep(prev => prev - 1);
    };

    const handleFinish = () => {
        onExampleComplete(answers);
    };

    const hasAnswer = answers[question.id] && answers[question.id].trim().length > 0;

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={{ ...headerStyle, flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h3 style={{ margin: 0 }}>物語作成ウィザード</h3>
                            <button
                                onClick={toggleMode}
                                style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 8px',
                                    background: isSimpleMode ? '#4CAF50' : '#2196F3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                                title="クリックしてモード切替"
                            >
                                {isSimpleMode ? 'シンプル (11問)' : '詳細 (30問)'}
                            </button>
                        </div>
                        <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                            Q{currentStep + 1} / {questions.length}
                        </span>
                    </div>
                    <button
                        onClick={handleFinish}
                        style={{
                            fontSize: '0.8rem',
                            padding: '4px 8px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: 'var(--text-primary)'
                        }}
                        title="現在の入力内容でボードを生成して終了します"
                    >
                        途中終了して生成
                    </button>
                </div>
                {/* Progress Bar */}
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${((currentStep + 1) / questions.length) * 100}%`,
                        height: '100%',
                        background: 'var(--accent-color, #4CAF50)',
                        borderRadius: '2px',
                        transition: 'width 0.3s ease'
                    }} />
                </div>
            </div>

            <div style={contentStyle}>
                <div style={{ marginBottom: '20px', fontSize: '1.2rem', lineHeight: '1.6', fontWeight: 'bold' }}>
                    Q{question.id}. {question.text}
                </div>
                <textarea
                    autoFocus
                    style={{
                        width: '100%',
                        minHeight: '200px',
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid rgba(127,127,127,0.3)',
                        backgroundColor: 'rgba(0,0,0,0.05)',
                        color: 'var(--text-primary)',
                        fontSize: '1.1rem',
                        resize: 'vertical',
                        lineHeight: '1.8'
                    }}
                    value={answers[question.id] || ''}
                    onChange={handleChange}
                    placeholder="ここに答えを入力してください..."
                />
                <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(33, 150, 243, 0.1)', borderRadius: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <strong>💡 Hint:</strong> この答えはストーリーボードの <strong>{question.target}</strong> （{question.type === 'character' ? '登場人物' : question.type === 'note' ? 'メモ' : 'イベント'}）として配置されます。
                </div>
            </div>

            <div style={footerStyle}>
                <div>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 16px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                        }}>
                        キャンセル
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handlePrev}
                        disabled={isFirst}
                        style={{
                            padding: '8px 16px',
                            border: '1px solid rgba(127,127,127,0.3)',
                            borderRadius: '6px',
                            background: 'transparent',
                            color: isFirst ? 'rgba(127,127,127,0.3)' : 'var(--text-primary)',
                            cursor: isFirst ? 'default' : 'pointer'
                        }}
                    >
                        前へ
                    </button>

                    {isLast ? (
                        <button
                            onClick={handleFinish}
                            style={{
                                padding: '8px 24px',
                                border: 'none',
                                borderRadius: '6px',
                                background: '#4CAF50',
                                color: 'white',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                            }}
                        >
                            完了して生成
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            style={{
                                padding: '8px 24px',
                                border: 'none',
                                borderRadius: '6px',
                                background: hasAnswer ? '#2196F3' : '#9E9E9E',
                                color: 'white',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                            }}
                        >
                            {hasAnswer ? '次へ' : 'スキップ'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
