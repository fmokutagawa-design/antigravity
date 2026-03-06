export const SCENE_TEMPLATES = [
    {
        type: 'event',
        label: '基本',
        icon: '📝',
        color: '#9E9E9E', // Grey
        defaultTitle: '一般シーン',
        defaultPlot: ''
    },
    {
        type: 'battle',
        label: '戦闘',
        icon: '⚔️',
        color: '#F44336', // Red
        defaultTitle: '戦闘 / アクション',
        defaultPlot: '【敵】\n【状況】\n【結果】'
    },
    {
        type: 'dialogue',
        label: '会話',
        icon: '💬',
        color: '#2196F3', // Blue
        defaultTitle: '重要な会話',
        defaultPlot: '【相手】\n【話題】\n【得られる情報】'
    },
    {
        type: 'movement',
        label: '移動',
        icon: '🚚',
        color: '#4CAF50', // Green
        defaultTitle: '移動 / 旅',
        defaultPlot: '【出発地】\n【目的地】\n【道中の出来事】'
    },
    {
        type: 'love',
        label: '恋愛',
        icon: '❤️',
        color: '#E91E63', // Pink
        defaultTitle: '恋愛 / 絆',
        defaultPlot: '【相手】\n【進展】\n【障害】'
    },
    {
        type: 'mystery',
        label: '謎',
        icon: '🕵️',
        color: '#9C27B0', // Purple
        defaultTitle: '発見 / 謎',
        defaultPlot: '【発見したもの】\n【謎の内容】\n【推測】'
    },
    {
        type: 'training',
        label: '修行',
        icon: '💪',
        color: '#FF9800', // Orange
        defaultTitle: '修行 / 訓練',
        defaultPlot: '【課題】\n【師匠の教え】\n【成長】'
    },
    {
        type: 'rest',
        label: '休息',
        icon: '☕',
        color: '#795548', // Brown
        defaultTitle: '休息 / 幕間',
        defaultPlot: '【場所】\n【雰囲気】\n【回復】'
    }
];
