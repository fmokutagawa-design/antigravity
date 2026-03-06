
import React, { useState, useEffect } from 'react';
import './ProgressTracker.css';

const WritingSession = ({ sessionCharDiff, onResetSession }) => {
    const [mode, setMode] = useState('stopwatch'); // stopwatch, timer, target
    const [timeLeft, setTimeLeft] = useState(0); // in seconds
    const [isActive, setIsActive] = useState(false);
    const [targetTime, setTargetTime] = useState('');
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [sessionTarget, setSessionTarget] = useState(() => {
        try { return parseInt(localStorage.getItem('session_char_target')) || 0; } catch { return 0; }
    });
    const [showTargetInput, setShowTargetInput] = useState(false);
    const [tempTarget, setTempTarget] = useState('');

    useEffect(() => {
        let interval = null;
        if (isActive) {
            interval = setInterval(() => {
                if (mode === 'stopwatch') {
                    setElapsedSeconds(prev => prev + 1);
                } else if (mode === 'timer') {
                    setTimeLeft(prev => {
                        if (prev <= 1) {
                            setIsActive(false);
                            new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(() => { });
                            alert('時間です！');
                            return 0;
                        }
                        return prev - 1;
                    });
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, mode]);

    // Handle Target Mode Tick
    useEffect(() => {
        if (mode === 'target' && isActive && targetTime) {
            const interval = setInterval(() => {
                const now = new Date();
                const [h, m] = targetTime.split(':').map(Number);
                const target = new Date();
                target.setHours(h, m, 0, 0);
                if (target < now) target.setDate(target.getDate() + 1);

                const diff = Math.floor((target - now) / 1000);
                if (diff <= 0) {
                    setIsActive(false);
                    setTimeLeft(0);
                    alert('時間です！');
                } else {
                    setTimeLeft(diff);
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [mode, isActive, targetTime]);


    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const startTimer = (minutes) => {
        setMode('timer');
        setTimeLeft(minutes * 60);
        setIsActive(true);
    };

    const startTarget = () => {
        if (!targetTime) return;
        setMode('target');
        setIsActive(true);
    };

    const handleSetSessionTarget = () => {
        const val = parseInt(tempTarget) || 0;
        setSessionTarget(val);
        localStorage.setItem('session_char_target', val.toString());
        setShowTargetInput(false);
        setTempTarget('');
    };

    const sessionProgress = sessionTarget > 0 ? Math.min(((sessionCharDiff || 0) / sessionTarget) * 100, 100) : 0;
    const sessionAchieved = sessionTarget > 0 && (sessionCharDiff || 0) >= sessionTarget;

    return (
        <div className="writing-session">
            <h4>⏱️ 作業セッション</h4>

            {/* Session Character Target */}
            <div style={{ marginBottom: '12px' }}>
                {sessionTarget > 0 ? (
                    <div style={{ fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span>🎯 セッション目標: <strong>{sessionTarget.toLocaleString()}</strong>文字</span>
                            <button
                                onClick={() => { setShowTargetInput(true); setTempTarget(sessionTarget.toString()); }}
                                style={{ fontSize: '10px', padding: '1px 6px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'inherit' }}
                            >変更</button>
                        </div>
                        <div style={{ background: 'var(--border-color)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${sessionProgress}%`,
                                height: '100%',
                                background: sessionAchieved ? '#4caf50' : '#2196f3',
                                borderRadius: '4px',
                                transition: 'width 0.3s'
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', opacity: 0.7, fontSize: '11px' }}>
                            <span>{(sessionCharDiff || 0).toLocaleString()} / {sessionTarget.toLocaleString()}</span>
                            <span>{sessionAchieved ? '🎉 達成！' : `残り ${Math.max(0, sessionTarget - (sessionCharDiff || 0)).toLocaleString()}文字`}</span>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowTargetInput(true)}
                        style={{
                            width: '100%',
                            padding: '6px',
                            fontSize: '12px',
                            background: 'none',
                            border: '1px dashed var(--border-color)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: 'var(--accent-color)',
                            opacity: 0.8
                        }}
                    >
                        + セッション文字目標を設定
                    </button>
                )}

                {showTargetInput && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'center' }}>
                        <input
                            type="number"
                            value={tempTarget}
                            onChange={e => setTempTarget(e.target.value)}
                            placeholder="例: 1000"
                            style={{ flex: 1, fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSetSessionTarget(); if (e.key === 'Escape') setShowTargetInput(false); }}
                        />
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>文字</span>
                        <button onClick={handleSetSessionTarget} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>設定</button>
                        <button onClick={() => { setShowTargetInput(false); setSessionTarget(0); localStorage.removeItem('session_char_target'); }} style={{ fontSize: '11px', padding: '4px 8px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'inherit' }}>解除</button>
                    </div>
                )}
            </div>

            <div className="session-controls">
                <div className="mode-toggle">
                    <button className={mode === 'stopwatch' ? 'active' : ''} onClick={() => { setMode('stopwatch'); setIsActive(false); setElapsedSeconds(0); }}>経過</button>
                    <button className={mode === 'timer' ? 'active' : ''} onClick={() => { setMode('timer'); setIsActive(false); }}>タイマー</button>
                    <button className={mode === 'target' ? 'active' : ''} onClick={() => { setMode('target'); setIsActive(false); }}>時刻</button>
                </div>

                <div className="timer-display">
                    {mode === 'stopwatch' ? formatTime(elapsedSeconds) : formatTime(timeLeft)}
                </div>

                <div className="session-actions">
                    {mode === 'timer' && !isActive && (
                        <div className="quick-set">
                            <button onClick={() => startTimer(15)}>15分</button>
                            <button onClick={() => startTimer(30)}>30分</button>
                            <button onClick={() => startTimer(60)}>60分</button>
                        </div>
                    )}
                    {mode === 'target' && !isActive && (
                        <div className="target-set">
                            <input type="time" value={targetTime} onChange={e => setTargetTime(e.target.value)} />
                            <button onClick={startTarget}>開始</button>
                        </div>
                    )}

                    {(mode === 'stopwatch' || isActive) && (
                        <button
                            className={`toggle-btn ${isActive ? 'stop' : 'start'}`}
                            onClick={() => setIsActive(!isActive)}
                        >
                            {isActive ? '一時停止' : '再開'}
                        </button>
                    )}
                    <button className="reset-btn" onClick={() => {
                        setIsActive(false);
                        setElapsedSeconds(0);
                        setTimeLeft(0);
                        if (onResetSession) onResetSession(); // Call global reset
                    }}>リセット</button>
                </div>

                <div className="session-stats">
                    <span>本日/Session: </span>
                    <strong>{(sessionCharDiff || 0).toLocaleString()}</strong> 文字
                </div>
            </div>
        </div>
    );
};

const ProgressTracker = ({ allMaterialFiles, currentWork, sessionCharDiff, onResetSession, projectSettings, onUpdateProjectSettings }) => {
    const [goals, setGoals] = useState({});
    const [showSettings, setShowSettings] = useState(false);
    const [editingWork, setEditingWork] = useState('');
    const [tempGoal, setTempGoal] = useState({ targetChars: '', deadline: '' });
    const [customWorks, setCustomWorks] = useState([]);
    const [showAddWork, setShowAddWork] = useState(false);
    const [newWorkName, setNewWorkName] = useState('');

    // Load goals from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('writing_goals');
            if (saved) {
                setGoals(JSON.parse(saved));
            }
            const savedCustom = localStorage.getItem('custom_works');
            if (savedCustom) {
                setCustomWorks(JSON.parse(savedCustom));
            }
        } catch (e) {
            console.error('Failed to load goals:', e);
        }
    }, []);

    // Save goals to localStorage
    const saveGoals = (newGoals) => {
        setGoals(newGoals);
        localStorage.setItem('writing_goals', JSON.stringify(newGoals));
    };

    // Calculate total characters for a work
    const calculateWorkChars = (workName) => {
        if (!workName || !allMaterialFiles) return 0;
        return allMaterialFiles
            .filter(f => f.metadata?.作品 && f.metadata.作品.includes(workName))
            .reduce((total, f) => total + (f.body?.length || 0), 0);
    };

    // Calculate days remaining
    const getDaysRemaining = (deadline) => {
        if (!deadline) return null;
        const today = new Date();
        const deadlineDate = new Date(deadline);
        deadlineDate.setHours(23, 59, 59, 999);
        const diffTime = deadlineDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Handle goal setting
    const handleSetGoal = () => {
        if (!editingWork) return;
        const newGoals = {
            ...goals,
            [editingWork]: {
                targetChars: parseInt(tempGoal.targetChars) || 0,
                deadline: tempGoal.deadline || ''
            }
        };
        saveGoals(newGoals);
        setShowSettings(false);
    };

    // Handle adding a new custom work/goal
    const handleAddWork = () => {
        const name = newWorkName.trim();
        if (!name) return;
        const updated = [...new Set([...customWorks, name])];
        setCustomWorks(updated);
        localStorage.setItem('custom_works', JSON.stringify(updated));
        setSelectedWork(name);
        setShowAddWork(false);
        setNewWorkName('');
        // Auto-open goal settings for the new work
        openSettings(name);
    };

    // Handle deleting a custom work
    const handleDeleteWork = (workName) => {
        const updatedCustom = customWorks.filter(w => w !== workName);
        setCustomWorks(updatedCustom);
        localStorage.setItem('custom_works', JSON.stringify(updatedCustom));
        // Also remove its goal
        const newGoals = { ...goals };
        delete newGoals[workName];
        saveGoals(newGoals);
        // Select first available work
        const remaining = [...allWorks.filter(w => w !== workName), ...updatedCustom];
        setSelectedWork(remaining[0] || '');
    };

    // Open settings for a work
    const openSettings = (workName) => {
        setEditingWork(workName);
        const existing = goals[workName] || { targetChars: '', deadline: '' };
        setTempGoal({
            targetChars: existing.targetChars || '',
            deadline: existing.deadline || ''
        });
        setShowSettings(true);
    };

    // Extract all unique works from files
    const fileWorks = Array.from(new Set(
        allMaterialFiles
            .map(f => f.metadata?.作品)
            .filter(Boolean)
            .flatMap(w => w.split(',').map(s => s.trim()))
            .filter(w => w.length > 0)
    ));

    // Combine file works + custom works (deduplicated)
    const allWorks = Array.from(new Set([...fileWorks, ...customWorks]));

    const [selectedWork, setSelectedWork] = useState(currentWork || (allWorks.length > 0 ? allWorks[0] : ''));

    useEffect(() => {
        if (currentWork) {
            setSelectedWork(currentWork);
        }
    }, [currentWork]);

    const isCustomWork = (workName) => customWorks.includes(workName) && !fileWorks.includes(workName);

    // Render progress for a work
    const renderWorkProgress = (workName) => {
        if (!workName && allWorks.length === 0) {
            return (
                <div className="no-work-selected" style={{ textAlign: 'center', padding: '20px' }}>
                    <p style={{ marginBottom: '12px', opacity: 0.6 }}>プロジェクトがまだありません</p>
                    <button
                        className="set-goal-btn big"
                        onClick={() => setShowAddWork(true)}
                    >
                        + 新規プロジェクト / 目標を追加
                    </button>
                </div>
            );
        }

        const goal = goals[workName] || { targetChars: 0, deadline: '' };
        const currentChars = calculateWorkChars(workName);
        const progress = goal.targetChars > 0 ? (currentChars / goal.targetChars) * 100 : 0;
        const daysRemaining = getDaysRemaining(goal.deadline);

        return (
            <div className="progress-current">
                <div className="progress-header" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <select
                        value={workName}
                        onChange={(e) => setSelectedWork(e.target.value)}
                        className="work-selector"
                        style={{ flex: 1 }}
                    >
                        {allWorks.map(w => (
                            <option key={w} value={w}>{w}{isCustomWork(w) ? ' ★' : ''}</option>
                        ))}
                        {allWorks.length === 0 && <option value="">(作品タグなし)</option>}
                    </select>
                    <button
                        onClick={() => setShowAddWork(true)}
                        style={{
                            padding: '3px 8px',
                            fontSize: '14px',
                            background: 'none',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: 'var(--accent-color)',
                            flexShrink: 0,
                            lineHeight: 1
                        }}
                        title="新規追加"
                    >+</button>
                </div>

                {/* Add Work Input */}
                {showAddWork && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px', alignItems: 'center' }}>
                        <input
                            type="text"
                            value={newWorkName}
                            onChange={e => setNewWorkName(e.target.value)}
                            placeholder="目標名（例: 短編 1000文字）"
                            style={{ flex: 1, fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleAddWork(); if (e.key === 'Escape') setShowAddWork(false); }}
                        />
                        <button onClick={handleAddWork} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>追加</button>
                        <button onClick={() => setShowAddWork(false)} style={{ fontSize: '11px', padding: '4px 8px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'inherit' }}>×</button>
                    </div>
                )}

                {/* Main Progress Card */}
                <div className="goal-card">
                    {goal.targetChars > 0 ? (
                        <>
                            <div className="progress-bar-container">
                                <div
                                    className="progress-bar-fill"
                                    style={{ width: `${Math.min(progress, 100)}% ` }}
                                />
                            </div>
                            <div className="progress-stats-row">
                                <div className="stat-box">
                                    <div className="label">進捗</div>
                                    <div className="value">{Math.round(progress)}%</div>
                                </div>
                                <div className="stat-box">
                                    <div className="label">文字数</div>
                                    <div className="value">{currentChars.toLocaleString()}</div>
                                </div>
                                <div className="stat-box">
                                    <div className="label">残り</div>
                                    <div className={`value ${daysRemaining < 7 ? 'urgent' : ''} `}>
                                        {daysRemaining !== null ? `${daysRemaining} 日` : '-'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    className="edit-goal-btn"
                                    onClick={() => openSettings(workName)}
                                    style={{ flex: 1 }}
                                >
                                    目標を編集
                                </button>
                                {isCustomWork(workName) && (
                                    <button
                                        className="edit-goal-btn"
                                        onClick={() => { if (confirm(`「${workName}」を削除しますか？`)) handleDeleteWork(workName); }}
                                        style={{ color: '#e53935', flex: 0, padding: '4px 10px' }}
                                        title="削除"
                                    >
                                        🗑
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div>
                            <button
                                className="set-goal-btn big"
                                onClick={() => openSettings(workName)}
                            >
                                🎯 目標を設定する
                            </button>
                            {isCustomWork(workName) && (
                                <button
                                    onClick={() => { if (confirm(`「${workName}」を削除しますか？`)) handleDeleteWork(workName); }}
                                    style={{ marginTop: '6px', width: '100%', padding: '4px', fontSize: '11px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: '#e53935', opacity: 0.7 }}
                                >
                                    この項目を削除
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <hr className="divider" />

                {/* Session Component */}
                <WritingSession sessionCharDiff={sessionCharDiff} onResetSession={onResetSession} />

            </div>
        );
    };

    return (
        <div className="progress-tracker">
            {renderWorkProgress(selectedWork)}

            {showSettings && (
                <div className="progress-settings-modal">
                    <div className="modal-content">
                        <h3>{editingWork} の目標設定</h3>
                        <div className="form-group">
                            <label>目標文字数</label>
                            <input
                                type="number"
                                value={tempGoal.targetChars}
                                onChange={(e) => setTempGoal({ ...tempGoal, targetChars: e.target.value })}
                                placeholder="例: 100000"
                            />
                        </div>
                        <div className="form-group">
                            <label>締め切り</label>
                            <input
                                type="date"
                                value={tempGoal.deadline}
                                onChange={(e) => setTempGoal({ ...tempGoal, deadline: e.target.value })}
                            />
                        </div>
                        <div className="modal-actions">
                            <button onClick={handleSetGoal}>保存</button>
                            <button onClick={() => setShowSettings(false)}>キャンセル</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgressTracker;
